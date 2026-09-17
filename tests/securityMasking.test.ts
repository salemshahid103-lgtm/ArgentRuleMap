import { describe, expect, it } from 'vitest';
import { maskSecret } from '../src/security/masker.js';
import { detectSecretsInContent, detectInsecureInstructions } from '../src/security/secretDetector.js';

describe('Security Masking and Secret Detection', () => {
  it('masks sensitive API tokens cleanly without revealing full secret', () => {
    const rawKey = 'sk-proj-99887766554433221100aabb';
    const masked = maskSecret(rawKey);

    expect(masked).not.toBe(rawKey);
    expect(masked).toBe('sk-p...aabb');
    expect(masked.length).toBeLessThan(rawKey.length);
  });

  it('redacts short secrets completely', () => {
    expect(maskSecret('secret')).toBe('***REDACTED***');
    expect(maskSecret('')).toBe('[EMPTY]');
  });

  it('detects OpenAI and Google API key patterns in content and masks them', () => {
    const content = `
      Here is my key: sk-proj-123456789012345678901234
      Google key: AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q
    `;

    const findings = detectSecretsInContent(content, 'test-doc.md');
    expect(findings.length).toBeGreaterThanOrEqual(2);

    for (const f of findings) {
      expect(f.maskedSnippet).toContain('...');
      // Ensure the full raw keys are NOT in the masked output
      expect(f.maskedSnippet).not.toBe('sk-proj-123456789012345678901234');
      expect(f.maskedSnippet).not.toBe('AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q');
    }
  });

  it('detects insecure instructions directing agents to commit .env files', () => {
    const content = 'Please commit .env to repo when deploying.';
    const findings = detectInsecureInstructions(content, 'AGENTS.md');

    expect(findings.length).toBe(1);
    expect(findings[0].issue).toContain('.env');
  });
});
