import type {
  InstructionProfileId,
  InstructionSource,
  InstructionResolution,
  TargetPath,
  DiscoveryOptions,
  ResolutionOptions,
} from '../types/engine.js';
import type { InstructionContentCache } from '../scanners/instructionFileScanner.js';

export interface InstructionProfileAdapter {
  readonly id: InstructionProfileId;
  readonly name: string;
  readonly description: string;
  readonly supportedFiles: string[];

  discover(
    rootDir: string,
    options?: DiscoveryOptions,
    cache?: InstructionContentCache
  ): Promise<InstructionSource[]> | InstructionSource[];

  resolveForTarget(
    target: TargetPath,
    sources: InstructionSource[],
    options?: ResolutionOptions
  ): Promise<InstructionResolution> | InstructionResolution;
}
