import { maskSecret } from './masker.js';

export interface SecretFinding {
  type: string;
  source: string;
  maskedSnippet: string;
  line?: number;
}

export interface InsecureInstructionFinding {
  source: string;
  issue: string;
  snippet: string;
}

const SECRET_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  {
    name: 'OpenAI API Key',
    pattern: /\bsk-[A-Za-z0-9_\-]{20,}\b/g,
  },
  {
    name: 'Google API Key',
    pattern: /\bAIza[0-9A-Za-z\-_]{35}\b/g,
  },
  {
    name: 'GitHub Personal Access Token',
    pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36}\b/g,
  },
  {
    name: 'GitHub Fine-Grained Token',
    pattern: /\bgithub_pat_[A-Za-z0-9_]{22,}\b/g,
  },
  {
    name: 'AWS Access Key ID',
    pattern: /\b(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b/g,
  },
  {
    name: 'Generic API Key Assignment',
    pattern: /(?:api[_-]?key|secret[_-]?key|access[_-]?token|private[_-]?key)\s*[:=]\s*['"]([A-Za-z0-9_\-+/=]{16,})['"]/gi,
  },
];

const INSECURE_INSTRUCTION_PATTERNS: Array<{ description: string; pattern: RegExp }> = [
  {
    description: 'Instructs agent to commit .env files',
    pattern: /(?:commit|push|add)\s+(?:\.env|\.env\.local|secrets|keys)/i,
  },
  {
    description: 'Instructs agent to bypass security or validation checks',
    pattern: /(?:disable|bypass|skip|ignore)\s+(?:security|secret-scanner|auth-check|credential-check)/i,
  },
  {
    description: 'Instructs agent to hardcode or print secret tokens directly',
    pattern: /(?:print|log|echo|output|hardcode)\s+(?:api[_-]?key|password|secret|token)/i,
  },
];

/**
 * Detects real secrets in file contents and returns masked findings.
 * Guaranteed never to expose actual secret characters.
 */
export function detectSecretsInContent(content: string, sourcePath: string): SecretFinding[] {
  const findings: SecretFinding[] = [];
  const lines = content.split('\n');

  lines.forEach((line, lineIndex) => {
    // Avoid false positives for placeholders like "MY_GEMINI_API_KEY", "your-api-key-here", etc.
    const isPlaceholder =
      line.includes('YOUR_') ||
      line.includes('<your-') ||
      line.includes('MY_API_KEY') ||
      line.includes('PLACEHOLDER') ||
      line.includes('example') ||
      line.includes('process.env.') ||
      line.includes('import.meta.env.');

    if (isPlaceholder) {
      return;
    }

    for (const { name, pattern } of SECRET_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(line)) !== null) {
        const fullMatch = match[1] || match[0];
        // Ensure not a typical placeholder
        if (fullMatch.length >= 16 && !fullMatch.toUpperCase().includes('EXAMPLE')) {
          findings.push({
            type: name,
            source: sourcePath,
            maskedSnippet: maskSecret(fullMatch),
            line: lineIndex + 1,
          });
        }
      }
    }
  });

  return findings;
}

/**
 * Detects dangerous instructions in agent instruction files.
 */
export function detectInsecureInstructions(content: string, sourcePath: string): InsecureInstructionFinding[] {
  const findings: InsecureInstructionFinding[] = [];
  const lines = content.split('\n');

  lines.forEach((line) => {
    for (const { description, pattern } of INSECURE_INSTRUCTION_PATTERNS) {
      if (pattern.test(line)) {
        findings.push({
          source: sourcePath,
          issue: description,
          snippet: line.trim().slice(0, 100),
        });
      }
    }
  });

  return findings;
}
