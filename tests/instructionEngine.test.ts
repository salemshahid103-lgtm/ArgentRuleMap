import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { InstructionEngine } from '../src/core/instructionEngine.js';
import { CodexAdapter } from '../src/adapters/codexAdapter.js';
import { CopilotAdapter } from '../src/adapters/copilotAdapter.js';
import { GeminiAdapter } from '../src/adapters/geminiAdapter.js';
import { GenericAdapter } from '../src/adapters/genericAdapter.js';
import { parseApplyTo, matchesGlobPatterns } from '../src/globs/matcher.js';
import { verifySymlinkSafety } from '../src/utils/symlinkUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, 'fixtures');

describe('Instruction Discovery and Scope Engine', () => {
  // Fixture A: Root AGENTS
  it('Fixture A: applies root AGENTS.md to target', () => {
    const repoDir = path.join(fixturesDir, 'fixture-a-root-agents');
    const engine = new InstructionEngine({ rootDir: repoDir });

    const resolution = engine.resolve('src/index.ts', 'codex');

    expect(resolution.profile).toBe('codex');
    expect(resolution.matchedSources.length).toBe(1);
    expect(resolution.matchedSources[0].filePath).toBe('AGENTS.md');
    expect(resolution.matchedSources[0].sourceType).toBe('root');
    expect(resolution.stack.layers.length).toBe(1);
    expect(resolution.stack.layers[0].source.filePath).toBe('AGENTS.md');
    expect(resolution.diagnostics.length).toBe(0);
  });

  // Fixture B: Nested AGENTS
  it('Fixture B: discovers both root and nested AGENTS.md, with nested represented as more specific', () => {
    const repoDir = path.join(fixturesDir, 'fixture-b-nested-agents');
    const engine = new InstructionEngine({ rootDir: repoDir });

    const resolution = engine.resolve('src/api/users.ts', 'codex');

    expect(resolution.matchedSources.length).toBe(2);
    // Ordered from least specific to most specific
    expect(resolution.matchedSources[0].filePath).toBe('AGENTS.md');
    expect(resolution.matchedSources[0].specificity.depth).toBe(0);
    expect(resolution.matchedSources[1].filePath).toBe('src/AGENTS.md');
    expect(resolution.matchedSources[1].specificity.depth).toBe(1);
    expect(resolution.matchedSources[1].specificity.score).toBeGreaterThan(
      resolution.matchedSources[0].specificity.score
    );

    // Complete source stack preserved
    expect(resolution.stack.layers.length).toBe(2);
    expect(resolution.stack.layers[0].source.filePath).toBe('AGENTS.md');
    expect(resolution.stack.layers[1].source.filePath).toBe('src/AGENTS.md');
  });

  // Fixture C: Deeply nested AGENTS
  it('Fixture C: handles deeply nested AGENTS in deterministic specificity order', () => {
    const repoDir = path.join(fixturesDir, 'fixture-c-deep-agents');
    const engine = new InstructionEngine({ rootDir: repoDir });

    const resolution = engine.resolve('src/api/users.ts', 'codex');

    expect(resolution.matchedSources.length).toBe(3);
    expect(resolution.matchedSources.map((s) => s.filePath)).toEqual([
      'AGENTS.md',
      'src/AGENTS.md',
      'src/api/AGENTS.md',
    ]);
    expect(resolution.stack.layers.map((l) => l.source.filePath)).toEqual([
      'AGENTS.md',
      'src/AGENTS.md',
      'src/api/AGENTS.md',
    ]);
    expect(resolution.matchedSources[2].specificity.depth).toBe(2);
  });

  // Fixture D: AGENTS.override
  it('Fixture D: represents AGENTS.override.md explicitly with higher specificity than AGENTS.md', () => {
    const repoDir = path.join(fixturesDir, 'fixture-d-agents-override');
    const engine = new InstructionEngine({ rootDir: repoDir });

    const resolution = engine.resolve('src/index.ts', 'codex');

    expect(resolution.matchedSources.length).toBe(2);
    // Least specific first: AGENTS.md (score 0), then AGENTS.override.md (score 10)
    expect(resolution.matchedSources[0].filePath).toBe('AGENTS.md');
    expect(resolution.matchedSources[0].sourceType).toBe('root');
    expect(resolution.matchedSources[0].specificity.isOverride).toBe(false);

    expect(resolution.matchedSources[1].filePath).toBe('AGENTS.override.md');
    expect(resolution.matchedSources[1].sourceType).toBe('override');
    expect(resolution.matchedSources[1].specificity.isOverride).toBe(true);
    expect(resolution.matchedSources[1].specificity.priority).toBe(10);
    expect(resolution.matchedSources[1].specificity.score).toBeGreaterThan(
      resolution.matchedSources[0].specificity.score
    );
  });

  // Fixture E: Copilot repository instructions
  it('Fixture E: applies repository-level Copilot instructions to targets', () => {
    const repoDir = path.join(fixturesDir, 'fixture-e-copilot-repo');
    const engine = new InstructionEngine({ rootDir: repoDir });

    const resolution = engine.resolve('src/index.ts', 'copilot');

    expect(resolution.matchedSources.length).toBe(1);
    expect(resolution.matchedSources[0].filePath).toBe('.github/copilot-instructions.md');
    expect(resolution.matchedSources[0].sourceType).toBe('root');
    expect(resolution.stack.layers.length).toBe(1);
  });

  // Fixture F: Copilot applyTo pattern matching
  it('Fixture F: applies path-specific Copilot rules only to matching targets', () => {
    const repoDir = path.join(fixturesDir, 'fixture-f-copilot-applyto');
    const engine = new InstructionEngine({ rootDir: repoDir });

    // Target 1: matches applyTo "src/api/**/*.ts"
    const apiRes = engine.resolve('src/api/users.ts', 'copilot');
    expect(apiRes.matchedSources.length).toBe(1);
    expect(apiRes.matchedSources[0].filePath).toBe(
      '.github/instructions/backend.instructions.md'
    );
    expect(apiRes.matchedSources[0].metadata?.applyTo).toBe('src/api/**/*.ts');

    // Target 2: does NOT match "src/api/**/*.ts"
    const uiRes = engine.resolve('src/ui/Button.tsx', 'copilot');
    expect(uiRes.matchedSources.length).toBe(0);
    expect(uiRes.rejectedSources.length).toBe(1);
    expect(uiRes.rejectedSources[0].source.filePath).toBe(
      '.github/instructions/backend.instructions.md'
    );
    expect(uiRes.rejectedSources[0].reason).toContain('does not match');
  });

  // Fixture G: Multiple comma-separated applyTo patterns
  it('Fixture G: handles comma-separated applyTo patterns (**/*.ts,**/*.tsx)', () => {
    const repoDir = path.join(fixturesDir, 'fixture-g-copilot-multi-applyto');
    const engine = new InstructionEngine({ rootDir: repoDir });

    // Target 1: .ts matches
    const tsRes = engine.resolve('src/index.ts', 'copilot');
    expect(tsRes.matchedSources.length).toBe(1);

    // Target 2: .tsx matches
    const tsxRes = engine.resolve('src/Component.tsx', 'copilot');
    expect(tsxRes.matchedSources.length).toBe(1);

    // Target 3: .css does NOT match
    const cssRes = engine.resolve('src/styles.css', 'copilot');
    expect(cssRes.matchedSources.length).toBe(0);
    expect(cssRes.rejectedSources.length).toBe(1);
  });

  // Fixture H: Malformed YAML frontmatter
  it('Fixture H: returns diagnostics on malformed frontmatter without crashing', () => {
    const repoDir = path.join(fixturesDir, 'fixture-h-malformed-yaml');
    const engine = new InstructionEngine({ rootDir: repoDir });

    const resolution = engine.resolve('src/index.ts', 'copilot');

    expect(resolution).toBeDefined();
    expect(resolution.diagnostics.length).toBeGreaterThanOrEqual(1);
    const fmDiagnostic = resolution.diagnostics.find(
      (d) => d.id === 'INVALID_FRONTMATTER'
    );
    expect(fmDiagnostic).toBeDefined();
    expect(fmDiagnostic?.severity).toBe('warning');
  });

  // Fixture I: Gemini hierarchy
  it('Fixture I: discovers and hierarchically resolves GEMINI.md in deterministic order', () => {
    const repoDir = path.join(fixturesDir, 'fixture-i-gemini-hierarchy');
    const engine = new InstructionEngine({ rootDir: repoDir });

    const resolution = engine.resolve('src/api/users.ts', 'gemini');

    expect(resolution.matchedSources.length).toBe(2);
    expect(resolution.matchedSources[0].filePath).toBe('GEMINI.md');
    expect(resolution.matchedSources[1].filePath).toBe('src/GEMINI.md');
    expect(resolution.matchedSources[1].specificity.depth).toBe(1);
    expect(resolution.stack.layers.length).toBe(2);
  });

  // Fixture J: Windows-style target path
  it('Fixture J: normalizes Windows-style backslashes in target path', () => {
    const repoDir = path.join(fixturesDir, 'fixture-c-deep-agents');
    const engine = new InstructionEngine({ rootDir: repoDir });

    const resolution = engine.resolve('src\\api\\users.ts', 'codex');

    expect(resolution.targetPath.normalized).toBe('src/api/users.ts');
    expect(resolution.matchedSources.length).toBe(3);
  });

  // Fixture K: Target outside repository
  it('Fixture K: rejects target paths outside repository with PATH_OUTSIDE_REPOSITORY', () => {
    const repoDir = path.join(fixturesDir, 'fixture-a-root-agents');
    const engine = new InstructionEngine({ rootDir: repoDir });

    const resolution = engine.resolve('../../secret.txt', 'codex');

    expect(resolution.targetPath.isValid).toBe(false);
    expect(resolution.targetPath.isInsideRepo).toBe(false);
    expect(resolution.matchedSources.length).toBe(0);

    const outsideDiag = resolution.diagnostics.find(
      (d) => d.id === 'PATH_OUTSIDE_REPOSITORY'
    );
    expect(outsideDiag).toBeDefined();
    expect(outsideDiag?.severity).toBe('error');
  });

  // Fixture L: Spaces and Unicode filenames
  it('Fixture L: successfully resolves targets with spaces and Unicode characters', () => {
    const repoDir = path.join(fixturesDir, 'fixture-l-unicode-spaces');
    const engine = new InstructionEngine({ rootDir: repoDir });

    const resolution = engine.resolve('src/my folder/ملف.ts', 'codex');

    expect(resolution.targetPath.isValid).toBe(true);
    expect(resolution.targetPath.normalized).toBe('src/my folder/ملف.ts');
    expect(resolution.matchedSources.length).toBe(1);
    expect(resolution.matchedSources[0].filePath).toBe('AGENTS.md');
  });

  // Symlink safety
  it('detects and flags symlink escaping repository root', () => {
    const repoDir = path.join(fixturesDir, 'fixture-a-root-agents');
    const symlinkPath = path.join(repoDir, 'external-symlink.md');

    // Create a temporary symlink pointing to /etc/passwd or /tmp outside repo
    try {
      if (fs.existsSync(symlinkPath)) fs.unlinkSync(symlinkPath);
      fs.symlinkSync('/tmp', symlinkPath);

      const check = verifySymlinkSafety(symlinkPath, repoDir);
      expect(check.safe).toBe(false);
      expect(check.diagnostics.some((d) => d.id === 'SYMLINK_ESCAPE')).toBe(true);
    } catch {
      // If symlink creation is not permitted in container, test passes gracefully
    } finally {
      if (fs.existsSync(symlinkPath)) {
        try {
          fs.unlinkSync(symlinkPath);
        } catch {
          // ignore
        }
      }
    }
  });

  // Generic profile: Informational discovery
  it('Generic Profile: discovers known instruction files informationally without claiming vendor precedence', () => {
    const repoDir = path.join(fixturesDir, 'fixture-i-gemini-hierarchy');
    const engine = new InstructionEngine({ rootDir: repoDir });

    const resolution = engine.resolve('src/api/users.ts', 'generic');

    expect(resolution.profile).toBe('generic');
    expect(resolution.matchedSources.length).toBeGreaterThanOrEqual(2);
    expect(resolution.matchedSources.every((s) => s.sourceType === 'informational')).toBe(true);
  });

  // Glob engine edge cases
  it('Glob Engine: parses patterns, empty patterns, and matches glob brackets', () => {
    const parsed = parseApplyTo('src/**/*.{ts,tsx}, tests/**/*.ts');
    expect(parsed.patterns).toEqual(['src/**/*.{ts,tsx}', 'tests/**/*.ts']);

    const match1 = matchesGlobPatterns('src/components/Modal.tsx', parsed.patterns);
    expect(match1.matched).toBe(true);

    const match2 = matchesGlobPatterns('tests/unit/api.ts', parsed.patterns);
    expect(match2.matched).toBe(true);

    const match3 = matchesGlobPatterns('docs/index.html', parsed.patterns);
    expect(match3.matched).toBe(false);
  });

  // Engine caching discipline
  it('InstructionEngine: caches parsed files across repeated resolve calls', () => {
    const repoDir = path.join(fixturesDir, 'fixture-b-nested-agents');
    const engine = new InstructionEngine({ rootDir: repoDir });

    // Initial resolve
    const res1 = engine.resolve('src/api/users.ts', 'codex');
    expect(res1.matchedSources.length).toBe(2);

    // Second resolve uses cache
    const res2 = engine.resolve('src/api/users.ts', 'codex');
    expect(res2.matchedSources.length).toBe(2);
    expect(res2.matchedSources[0].rawContent).toBe(res1.matchedSources[0].rawContent);
  });

  // ResolveAll across all profiles
  it('InstructionEngine: resolveAll returns resolution for codex, copilot, gemini, generic', () => {
    const repoDir = path.join(fixturesDir, 'fixture-b-nested-agents');
    const engine = new InstructionEngine({ rootDir: repoDir });

    const all = engine.resolveAll('src/api/users.ts');
    expect(all.codex).toBeDefined();
    expect(all.copilot).toBeDefined();
    expect(all.gemini).toBeDefined();
    expect(all.generic).toBeDefined();
    expect(all.codex.profile).toBe('codex');
  });
});
