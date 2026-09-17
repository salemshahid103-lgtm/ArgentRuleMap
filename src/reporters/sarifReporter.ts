import type { Diagnostic, DiagnosticSeverity } from '../types/engine.js';
import { DIAGNOSTIC_REGISTRY } from '../diagnostics/registry.js';
import { normalizePath } from '../utils/pathUtils.js';

export interface SarifArtifactLocation {
  uri: string;
  uriBaseId?: string;
}

export interface SarifRegion {
  startLine: number;
  startColumn?: number;
  endLine?: number;
  endColumn?: number;
}

export interface SarifPhysicalLocation {
  artifactLocation: SarifArtifactLocation;
  region?: SarifRegion;
}

export interface SarifLocation {
  physicalLocation: SarifPhysicalLocation;
}

export type SarifLevel = 'none' | 'note' | 'warning' | 'error';

export interface SarifResult {
  ruleId: string;
  level: SarifLevel;
  message: {
    text: string;
  };
  locations?: SarifLocation[];
}

export interface SarifRule {
  id: string;
  name: string;
  shortDescription: {
    text: string;
  };
  fullDescription: {
    text: string;
  };
  defaultConfiguration: {
    level: SarifLevel;
  };
  help?: {
    text: string;
    markdown?: string;
  };
}

export interface SarifRun {
  tool: {
    driver: {
      name: string;
      semanticVersion: string;
      informationUri: string;
      rules: SarifRule[];
    };
  };
  results: SarifResult[];
  invocations?: Array<{
    executionSuccessful: boolean;
  }>;
}

export interface SarifLog {
  $schema: string;
  version: '2.1.0';
  runs: SarifRun[];
}

/**
 * Predictable severity mapping from AgentRuleMap internal severity to SARIF 2.1.0 levels:
 * - 'error'   -> 'error'
 * - 'warning' -> 'warning'
 * - 'info'    -> 'note'
 */
export function mapSeverityToSarifLevel(severity: DiagnosticSeverity): SarifLevel {
  switch (severity) {
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    case 'info':
    default:
      return 'note';
  }
}

/**
 * Formats a rule name to be PascalCase from rule title or id.
 */
function toPascalCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase())
    .replace(/^[a-z]/, (chr) => chr.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, '');
}

/**
 * Converts internal AgentRuleMap diagnostics into a standard SARIF 2.1.0 log document.
 */
export function generateSarifReport(
  diagnostics: Diagnostic[],
  options: {
    toolName?: string;
    version?: string;
    informationUri?: string;
  } = {}
): SarifLog {
  const toolName = options.toolName || 'AgentRuleMap';
  const version = options.version || '1.0.0';
  const informationUri =
    options.informationUri || 'https://github.com/OWNER/agent-rule-map';

  const rulesMap = new Map<string, SarifRule>();

  // Populate known rules first or dynamically
  for (const diag of diagnostics) {
    if (!rulesMap.has(diag.id)) {
      const def = DIAGNOSTIC_REGISTRY[diag.id];
      if (def) {
        rulesMap.set(diag.id, {
          id: def.id,
          name: toPascalCase(def.title || def.id),
          shortDescription: { text: def.title },
          fullDescription: { text: def.description },
          defaultConfiguration: {
            level: mapSeverityToSarifLevel(def.defaultSeverity),
          },
          help: {
            text: `${def.description}${def.remediation ? `\n\nRemediation: ${def.remediation}` : ''}`,
            markdown: `**${def.title}**\n\n${def.description}${def.remediation ? `\n\n### Remediation\n${def.remediation}` : ''}`,
          },
        });
      } else {
        rulesMap.set(diag.id, {
          id: diag.id,
          name: toPascalCase(diag.title || diag.id),
          shortDescription: { text: diag.title || diag.id },
          fullDescription: { text: diag.message },
          defaultConfiguration: {
            level: mapSeverityToSarifLevel(diag.severity),
          },
          help: {
            text: `${diag.message}${diag.remediation ? `\n\nRemediation: ${diag.remediation}` : ''}`,
          },
        });
      }
    }
  }

  const results: SarifResult[] = diagnostics.map((diag) => {
    const level = mapSeverityToSarifLevel(diag.severity);
    const result: SarifResult = {
      ruleId: diag.id,
      level,
      message: {
        text: diag.message,
      },
    };

    const targetUri = diag.sourcePath || diag.targetPath;
    if (targetUri) {
      const normalizedUri = normalizePath(targetUri);
      const location: SarifLocation = {
        physicalLocation: {
          artifactLocation: {
            uri: normalizedUri,
            uriBaseId: '%SRCROOT%',
          },
        },
      };

      // Only provide line region if line is specifically known and > 0
      if (typeof diag.line === 'number' && diag.line > 0) {
        location.physicalLocation.region = {
          startLine: diag.line,
          ...(typeof diag.column === 'number' && diag.column > 0
            ? { startColumn: diag.column }
            : {}),
        };
      }

      result.locations = [location];
    }

    return result;
  });

  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: toolName,
            semanticVersion: version,
            informationUri,
            rules: Array.from(rulesMap.values()),
          },
        },
        results,
        invocations: [
          {
            executionSuccessful: true,
          },
        ],
      },
    ],
  };
}

export function formatSarifReport(sarifLog: SarifLog, pretty = true): string {
  return JSON.stringify(sarifLog, null, pretty ? 2 : undefined);
}
