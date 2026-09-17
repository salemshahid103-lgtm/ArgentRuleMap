import type { AnalysisResult } from '../types/index.js';

export function formatJsonReport(result: AnalysisResult, pretty = true): string {
  return JSON.stringify(result, null, pretty ? 2 : undefined);
}
