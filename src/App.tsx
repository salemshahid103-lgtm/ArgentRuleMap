import { useState } from 'react';
import { Terminal, Shield, FileText, CheckCircle, AlertTriangle, Play, Copy, Check, GitCommit } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'changed' | 'conflicts' | 'coverage' | 'resolve' | 'check' | 'json' | 'init' | 'fix'>('changed');
  const [resolveProfile, setResolveProfile] = useState<'codex' | 'copilot' | 'gemini'>('codex');
  const [copied, setCopied] = useState(false);

  const resolveOutputs = {
    codex: `AgentRuleMap Instruction Scope Resolution
Repository: /app/workspace
Profile:    codex (Codex / Autonomous Coding Agent Profile)
Target:     src/api/users.ts -> [src/api/users.ts]

Matched Instruction Stack (2 layer(s)):
  (Ordered deterministically: least specific -> most specific)

  Layer 1: AGENTS.md
    • Specificity score: 0 (depth: 0)
    • Scope root:        /
    • Reason:            Repository-level baseline instruction

  Layer 2: src/AGENTS.md
    • Specificity score: 100 (depth: 1)
    • Scope root:        src
    • Reason:            Hierarchical directory-level instruction applying to "src"

Non-applicable / Rejected Candidates (1):
  - tests/AGENTS.md: Scope root "tests" is not an ancestor directory of target directory "src/api"`,
    copilot: `AgentRuleMap Instruction Scope Resolution
Repository: /app/workspace
Profile:    copilot (GitHub Copilot Profile)
Target:     src/api/users.ts -> [src/api/users.ts]

Matched Instruction Stack (2 layer(s)):
  (Ordered deterministically: least specific -> most specific)

  Layer 1: .github/copilot-instructions.md
    • Specificity score: 0 (depth: 0)
    • Scope root:        /
    • Reason:            Repository-level Copilot instruction applies to all target paths

  Layer 2: .github/instructions/backend.instructions.md
    • Specificity score: 150 (depth: 1)
    • Scope root:        /
    • Reason:            Matched pattern (src/api/**/*.ts) for target path "src/api/users.ts"

Non-applicable / Rejected Candidates (1):
  - .github/instructions/frontend.instructions.md: Target path "src/api/users.ts" does not match patterns: src/ui/**`,
    gemini: `AgentRuleMap Instruction Scope Resolution
Repository: /app/workspace
Profile:    gemini (Gemini CLI Profile)
Target:     src/api/users.ts -> [src/api/users.ts]

Matched Instruction Stack (2 layer(s)):
  (Ordered deterministically: least specific -> most specific)

  Layer 1: GEMINI.md
    • Specificity score: 0 (depth: 0)
    • Scope root:        /
    • Reason:            Root GEMINI.md repository context

  Layer 2: src/GEMINI.md
    • Specificity score: 100 (depth: 1)
    • Scope root:        src
    • Reason:            Directory GEMINI.md context applying to "src"`,
  };

  const commandSamples = {
    changed: `AgentRuleMap Changed Files Analysis
Repository: /app/workspace
Comparison: Comparison against base "main" (base ↔ working tree)
Profile:    all

Changed files: 3
  src/api/users.ts
    status: modified
    Codex:
      AGENTS.md
      src/AGENTS.md
      src/api/AGENTS.md
    GitHub Copilot:
      .github/copilot-instructions.md
      .github/instructions/backend.instructions.md
    Gemini:
      GEMINI.md
      src/GEMINI.md
    Generic:
      AGENTS.md
      src/AGENTS.md
      src/api/AGENTS.md

  src/api/reports.ts
    status: renamed (src/legacy/reports.ts → src/api/reports.ts)
    Codex:
      AGENTS.md
      src/AGENTS.md
      src/api/AGENTS.md
    GitHub Copilot:
      .github/copilot-instructions.md
      .github/instructions/backend.instructions.md
    Instruction scope changed after rename:
      codex:
        Old: AGENTS.md, src/AGENTS.md
        New: AGENTS.md, src/AGENTS.md, src/api/AGENTS.md

  src/ui/Button.tsx
    status: modified
    Codex:
      AGENTS.md
      src/AGENTS.md
    GitHub Copilot:
      .github/copilot-instructions.md
      .github/instructions/frontend.instructions.md

Instruction sources modified in this change set:
  src/AGENTS.md (modified)
  Potentially affected changed targets:
    src/api/reports.ts
    src/api/users.ts
    src/ui/Button.tsx

Scope Analysis: Multiple Instruction Scopes Detected
The changed files span multiple instruction scopes. Review each scope before using a coding agent across the entire change set.
  Codex (2 scopes):
    1. src/
    2. src/api/
  GitHub Copilot (2 scopes):
    1. path-specific: .github/instructions/backend.instructions.md
    2. path-specific: .github/instructions/frontend.instructions.md

Summary:
  Changed files: 3
  Added: 0
  Modified: 2
  Deleted: 0
  Renamed: 1
  Instruction sources involved:
    Codex: 3
    Copilot: 3
    Gemini: 2
    Generic: 3
  Changed instruction files: 1
  Distinct Codex scopes: 2
  Distinct GitHub Copilot scopes: 2

Notice: Deterministic analysis performed. Only structural instruction mappings and verifiable Git changes are reported.`,
    conflicts: `AgentRuleMap Conflicts
Repository: /app/workspace
Profile:    all

Findings (3):

 WARN  ARM006_STALE_PATH_REFERENCE docs/AGENTS.md:14:8
  Referenced path "src/legacy-api/README.md" does not exist in this repository.
  Remediation: Update or remove reference to the nonexistent file or directory.

 WARN  ARM007_MISSING_PACKAGE_SCRIPT AGENTS.md:28:10
  Instruction references script "lint" via "npm run lint", but script is not defined in "package.json".
  Remediation: Add "lint" to package.json scripts or correct the command in the instruction file.

 INFO  ARM011_OVERLAPPING_SCOPE .github/instructions/backend.instructions.md
  Overlapping instruction scopes between ".github/instructions/backend.instructions.md" (src/api/**/*.ts) and ".github/instructions/ts.instructions.md" (src/**/*.ts). Example overlap: src/api/users.ts
  Remediation: Ensure instruction precedence is intentional or make scopes mutually exclusive.

Summary: 0 errors, 2 warnings, 1 info (3 total)

Notice: Potential semantic conflict detection is not performed in deterministic mode. Only structural and objectively detectable findings are reported.`,
    coverage: `AgentRuleMap Coverage
Profile: codex
Repository-wide:
  AGENTS.md
Nested instruction scopes:
  src/**
    src/AGENTS.md
  src/api/**
    src/api/AGENTS.md
Source areas discovered:
  src/api/       nested instructions (src/api/AGENTS.md)
  src/ui/        nested instructions (src/AGENTS.md)
  tests/         root instructions only (AGENTS.md)

──────────────────────────────────────────────────

AgentRuleMap Coverage
Profile: copilot
Repository instructions:
  .github/copilot-instructions.md
Path-specific:
  src/api/**/*.ts (.github/instructions/backend.instructions.md)
  tests/**/*.ts (.github/instructions/tests.instructions.md)
Source areas discovered:
  src/api/       path-specific rules
  src/ui/        root instructions only (.github/copilot-instructions.md)
  tests/         path-specific rules

Coverage Gaps:
  packages/legacy/    no discovered instruction scope`,
    resolve: resolveOutputs[resolveProfile],
    check: `AgentRuleMap
Repository: my-project
Detected: TypeScript / Node.js

Agent Instructions       28/30
Build & Test Readiness   25/25
Repository Structure     15/15
Instruction Accuracy     18/20
Security                 10/10
Score: 96/100

✓ AGENTS.md found in repository
✓ All recommended instruction sections are present
✓ Build command verified (npm run build)
✓ Test command verified (npm test)
✓ Lint command verified (npm run lint)
✓ TypeScript configuration (tsconfig.json) detected
✓ Repository structure detected with clear architectural modules
✓ .gitignore properly configured to protect environment variables
✓ No unmasked or hardcoded API keys detected in scanned files
✓ No dangerous directives found in agent instruction files

Agent readiness: EXCELLENT`,
    json: `{
  "version": "1.0.0",
  "repository": {
    "name": "my-project",
    "detectedTypes": ["nodejs", "typescript", "react"],
    "instructionFiles": ["AGENTS.md"]
  },
  "score": 96,
  "readinessLabel": "EXCELLENT",
  "categories": {
    "agent_instructions": { "label": "Agent Instructions", "score": 28, "maxScore": 30 },
    "build_test": { "label": "Build & Test Readiness", "score": 25, "maxScore": 25 },
    "repo_structure": { "label": "Repository Structure", "score": 15, "maxScore": 15 },
    "instruction_accuracy": { "label": "Instruction Accuracy", "score": 18, "maxScore": 20 },
    "security": { "label": "Security", "score": 10, "maxScore": 10 }
  },
  "warnings": [],
  "errors": []
}`,
    init: `# AGENTS.md - Instructions for AI Coding Agents

## Project Overview
- Name: my-project
- Description: Production web application configured for AI coding agents
- Detected Stack: Node.js, TypeScript, React

## Repository Structure
- src/: Core application source code
- tests/: Automated unit and integration test suites

## Development Setup
1. npm install
2. Configure .env following .env.example

## Build Commands
npm run build

## Test Commands
npm test

## Coding Guidelines
- Strict TypeScript: No arbitrary any types.
- Modularity: Extract reusable components and keep modules small.

## Safety Rules
- Never commit secrets, .env files, or private keys.
- Run test suites before proposing pull requests.`,
    fix: `AgentRuleMap Fix Plan
Mode: DRY-RUN (no files will be modified)

• [AGENTS.md] Add missing recommended sections to AGENTS.md
  Appends missing sections (Safety Rules, Build Commands) to AGENTS.md
  Changes preview:
    + ## Safety Rules
    + - Secrets: Never commit .env or API keys to version control.
    + - Verification: Always run tests before proposing edits.

• [.gitignore] Add .env protection to .gitignore
  Appends .env* exclusion rule to .gitignore

Dry run complete. 2 potential fix(es) identified. Run without --dry-run to apply.`,
  };

  const currentCommand =
    activeTab === 'changed'
      ? 'npx agentrulemap changed'
      : activeTab === 'conflicts'
      ? 'npx agentrulemap conflicts'
      : activeTab === 'coverage'
      ? 'npx agentrulemap coverage'
      : activeTab === 'resolve'
      ? `npx agentrulemap resolve src/api/users.ts --profile ${resolveProfile}`
      : activeTab === 'check'
      ? 'npx agentrulemap check'
      : activeTab === 'json'
      ? 'npx agentrulemap check --json'
      : activeTab === 'init'
      ? 'npx agentrulemap init'
      : 'npx agentrulemap fix --dry-run';

  const copyCommand = () => {
    navigator.clipboard.writeText(currentCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div id="agentrulemap-root" className="min-h-screen bg-stone-900 text-stone-100 font-mono flex flex-col">
      {/* Top Header */}
      <header id="agentrulemap-header" className="border-b border-stone-800 bg-stone-950/60 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-emerald-400">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold text-stone-100">AgentRuleMap</h1>
                <span className="text-xs px-2 py-0.5 rounded bg-stone-800 text-stone-400 border border-stone-700">v1.0.0</span>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">CLI Tool</span>
              </div>
              <p className="text-xs text-stone-400 font-sans mt-0.5">
                Know which AI coding-agent instructions apply before your agent edits the file
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center space-x-4 text-xs font-sans text-stone-400">
            <span className="flex items-center space-x-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>Zero Remote Code Exec</span>
            </span>
            <span className="flex items-center space-x-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-blue-400" />
              <span>Deterministic Heuristics</span>
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main id="agentrulemap-main" className="max-w-6xl mx-auto w-full px-6 py-8 flex-1 flex flex-col gap-8">
        {/* Quick Launch Card */}
        <section id="quick-launch-card" className="bg-stone-950 border border-stone-800 rounded-lg p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs text-stone-400 uppercase tracking-wider font-sans">Quick Execution</div>
              <div className="text-sm text-stone-300 font-sans">
                Run directly in any repository without installing globally:
              </div>
            </div>
            <div className="flex items-center bg-stone-900 border border-stone-800 rounded px-3 py-2 text-sm text-emerald-400">
              <span className="text-stone-500 mr-2">$</span>
              <span>{currentCommand}</span>
              <button
                id="copy-cli-command-btn"
                onClick={copyCommand}
                className="ml-4 p-1 text-stone-400 hover:text-stone-200 hover:bg-stone-800 rounded transition-colors"
                title="Copy command"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </section>

        {/* Interactive CLI Output Explorer */}
        <section id="terminal-explorer" className="bg-stone-950 border border-stone-800 rounded-lg overflow-hidden flex-1 flex flex-col">
          {/* Tabs bar */}
          <div className="flex items-center justify-between border-b border-stone-800 bg-stone-900/50 px-4">
            <div className="flex space-x-1 py-2 overflow-x-auto">
              <button
                id="tab-btn-changed"
                onClick={() => setActiveTab('changed')}
                className={`px-3 py-1.5 rounded text-xs transition-colors flex items-center space-x-1.5 whitespace-nowrap ${
                  activeTab === 'changed' ? 'bg-indigo-900/60 text-indigo-300 font-semibold border border-indigo-700/50' : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <GitCommit className="w-3 h-3 text-indigo-400" />
                <span>agentrulemap changed</span>
              </button>
              <button
                id="tab-btn-conflicts"
                onClick={() => setActiveTab('conflicts')}
                className={`px-3 py-1.5 rounded text-xs transition-colors flex items-center space-x-1.5 whitespace-nowrap ${
                  activeTab === 'conflicts' ? 'bg-amber-900/60 text-amber-300 font-semibold border border-amber-700/50' : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                <span>agentrulemap conflicts</span>
              </button>
              <button
                id="tab-btn-coverage"
                onClick={() => setActiveTab('coverage')}
                className={`px-3 py-1.5 rounded text-xs transition-colors flex items-center space-x-1.5 whitespace-nowrap ${
                  activeTab === 'coverage' ? 'bg-cyan-900/60 text-cyan-300 font-semibold border border-cyan-700/50' : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <Shield className="w-3 h-3 text-cyan-400" />
                <span>agentrulemap coverage</span>
              </button>
              <button
                id="tab-btn-resolve"
                onClick={() => setActiveTab('resolve')}
                className={`px-3 py-1.5 rounded text-xs transition-colors flex items-center space-x-1.5 whitespace-nowrap ${
                  activeTab === 'resolve' ? 'bg-emerald-900/60 text-emerald-300 font-semibold border border-emerald-700/50' : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <Terminal className="w-3 h-3 text-emerald-400" />
                <span>resolve</span>
              </button>
              <button
                id="tab-btn-check"
                onClick={() => setActiveTab('check')}
                className={`px-3 py-1.5 rounded text-xs transition-colors flex items-center space-x-1.5 whitespace-nowrap ${
                  activeTab === 'check' ? 'bg-stone-800 text-stone-100 font-semibold' : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <Play className="w-3 h-3 text-emerald-400" />
                <span>check</span>
              </button>
              <button
                id="tab-btn-json"
                onClick={() => setActiveTab('json')}
                className={`px-3 py-1.5 rounded text-xs transition-colors flex items-center space-x-1.5 ${
                  activeTab === 'json' ? 'bg-stone-800 text-stone-100 font-semibold' : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <FileText className="w-3 h-3 text-blue-400" />
                <span>check --json</span>
              </button>
              <button
                id="tab-btn-init"
                onClick={() => setActiveTab('init')}
                className={`px-3 py-1.5 rounded text-xs transition-colors flex items-center space-x-1.5 ${
                  activeTab === 'init' ? 'bg-stone-800 text-stone-100 font-semibold' : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <FileText className="w-3 h-3 text-purple-400" />
                <span>init</span>
              </button>
              <button
                id="tab-btn-fix"
                onClick={() => setActiveTab('fix')}
                className={`px-3 py-1.5 rounded text-xs transition-colors flex items-center space-x-1.5 ${
                  activeTab === 'fix' ? 'bg-stone-800 text-stone-100 font-semibold' : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <AlertTriangle className="w-3 h-3 text-yellow-400" />
                <span>fix --dry-run</span>
              </button>
            </div>
            <div className="text-xs text-stone-500 font-sans hidden sm:block">
              {activeTab === 'changed' && 'Changed-Files & PR Instruction Mapping'}
              {activeTab === 'conflicts' && 'Deterministic Diagnostics'}
              {activeTab === 'coverage' && 'Instruction Scope Boundary Map'}
              {activeTab === 'resolve' && 'Deterministic Scope Engine'}
              {activeTab === 'check' && 'ANSI Terminal Report'}
              {activeTab === 'json' && 'CI/CD Schema Validated'}
              {activeTab === 'init' && 'Tailored AGENTS.md Generator'}
              {activeTab === 'fix' && 'Safe Deterministic Fixes'}
            </div>
          </div>

          {/* Profile Switcher when resolve tab is active */}
          {activeTab === 'resolve' && (
            <div id="resolve-profile-selector" className="px-5 py-2.5 bg-stone-900/40 border-b border-stone-800 flex items-center justify-between text-xs font-sans">
              <div className="flex items-center space-x-2">
                <span className="text-stone-400">Agent Profile:</span>
                <button
                  id="profile-btn-codex"
                  onClick={() => setResolveProfile('codex')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    resolveProfile === 'codex'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  Codex (AGENTS.md)
                </button>
                <button
                  id="profile-btn-copilot"
                  onClick={() => setResolveProfile('copilot')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    resolveProfile === 'copilot'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 font-semibold'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  GitHub Copilot (.instructions.md)
                </button>
                <button
                  id="profile-btn-gemini"
                  onClick={() => setResolveProfile('gemini')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    resolveProfile === 'gemini'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-semibold'
                      : 'text-stone-400 hover:text-stone-200'
                  }`}
                >
                  Gemini (GEMINI.md)
                </button>
              </div>
              <span className="text-stone-500 hidden md:inline">Target: src/api/users.ts</span>
            </div>
          )}

          {/* Terminal Display */}
          <div className="p-5 font-mono text-xs sm:text-sm text-stone-200 whitespace-pre-wrap leading-relaxed overflow-x-auto bg-stone-950 selection:bg-stone-800">
            {commandSamples[activeTab]}
          </div>
        </section>

        {/* Scoring Engine Breakdown Grid */}
        <section id="scoring-rules-grid" className="grid grid-cols-1 md:grid-cols-5 gap-3 font-sans">
          <div className="p-4 bg-stone-950 border border-stone-800 rounded-lg">
            <div className="text-xs font-semibold text-stone-400">Agent Instructions</div>
            <div className="text-lg font-bold text-stone-100 mt-1 font-mono">30 pts</div>
            <p className="text-xs text-stone-500 mt-1">
              AGENTS.md / CLAUDE.md / GEMINI.md presence and section completeness.
            </p>
          </div>

          <div className="p-4 bg-stone-950 border border-stone-800 rounded-lg">
            <div className="text-xs font-semibold text-stone-400">Build & Test</div>
            <div className="text-lg font-bold text-stone-100 mt-1 font-mono">25 pts</div>
            <p className="text-xs text-stone-500 mt-1">
              Automated test command, build scripts, tsconfig, and tests directory.
            </p>
          </div>

          <div className="p-4 bg-stone-950 border border-stone-800 rounded-lg">
            <div className="text-xs font-semibold text-stone-400">Repo Structure</div>
            <div className="text-lg font-bold text-stone-100 mt-1 font-mono">15 pts</div>
            <p className="text-xs text-stone-500 mt-1">
              Modular folder boundaries (src, app, components) and README.md.
            </p>
          </div>

          <div className="p-4 bg-stone-950 border border-stone-800 rounded-lg">
            <div className="text-xs font-semibold text-stone-400">Accuracy</div>
            <div className="text-lg font-bold text-stone-100 mt-1 font-mono">20 pts</div>
            <p className="text-xs text-stone-500 mt-1">
              Zero broken filesystem paths and valid package.json scripts.
            </p>
          </div>

          <div className="p-4 bg-stone-950 border border-stone-800 rounded-lg">
            <div className="text-xs font-semibold text-stone-400">Security</div>
            <div className="text-lg font-bold text-stone-100 mt-1 font-mono">10 pts</div>
            <p className="text-xs text-stone-500 mt-1">
              .env .gitignore rules, secret leak detection, and masked token logs.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer id="agentrulemap-footer" className="border-t border-stone-800 py-4 px-6 text-xs text-stone-500 font-sans text-center">
        AgentRuleMap • Open Source CLI Tool • MIT License
      </footer>
    </div>
  );
}
