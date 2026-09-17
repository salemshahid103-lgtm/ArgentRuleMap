import type {
  InstructionProfileAdapter,
} from './types.js';
import type {
  InstructionProfileId,
  InstructionProfile,
} from '../types/engine.js';
import { CodexAdapter } from './codexAdapter.js';
import { CopilotAdapter } from './copilotAdapter.js';
import { GeminiAdapter } from './geminiAdapter.js';
import { GenericAdapter } from './genericAdapter.js';

export class AdapterRegistry {
  private adapters = new Map<InstructionProfileId, InstructionProfileAdapter>();

  constructor() {
    this.register(new CodexAdapter());
    this.register(new CopilotAdapter());
    this.register(new GeminiAdapter());
    this.register(new GenericAdapter());
  }

  register(adapter: InstructionProfileAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  get(id: InstructionProfileId): InstructionProfileAdapter {
    const adapter = this.adapters.get(id);
    if (!adapter) {
      throw new Error(`Unsupported instruction profile adapter: "${id}"`);
    }
    return adapter;
  }

  has(id: string): id is InstructionProfileId {
    return this.adapters.has(id as InstructionProfileId);
  }

  getAll(): InstructionProfileAdapter[] {
    return Array.from(this.adapters.values());
  }

  getProfiles(): InstructionProfile[] {
    return this.getAll().map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      supportedFiles: a.supportedFiles,
    }));
  }
}

export const defaultAdapterRegistry = new AdapterRegistry();
