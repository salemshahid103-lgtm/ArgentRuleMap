import picomatch from 'picomatch';
import type { Diagnostic } from '../types/engine.js';
import { normalizePath } from '../utils/pathUtils.js';

export interface GlobParseResult {
  rawApplyTo?: string;
  patterns: string[];
  diagnostics: Diagnostic[];
}

export interface GlobMatchResult {
  matched: boolean;
  matchedPattern?: string;
  evaluatedPatterns: string[];
  normalizedTarget: string;
}

/**
 * Parses an `applyTo` field (string, comma-separated string, or array of strings)
 * into a list of normalized glob patterns.
 *
 * Supported pattern syntax:
 * - Standard wildcards: `*` (single directory component), `**` (recursive directory components)
 * - Brace expansion: `**\/*.{ts,tsx}`
 * - Path prefixes: `src/**\/*.ts`, `tests/**`
 * - Exact paths: `src/index.ts`
 * - Comma-separated lists in string: `"**\/*.ts,**\/*.tsx"`
 */
// Splits comma-separated patterns, respecting braces and brackets
// so that patterns like src/**/*.{ts,tsx} are not split inside braces.
export function splitTopLevelCommas(input: string): string[] {
  const parts: string[] = [];
  let current = '';
  let braceDepth = 0;
  let bracketDepth = 0;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '{') {
      braceDepth++;
      current += char;
    } else if (char === '}') {
      if (braceDepth > 0) braceDepth--;
      current += char;
    } else if (char === '[') {
      bracketDepth++;
      current += char;
    } else if (char === ']') {
      if (bracketDepth > 0) bracketDepth--;
      current += char;
    } else if (char === ',' && braceDepth === 0 && bracketDepth === 0) {
      if (current.trim()) {
        parts.push(current.trim());
      }
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

export function validateGlob(pattern: string): string | null {
  let brace = 0;
  let bracket = 0;
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === '{') brace++;
    else if (pattern[i] === '}') {
      if (brace > 0) brace--;
      else return 'Unmatched closing brace "}"';
    } else if (pattern[i] === '[') bracket++;
    else if (pattern[i] === ']') {
      if (bracket > 0) bracket--;
      else return 'Unmatched closing bracket "]"';
    }
  }
  if (brace > 0) return 'Unclosed brace "{" in glob pattern';
  if (bracket > 0) return 'Unclosed bracket "[" in glob pattern';

  try {
    picomatch.makeRe(pattern);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

export function parseApplyTo(
  rawApplyTo: unknown,
  sourcePath?: string
): GlobParseResult {
  const diagnostics: Diagnostic[] = [];

  if (rawApplyTo === undefined || rawApplyTo === null) {
    return {
      rawApplyTo: undefined,
      patterns: ['**/*'], // Default when not specified in general instruction files
      diagnostics,
    };
  }

  const rawString = typeof rawApplyTo === 'string' ? rawApplyTo : String(rawApplyTo);

  if (typeof rawApplyTo !== 'string' && !Array.isArray(rawApplyTo)) {
    diagnostics.push({
      id: 'INVALID_APPLY_TO',
      severity: 'warning',
      message: `Expected applyTo to be a glob string or array of strings, received ${typeof rawApplyTo}`,
      sourcePath,
      details: { rawApplyTo },
    });
    return {
      rawApplyTo: rawString,
      patterns: [],
      diagnostics,
    };
  }

  const patterns: string[] = [];

  const addAndValidatePattern = (p: string) => {
    const normalized = normalizePath(p);
    const globError = validateGlob(normalized);
    if (globError) {
      diagnostics.push({
        id: 'INVALID_GLOB',
        severity: 'error',
        message: `Invalid glob pattern "${p}": ${globError}`,
        sourcePath,
        details: { pattern: p, error: globError },
      });
    } else {
      patterns.push(normalized);
    }
  };

  if (Array.isArray(rawApplyTo)) {
    for (const item of rawApplyTo) {
      if (typeof item !== 'string' || item.trim() === '') {
        diagnostics.push({
          id: 'INVALID_APPLY_TO',
          severity: 'warning',
          message: `Array applyTo item is not a valid string: ${JSON.stringify(item)}`,
          sourcePath,
        });
        continue;
      }
      addAndValidatePattern(item);
    }
  } else {
    // String: check for comma-separated patterns, respecting brace expansions
    // e.g. "**/*.ts,**/*.tsx" or "src/**/*.{ts,tsx}, tests/**/*.ts"
    const split = splitTopLevelCommas(rawApplyTo);
    if (split.length === 0) {
      diagnostics.push({
        id: 'INVALID_APPLY_TO',
        severity: 'warning',
        message: 'Empty applyTo pattern provided',
        sourcePath,
        details: { rawApplyTo },
      });
    } else {
      for (const p of split) {
        addAndValidatePattern(p);
      }
    }
  }

  return {
    rawApplyTo: rawString,
    patterns,
    diagnostics,
  };
}

/**
 * Evaluates whether a normalized target path matches any of the supplied glob patterns.
 * Supports leading ./ removal, POSIX normalization, and directory matching.
 */
export function matchesGlobPatterns(
  targetPath: string,
  patterns: string[]
): GlobMatchResult {
  const normalizedTarget = normalizePath(targetPath);

  if (patterns.length === 0) {
    return {
      matched: false,
      evaluatedPatterns: patterns,
      normalizedTarget,
    };
  }

  for (const pattern of patterns) {
    try {
      const isMatch = picomatch(pattern, { dot: true });
      if (isMatch(normalizedTarget)) {
        return {
          matched: true,
          matchedPattern: pattern,
          evaluatedPatterns: patterns,
          normalizedTarget,
        };
      }
    } catch {
      // Ignore invalid regex compile and continue
    }
  }

  return {
    matched: false,
    evaluatedPatterns: patterns,
    normalizedTarget,
  };
}
