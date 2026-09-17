import { describe, it, expect } from 'vitest';
import {
  generateSarifReport,
  formatSarifReport,
  mapSeverityToSarifLevel,
} from '../src/reporters/sarifReporter.js';
import type { Diagnostic } from '../src/diagnostics/types.js';

describe('SARIF 2.1.0 Reporter', () => {
  it('maps severities predictably to SARIF levels', () => {
    expect(mapSeverityToSarifLevel('error')).toBe('error');
    expect(mapSeverityToSarifLevel('warning')).toBe('warning');
    expect(mapSeverityToSarifLevel('info')).toBe('note');
  });

  it('generates valid SARIF structure for empty diagnostics', () => {
    const sarif = generateSarifReport([]);

    expect(sarif.version).toBe('2.1.0');
    expect(sarif.$schema).toBe('https://json.schemastore.org/sarif-2.1.0.json');
    expect(sarif.runs).toHaveLength(1);
    expect(sarif.runs[0].tool.driver.name).toBe('AgentRuleMap');
    expect(sarif.runs[0].tool.driver.semanticVersion).toBe('1.0.0');
    expect(sarif.runs[0].tool.driver.informationUri).toContain('agent-rule-map');
    expect(sarif.runs[0].tool.driver.rules).toEqual([]);
    expect(sarif.runs[0].results).toEqual([]);
  });

  it('generates SARIF for known and ad-hoc rules with correct definitions and results', () => {
    const diagnostics: Diagnostic[] = [
      {
        id: 'ARM001_INVALID_FRONTMATTER',
        severity: 'error',
        title: 'Invalid YAML Frontmatter',
        message: 'Syntax error on line 3: unexpected colon',
        sourcePath: '.github/copilot-instructions.md',
        line: 3,
        column: 5,
        remediation: 'Verify YAML frontmatter syntax.',
      },
      {
        id: 'ARM006_STALE_TARGET_PATH',
        severity: 'warning',
        title: 'Stale Target Path',
        message: 'Scoped target path "src/legacy/" does not exist.',
        sourcePath: 'AGENTS.md',
        remediation: 'Update path.',
      },
    ];

    const sarif = generateSarifReport(diagnostics);

    expect(sarif.runs[0].tool.driver.rules).toHaveLength(2);
    const rule1 = sarif.runs[0].tool.driver.rules.find((r) => r.id === 'ARM001_INVALID_FRONTMATTER');
    expect(rule1).toBeDefined();
    expect(rule1?.defaultConfiguration.level).toBe('warning');
    expect(rule1?.shortDescription.text).toBe('Invalid YAML Frontmatter');
    expect(rule1?.help?.text).toContain('Remediation:');

    expect(sarif.runs[0].results).toHaveLength(2);

    // First result: line & column known -> region populated
    const res1 = sarif.runs[0].results[0];
    expect(res1.ruleId).toBe('ARM001_INVALID_FRONTMATTER');
    expect(res1.level).toBe('error');
    expect(res1.locations).toBeDefined();
    expect(res1.locations?.[0].physicalLocation.artifactLocation.uri).toBe(
      '.github/copilot-instructions.md'
    );
    expect(res1.locations?.[0].physicalLocation.region).toEqual({
      startLine: 3,
      startColumn: 5,
    });

    // Second result: line NOT known -> region must be omitted per SARIF 2.1.0 §3.29.4
    const res2 = sarif.runs[0].results[1];
    expect(res2.ruleId).toBe('ARM006_STALE_TARGET_PATH');
    expect(res2.level).toBe('warning');
    expect(res2.locations?.[0].physicalLocation.artifactLocation.uri).toBe('AGENTS.md');
    expect(res2.locations?.[0].physicalLocation.region).toBeUndefined();
  });

  it('safely handles Unicode paths, spaces, and formats valid JSON', () => {
    const diagnostics: Diagnostic[] = [
      {
        id: 'ARM002_EMPTY_INSTRUCTION_FILE',
        severity: 'warning',
        title: 'Empty Instruction File',
        message: 'Empty file found',
        sourcePath: 'docs/guide for 🚀 agents/instructions.md',
      },
    ];

    const sarif = generateSarifReport(diagnostics);
    const jsonString = formatSarifReport(sarif);

    expect(() => JSON.parse(jsonString)).not.toThrow();
    const parsed = JSON.parse(jsonString);
    expect(parsed.runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri).toBe(
      'docs/guide for 🚀 agents/instructions.md'
    );
  });
});
