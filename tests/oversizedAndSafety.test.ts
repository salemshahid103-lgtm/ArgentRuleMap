import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { readInstructionFileCached } from '../src/scanners/instructionFileScanner.js';
import { InstructionEngine } from '../src/core/instructionEngine.js';
import { ConflictEngine } from '../src/diagnostics/conflictEngine.js';
import { generateSarifReport } from '../src/reporters/sarifReporter.js';

describe('Oversized Files and Safety Defenses', () => {
  let tempRepo: string;

  beforeEach(() => {
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'arm-safety-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempRepo, { recursive: true, force: true });
  });

  it('safely limits and reports oversized instruction files without crashing', () => {
    const filePath = path.join(tempRepo, 'AGENTS.md');
    // Write 500 bytes
    fs.writeFileSync(filePath, '# AGENTS\n' + 'A'.repeat(500));

    // Test with a tight limit of 200 bytes
    const result = readInstructionFileCached(filePath, tempRepo, undefined, 200);

    expect(result.parsingState).toBe('warning');
    expect(result.rawContent).toBe('');
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].id).toBe('ARM020_OVERSIZED_INSTRUCTION_FILE');
    expect(result.diagnostics[0].severity).toBe('warning');
    expect(result.diagnostics[0].message).toContain('exceeds the maximum allowed size limit');
  });

  it('integrates oversized diagnostic into conflict engine and SARIF reporting', () => {
    const filePath = path.join(tempRepo, 'AGENTS.md');
    fs.writeFileSync(filePath, '# AGENTS\n' + 'B'.repeat(300));

    const engine = new InstructionEngine({ rootDir: tempRepo });
    // Run conflicts
    const conflictEngine = new ConflictEngine(engine);
    const report = conflictEngine.runConflicts();

    expect(report.deterministicModeNotice).toBeDefined();

    // SARIF serialization of the report
    const sarif = generateSarifReport(report.diagnostics);
    expect(sarif.version).toBe('2.1.0');
    expect(sarif.runs[0].tool.driver.name).toBe('AgentRuleMap');
  });

  it('safely normalizes and handles path traversal attempts in SARIF generation', () => {
    const diagnostics = [
      {
        id: 'ARM006_STALE_TARGET_PATH',
        severity: 'warning' as const,
        title: 'Stale Target Path',
        message: 'Target path does not exist',
        sourcePath: '../../etc/passwd',
      },
    ];

    const sarif = generateSarifReport(diagnostics);
    expect(sarif.runs[0].results[0].locations).toBeDefined();
    // Normalized path
    expect(sarif.runs[0].results[0].locations?.[0].physicalLocation.artifactLocation.uri).toBe(
      '../../etc/passwd'
    );
  });
});
