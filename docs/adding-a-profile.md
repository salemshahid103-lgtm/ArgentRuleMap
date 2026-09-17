# Adding an Instruction Profile Adapter

This guide explains how to implement a new instruction profile adapter in AgentRuleMap to model a specific AI coding-agent tool or standard.

---

## The `ProfileAdapter` Interface

Every profile in AgentRuleMap implements the `ProfileAdapter` interface defined in `src/types/engine.ts`:

```typescript
export interface ProfileAdapter {
  id: InstructionProfileId;
  name: string;
  description: string;
  supportedFiles: string[];

  /**
   * Discovers all instruction sources for this profile in the repository root.
   */
  discover(
    rootDir: string,
    options?: DiscoveryOptions,
    cache?: RepositoryCache
  ): InstructionSource[];

  /**
   * Resolves the applicable instruction stack for a specific target path.
   */
  resolve(
    targetPath: string,
    rootDir: string,
    sources: InstructionSource[],
    options?: ResolutionOptions
  ): InstructionResolution;

  /**
   * Computes the mathematical specificity score for an instruction source.
   */
  computeSpecificity(source: InstructionSource): Specificity;
}
```

---

## Step-by-Step Implementation

### Step 1: Declare the Profile ID
Open `src/types/engine.ts` and add your profile identifier:
```typescript
export type InstructionProfileId = 'codex' | 'copilot' | 'gemini' | 'generic' | 'your-profile';
```

### Step 2: Implement the Adapter Class
Create `src/adapters/yourProfileAdapter.ts`:
```typescript
import { BaseProfileAdapter } from './baseAdapter.js';
import type { InstructionSource, Specificity, InstructionResolution } from '../types/engine.js';

export class YourProfileAdapter extends BaseProfileAdapter {
  readonly id = 'your-profile';
  readonly name = 'Your Agent Profile';
  readonly description = 'Instruction adapter for Your Agent specification';
  readonly supportedFiles = ['.youragentrules', 'YOURAGENT.md'];

  discover(rootDir: string, options?: any, cache?: any): InstructionSource[] {
    // 1. Scan filesystem safely for supported instruction files
    // 2. Parse file content and any metadata
    // 3. Return array of normalized InstructionSource records
  }

  resolve(
    targetPath: string,
    rootDir: string,
    sources: InstructionSource[],
    options?: any
  ): InstructionResolution {
    // 1. Filter sources whose scope matches targetPath
    // 2. Sort matched sources by specificity score
    // 3. Construct the layered InstructionStack
    // 4. Return resolution object
  }

  computeSpecificity(source: InstructionSource): Specificity {
    // Return depth, priority, and scalar score
  }
}
```

### Step 3: Register in Adapter Registry
Open `src/adapters/registry.ts` and register the adapter instance:
```typescript
import { YourProfileAdapter } from './yourProfileAdapter.js';

// In AdapterRegistry constructor:
this.register(new YourProfileAdapter());
```

### Step 4: Add Automated Unit Tests
Create `tests/adapters/yourProfileAdapter.test.ts`:
- Test root instruction discovery.
- Test directory nesting or glob matching.
- Test specificity calculation and precedence ordering.
- Test boundary checks and error states.

### Step 5: Document the Profile
Create `docs/profiles/your-profile.md` explaining:
- Supported instruction files and discovery paths.
- Scoping rules and precedence calculations.
- Limitations and known vendor nuances.
