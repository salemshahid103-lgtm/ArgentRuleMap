#!/usr/bin/env node

// src/cli/index.ts
import { Command } from "commander";

// src/commands/checkCommand.ts
import path5 from "node:path";

// src/scanners/fileScanner.ts
import fs2 from "node:fs";
import path3 from "node:path";

// src/utils/fsUtils.ts
import fs from "node:fs";
import path from "node:path";
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}
function isDirectory(dirPath) {
  try {
    const stats = fs.statSync(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}
function readFileSafe(filePath) {
  try {
    if (!fileExists(filePath)) return null;
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}
function readJsonSafe(filePath) {
  const content = readFileSafe(filePath);
  if (!content) return null;
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}
function listDirSafe(dirPath) {
  try {
    if (!fileExists(dirPath) || !isDirectory(dirPath)) return [];
    return fs.readdirSync(dirPath);
  } catch {
    return [];
  }
}
var IGNORED_SCAN_DIRS = /* @__PURE__ */ new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".turbo",
  ".cache",
  "coverage",
  ".idea",
  ".vscode",
  "venv",
  ".venv",
  "__pycache__"
]);
function scanDirectoryStructure(rootDir, maxDepth = 3) {
  const directories = [];
  let rootFiles = [];
  let totalFilesScanned = 0;
  function traverse(currentDir, relativeCurrent, depth) {
    if (depth > maxDepth) return;
    const entries = listDirSafe(currentDir);
    if (depth === 0) {
      rootFiles = entries.filter((entry) => {
        try {
          const stats = fs.statSync(path.join(currentDir, entry));
          return !stats.isDirectory();
        } catch {
          return false;
        }
      });
    }
    for (const entry of entries) {
      if (IGNORED_SCAN_DIRS.has(entry)) continue;
      const fullPath = path.join(currentDir, entry);
      const relPath = relativeCurrent ? `${relativeCurrent}/${entry}` : entry;
      try {
        const stats = fs.statSync(fullPath);
        if (stats.isDirectory()) {
          directories.push(relPath);
          traverse(fullPath, relPath, depth + 1);
        } else {
          totalFilesScanned++;
        }
      } catch {
      }
    }
  }
  traverse(rootDir, "", 0);
  return {
    directories,
    rootFiles,
    totalFilesScanned
  };
}

// src/scanners/repoTypeScanner.ts
import path2 from "node:path";
function detectRepoTypes(rootDir, rootFiles, packageJson) {
  const types = /* @__PURE__ */ new Set();
  const hasFile = (name) => rootFiles.includes(name) || fileExists(path2.join(rootDir, name));
  const allDeps = {
    ...packageJson?.dependencies || {},
    ...packageJson?.devDependencies || {}
  };
  if (hasFile("package.json")) {
    types.add("nodejs");
  }
  if (hasFile("tsconfig.json") || "typescript" in allDeps || rootFiles.some((f) => f.endsWith(".ts") || f.endsWith(".tsx"))) {
    types.add("typescript");
  }
  if (hasFile("package.json") && (!types.has("typescript") || rootFiles.some((f) => f.endsWith(".js") || f.endsWith(".mjs")))) {
    types.add("javascript");
  }
  if ("react" in allDeps || rootFiles.some((f) => f.endsWith(".jsx") || f.endsWith(".tsx"))) {
    types.add("react");
  }
  if ("next" in allDeps || hasFile("next.config.js") || hasFile("next.config.mjs") || hasFile("next.config.ts")) {
    types.add("nextjs");
  }
  if ("vite" in allDeps || hasFile("vite.config.js") || hasFile("vite.config.mjs") || hasFile("vite.config.ts")) {
    types.add("vite");
  }
  if (hasFile("pyproject.toml") || hasFile("requirements.txt") || hasFile("Pipfile") || hasFile("setup.py") || rootFiles.some((f) => f.endsWith(".py"))) {
    types.add("python");
  }
  if (types.size === 0) {
    return ["unknown"];
  }
  return Array.from(types);
}

// src/scanners/fileScanner.ts
var INSTRUCTION_CANDIDATES = [
  { relPath: "AGENTS.md", agentType: "agents" },
  { relPath: ".agent/AGENTS.md", agentType: "agents" },
  { relPath: ".github/AGENTS.md", agentType: "agents" },
  { relPath: "CLAUDE.md", agentType: "claude" },
  { relPath: ".claude/CLAUDE.md", agentType: "claude" },
  { relPath: "GEMINI.md", agentType: "gemini" },
  { relPath: ".github/copilot-instructions.md", agentType: "copilot" },
  { relPath: ".cursorrules", agentType: "cursor" },
  { relPath: ".cursor/rules", agentType: "cursor" }
];
function scanRepository(targetDir) {
  const rootDir = path3.resolve(targetDir);
  const repoName = path3.basename(rootDir) || "unnamed-repo";
  const { directories, rootFiles, totalFilesScanned } = scanDirectoryStructure(rootDir, 3);
  const importantDirs = {};
  const standardDirs = ["src", "app", "pages", "components", "tests", "test", "__tests__", "docs", "scripts", "bin"];
  for (const dir of standardDirs) {
    const found = directories.find((d) => d === dir || d.endsWith(`/${dir}`));
    if (found) {
      importantDirs[dir] = found;
    }
  }
  const structure = {
    directories,
    importantDirs,
    rootFiles,
    totalFilesScanned
  };
  const packageJsonPath = path3.join(rootDir, "package.json");
  const packageJson = readJsonSafe(packageJsonPath) ?? void 0;
  const hasTsConfig = fileExists(path3.join(rootDir, "tsconfig.json"));
  const gitignorePath = path3.join(rootDir, ".gitignore");
  const hasGitignore = fileExists(gitignorePath);
  const gitignoreContent = readFileSafe(gitignorePath) ?? void 0;
  const envFileCandidates = [".env", ".env.local", ".env.development", ".env.production", ".env.test"];
  const envFiles = envFileCandidates.filter((f) => fileExists(path3.join(rootDir, f)));
  const hasEnvFile = envFiles.length > 0;
  const hasEnvExample = fileExists(path3.join(rootDir, ".env.example"));
  const instructionFiles = [];
  for (const candidate of INSTRUCTION_CANDIDATES) {
    const fullPath = path3.join(rootDir, candidate.relPath);
    if (fileExists(fullPath)) {
      try {
        const stats = fs2.statSync(fullPath);
        if (stats.isFile()) {
          const content = readFileSafe(fullPath) || "";
          instructionFiles.push({
            relativePath: candidate.relPath,
            absolutePath: fullPath,
            agentType: candidate.agentType,
            content,
            exists: true,
            sizeBytes: stats.size
          });
        } else if (stats.isDirectory() && candidate.relPath === ".cursor/rules") {
          const ruleFiles = fs2.readdirSync(fullPath);
          for (const rf of ruleFiles) {
            const rfPath = path3.join(fullPath, rf);
            const rRel = path3.join(candidate.relPath, rf);
            const rContent = readFileSafe(rfPath) || "";
            instructionFiles.push({
              relativePath: rRel,
              absolutePath: rfPath,
              agentType: "cursor",
              content: rContent,
              exists: true,
              sizeBytes: Buffer.byteLength(rContent)
            });
          }
        }
      } catch {
      }
    }
  }
  let readmeFile;
  const readmePath = path3.join(rootDir, "README.md");
  if (fileExists(readmePath)) {
    readmeFile = {
      path: "README.md",
      content: readFileSafe(readmePath) || ""
    };
  }
  const detectedTypes = detectRepoTypes(rootDir, rootFiles, packageJson);
  return {
    rootDir,
    name: packageJson?.name || repoName,
    detectedTypes,
    packageJson,
    hasTsConfig,
    hasGitignore,
    gitignoreContent,
    hasEnvFile,
    hasEnvExample,
    envFiles,
    structure,
    instructionFiles,
    readmeFile
  };
}

// src/scanners/instructionParser.ts
var SECTION_PATTERNS = {
  projectOverview: /(?:project\s+overview|about\s+the\s+project|introduction|architecture\s+overview|overview|what\s+is)/i,
  installation: /(?:installation|getting\s+started|setup|dependencies|prerequisites|install)/i,
  build: /(?:build(?:\s+instructions|\s+commands|\s+step)?|compil(?:e|ation)|bundl(?:e|ing))/i,
  test: /(?:test(?:ing|\s+instructions|\s+commands|\s+suite)?|vitest|jest|pytest)/i,
  conventions: /(?:coding\s+(?:standards|conventions|guidelines|style)|code\s+style|rules|conventions)/i,
  paths: /(?:repository\s+(?:structure|layout|map|paths)|important\s+(?:files|paths|directories)|directory\s+structure)/i,
  safety: /(?:safety|security|constraints|guardrails|forbidden|do\s+not|rules\s+and\s+boundaries)/i,
  environment: /(?:environment\s+(?:variables|setup|info|configuration)|\.env|configuration)/i
};
function parseInstructionFile(content, sourceFile) {
  const sections = {
    projectOverview: false,
    installation: false,
    build: false,
    test: false,
    conventions: false,
    paths: false,
    safety: false,
    environment: false
  };
  for (const [key, pattern] of Object.entries(SECTION_PATTERNS)) {
    if (pattern.test(content)) {
      sections[key] = true;
    }
  }
  const commands = [];
  const lines = content.split("\n");
  const npmRegex = /(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?([a-zA-Z0-9_:-]+)/g;
  const BUILTIN_PKG_COMMANDS = /* @__PURE__ */ new Set([
    "install",
    "i",
    "ci",
    "add",
    "update",
    "upgrade",
    "remove",
    "uninstall",
    "audit",
    "init",
    "publish",
    "pack",
    "login",
    "logout",
    "whoami",
    "version",
    "config",
    "exec",
    "dlx"
  ]);
  lines.forEach((line) => {
    let match;
    npmRegex.lastIndex = 0;
    while ((match = npmRegex.exec(line)) !== null) {
      const full = match[0];
      const script = match[1];
      if (script.startsWith("-") || BUILTIN_PKG_COMMANDS.has(script.toLowerCase())) continue;
      commands.push({
        raw: full,
        commandName: full.split(" ")[0],
        scriptName: script,
        sourceFile
      });
    }
  });
  const referencedPaths = [];
  const pathRegex = /(?:`|'|")([a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_.-]+)+|\.\/[a-zA-Z0-9_.-]+)(?:`|'|")/g;
  lines.forEach((line, index) => {
    if (line.includes("http://") || line.includes("https://")) {
      return;
    }
    let pMatch;
    pathRegex.lastIndex = 0;
    while ((pMatch = pathRegex.exec(line)) !== null) {
      const rawPath = pMatch[1];
      if (rawPath.startsWith("@") || rawPath.includes("github.com") || rawPath.endsWith(".com") || rawPath.endsWith(".org") || rawPath === "node_modules" || rawPath === ".git") {
        continue;
      }
      const normalized = rawPath.replace(/^\.\//, "");
      referencedPaths.push({
        raw: rawPath,
        normalized,
        sourceFile,
        lineNumber: index + 1
      });
    }
  });
  return {
    sourceFile,
    sections,
    commands,
    referencedPaths
  };
}

// src/rules/agentInstructionsRule.ts
function runAgentInstructionsRule(context) {
  const maxScore = 30;
  let score = 0;
  const checks = [];
  const files = context.instructionFiles;
  const hasAgentsMd = files.some((f) => f.relativePath === "AGENTS.md" || f.relativePath.endsWith("AGENTS.md"));
  const hasAnyAgentFile = files.length > 0;
  if (hasAgentsMd) {
    score += 10;
    checks.push({
      id: "agent-instructions-file-exists",
      category: "agent_instructions",
      name: "Agent Instruction File Found",
      description: "Checks whether standard agent instruction files exist",
      status: "pass",
      message: "AGENTS.md found in repository",
      details: files.map((f) => f.relativePath),
      pointsAwarded: 10,
      pointsPossible: 10
    });
  } else if (hasAnyAgentFile) {
    score += 8;
    checks.push({
      id: "agent-instructions-file-exists",
      category: "agent_instructions",
      name: "Agent Instruction File Found",
      description: "Checks whether standard agent instruction files exist",
      status: "warn",
      message: `Found alternative instruction file(s) (${files.map((f) => f.relativePath).join(", ")}), but standard AGENTS.md is recommended`,
      details: files.map((f) => f.relativePath),
      pointsAwarded: 8,
      pointsPossible: 10
    });
  } else {
    checks.push({
      id: "agent-instructions-file-exists",
      category: "agent_instructions",
      name: "Agent Instruction File Missing",
      description: "Checks whether standard agent instruction files exist",
      status: "fail",
      message: "No agent instruction files found (e.g. AGENTS.md, CLAUDE.md, GEMINI.md)",
      pointsAwarded: 0,
      pointsPossible: 10
    });
  }
  const combinedContent = files.map((f) => f.content).join("\n\n");
  const parsed = parseInstructionFile(combinedContent, "combined-instructions");
  const sectionCriteria = [
    { key: "projectOverview", label: "Project overview", pts: 3 },
    { key: "installation", label: "Installation instructions", pts: 3 },
    { key: "build", label: "Build instructions", pts: 3 },
    { key: "test", label: "Test instructions", pts: 3 },
    { key: "conventions", label: "Coding conventions", pts: 3 },
    { key: "paths", label: "Important repository paths", pts: 2 },
    { key: "safety", label: "Safety constraints", pts: 2 },
    { key: "environment", label: "Environment information", pts: 1 }
  ];
  const missingSections = [];
  const presentSections = [];
  let sectionScore = 0;
  for (const { key, label, pts } of sectionCriteria) {
    if (parsed.sections[key]) {
      sectionScore += pts;
      presentSections.push(label);
    } else {
      missingSections.push(label);
    }
  }
  score += sectionScore;
  if (hasAnyAgentFile) {
    if (missingSections.length === 0) {
      checks.push({
        id: "agent-instructions-sections",
        category: "agent_instructions",
        name: "Comprehensive Instruction Sections",
        description: "Verifies required instruction sections (overview, setup, build, test, conventions, paths, safety, env)",
        status: "pass",
        message: "All recommended instruction sections are present",
        details: presentSections,
        pointsAwarded: 20,
        pointsPossible: 20
      });
    } else {
      checks.push({
        id: "agent-instructions-sections",
        category: "agent_instructions",
        name: "Instruction Sections Completeness",
        description: "Verifies required instruction sections (overview, setup, build, test, conventions, paths, safety, env)",
        status: missingSections.length <= 2 ? "warn" : "fail",
        message: `Missing instruction guidance: ${missingSections.join(", ")}`,
        details: [`Present: ${presentSections.join(", ") || "None"}`, `Missing: ${missingSections.join(", ")}`],
        pointsAwarded: sectionScore,
        pointsPossible: 20
      });
    }
  } else {
    checks.push({
      id: "agent-instructions-sections",
      category: "agent_instructions",
      name: "Instruction Sections Missing",
      description: "Verifies required instruction sections",
      status: "fail",
      message: "Cannot evaluate sections because no instruction files exist",
      pointsAwarded: 0,
      pointsPossible: 20
    });
  }
  return {
    score: Math.min(score, maxScore),
    maxScore,
    checks
  };
}

// src/rules/buildTestRule.ts
function runBuildTestRule(context) {
  const maxScore = 25;
  let score = 0;
  const checks = [];
  const scripts = context.packageJson?.scripts || {};
  const isPython = context.detectedTypes.includes("python");
  const isTs = context.detectedTypes.includes("typescript");
  const hasTestScript = Boolean(scripts.test || scripts["test:unit"] || scripts["test:run"]);
  const hasPyTest = isPython && (context.structure.rootFiles.includes("pytest.ini") || context.structure.rootFiles.includes("pyproject.toml"));
  if (hasTestScript || hasPyTest) {
    score += 6;
    checks.push({
      id: "build-test-test-command",
      category: "build_test",
      name: "Test Script Verification",
      description: "Verifies whether automated test command is configured",
      status: "pass",
      message: "Test command verified in repository configuration",
      details: hasTestScript ? [`npm test / ${scripts.test}`] : ["Python test runner configured"],
      pointsAwarded: 6,
      pointsPossible: 6
    });
  } else {
    checks.push({
      id: "build-test-test-command",
      category: "build_test",
      name: "Test Script Verification",
      description: "Verifies whether automated test command is configured",
      status: "fail",
      message: 'No test script configured in package.json (e.g. "scripts": { "test": "..." })',
      pointsAwarded: 0,
      pointsPossible: 6
    });
  }
  const hasBuildScript = Boolean(scripts.build || scripts["build:cli"]);
  const needsBuild = context.detectedTypes.some((t) => ["typescript", "react", "nextjs", "vite"].includes(t));
  if (hasBuildScript) {
    score += 6;
    checks.push({
      id: "build-test-build-command",
      category: "build_test",
      name: "Build Command Verification",
      description: "Verifies whether project build command is configured",
      status: "pass",
      message: "Build command verified",
      details: [`npm run build: ${scripts.build || scripts["build:cli"]}`],
      pointsAwarded: 6,
      pointsPossible: 6
    });
  } else if (!needsBuild) {
    score += 6;
    checks.push({
      id: "build-test-build-command",
      category: "build_test",
      name: "Build Command Verification",
      description: "Verifies whether project build command is configured",
      status: "info",
      message: "Build script not strictly required for this project type",
      pointsAwarded: 6,
      pointsPossible: 6
    });
  } else {
    checks.push({
      id: "build-test-build-command",
      category: "build_test",
      name: "Build Command Verification",
      description: "Verifies whether project build command is configured",
      status: "fail",
      message: 'Missing build script in package.json ("build")',
      pointsAwarded: 0,
      pointsPossible: 6
    });
  }
  const hasLintScript = Boolean(scripts.lint || scripts["lint:check"]);
  if (hasLintScript) {
    score += 5;
    checks.push({
      id: "build-test-lint-command",
      category: "build_test",
      name: "Lint Script Verification",
      description: "Verifies whether lint/static analysis command is configured",
      status: "pass",
      message: "Lint command verified",
      details: [`npm run lint: ${scripts.lint}`],
      pointsAwarded: 5,
      pointsPossible: 5
    });
  } else {
    checks.push({
      id: "build-test-lint-command",
      category: "build_test",
      name: "Lint Script Verification",
      description: "Verifies whether lint/static analysis command is configured",
      status: "warn",
      message: 'No lint command found in package.json ("lint")',
      pointsAwarded: 0,
      pointsPossible: 5
    });
  }
  if (!isTs) {
    score += 4;
    checks.push({
      id: "build-test-tsconfig",
      category: "build_test",
      name: "TypeScript Configuration",
      description: "Checks tsconfig.json validity when TypeScript is used",
      status: "info",
      message: "Project does not appear to use TypeScript; check skipped",
      pointsAwarded: 4,
      pointsPossible: 4
    });
  } else if (context.hasTsConfig) {
    score += 4;
    checks.push({
      id: "build-test-tsconfig",
      category: "build_test",
      name: "TypeScript Configuration",
      description: "Checks tsconfig.json validity when TypeScript is used",
      status: "pass",
      message: "TypeScript configuration (tsconfig.json) detected",
      pointsAwarded: 4,
      pointsPossible: 4
    });
  } else {
    checks.push({
      id: "build-test-tsconfig",
      category: "build_test",
      name: "TypeScript Configuration",
      description: "Checks tsconfig.json validity when TypeScript is used",
      status: "fail",
      message: "TypeScript files detected but tsconfig.json is missing",
      pointsAwarded: 0,
      pointsPossible: 4
    });
  }
  const hasTestDir = Boolean(
    context.structure.importantDirs.tests || context.structure.importantDirs.test || context.structure.importantDirs.__tests__
  );
  const hasTestFiles = context.structure.rootFiles.some((f) => f.includes(".test.") || f.includes(".spec."));
  if (hasTestDir || hasTestFiles) {
    score += 4;
    checks.push({
      id: "build-test-directory",
      category: "build_test",
      name: "Test Directory Structure",
      description: "Checks whether dedicated test directories or files exist",
      status: "pass",
      message: "Test directory or test suite files found",
      details: [
        context.structure.importantDirs.tests || context.structure.importantDirs.test || "root test files"
      ],
      pointsAwarded: 4,
      pointsPossible: 4
    });
  } else {
    checks.push({
      id: "build-test-directory",
      category: "build_test",
      name: "Test Directory Structure",
      description: "Checks whether dedicated test directories or files exist",
      status: "warn",
      message: "No test directory (tests/, test/, __tests__/) found",
      pointsAwarded: 0,
      pointsPossible: 4
    });
  }
  return {
    score: Math.min(score, maxScore),
    maxScore,
    checks
  };
}

// src/rules/repoStructureRule.ts
function runRepoStructureRule(context) {
  const maxScore = 15;
  let score = 0;
  const checks = [];
  const { importantDirs, directories } = context.structure;
  const hasSourceDir = Boolean(importantDirs.src || importantDirs.app || importantDirs.pages);
  if (hasSourceDir) {
    score += 6;
    checks.push({
      id: "repo-structure-source",
      category: "repo_structure",
      name: "Source Directory Organization",
      description: "Checks for dedicated source folder (src, app, or pages)",
      status: "pass",
      message: "Source code folder detected",
      details: [importantDirs.src ? `src/ (${importantDirs.src})` : `app/ (${importantDirs.app})`],
      pointsAwarded: 6,
      pointsPossible: 6
    });
  } else if (directories.length > 0) {
    score += 3;
    checks.push({
      id: "repo-structure-source",
      category: "repo_structure",
      name: "Source Directory Organization",
      description: "Checks for dedicated source folder (src, app, or pages)",
      status: "warn",
      message: "No distinct src/ or app/ directory; root contains source files",
      pointsAwarded: 3,
      pointsPossible: 6
    });
  } else {
    checks.push({
      id: "repo-structure-source",
      category: "repo_structure",
      name: "Source Directory Organization",
      description: "Checks for dedicated source folder (src, app, or pages)",
      status: "fail",
      message: "Repository has flat or unorganized root without clear source boundaries",
      pointsAwarded: 0,
      pointsPossible: 6
    });
  }
  const identifiedList = Object.entries(importantDirs).filter(([_, v]) => Boolean(v)).map(([k, v]) => `${k} -> ${v}`);
  if (identifiedList.length >= 2) {
    score += 5;
    checks.push({
      id: "repo-structure-segmentation",
      category: "repo_structure",
      name: "Repository Modular Structure",
      description: "Identifies standard architectural modules (components, docs, scripts, tests)",
      status: "pass",
      message: "Repository structure detected with clear architectural modules",
      details: identifiedList,
      pointsAwarded: 5,
      pointsPossible: 5
    });
  } else if (identifiedList.length === 1) {
    score += 3;
    checks.push({
      id: "repo-structure-segmentation",
      category: "repo_structure",
      name: "Repository Modular Structure",
      description: "Identifies standard architectural modules (components, docs, scripts, tests)",
      status: "info",
      message: "Basic directory structure found",
      details: identifiedList,
      pointsAwarded: 3,
      pointsPossible: 5
    });
  } else {
    checks.push({
      id: "repo-structure-segmentation",
      category: "repo_structure",
      name: "Repository Modular Structure",
      description: "Identifies standard architectural modules (components, docs, scripts, tests)",
      status: "warn",
      message: "Few or no modular subdirectories detected",
      pointsAwarded: 0,
      pointsPossible: 5
    });
  }
  if (context.readmeFile) {
    score += 4;
    checks.push({
      id: "repo-structure-documentation",
      category: "repo_structure",
      name: "Repository Documentation",
      description: "Verifies existence of human/agent onboarding documentation (README.md)",
      status: "pass",
      message: "README.md found",
      pointsAwarded: 4,
      pointsPossible: 4
    });
  } else {
    checks.push({
      id: "repo-structure-documentation",
      category: "repo_structure",
      name: "Repository Documentation",
      description: "Verifies existence of human/agent onboarding documentation (README.md)",
      status: "fail",
      message: "Missing README.md in root directory",
      pointsAwarded: 0,
      pointsPossible: 4
    });
  }
  return {
    score: Math.min(score, maxScore),
    maxScore,
    checks
  };
}

// src/rules/instructionAccuracyRule.ts
import path4 from "node:path";
function runInstructionAccuracyRule(context) {
  const maxScore = 20;
  let score = 0;
  const checks = [];
  const warnings = [];
  const instructionFiles = context.instructionFiles;
  if (instructionFiles.length === 0) {
    checks.push({
      id: "instruction-accuracy-commands",
      category: "instruction_accuracy",
      name: "Command Verification",
      description: "Verifies whether scripts mentioned in instructions exist in package.json",
      status: "fail",
      message: "No instruction files available to verify commands against",
      pointsAwarded: 0,
      pointsPossible: 10
    });
    checks.push({
      id: "instruction-accuracy-paths",
      category: "instruction_accuracy",
      name: "Path Verification",
      description: "Verifies whether paths referenced in instructions actually exist in the repository",
      status: "fail",
      message: "No instruction files available to verify referenced paths against",
      pointsAwarded: 0,
      pointsPossible: 10
    });
    return { score: 0, maxScore, checks, warnings };
  }
  const analyses = instructionFiles.map(
    (file) => parseInstructionFile(file.content, file.relativePath)
  );
  const allCommands = analyses.flatMap((a) => a.commands);
  const pkgScripts = context.packageJson?.scripts || {};
  const invalidCommands = [];
  const verifiedCommands = [];
  for (const cmd of allCommands) {
    if (cmd.scriptName) {
      const scriptExists = Object.prototype.hasOwnProperty.call(pkgScripts, cmd.scriptName);
      if (scriptExists) {
        if (!verifiedCommands.includes(cmd.scriptName)) {
          verifiedCommands.push(cmd.scriptName);
        }
      } else {
        const item = `${cmd.sourceFile} mentions "${cmd.raw}" but script "${cmd.scriptName}" is missing from package.json`;
        if (!invalidCommands.includes(item)) {
          invalidCommands.push(item);
        }
      }
    }
  }
  if (invalidCommands.length > 0) {
    const penalty = Math.min(10, invalidCommands.length * 3);
    const cmdScore = Math.max(0, 10 - penalty);
    score += cmdScore;
    for (const inv of invalidCommands) {
      warnings.push(inv);
    }
    checks.push({
      id: "instruction-accuracy-commands",
      category: "instruction_accuracy",
      name: "Command Verification",
      description: "Verifies whether scripts mentioned in instructions exist in package.json",
      status: "warn",
      message: `Instruction commands do not match package.json (${invalidCommands.length} mismatch${invalidCommands.length > 1 ? "es" : ""})`,
      details: invalidCommands,
      pointsAwarded: cmdScore,
      pointsPossible: 10
    });
  } else if (verifiedCommands.length > 0) {
    score += 10;
    checks.push({
      id: "instruction-accuracy-commands",
      category: "instruction_accuracy",
      name: "Command Verification",
      description: "Verifies whether scripts mentioned in instructions exist in package.json",
      status: "pass",
      message: `Verified instruction commands (${verifiedCommands.join(", ")}) in package.json scripts`,
      details: verifiedCommands.map((c) => `\u2713 Script "${c}" exists in package.json`),
      pointsAwarded: 10,
      pointsPossible: 10
    });
  } else {
    score += 8;
    checks.push({
      id: "instruction-accuracy-commands",
      category: "instruction_accuracy",
      name: "Command Verification",
      description: "Verifies whether scripts mentioned in instructions exist in package.json",
      status: "info",
      message: "No explicit package.json scripts were cited in agent instructions",
      pointsAwarded: 8,
      pointsPossible: 10
    });
  }
  const allPaths = analyses.flatMap((a) => a.referencedPaths);
  const brokenPaths = [];
  const validPaths = [];
  for (const p of allPaths) {
    const fullPath = path4.resolve(context.rootDir, p.normalized);
    const exists = fileExists(fullPath);
    if (exists) {
      if (!validPaths.includes(p.normalized)) {
        validPaths.push(p.normalized);
      }
    } else {
      brokenPaths.push({ source: p.sourceFile, raw: p.raw });
      const warnMsg = `${p.sourceFile} references ${p.raw} but that path does not exist`;
      if (!warnings.includes(warnMsg)) {
        warnings.push(warnMsg);
      }
    }
  }
  if (brokenPaths.length > 0) {
    const penalty = Math.min(10, brokenPaths.length * 3);
    const pathScore = Math.max(0, 10 - penalty);
    score += pathScore;
    checks.push({
      id: "instruction-accuracy-paths",
      category: "instruction_accuracy",
      name: "Path Verification",
      description: "Verifies whether paths referenced in instructions actually exist in the repository",
      status: "warn",
      message: `${brokenPaths.length} referenced path${brokenPaths.length > 1 ? "s" : ""} do not exist in the repository`,
      details: brokenPaths.map((bp) => `${bp.source} references ${bp.raw} (not found)`),
      pointsAwarded: pathScore,
      pointsPossible: 10
    });
  } else if (validPaths.length > 0) {
    score += 10;
    checks.push({
      id: "instruction-accuracy-paths",
      category: "instruction_accuracy",
      name: "Path Verification",
      description: "Verifies whether paths referenced in instructions actually exist in the repository",
      status: "pass",
      message: "All paths referenced in instructions were verified to exist",
      details: validPaths.map((vp) => `\u2713 ${vp} verified`),
      pointsAwarded: 10,
      pointsPossible: 10
    });
  } else {
    score += 8;
    checks.push({
      id: "instruction-accuracy-paths",
      category: "instruction_accuracy",
      name: "Path Verification",
      description: "Verifies whether paths referenced in instructions actually exist in the repository",
      status: "info",
      message: "No explicit relative paths detected in agent instructions to verify",
      pointsAwarded: 8,
      pointsPossible: 10
    });
  }
  return {
    score: Math.min(score, maxScore),
    maxScore,
    checks,
    warnings
  };
}

// src/security/masker.ts
function maskSecret(secret) {
  if (!secret) return "[EMPTY]";
  const trimmed = secret.trim();
  if (trimmed.length <= 8) {
    return "***REDACTED***";
  }
  const prefix = trimmed.slice(0, 4);
  const suffix = trimmed.slice(-4);
  return `${prefix}...${suffix}`;
}

// src/security/secretDetector.ts
var SECRET_PATTERNS = [
  {
    name: "OpenAI API Key",
    pattern: /\bsk-[A-Za-z0-9_\-]{20,}\b/g
  },
  {
    name: "Google API Key",
    pattern: /\bAIza[0-9A-Za-z\-_]{35}\b/g
  },
  {
    name: "GitHub Personal Access Token",
    pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36}\b/g
  },
  {
    name: "GitHub Fine-Grained Token",
    pattern: /\bgithub_pat_[A-Za-z0-9_]{22,}\b/g
  },
  {
    name: "AWS Access Key ID",
    pattern: /\b(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b/g
  },
  {
    name: "Generic API Key Assignment",
    pattern: /(?:api[_-]?key|secret[_-]?key|access[_-]?token|private[_-]?key)\s*[:=]\s*['"]([A-Za-z0-9_\-+/=]{16,})['"]/gi
  }
];
var INSECURE_INSTRUCTION_PATTERNS = [
  {
    description: "Instructs agent to commit .env files",
    pattern: /(?:commit|push|add)\s+(?:\.env|\.env\.local|secrets|keys)/i
  },
  {
    description: "Instructs agent to bypass security or validation checks",
    pattern: /(?:disable|bypass|skip|ignore)\s+(?:security|secret-scanner|auth-check|credential-check)/i
  },
  {
    description: "Instructs agent to hardcode or print secret tokens directly",
    pattern: /(?:print|log|echo|output|hardcode)\s+(?:api[_-]?key|password|secret|token)/i
  }
];
function detectSecretsInContent(content, sourcePath) {
  const findings = [];
  const lines = content.split("\n");
  lines.forEach((line, lineIndex) => {
    const isPlaceholder = line.includes("YOUR_") || line.includes("<your-") || line.includes("MY_API_KEY") || line.includes("PLACEHOLDER") || line.includes("example") || line.includes("process.env.") || line.includes("import.meta.env.");
    if (isPlaceholder) {
      return;
    }
    for (const { name, pattern } of SECRET_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(line)) !== null) {
        const fullMatch = match[1] || match[0];
        if (fullMatch.length >= 16 && !fullMatch.toUpperCase().includes("EXAMPLE")) {
          findings.push({
            type: name,
            source: sourcePath,
            maskedSnippet: maskSecret(fullMatch),
            line: lineIndex + 1
          });
        }
      }
    }
  });
  return findings;
}
function detectInsecureInstructions(content, sourcePath) {
  const findings = [];
  const lines = content.split("\n");
  lines.forEach((line) => {
    for (const { description, pattern } of INSECURE_INSTRUCTION_PATTERNS) {
      if (pattern.test(line)) {
        findings.push({
          source: sourcePath,
          issue: description,
          snippet: line.trim().slice(0, 100)
        });
      }
    }
  });
  return findings;
}

// src/rules/securityRule.ts
function runSecurityRule(context) {
  const maxScore = 10;
  let score = 10;
  const checks = [];
  const warnings = [];
  const gitignore = context.gitignoreContent || "";
  const ignoresEnv = gitignore.includes(".env") || gitignore.includes(".env*") || gitignore.includes("*.env");
  if (!context.hasGitignore) {
    score -= 3;
    const msg = "Missing .gitignore file in repository; sensitive files may be committed accidentally";
    warnings.push(msg);
    checks.push({
      id: "security-gitignore",
      category: "security",
      name: ".gitignore Protection",
      description: "Checks whether .gitignore exists and protects sensitive environment files",
      status: "fail",
      message: msg,
      pointsAwarded: 0,
      pointsPossible: 3
    });
  } else if (!ignoresEnv && context.hasEnvFile) {
    score -= 3;
    const msg = "Active .env file detected but .gitignore does not ignore .env files";
    warnings.push(msg);
    checks.push({
      id: "security-gitignore",
      category: "security",
      name: ".gitignore Protection",
      description: "Checks whether .gitignore exists and protects sensitive environment files",
      status: "warn",
      message: msg,
      details: context.envFiles,
      pointsAwarded: 0,
      pointsPossible: 3
    });
  } else {
    checks.push({
      id: "security-gitignore",
      category: "security",
      name: ".gitignore Protection",
      description: "Checks whether .gitignore exists and protects sensitive environment files",
      status: "pass",
      message: ".gitignore properly configured to protect environment variables",
      pointsAwarded: 3,
      pointsPossible: 3
    });
  }
  const filesToScan = [
    ...context.instructionFiles.map((f) => ({ name: f.relativePath, content: f.content })),
    ...context.readmeFile ? [{ name: context.readmeFile.path, content: context.readmeFile.content }] : []
  ];
  const leakedSecrets = filesToScan.flatMap(
    (file) => detectSecretsInContent(file.content, file.name)
  );
  if (leakedSecrets.length > 0) {
    score -= 4;
    const leakedDetails = leakedSecrets.map(
      (s) => `${s.source}: detected ${s.type} (${s.maskedSnippet})`
    );
    for (const d of leakedDetails) {
      warnings.push(`Potential secret leak: ${d}`);
    }
    checks.push({
      id: "security-secret-leak",
      category: "security",
      name: "Secret Leak Detection",
      description: "Scans files for exposed API keys and sensitive tokens",
      status: "fail",
      message: `${leakedSecrets.length} potential secret token(s) detected in documentation/instructions`,
      details: leakedDetails,
      pointsAwarded: 0,
      pointsPossible: 4
    });
  } else {
    checks.push({
      id: "security-secret-leak",
      category: "security",
      name: "Secret Leak Detection",
      description: "Scans files for exposed API keys and sensitive tokens",
      status: "pass",
      message: "No unmasked or hardcoded API keys detected in scanned files",
      pointsAwarded: 4,
      pointsPossible: 4
    });
  }
  const dangerousInstructions = context.instructionFiles.flatMap(
    (file) => detectInsecureInstructions(file.content, file.relativePath)
  );
  if (dangerousInstructions.length > 0) {
    score -= 3;
    const dangDetails = dangerousInstructions.map(
      (d) => `${d.source}: ${d.issue} -> "${d.snippet}"`
    );
    for (const d of dangDetails) {
      warnings.push(`Insecure instruction: ${d}`);
    }
    checks.push({
      id: "security-agent-instructions",
      category: "security",
      name: "Agent Safety Constraints",
      description: "Ensures instructions do not direct AI agents to bypass security checks or expose secrets",
      status: "fail",
      message: "Instruction file contains unsafe directives for AI agents",
      details: dangDetails,
      pointsAwarded: 0,
      pointsPossible: 3
    });
  } else {
    const hasSecurityMention = context.instructionFiles.some(
      (f) => /safety|security|secret|credential|token|\.env/i.test(f.content)
    );
    if (context.instructionFiles.length > 0 && !hasSecurityMention) {
      score -= 1;
      const warnMsg = "Missing security guidance";
      warnings.push(warnMsg);
      checks.push({
        id: "security-agent-instructions",
        category: "security",
        name: "Agent Safety Constraints",
        description: "Ensures instructions do not direct AI agents to bypass security checks or expose secrets",
        status: "warn",
        message: "No security guidelines or credential boundaries defined for AI agents",
        pointsAwarded: 2,
        pointsPossible: 3
      });
    } else {
      checks.push({
        id: "security-agent-instructions",
        category: "security",
        name: "Agent Safety Constraints",
        description: "Ensures instructions do not direct AI agents to bypass security checks or expose secrets",
        status: "pass",
        message: "No dangerous directives found in agent instruction files",
        pointsAwarded: 3,
        pointsPossible: 3
      });
    }
  }
  return {
    score: Math.max(0, Math.min(score, maxScore)),
    maxScore,
    checks,
    warnings
  };
}

// src/core/engine.ts
function calculateReadinessLabel(score) {
  if (score >= 90) return "EXCELLENT";
  if (score >= 75) return "GOOD";
  if (score >= 50) return "NEEDS IMPROVEMENT";
  return "NOT READY";
}
function analyzeRepository(targetDir = process.cwd()) {
  const context = scanRepository(targetDir);
  const agentRule = runAgentInstructionsRule(context);
  const buildTestRule = runBuildTestRule(context);
  const repoStructureRule = runRepoStructureRule(context);
  const accuracyRule = runInstructionAccuracyRule(context);
  const securityRule = runSecurityRule(context);
  const totalScore = Math.min(
    100,
    Math.max(
      0,
      agentRule.score + buildTestRule.score + repoStructureRule.score + accuracyRule.score + securityRule.score
    )
  );
  const readinessLabel = calculateReadinessLabel(totalScore);
  const categories = {
    agent_instructions: {
      label: "Agent Instructions",
      score: agentRule.score,
      maxScore: agentRule.maxScore
    },
    build_test: {
      label: "Build & Test Readiness",
      score: buildTestRule.score,
      maxScore: buildTestRule.maxScore
    },
    repo_structure: {
      label: "Repository Structure",
      score: repoStructureRule.score,
      maxScore: repoStructureRule.maxScore
    },
    instruction_accuracy: {
      label: "Instruction Accuracy",
      score: accuracyRule.score,
      maxScore: accuracyRule.maxScore
    },
    security: {
      label: "Security",
      score: securityRule.score,
      maxScore: securityRule.maxScore
    }
  };
  const allChecks = [
    ...agentRule.checks,
    ...buildTestRule.checks,
    ...repoStructureRule.checks,
    ...accuracyRule.checks,
    ...securityRule.checks
  ];
  const warnings = [
    ...accuracyRule.warnings,
    ...securityRule.warnings
  ];
  for (const check of allChecks) {
    if (check.status === "warn" && !warnings.includes(check.message)) {
      warnings.push(check.message);
    }
  }
  const errors = allChecks.filter((c) => c.status === "fail").map((c) => c.message);
  return {
    version: "1.0.0",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    repository: {
      name: context.name,
      path: context.rootDir,
      detectedTypes: context.detectedTypes,
      instructionFiles: context.instructionFiles.map((f) => f.relativePath),
      structure: {
        importantDirs: Object.fromEntries(
          Object.entries(context.structure.importantDirs).filter(([_, v]) => Boolean(v))
        ),
        totalFiles: context.structure.totalFilesScanned
      }
    },
    score: totalScore,
    readinessLabel,
    categories,
    checks: allChecks,
    warnings,
    errors
  };
}

// src/reporters/jsonReporter.ts
function formatJsonReport(result, pretty = true) {
  return JSON.stringify(result, null, pretty ? 2 : void 0);
}

// src/reporters/terminalReporter.ts
import chalk from "chalk";
function formatLabel(label) {
  switch (label) {
    case "EXCELLENT":
      return chalk.green.bold(label);
    case "GOOD":
      return chalk.cyan.bold(label);
    case "NEEDS IMPROVEMENT":
      return chalk.yellow.bold(label);
    case "NOT READY":
      return chalk.red.bold(label);
    default:
      return label;
  }
}
function formatTypes(types) {
  return types.map((t) => {
    switch (t) {
      case "typescript":
        return "TypeScript";
      case "nodejs":
        return "Node.js";
      case "javascript":
        return "JavaScript";
      case "react":
        return "React";
      case "nextjs":
        return "Next.js";
      case "vite":
        return "Vite";
      case "python":
        return "Python";
      default:
        return t;
    }
  }).join(" / ");
}
function formatTerminalReport(result, verbose = false) {
  const lines = [];
  lines.push("");
  lines.push(chalk.bold("AgentRuleMap"));
  lines.push(`Repository: ${chalk.white.bold(result.repository.name)}`);
  lines.push(`Detected: ${formatTypes(result.repository.detectedTypes)}`);
  lines.push("");
  const categories = Object.values(result.categories);
  const maxLabelLength = Math.max(...categories.map((c) => c.label.length));
  for (const cat of categories) {
    const paddedLabel = cat.label.padEnd(maxLabelLength + 2);
    const scoreStr = `${cat.score}/${cat.maxScore}`.padStart(5);
    lines.push(`${paddedLabel} ${chalk.bold(scoreStr)}`);
  }
  lines.push(chalk.bold(`Score: ${result.score}/100`));
  lines.push("");
  const passes = result.checks.filter((c) => c.status === "pass");
  for (const check of passes) {
    lines.push(chalk.green(`\u2713 ${check.message}`));
    if (verbose && check.details && check.details.length > 0) {
      for (const d of check.details) {
        lines.push(chalk.dim(`    ${d}`));
      }
    }
  }
  const warnings = result.warnings;
  for (const warn of warnings) {
    lines.push(chalk.yellow(`\u26A0 ${warn}`));
  }
  const fails = result.checks.filter((c) => c.status === "fail");
  for (const fail of fails) {
    lines.push(chalk.red(`\u2716 ${fail.message}`));
  }
  lines.push("");
  lines.push(`Agent readiness: ${formatLabel(result.readinessLabel)}`);
  lines.push("");
  return lines.join("\n");
}

// src/commands/checkCommand.ts
function runCheckCommand(options = {}) {
  const targetDir = path5.resolve(options.cwd || process.cwd());
  const result = analyzeRepository(targetDir);
  if (options.json) {
    const jsonOutput = formatJsonReport(result, true);
    console.log(jsonOutput);
    return {
      exitCode: result.readinessLabel === "NOT READY" ? 1 : 0,
      output: jsonOutput
    };
  }
  const terminalOutput = formatTerminalReport(result, options.verbose ?? false);
  console.log(terminalOutput);
  return {
    exitCode: result.readinessLabel === "NOT READY" ? 1 : 0,
    output: terminalOutput
  };
}

// src/commands/initCommand.ts
import fs3 from "node:fs";
import path6 from "node:path";
import chalk2 from "chalk";

// src/generators/agentDocGenerator.ts
function generateAgentsTemplate(context) {
  const name = context.name || "Project";
  const desc = context.packageJson?.description || "Repository configured for AI coding agents.";
  const types = context.detectedTypes.join(", ");
  const scripts = context.packageJson?.scripts || {};
  const buildCmd = scripts.build ? "npm run build" : "None configured";
  const testCmd = scripts.test ? "npm test" : scripts["test:run"] ? "npm run test:run" : "None configured";
  const lintCmd = scripts.lint ? "npm run lint" : "None configured";
  const importantDirs = Object.entries(context.structure.importantDirs).filter(([_, relPath]) => Boolean(relPath)).map(([type, relPath]) => `- \`${relPath}/\`: ${formatDirDescription(type)}`).join("\n");
  return `# AGENTS.md - Instructions for AI Coding Agents

## Project Overview
- **Name**: ${name}
- **Description**: ${desc}
- **Detected Stack**: ${types}

## Repository Structure
Key directories in this codebase:
${importantDirs || "- `src/`: Core source code\n- `tests/`: Automated test suite"}

## Development Setup
1. Clone the repository and navigate to the project directory.
2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`
3. Verify environment configuration:
   - Copy \`.env.example\` to \`.env\` if present.
   - Never commit private secrets or credentials.

## Build Commands
${scripts.build ? `\`\`\`bash
${buildCmd}
\`\`\`` : "No build command detected in package.json."}

## Test Commands
Run the automated test suite before proposing changes:
${scripts.test || scripts["test:run"] ? `\`\`\`bash
${testCmd}
\`\`\`` : "No test script configured yet."}

## Lint & Quality Verification
Verify static analysis and formatting:
${scripts.lint ? `\`\`\`bash
${lintCmd}
\`\`\`` : "No lint script configured yet."}

## Coding Guidelines
- **TypeScript**: Strict mode enabled. Avoid arbitrary \`any\` types; declare explicit interfaces.
- **Modularity**: Keep modules focused and avoid oversized multi-responsibility files.
- **Clean Architecture**: Place reusable utilities in appropriate subdirectories.
- **Verification**: Always run tests and type checking after modifying code.

## Important Files
- \`package.json\`: Project manifest, scripts, and dependency definitions.
${context.hasTsConfig ? "- `tsconfig.json`: TypeScript compiler options and path aliases.\n" : ""}- \`README.md\`: High-level human documentation.
- \`.gitignore\`: Git exclusion rules.

## Safety Rules
- **Secrets**: Never commit \`.env\`, API keys, private certificates, or session tokens.
- **Destructive Actions**: Do not delete critical configuration files or force-push without confirmation.
- **Command Safety**: Do not run arbitrary shell scripts without explicit user review.
`;
}
function formatDirDescription(type) {
  switch (type) {
    case "src":
      return "Primary application source code";
    case "app":
      return "Application entry points and routing";
    case "components":
      return "Reusable UI/logic components";
    case "tests":
    case "test":
    case "__tests__":
      return "Automated unit and integration test suites";
    case "docs":
      return "Project documentation and guides";
    case "scripts":
      return "Build, deployment, and automation scripts";
    default:
      return `${type} directory`;
  }
}

// src/commands/initCommand.ts
function runInitCommand(options = {}) {
  const targetDir = path6.resolve(options.cwd || process.cwd());
  const agentsPath = path6.join(targetDir, "AGENTS.md");
  if (fileExists(agentsPath) && !options.force) {
    const message = `AGENTS.md already exists at ${agentsPath}. Use ${chalk2.cyan("--force")} to overwrite.`;
    console.warn(chalk2.yellow(`\u26A0 ${message}`));
    return {
      success: false,
      message,
      targetPath: agentsPath
    };
  }
  const context = scanRepository(targetDir);
  const content = generateAgentsTemplate(context);
  try {
    fs3.writeFileSync(agentsPath, content, "utf-8");
    const message = `Generated AGENTS.md successfully at ${path6.relative(process.cwd(), agentsPath) || "AGENTS.md"}`;
    console.log(chalk2.green(`\u2713 ${message}`));
    return {
      success: true,
      message,
      targetPath: agentsPath
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const message = `Failed to write AGENTS.md: ${errMsg}`;
    console.error(chalk2.red(`\u2716 ${message}`));
    return {
      success: false,
      message,
      targetPath: agentsPath
    };
  }
}

// src/commands/fixCommand.ts
import fs4 from "node:fs";
import path7 from "node:path";
import chalk3 from "chalk";
function runFixCommand(options = {}) {
  const targetDir = path7.resolve(options.cwd || process.cwd());
  const dryRun = Boolean(options.dryRun);
  const context = scanRepository(targetDir);
  const actions = [];
  const agentsMdPath = path7.join(targetDir, "AGENTS.md");
  if (!fileExists(agentsMdPath)) {
    const template = generateAgentsTemplate(context);
    actions.push({
      id: "create-agents-md",
      title: "Create missing AGENTS.md instruction file",
      description: "Generates structured repository guidance populated from package.json and repository tree",
      file: "AGENTS.md",
      diffOrPreview: template,
      apply: () => {
        fs4.writeFileSync(agentsMdPath, template, "utf-8");
      }
    });
  } else {
    const existingContent = readFileSafe(agentsMdPath) || "";
    const parsed = parseInstructionFile(existingContent, "AGENTS.md");
    const sectionsToAppend = [];
    if (!parsed.sections.safety) {
      sectionsToAppend.push(
        `
## Safety Rules
- **Secrets**: Never commit \`.env\`, API keys, or private tokens to version control.
- **Verification**: Always run tests and verify changes before proposing edits.
- **Destructive Commands**: Confirm with the user before deleting files or running external shell scripts.
`
      );
    }
    if (!parsed.sections.build && context.packageJson?.scripts?.build) {
      sectionsToAppend.push(
        `
## Build Commands
\`\`\`bash
npm run build
\`\`\`
`
      );
    }
    if (!parsed.sections.test && context.packageJson?.scripts?.test) {
      sectionsToAppend.push(
        `
## Test Commands
\`\`\`bash
npm test
\`\`\`
`
      );
    }
    if (!parsed.sections.paths && Object.keys(context.structure.importantDirs).length > 0) {
      const dirs = Object.entries(context.structure.importantDirs).filter(([_, rel]) => Boolean(rel)).map(([k, rel]) => `- \`${rel}/\`: ${k} directory`).join("\n");
      sectionsToAppend.push(
        `
## Repository Structure
${dirs}
`
      );
    }
    if (sectionsToAppend.length > 0) {
      const appendedText = sectionsToAppend.join("\n");
      actions.push({
        id: "append-missing-sections",
        title: "Add missing recommended sections to AGENTS.md",
        description: `Appends missing sections (${sectionsToAppend.length} detected) to AGENTS.md`,
        file: "AGENTS.md",
        diffOrPreview: appendedText,
        apply: () => {
          fs4.appendFileSync(agentsMdPath, `
${appendedText}`, "utf-8");
        }
      });
    }
  }
  const gitignorePath = path7.join(targetDir, ".gitignore");
  const gitignoreContent = readFileSafe(gitignorePath) || "";
  const ignoresEnv = gitignoreContent.includes(".env") || gitignoreContent.includes(".env*");
  if (!fileExists(gitignorePath)) {
    const defaultGitignore = `node_modules/
dist/
build/
.env*
!.env.example
*.log
`;
    actions.push({
      id: "create-gitignore",
      title: "Create .gitignore protecting sensitive environment files",
      description: "Adds standard .gitignore covering node_modules, build outputs, and .env files",
      file: ".gitignore",
      diffOrPreview: defaultGitignore,
      apply: () => {
        fs4.writeFileSync(gitignorePath, defaultGitignore, "utf-8");
      }
    });
  } else if (!ignoresEnv && context.hasEnvFile) {
    const addition = `
# Protect environment files
.env*
!.env.example
`;
    actions.push({
      id: "update-gitignore-env",
      title: "Add .env protection to .gitignore",
      description: "Appends .env* exclusion rule to .gitignore to protect secrets from being committed",
      file: ".gitignore",
      diffOrPreview: addition,
      apply: () => {
        fs4.appendFileSync(gitignorePath, addition, "utf-8");
      }
    });
  }
  const envPath = path7.join(targetDir, ".env");
  const envExamplePath = path7.join(targetDir, ".env.example");
  if (fileExists(envPath) && !fileExists(envExamplePath)) {
    const rawEnv = readFileSafe(envPath) || "";
    const exampleLines = rawEnv.split("\n").map((line) => {
      if (line.trim().startsWith("#") || !line.includes("=")) {
        return line;
      }
      const [key] = line.split("=");
      return `${key.trim()}=your_${key.trim().toLowerCase()}_here`;
    }).join("\n");
    actions.push({
      id: "create-env-example",
      title: "Create .env.example template",
      description: "Generates sanitized .env.example with placeholders based on detected .env file",
      file: ".env.example",
      diffOrPreview: exampleLines,
      apply: () => {
        fs4.writeFileSync(envExamplePath, exampleLines, "utf-8");
      }
    });
  }
  console.log("");
  console.log(chalk3.bold("AgentRuleMap Fix Plan"));
  if (dryRun) {
    console.log(chalk3.cyan.bold("Mode: DRY-RUN (no files will be modified)"));
  }
  console.log("");
  if (actions.length === 0) {
    console.log(chalk3.green("\u2713 No automatic fixes needed. Repository is clean."));
    return {
      actionsProposed: 0,
      actionsApplied: 0,
      actions: []
    };
  }
  let appliedCount = 0;
  for (const act of actions) {
    console.log(chalk3.blue.bold(`\u2022 [${act.file}] ${act.title}`));
    console.log(chalk3.dim(`  ${act.description}`));
    console.log(chalk3.dim("  Changes preview:"));
    const previewLines = act.diffOrPreview.trim().split("\n").slice(0, 10).map((l) => chalk3.dim(`    + ${l}`)).join("\n");
    console.log(previewLines);
    if (act.diffOrPreview.trim().split("\n").length > 10) {
      console.log(chalk3.dim("    + ... [truncated]"));
    }
    if (!dryRun) {
      try {
        act.apply();
        appliedCount++;
        console.log(chalk3.green(`  \u2713 Applied fix to ${act.file}`));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(chalk3.red(`  \u2716 Failed to apply fix to ${act.file}: ${msg}`));
      }
    } else {
      console.log(chalk3.cyan(`  \u2192 [dry-run] Would apply fix to ${act.file}`));
    }
    console.log("");
  }
  if (dryRun) {
    console.log(
      chalk3.cyan(`Dry run complete. ${actions.length} potential fix(es) identified. Run without --dry-run to apply.`)
    );
  } else {
    console.log(chalk3.green(`Applied ${appliedCount} of ${actions.length} fix(es).`));
  }
  console.log("");
  return {
    actionsProposed: actions.length,
    actionsApplied: appliedCount,
    actions: actions.map((a) => ({ title: a.title, file: a.file, description: a.description }))
  };
}

// src/commands/resolveCommand.ts
import chalk4 from "chalk";
import path16 from "node:path";

// src/core/instructionEngine.ts
import path15 from "node:path";

// src/adapters/codexAdapter.ts
import path11 from "node:path";

// src/scanners/instructionFileScanner.ts
import fs6 from "node:fs";
import path10 from "node:path";
import YAML from "yaml";

// src/utils/pathUtils.ts
import path8 from "node:path";
function normalizePath(inputPath) {
  if (!inputPath) return "";
  let normalized = inputPath.replace(/\\/g, "/").trim();
  normalized = normalized.replace(/\/+/g, "/");
  while (normalized.startsWith("./")) {
    normalized = normalized.slice(2);
  }
  if (normalized.startsWith("/")) {
    normalized = normalized.slice(1);
  }
  if (normalized.endsWith("/") && normalized.length > 1) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}
function parseAndValidateTargetPath(rawPath, repoRoot) {
  const diagnostics = [];
  const normalized = normalizePath(rawPath);
  if (!rawPath || rawPath.trim() === "" || rawPath === ".") {
    return {
      target: {
        raw: rawPath,
        normalized: "",
        directory: "",
        filename: "",
        extension: "",
        isValid: false,
        isInsideRepo: true
      },
      diagnostics: [
        {
          id: "INVALID_TARGET_PATH",
          severity: "error",
          message: 'Target path cannot be empty or root reference "."',
          targetPath: rawPath
        }
      ]
    };
  }
  const resolvedRoot = path8.resolve(repoRoot);
  const resolvedTarget = path8.resolve(resolvedRoot, normalized);
  const relativeFromRoot = path8.relative(resolvedRoot, resolvedTarget);
  const isEscaped = relativeFromRoot.startsWith("..") || path8.isAbsolute(relativeFromRoot) || resolvedTarget === resolvedRoot;
  if (isEscaped) {
    diagnostics.push({
      id: "PATH_OUTSIDE_REPOSITORY",
      severity: "error",
      message: `Target path "${rawPath}" resolves outside of repository root "${repoRoot}"`,
      targetPath: rawPath,
      details: {
        rawPath,
        resolvedTarget,
        resolvedRoot
      }
    });
    return {
      target: {
        raw: rawPath,
        normalized,
        directory: "",
        filename: path8.basename(normalized),
        extension: path8.extname(normalized),
        isValid: false,
        isInsideRepo: false
      },
      diagnostics
    };
  }
  const posixRelative = normalizePath(relativeFromRoot);
  const directory = path8.posix.dirname(posixRelative) === "." ? "" : path8.posix.dirname(posixRelative);
  const filename = path8.posix.basename(posixRelative);
  const extension = path8.posix.extname(posixRelative);
  return {
    target: {
      raw: rawPath,
      normalized: posixRelative,
      directory,
      filename,
      extension,
      isValid: true,
      isInsideRepo: true
    },
    diagnostics
  };
}
function getDirectoryChain(targetDirectory) {
  const normalized = normalizePath(targetDirectory);
  if (!normalized || normalized === ".") {
    return [""];
  }
  const segments = normalized.split("/").filter(Boolean);
  const chain = [""];
  let current = "";
  for (const seg of segments) {
    current = current ? `${current}/${seg}` : seg;
    chain.push(current);
  }
  return chain;
}
function getPathDepth(posixPath) {
  const norm = normalizePath(posixPath);
  if (!norm || norm === ".") return 0;
  return norm.split("/").filter(Boolean).length;
}

// src/utils/symlinkUtils.ts
import fs5 from "node:fs";
import path9 from "node:path";
function verifySymlinkSafety(targetPath, repoRoot, visitedRealPaths = /* @__PURE__ */ new Set()) {
  const diagnostics = [];
  const resolvedRoot = path9.resolve(repoRoot);
  try {
    const lstat = fs5.lstatSync(targetPath);
    if (!lstat.isSymbolicLink()) {
      return { isSymlink: false, safe: true, realPath: targetPath, diagnostics };
    }
    const realPath = fs5.realpathSync(targetPath);
    if (visitedRealPaths.has(realPath)) {
      diagnostics.push({
        id: "CYCLIC_SYMLINK_DETECTED",
        severity: "error",
        message: `Cyclic symlink detected at "${targetPath}" resolving to "${realPath}"`,
        sourcePath: targetPath
      });
      return { isSymlink: true, safe: false, realPath, diagnostics };
    }
    visitedRealPaths.add(realPath);
    const relativeFromRoot = path9.relative(resolvedRoot, realPath);
    const isEscaping = relativeFromRoot.startsWith("..") || path9.isAbsolute(relativeFromRoot);
    if (isEscaping) {
      diagnostics.push({
        id: "SYMLINK_ESCAPE",
        severity: "error",
        message: `Symlink at "${targetPath}" points outside the repository root to "${realPath}"`,
        sourcePath: targetPath,
        details: { targetPath, realPath, resolvedRoot }
      });
      return { isSymlink: true, safe: false, realPath, diagnostics };
    }
    return {
      isSymlink: true,
      safe: true,
      realPath,
      relativeRealPath: normalizePath(relativeFromRoot),
      diagnostics
    };
  } catch (err) {
    diagnostics.push({
      id: "UNREADABLE_INSTRUCTION_SOURCE",
      severity: "warning",
      message: `Failed to inspect file or symlink metadata at "${targetPath}": ${err instanceof Error ? err.message : String(err)}`,
      sourcePath: targetPath
    });
    return { isSymlink: false, safe: false, diagnostics };
  }
}

// src/scanners/instructionFileScanner.ts
var IGNORED_DIRECTORIES = /* @__PURE__ */ new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  "vendor",
  ".venv",
  "venv",
  "target"
]);
var DEFAULT_MAX_INSTRUCTION_FILE_SIZE = 1024 * 1024;
var InstructionContentCache = class {
  constructor() {
    this.cache = /* @__PURE__ */ new Map();
  }
  get(filePath) {
    return this.cache.get(filePath);
  }
  set(filePath, value) {
    this.cache.set(filePath, value);
  }
  clear() {
    this.cache.clear();
  }
};
function parseFrontmatter(rawContent, sourcePath) {
  const diagnostics = [];
  if (!rawContent.startsWith("---")) {
    return {
      data: {},
      contentBody: rawContent,
      hasFrontmatter: false,
      diagnostics
    };
  }
  const endIdx = rawContent.indexOf("\n---", 3);
  if (endIdx === -1) {
    diagnostics.push({
      id: "INVALID_FRONTMATTER",
      severity: "warning",
      message: 'Unclosed YAML frontmatter: missing closing "---"',
      sourcePath
    });
    return {
      data: {},
      contentBody: rawContent,
      hasFrontmatter: true,
      diagnostics
    };
  }
  const rawYaml = rawContent.slice(3, endIdx).trim();
  const contentBody = rawContent.slice(endIdx + 4).trimStart();
  try {
    const parsed = YAML.parse(rawYaml);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return {
        data: parsed,
        contentBody,
        hasFrontmatter: true,
        diagnostics
      };
    } else if (parsed === null || parsed === void 0) {
      return {
        data: {},
        contentBody,
        hasFrontmatter: true,
        diagnostics
      };
    } else {
      diagnostics.push({
        id: "INVALID_FRONTMATTER",
        severity: "warning",
        message: "Frontmatter must be a key-value mapping",
        sourcePath,
        details: { parsed }
      });
      return {
        data: {},
        contentBody,
        hasFrontmatter: true,
        diagnostics
      };
    }
  } catch (err) {
    diagnostics.push({
      id: "INVALID_FRONTMATTER",
      severity: "warning",
      message: `Failed to parse YAML frontmatter: ${err instanceof Error ? err.message : String(err)}`,
      sourcePath,
      details: { rawYaml }
    });
    return {
      data: {},
      contentBody,
      hasFrontmatter: true,
      diagnostics
    };
  }
}
function readInstructionFileCached(absolutePath, repoRoot, cache, maxFileSize = DEFAULT_MAX_INSTRUCTION_FILE_SIZE) {
  const relativePath = normalizePath(path10.relative(repoRoot, absolutePath));
  const cached = cache?.get(absolutePath);
  if (cached) {
    const parsingState2 = cached.diagnostics.some(
      (d) => d.severity === "error"
    ) ? "error" : cached.diagnostics.length > 0 ? "warning" : "parsed";
    return {
      rawContent: cached.rawContent,
      frontmatter: cached.frontmatter,
      parsingState: parsingState2,
      diagnostics: [...cached.diagnostics]
    };
  }
  const diagnostics = [];
  const symlinkResult = verifySymlinkSafety(absolutePath, repoRoot);
  if (!symlinkResult.safe) {
    diagnostics.push(...symlinkResult.diagnostics);
    return {
      rawContent: "",
      frontmatter: {
        data: {},
        contentBody: "",
        hasFrontmatter: false,
        diagnostics: []
      },
      parsingState: "error",
      diagnostics
    };
  }
  try {
    const stat = fs6.statSync(absolutePath);
    if (stat.size > maxFileSize) {
      diagnostics.push({
        id: "ARM020_OVERSIZED_INSTRUCTION_FILE",
        severity: "warning",
        message: `Instruction file "${relativePath}" (${stat.size} bytes) exceeds the maximum allowed size limit of ${maxFileSize} bytes. Parsing skipped to prevent unbounded resource consumption.`,
        sourcePath: relativePath,
        details: { size: stat.size, maxSize: maxFileSize }
      });
      return {
        rawContent: "",
        frontmatter: {
          data: {},
          contentBody: "",
          hasFrontmatter: false,
          diagnostics: []
        },
        parsingState: "warning",
        diagnostics
      };
    }
  } catch {
  }
  let rawContent = "";
  try {
    rawContent = fs6.readFileSync(absolutePath, "utf8");
  } catch (err) {
    diagnostics.push({
      id: "UNREADABLE_INSTRUCTION_SOURCE",
      severity: "error",
      message: `Unable to read instruction file at "${relativePath}": ${err instanceof Error ? err.message : String(err)}`,
      sourcePath: relativePath
    });
    return {
      rawContent: "",
      frontmatter: {
        data: {},
        contentBody: "",
        hasFrontmatter: false,
        diagnostics: []
      },
      parsingState: "error",
      diagnostics
    };
  }
  const frontmatter = parseFrontmatter(rawContent, relativePath);
  diagnostics.push(...frontmatter.diagnostics);
  const parsingState = diagnostics.some((d) => d.severity === "error") ? "error" : diagnostics.length > 0 ? "warning" : "parsed";
  const entry = {
    rawContent,
    frontmatter,
    diagnostics
  };
  cache?.set(absolutePath, entry);
  return {
    rawContent,
    frontmatter,
    parsingState,
    diagnostics
  };
}
function findFilesRecursively(rootDir, isCandidate, currentRelDir = "", maxDepth = 20, currentDepth = 0) {
  if (currentDepth > maxDepth) return [];
  const currentAbsDir = currentRelDir ? path10.join(rootDir, currentRelDir) : rootDir;
  if (!fs6.existsSync(currentAbsDir)) return [];
  let entries = [];
  try {
    entries = fs6.readdirSync(currentAbsDir, { withFileTypes: true });
  } catch {
    return [];
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));
  const results = [];
  for (const entry of entries) {
    const entryName = entry.name;
    const relPath = currentRelDir ? `${currentRelDir}/${entryName}` : entryName;
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entryName)) {
        continue;
      }
      results.push(
        ...findFilesRecursively(
          rootDir,
          isCandidate,
          relPath,
          maxDepth,
          currentDepth + 1
        )
      );
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      if (isCandidate(relPath, entryName)) {
        results.push(normalizePath(relPath));
      }
    }
  }
  return results;
}

// src/adapters/codexAdapter.ts
var CodexAdapter = class {
  constructor() {
    this.id = "codex";
    this.name = "Codex / Autonomous Coding Agent Profile";
    this.description = "Discovers and resolves hierarchical AGENTS.md and AGENTS.override.md files from repository root to target path.";
    this.supportedFiles = ["AGENTS.md", "AGENTS.override.md"];
  }
  discover(rootDir, _options, cache) {
    const discoveredPaths = findFilesRecursively(
      rootDir,
      (_relPath, filename) => filename === "AGENTS.md" || filename === "AGENTS.override.md"
    );
    discoveredPaths.sort((a, b) => a.localeCompare(b));
    const sources = [];
    for (const relPath of discoveredPaths) {
      const absPath = path11.join(rootDir, relPath);
      const fileData = readInstructionFileCached(absPath, rootDir, cache);
      const filename = path11.posix.basename(relPath);
      const dir = path11.posix.dirname(relPath);
      const scopeRoot = dir === "." ? "" : normalizePath(dir);
      const depth = getPathDepth(scopeRoot);
      const isOverride = filename === "AGENTS.override.md";
      const priority = isOverride ? 10 : 0;
      const score = depth * 100 + priority;
      const sourceType = isOverride ? "override" : scopeRoot === "" ? "root" : "directory";
      const specificity = {
        depth,
        priority,
        isOverride,
        hasPattern: false,
        score
      };
      sources.push({
        id: `codex:${relPath}`,
        profile: "codex",
        sourceType,
        filePath: relPath,
        absolutePath: absPath,
        scopeRoot,
        scope: {
          kind: scopeRoot === "" ? "repository" : "directory",
          root: scopeRoot
        },
        specificity,
        rawContent: fileData.rawContent,
        metadata: {
          isOverride,
          scopeDirectory: scopeRoot || "/",
          frontmatter: fileData.frontmatter.data
        },
        parsingState: fileData.parsingState,
        diagnostics: fileData.diagnostics
      });
    }
    return sources;
  }
  resolveForTarget(target, sources, _options) {
    const diagnostics = [];
    const matchedSources = [];
    const rejectedSources = [];
    if (!target.isValid || !target.isInsideRepo) {
      return {
        targetPath: target,
        profile: "codex",
        matchedSources: [],
        rejectedSources: sources.map((s) => ({
          source: s,
          reason: "Target path is invalid or outside repository boundaries"
        })),
        stack: {
          profile: "codex",
          targetPath: target.normalized,
          layers: []
        },
        diagnostics
      };
    }
    const dirChain = new Set(getDirectoryChain(target.directory));
    for (const source of sources) {
      if (dirChain.has(source.scopeRoot)) {
        matchedSources.push(source);
      } else {
        rejectedSources.push({
          source,
          reason: `Scope root "${source.scopeRoot || "/"}" is not an ancestor directory of target directory "${target.directory || "/"}"`
        });
      }
    }
    matchedSources.sort((a, b) => {
      if (a.specificity.score !== b.specificity.score) {
        return a.specificity.score - b.specificity.score;
      }
      return a.filePath.localeCompare(b.filePath);
    });
    const stack = {
      profile: "codex",
      targetPath: target.normalized,
      layers: matchedSources.map((source, index) => ({
        source,
        layerIndex: index,
        specificity: source.specificity,
        matchedReason: source.specificity.isOverride ? `Override instruction applying to directory scope "${source.scopeRoot || "/"}"` : source.scopeRoot === "" ? "Repository-level baseline instruction" : `Hierarchical directory-level instruction applying to "${source.scopeRoot}"`
      }))
    };
    return {
      targetPath: target,
      profile: "codex",
      matchedSources,
      rejectedSources,
      stack,
      diagnostics
    };
  }
};

// src/adapters/copilotAdapter.ts
import path12 from "node:path";

// src/globs/matcher.ts
import picomatch from "picomatch";
function splitTopLevelCommas(input) {
  const parts = [];
  let current = "";
  let braceDepth = 0;
  let bracketDepth = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === "{") {
      braceDepth++;
      current += char;
    } else if (char === "}") {
      if (braceDepth > 0) braceDepth--;
      current += char;
    } else if (char === "[") {
      bracketDepth++;
      current += char;
    } else if (char === "]") {
      if (bracketDepth > 0) bracketDepth--;
      current += char;
    } else if (char === "," && braceDepth === 0 && bracketDepth === 0) {
      if (current.trim()) {
        parts.push(current.trim());
      }
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    parts.push(current.trim());
  }
  return parts;
}
function validateGlob(pattern) {
  let brace = 0;
  let bracket = 0;
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === "{") brace++;
    else if (pattern[i] === "}") {
      if (brace > 0) brace--;
      else return 'Unmatched closing brace "}"';
    } else if (pattern[i] === "[") bracket++;
    else if (pattern[i] === "]") {
      if (bracket > 0) bracket--;
      else return 'Unmatched closing bracket "]"';
    }
  }
  if (brace > 0) return 'Unclosed brace "{" in glob pattern';
  if (bracket > 0) return 'Unclosed bracket "[" in glob pattern';
  try {
    picomatch.makeRe(pattern);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}
function parseApplyTo(rawApplyTo, sourcePath) {
  const diagnostics = [];
  if (rawApplyTo === void 0 || rawApplyTo === null) {
    return {
      rawApplyTo: void 0,
      patterns: ["**/*"],
      // Default when not specified in general instruction files
      diagnostics
    };
  }
  const rawString = typeof rawApplyTo === "string" ? rawApplyTo : String(rawApplyTo);
  if (typeof rawApplyTo !== "string" && !Array.isArray(rawApplyTo)) {
    diagnostics.push({
      id: "INVALID_APPLY_TO",
      severity: "warning",
      message: `Expected applyTo to be a glob string or array of strings, received ${typeof rawApplyTo}`,
      sourcePath,
      details: { rawApplyTo }
    });
    return {
      rawApplyTo: rawString,
      patterns: [],
      diagnostics
    };
  }
  const patterns = [];
  const addAndValidatePattern = (p) => {
    const normalized = normalizePath(p);
    const globError = validateGlob(normalized);
    if (globError) {
      diagnostics.push({
        id: "INVALID_GLOB",
        severity: "error",
        message: `Invalid glob pattern "${p}": ${globError}`,
        sourcePath,
        details: { pattern: p, error: globError }
      });
    } else {
      patterns.push(normalized);
    }
  };
  if (Array.isArray(rawApplyTo)) {
    for (const item of rawApplyTo) {
      if (typeof item !== "string" || item.trim() === "") {
        diagnostics.push({
          id: "INVALID_APPLY_TO",
          severity: "warning",
          message: `Array applyTo item is not a valid string: ${JSON.stringify(item)}`,
          sourcePath
        });
        continue;
      }
      addAndValidatePattern(item);
    }
  } else {
    const split = splitTopLevelCommas(rawApplyTo);
    if (split.length === 0) {
      diagnostics.push({
        id: "INVALID_APPLY_TO",
        severity: "warning",
        message: "Empty applyTo pattern provided",
        sourcePath,
        details: { rawApplyTo }
      });
    } else {
      for (const p of split) {
        addAndValidatePattern(p);
      }
    }
  }
  return {
    rawApplyTo: rawString,
    patterns,
    diagnostics
  };
}
function matchesGlobPatterns(targetPath, patterns) {
  const normalizedTarget = normalizePath(targetPath);
  if (patterns.length === 0) {
    return {
      matched: false,
      evaluatedPatterns: patterns,
      normalizedTarget
    };
  }
  for (const pattern of patterns) {
    try {
      const isMatch = picomatch(pattern, { dot: true });
      if (isMatch(normalizedTarget)) {
        return {
          matched: true,
          matchedPattern: pattern,
          evaluatedPatterns: patterns,
          normalizedTarget
        };
      }
    } catch {
    }
  }
  return {
    matched: false,
    evaluatedPatterns: patterns,
    normalizedTarget
  };
}

// src/adapters/copilotAdapter.ts
var CopilotAdapter = class {
  constructor() {
    this.id = "copilot";
    this.name = "GitHub Copilot Profile";
    this.description = "Discovers .github/copilot-instructions.md and scoped .github/instructions/**/*.instructions.md with frontmatter applyTo rules.";
    this.supportedFiles = [
      ".github/copilot-instructions.md",
      ".github/instructions/**/*.instructions.md"
    ];
  }
  discover(rootDir, _options, cache) {
    const discoveredPaths = [];
    const repoInstructionsPath = path12.join(
      rootDir,
      ".github",
      "copilot-instructions.md"
    );
    try {
      if (readInstructionFileCached(repoInstructionsPath, rootDir, cache).rawContent !== "" || // Check if file physically exists
      path12.join(rootDir, ".github", "copilot-instructions.md")) {
      }
    } catch {
    }
    const candidateFiles = findFilesRecursively(rootDir, (relPath, filename) => {
      if (relPath === ".github/copilot-instructions.md") return true;
      if (relPath.startsWith(".github/instructions/") && filename.endsWith(".instructions.md")) {
        return true;
      }
      return false;
    });
    candidateFiles.sort((a, b) => a.localeCompare(b));
    const sources = [];
    for (const relPath of candidateFiles) {
      const absPath = path12.join(rootDir, relPath);
      const fileData = readInstructionFileCached(absPath, rootDir, cache);
      const isRepoLevel = relPath === ".github/copilot-instructions.md";
      const sourceType = isRepoLevel ? "root" : "file-pattern";
      const rawApplyTo = fileData.frontmatter.data["applyTo"];
      const globParse = parseApplyTo(rawApplyTo, relPath);
      const combinedDiagnostics = [
        ...fileData.diagnostics,
        ...globParse.diagnostics
      ];
      const depth = isRepoLevel ? 0 : 1;
      const priority = isRepoLevel ? 0 : 50;
      const specificity = {
        depth,
        priority,
        isOverride: false,
        hasPattern: !isRepoLevel,
        score: depth * 100 + priority
      };
      sources.push({
        id: `copilot:${relPath}`,
        profile: "copilot",
        sourceType,
        filePath: relPath,
        absolutePath: absPath,
        scopeRoot: "",
        scope: {
          kind: isRepoLevel ? "repository" : "glob",
          root: "",
          patterns: isRepoLevel ? ["**/*"] : globParse.patterns,
          rawApplyTo: globParse.rawApplyTo
        },
        specificity,
        rawContent: fileData.rawContent,
        metadata: {
          isRepoLevel,
          frontmatter: fileData.frontmatter.data,
          applyTo: globParse.rawApplyTo,
          parsedPatterns: globParse.patterns
        },
        parsingState: combinedDiagnostics.some((d) => d.severity === "error") ? "error" : combinedDiagnostics.length > 0 ? "warning" : "parsed",
        diagnostics: combinedDiagnostics
      });
    }
    return sources;
  }
  resolveForTarget(target, sources, _options) {
    const matchedSources = [];
    const rejectedSources = [];
    const diagnostics = [];
    if (!target.isValid || !target.isInsideRepo) {
      return {
        targetPath: target,
        profile: "copilot",
        matchedSources: [],
        rejectedSources: sources.map((s) => ({
          source: s,
          reason: "Target path is invalid or outside repository boundaries"
        })),
        stack: {
          profile: "copilot",
          targetPath: target.normalized,
          layers: []
        },
        diagnostics
      };
    }
    for (const source of sources) {
      diagnostics.push(...source.diagnostics);
      if (source.filePath === ".github/copilot-instructions.md") {
        matchedSources.push(source);
        continue;
      }
      const patterns = source.scope.patterns || [];
      const matchResult = matchesGlobPatterns(target.normalized, patterns);
      if (matchResult.matched) {
        matchedSources.push(source);
      } else {
        rejectedSources.push({
          source,
          reason: `Target path "${target.normalized}" does not match patterns: ${patterns.join(", ") || "(none)"}`
        });
      }
    }
    matchedSources.sort((a, b) => {
      if (a.specificity.score !== b.specificity.score) {
        return a.specificity.score - b.specificity.score;
      }
      return a.filePath.localeCompare(b.filePath);
    });
    const stack = {
      profile: "copilot",
      targetPath: target.normalized,
      layers: matchedSources.map((source, index) => ({
        source,
        layerIndex: index,
        specificity: source.specificity,
        matchedReason: source.filePath === ".github/copilot-instructions.md" ? "Repository-level Copilot instruction applies to all target paths" : `Matched pattern (${source.scope.rawApplyTo || source.scope.patterns?.join(", ")}) for target path "${target.normalized}"`
      }))
    };
    return {
      targetPath: target,
      profile: "copilot",
      matchedSources,
      rejectedSources,
      stack,
      diagnostics
    };
  }
};

// src/adapters/geminiAdapter.ts
import path13 from "node:path";
var GeminiAdapter = class {
  constructor() {
    this.id = "gemini";
    this.name = "Gemini CLI Profile";
    this.description = "Discovers and hierarchically resolves GEMINI.md instruction files from repository root down to target path.";
    this.supportedFiles = ["GEMINI.md"];
  }
  discover(rootDir, _options, cache) {
    const discoveredPaths = findFilesRecursively(
      rootDir,
      (_relPath, filename) => filename === "GEMINI.md"
    );
    discoveredPaths.sort((a, b) => a.localeCompare(b));
    const sources = [];
    for (const relPath of discoveredPaths) {
      const absPath = path13.join(rootDir, relPath);
      const fileData = readInstructionFileCached(absPath, rootDir, cache);
      const dir = path13.posix.dirname(relPath);
      const scopeRoot = dir === "." ? "" : normalizePath(dir);
      const depth = getPathDepth(scopeRoot);
      const score = depth * 100;
      const sourceType = scopeRoot === "" ? "root" : "directory";
      const specificity = {
        depth,
        priority: 0,
        isOverride: false,
        hasPattern: false,
        score
      };
      sources.push({
        id: `gemini:${relPath}`,
        profile: "gemini",
        sourceType,
        filePath: relPath,
        absolutePath: absPath,
        scopeRoot,
        scope: {
          kind: scopeRoot === "" ? "repository" : "directory",
          root: scopeRoot
        },
        specificity,
        rawContent: fileData.rawContent,
        metadata: {
          scopeDirectory: scopeRoot || "/",
          normalizedSpecificity: score,
          note: "AgentRuleMap normalized directory specificity; vendor hierarchy preserves all directory layers"
        },
        parsingState: fileData.parsingState,
        diagnostics: fileData.diagnostics
      });
    }
    return sources;
  }
  resolveForTarget(target, sources, _options) {
    const matchedSources = [];
    const rejectedSources = [];
    const diagnostics = [];
    if (!target.isValid || !target.isInsideRepo) {
      return {
        targetPath: target,
        profile: "gemini",
        matchedSources: [],
        rejectedSources: sources.map((s) => ({
          source: s,
          reason: "Target path is invalid or outside repository boundaries"
        })),
        stack: {
          profile: "gemini",
          targetPath: target.normalized,
          layers: []
        },
        diagnostics
      };
    }
    const dirChain = new Set(getDirectoryChain(target.directory));
    for (const source of sources) {
      diagnostics.push(...source.diagnostics);
      if (dirChain.has(source.scopeRoot)) {
        matchedSources.push(source);
      } else {
        rejectedSources.push({
          source,
          reason: `GEMINI.md at "${source.scopeRoot || "/"}" is outside the directory ancestry of target "${target.normalized}"`
        });
      }
    }
    matchedSources.sort((a, b) => {
      if (a.specificity.score !== b.specificity.score) {
        return a.specificity.score - b.specificity.score;
      }
      return a.filePath.localeCompare(b.filePath);
    });
    const stack = {
      profile: "gemini",
      targetPath: target.normalized,
      layers: matchedSources.map((source, index) => ({
        source,
        layerIndex: index,
        specificity: source.specificity,
        matchedReason: source.scopeRoot === "" ? "Root GEMINI.md repository context" : `Directory GEMINI.md context applying to "${source.scopeRoot}"`
      }))
    };
    return {
      targetPath: target,
      profile: "gemini",
      matchedSources,
      rejectedSources,
      stack,
      diagnostics
    };
  }
};

// src/adapters/genericAdapter.ts
import path14 from "node:path";
var GenericAdapter = class {
  constructor() {
    this.id = "generic";
    this.name = "Generic Informational Profile";
    this.description = "Informational profile that discovers all common AI instruction files (AGENTS.md, CLAUDE.md, GEMINI.md, .github/copilot-instructions.md) without enforcing vendor-specific precedence.";
    this.supportedFiles = [
      "AGENTS.md",
      "AGENTS.override.md",
      "CLAUDE.md",
      "GEMINI.md",
      ".github/copilot-instructions.md",
      ".cursorrules"
    ];
  }
  discover(rootDir, _options, cache) {
    const candidateFiles = findFilesRecursively(rootDir, (relPath, filename) => {
      if (filename === "AGENTS.md" || filename === "AGENTS.override.md" || filename === "CLAUDE.md" || filename === "GEMINI.md" || filename === ".cursorrules" || relPath === ".github/copilot-instructions.md") {
        return true;
      }
      return false;
    });
    candidateFiles.sort((a, b) => a.localeCompare(b));
    const sources = [];
    for (const relPath of candidateFiles) {
      const absPath = path14.join(rootDir, relPath);
      const fileData = readInstructionFileCached(absPath, rootDir, cache);
      const dir = path14.posix.dirname(relPath);
      const scopeRoot = dir === "." ? "" : normalizePath(dir);
      const specificity = {
        depth: 0,
        priority: 0,
        score: 0
      };
      sources.push({
        id: `generic:${relPath}`,
        profile: "generic",
        sourceType: "informational",
        filePath: relPath,
        absolutePath: absPath,
        scopeRoot,
        scope: {
          kind: "informational",
          root: scopeRoot
        },
        specificity,
        rawContent: fileData.rawContent,
        metadata: {
          scopeDirectory: scopeRoot || "/",
          informationalOnly: true,
          frontmatter: fileData.frontmatter.data
        },
        parsingState: fileData.parsingState,
        diagnostics: fileData.diagnostics
      });
    }
    return sources;
  }
  resolveForTarget(target, sources, _options) {
    const diagnostics = [];
    if (!target.isValid || !target.isInsideRepo) {
      return {
        targetPath: target,
        profile: "generic",
        matchedSources: [],
        rejectedSources: sources.map((s) => ({
          source: s,
          reason: "Target path is invalid or outside repository boundaries"
        })),
        stack: {
          profile: "generic",
          targetPath: target.normalized,
          layers: []
        },
        diagnostics
      };
    }
    for (const s of sources) {
      diagnostics.push(...s.diagnostics);
    }
    const matched = [...sources].sort((a, b) => a.filePath.localeCompare(b.filePath));
    const stack = {
      profile: "generic",
      targetPath: target.normalized,
      layers: matched.map((source, index) => ({
        source,
        layerIndex: index,
        specificity: source.specificity,
        matchedReason: "Informational candidate discovery (vendor precedence not applied)"
      }))
    };
    return {
      targetPath: target,
      profile: "generic",
      matchedSources: matched,
      rejectedSources: [],
      stack,
      diagnostics
    };
  }
};

// src/adapters/registry.ts
var AdapterRegistry = class {
  constructor() {
    this.adapters = /* @__PURE__ */ new Map();
    this.register(new CodexAdapter());
    this.register(new CopilotAdapter());
    this.register(new GeminiAdapter());
    this.register(new GenericAdapter());
  }
  register(adapter) {
    this.adapters.set(adapter.id, adapter);
  }
  get(id) {
    const adapter = this.adapters.get(id);
    if (!adapter) {
      throw new Error(`Unsupported instruction profile adapter: "${id}"`);
    }
    return adapter;
  }
  has(id) {
    return this.adapters.has(id);
  }
  getAll() {
    return Array.from(this.adapters.values());
  }
  getProfiles() {
    return this.getAll().map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      supportedFiles: a.supportedFiles
    }));
  }
};
var defaultAdapterRegistry = new AdapterRegistry();

// src/core/instructionEngine.ts
var InstructionEngine = class {
  constructor(config = {}) {
    this.rootDir = path15.resolve(config.rootDir || process.cwd());
    this.registry = config.registry || defaultAdapterRegistry;
    this.cache = new InstructionContentCache();
  }
  /**
   * Discovers all instruction sources for a given profile in the repository.
   */
  discover(profileId, options) {
    const adapter = this.registry.get(profileId);
    return adapter.discover(this.rootDir, options, this.cache);
  }
  /**
   * Resolves instructions for a target file path according to the specified profile.
   */
  resolve(rawTargetPath, profileId, options) {
    const adapter = this.registry.get(profileId);
    const { target, diagnostics: pathDiagnostics } = parseAndValidateTargetPath(
      rawTargetPath,
      this.rootDir
    );
    if (!target.isValid || !target.isInsideRepo) {
      const emptyResolution = {
        targetPath: target,
        profile: profileId,
        matchedSources: [],
        rejectedSources: [],
        stack: {
          profile: profileId,
          targetPath: target.normalized || rawTargetPath,
          layers: []
        },
        diagnostics: pathDiagnostics
      };
      return emptyResolution;
    }
    const sources = this.discover(profileId);
    const resolution = adapter.resolveForTarget(
      target,
      sources,
      options
    );
    const allDiagnostics = [
      ...pathDiagnostics,
      ...resolution.diagnostics
    ];
    const seen = /* @__PURE__ */ new Set();
    const dedupedDiagnostics = allDiagnostics.filter((d) => {
      const key = `${d.id}:${d.sourcePath || ""}:${d.targetPath || ""}:${d.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return {
      ...resolution,
      diagnostics: dedupedDiagnostics
    };
  }
  /**
   * Resolves instructions for a target path across all supported profiles.
   */
  resolveAll(rawTargetPath, options) {
    const profiles = [
      "codex",
      "copilot",
      "gemini",
      "generic"
    ];
    const results = {};
    for (const p of profiles) {
      results[p] = this.resolve(rawTargetPath, p, options);
    }
    return results;
  }
  /**
   * Clears the instruction file cache.
   */
  clearCache() {
    this.cache.clear();
  }
};

// src/diagnostics/registry.ts
var DIAGNOSTIC_REGISTRY = {
  ARM001_INVALID_FRONTMATTER: {
    id: "ARM001_INVALID_FRONTMATTER",
    title: "Invalid YAML Frontmatter",
    defaultSeverity: "warning",
    description: "YAML frontmatter in an instruction file is malformed, unclosed, or cannot be parsed.",
    trigger: 'An instruction markdown file contains unclosed "---" or invalid YAML syntax.',
    example: "---\napplyTo: [invalid: yaml\n---",
    remediation: 'Ensure YAML frontmatter is a valid YAML key-value mapping enclosed between "---" markers.',
    causesStrictModeFailure: false
  },
  ARM002_INVALID_GLOB: {
    id: "ARM002_INVALID_GLOB",
    title: "Invalid Glob Pattern",
    defaultSeverity: "error",
    description: "A glob pattern specified in an instruction file is invalid or malformed.",
    trigger: "An applyTo or path pattern contains unclosed brackets or syntax that picomatch cannot parse.",
    example: 'applyTo: "src/[a-"',
    remediation: "Check glob pattern syntax and close all brackets, braces, and wildcards properly.",
    causesStrictModeFailure: true
  },
  ARM003_EMPTY_SCOPE: {
    id: "ARM003_EMPTY_SCOPE",
    title: "Empty Instruction Scope",
    defaultSeverity: "warning",
    description: "An instruction file declares an empty or whitespace-only scope or applyTo field.",
    trigger: "applyTo is specified as an empty string, empty array, or whitespace.",
    example: 'applyTo: ""',
    remediation: "Provide a valid glob pattern or remove the empty applyTo field.",
    causesStrictModeFailure: false
  },
  ARM004_DUPLICATE_SCOPE: {
    id: "ARM004_DUPLICATE_SCOPE",
    title: "Duplicate Scope Definition",
    defaultSeverity: "warning",
    description: "Multiple path-specific instruction files declare identical or equivalent scopes.",
    trigger: "Two or more instruction files define the exact same applyTo glob patterns within the same profile.",
    example: 'Two files both specifying applyTo: "src/api/**/*.ts"',
    remediation: "Consolidate the rules into one file or differentiate their scopes.",
    causesStrictModeFailure: false
  },
  ARM005_DUPLICATE_CONTENT: {
    id: "ARM005_DUPLICATE_CONTENT",
    title: "Identical Instruction Content",
    defaultSeverity: "info",
    description: "Multiple instruction files contain identical effective content.",
    trigger: "Two or more instruction files have identical normalized content (ignoring line endings and trailing whitespace).",
    example: "AGENTS.md and packages/api/AGENTS.md have identical instructions.",
    remediation: "Consider keeping instructions in the root or refactoring common rules.",
    causesStrictModeFailure: false
  },
  ARM006_STALE_PATH_REFERENCE: {
    id: "ARM006_STALE_PATH_REFERENCE",
    title: "Stale Path Reference",
    defaultSeverity: "warning",
    description: "An instruction file references a repository-relative path that does not exist.",
    trigger: "A file or directory path in Markdown inline code or relative link cannot be found in the repository.",
    example: "Read `src/legacy-api/README.md` before editing.",
    remediation: "Update or remove reference to the nonexistent file or directory.",
    causesStrictModeFailure: false
  },
  ARM007_MISSING_PACKAGE_SCRIPT: {
    id: "ARM007_MISSING_PACKAGE_SCRIPT",
    title: "Missing Package Script",
    defaultSeverity: "warning",
    description: "An instruction file directs the agent to run an npm/pnpm/yarn/bun script that is not in package.json.",
    trigger: "Instruction contains `npm run lint` or `npm test`, but the scripts field in package.json lacks it.",
    example: 'Run `npm run lint` when package.json has no "lint" script.',
    remediation: 'Add the missing script to package.json "scripts" or correct the command in the instruction file.',
    causesStrictModeFailure: false
  },
  ARM008_SCOPE_MATCHES_NO_FILES: {
    id: "ARM008_SCOPE_MATCHES_NO_FILES",
    title: "Scope Matches No Repository Files",
    defaultSeverity: "warning",
    description: "A path-specific instruction scope matches zero files in the repository.",
    trigger: "An applyTo glob pattern evaluates to zero files in the current repository.",
    example: 'applyTo: "src/legacy/**/*.ts" when src/legacy/ does not exist.',
    remediation: "Verify the glob pattern matches existing files or remove the unused instruction file.",
    causesStrictModeFailure: false
  },
  ARM009_PATH_OUTSIDE_REPOSITORY: {
    id: "ARM009_PATH_OUTSIDE_REPOSITORY",
    title: "Path Traverses Outside Repository",
    defaultSeverity: "error",
    description: "A target path or referenced path escapes the repository boundary.",
    trigger: 'A path uses ".." to escape the repository root.',
    example: "resolve ../../secret.txt",
    remediation: "Restrict paths to within the repository root.",
    causesStrictModeFailure: true
  },
  ARM010_SYMLINK_ESCAPE: {
    id: "ARM010_SYMLINK_ESCAPE",
    title: "Symlink Escapes Repository",
    defaultSeverity: "error",
    description: "A symbolic link points to a target outside the repository root.",
    trigger: "A symlinked instruction file points to /etc/passwd or a parent directory.",
    example: "ln -s /etc/passwd instructions.md",
    remediation: "Remove or repoint the symbolic link to an internal repository target.",
    causesStrictModeFailure: true
  },
  ARM011_OVERLAPPING_SCOPE: {
    id: "ARM011_OVERLAPPING_SCOPE",
    title: "Overlapping Instruction Scopes",
    defaultSeverity: "info",
    description: "Multiple path-specific instruction rules overlap for one or more files.",
    trigger: 'Patterns like "src/**/*.ts" and "src/api/**/*.ts" both match common repository files.',
    example: 'Both applyTo rules match "src/api/users.ts".',
    remediation: "Ensure instruction precedence is intentional or make scopes mutually exclusive.",
    causesStrictModeFailure: false
  },
  ARM012_SHADOWED_SOURCE: {
    id: "ARM012_SHADOWED_SOURCE",
    title: "Shadowed Instruction Source",
    defaultSeverity: "info",
    description: "An instruction source is shadowed by a higher-precedence rule.",
    trigger: "An override instruction file shadows a baseline instruction file in the same scope.",
    example: "AGENTS.override.md taking precedence over AGENTS.md in the root directory.",
    remediation: "Review precedence ordering if the shadowed file was expected to be active.",
    causesStrictModeFailure: false
  },
  ARM013_UNREADABLE_SOURCE: {
    id: "ARM013_UNREADABLE_SOURCE",
    title: "Unreadable Instruction Source",
    defaultSeverity: "error",
    description: "An instruction file cannot be read due to file system or permission error.",
    trigger: "fs.readFileSync fails with EACCES or ENOENT.",
    example: "An instruction file with restricted file permissions.",
    remediation: "Check file permissions and ensure file exists and is accessible.",
    causesStrictModeFailure: true
  },
  ARM014_CYCLIC_SYMLINK: {
    id: "ARM014_CYCLIC_SYMLINK",
    title: "Cyclic Symlink Detected",
    defaultSeverity: "error",
    description: "A circular symbolic link loop was detected.",
    trigger: "Symlink resolves in a loop back to an already-visited path.",
    example: "symlink A -> symlink B -> symlink A.",
    remediation: "Break the symlink loop.",
    causesStrictModeFailure: true
  },
  ARM020_OVERSIZED_INSTRUCTION_FILE: {
    id: "ARM020_OVERSIZED_INSTRUCTION_FILE",
    title: "Oversized Instruction File",
    defaultSeverity: "warning",
    description: "An instruction file exceeds the maximum allowed file size and was skipped to prevent excessive memory consumption.",
    trigger: "An instruction file exceeds the size limit (1 MB / 1,048,576 bytes).",
    example: "A large generated markdown file exceeding 1MB.",
    remediation: "Reduce file size or split repository instructions into smaller scoped files.",
    causesStrictModeFailure: false
  }
};
function createDiagnostic(id, overrides) {
  const def = DIAGNOSTIC_REGISTRY[id];
  const severity = overrides.severity || def?.defaultSeverity || "warning";
  return {
    id,
    severity,
    title: overrides.title || def?.title || id,
    message: overrides.message || def?.description || "",
    sourcePath: overrides.sourcePath,
    targetPath: overrides.targetPath,
    line: overrides.line,
    column: overrides.column,
    details: overrides.details,
    remediation: overrides.remediation || def?.remediation,
    profile: overrides.profile
  };
}
var SEVERITY_ORDER = {
  error: 0,
  warning: 1,
  info: 2
};
function sortDiagnostics(diagnostics) {
  return [...diagnostics].sort((a, b) => {
    const sevA = SEVERITY_ORDER[a.severity] ?? 99;
    const sevB = SEVERITY_ORDER[b.severity] ?? 99;
    if (sevA !== sevB) return sevA - sevB;
    const idCmp = a.id.localeCompare(b.id);
    if (idCmp !== 0) return idCmp;
    const srcA = a.sourcePath || "";
    const srcB = b.sourcePath || "";
    const srcCmp = srcA.localeCompare(srcB);
    if (srcCmp !== 0) return srcCmp;
    const tgtA = a.targetPath || "";
    const tgtB = b.targetPath || "";
    const tgtCmp = tgtA.localeCompare(tgtB);
    if (tgtCmp !== 0) return tgtCmp;
    const lineA = a.line ?? 0;
    const lineB = b.line ?? 0;
    if (lineA !== lineB) return lineA - lineB;
    return a.message.localeCompare(b.message);
  });
}

// src/reporters/sarifReporter.ts
function mapSeverityToSarifLevel(severity) {
  switch (severity) {
    case "error":
      return "error";
    case "warning":
      return "warning";
    case "info":
    default:
      return "note";
  }
}
function toPascalCase(str) {
  return str.replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase()).replace(/^[a-z]/, (chr) => chr.toUpperCase()).replace(/[^a-zA-Z0-9]/g, "");
}
function generateSarifReport(diagnostics, options = {}) {
  const toolName = options.toolName || "AgentRuleMap";
  const version = options.version || "1.0.0";
  const informationUri = options.informationUri || "https://github.com/OWNER/agent-rule-map";
  const rulesMap = /* @__PURE__ */ new Map();
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
            level: mapSeverityToSarifLevel(def.defaultSeverity)
          },
          help: {
            text: `${def.description}${def.remediation ? `

Remediation: ${def.remediation}` : ""}`,
            markdown: `**${def.title}**

${def.description}${def.remediation ? `

### Remediation
${def.remediation}` : ""}`
          }
        });
      } else {
        rulesMap.set(diag.id, {
          id: diag.id,
          name: toPascalCase(diag.title || diag.id),
          shortDescription: { text: diag.title || diag.id },
          fullDescription: { text: diag.message },
          defaultConfiguration: {
            level: mapSeverityToSarifLevel(diag.severity)
          },
          help: {
            text: `${diag.message}${diag.remediation ? `

Remediation: ${diag.remediation}` : ""}`
          }
        });
      }
    }
  }
  const results = diagnostics.map((diag) => {
    const level = mapSeverityToSarifLevel(diag.severity);
    const result = {
      ruleId: diag.id,
      level,
      message: {
        text: diag.message
      }
    };
    const targetUri = diag.sourcePath || diag.targetPath;
    if (targetUri) {
      const normalizedUri = normalizePath(targetUri);
      const location = {
        physicalLocation: {
          artifactLocation: {
            uri: normalizedUri,
            uriBaseId: "%SRCROOT%"
          }
        }
      };
      if (typeof diag.line === "number" && diag.line > 0) {
        location.physicalLocation.region = {
          startLine: diag.line,
          ...typeof diag.column === "number" && diag.column > 0 ? { startColumn: diag.column } : {}
        };
      }
      result.locations = [location];
    }
    return result;
  });
  return {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: toolName,
            semanticVersion: version,
            informationUri,
            rules: Array.from(rulesMap.values())
          }
        },
        results,
        invocations: [
          {
            executionSuccessful: true
          }
        ]
      }
    ]
  };
}
function formatSarifReport(sarifLog, pretty = true) {
  return JSON.stringify(sarifLog, null, pretty ? 2 : void 0);
}

// src/commands/resolveCommand.ts
function runResolveCommand(targetPath, options = {}) {
  const rootDir = options.cwd ? path16.resolve(options.cwd) : process.cwd();
  const engine = new InstructionEngine({ rootDir });
  const rawProfile = (options.profile || "codex").toLowerCase();
  const profileId = rawProfile === "copilot" || rawProfile === "gemini" || rawProfile === "generic" ? rawProfile : "codex";
  const resolution = engine.resolve(targetPath, profileId);
  if (options.json) {
    console.log(JSON.stringify(resolution, null, 2));
    const hasError2 = resolution.diagnostics.some((d) => d.severity === "error");
    return { exitCode: hasError2 ? 1 : 0 };
  }
  console.log(chalk4.bold.cyan("\nAgentRuleMap Instruction Scope Resolution"));
  console.log(chalk4.gray(`Repository: ${rootDir}`));
  console.log(chalk4.gray(`Profile:    ${profileId} (${engine.registry.get(profileId).name})`));
  console.log(chalk4.gray(`Target:     ${targetPath} -> [${resolution.targetPath.normalized || "(invalid)"}]
`));
  if (resolution.diagnostics.length > 0) {
    console.log(chalk4.bold.yellow("Diagnostics:"));
    for (const diag of resolution.diagnostics) {
      const icon = diag.severity === "error" ? chalk4.red("\u2716 [ERROR]") : diag.severity === "warning" ? chalk4.yellow("\u26A0 [WARN]") : chalk4.blue("\u2139 [INFO]");
      console.log(`  ${icon} ${diag.id}: ${diag.message}`);
    }
    console.log();
  }
  if (resolution.matchedSources.length === 0) {
    console.log(chalk4.yellow("No instruction sources match this target path."));
  } else {
    console.log(chalk4.bold.green(`Matched Instruction Stack (${resolution.matchedSources.length} layer(s)):`));
    console.log(chalk4.gray("  (Ordered deterministically: least specific -> most specific)\n"));
    resolution.stack.layers.forEach((layer, idx) => {
      const isOverride = layer.specificity.isOverride ? chalk4.magenta(" [OVERRIDE]") : "";
      console.log(
        `  ${chalk4.cyan(`Layer ${idx + 1}`)}: ${chalk4.bold(layer.source.filePath)}${isOverride}`
      );
      console.log(
        `    ${chalk4.gray("\u2022 Specificity score:")} ${layer.specificity.score} (depth: ${layer.specificity.depth})`
      );
      console.log(`    ${chalk4.gray("\u2022 Scope root:")}        ${layer.source.scopeRoot || "/"}`);
      console.log(`    ${chalk4.gray("\u2022 Reason:")}            ${layer.matchedReason}`);
      console.log();
    });
  }
  if (resolution.rejectedSources.length > 0) {
    console.log(chalk4.bold.gray(`Non-applicable / Rejected Candidates (${resolution.rejectedSources.length}):`));
    for (const rejected of resolution.rejectedSources) {
      console.log(chalk4.gray(`  - ${rejected.source.filePath}: ${rejected.reason}`));
    }
    console.log();
  }
  const hasError = resolution.diagnostics.some((d) => d.severity === "error");
  return { exitCode: hasError ? 1 : 0 };
}
function runDiscoverCommand(options = {}) {
  const rootDir = options.cwd ? path16.resolve(options.cwd) : process.cwd();
  const engine = new InstructionEngine({ rootDir });
  const rawProfile = (options.profile || "generic").toLowerCase();
  const profileId = rawProfile === "codex" || rawProfile === "copilot" || rawProfile === "gemini" ? rawProfile : "generic";
  const sources = engine.discover(profileId);
  const isSarif = options.sarif || options.format === "sarif";
  if (isSarif) {
    const allDiagnostics = sources.flatMap((s) => s.diagnostics);
    const sarifLog = generateSarifReport(allDiagnostics);
    console.log(formatSarifReport(sarifLog));
    const hasError = allDiagnostics.some((d) => d.severity === "error");
    return { exitCode: hasError ? 1 : 0 };
  }
  if (options.json) {
    console.log(JSON.stringify(sources, null, 2));
    return { exitCode: 0 };
  }
  console.log(chalk4.bold.cyan("\nAgentRuleMap Instruction Discovery"));
  console.log(chalk4.gray(`Repository: ${rootDir}`));
  console.log(chalk4.gray(`Profile:    ${profileId}
`));
  if (sources.length === 0) {
    console.log(chalk4.yellow("No instruction files found for this profile."));
    return { exitCode: 0 };
  }
  console.log(chalk4.bold.green(`Found ${sources.length} instruction source(s):
`));
  for (const s of sources) {
    console.log(`  \u2022 ${chalk4.bold(s.filePath)} [${s.sourceType}] (scope: "${s.scopeRoot || "/"}")`);
    if (s.diagnostics.length > 0) {
      for (const d of s.diagnostics) {
        console.log(`      ${chalk4.yellow(`\u26A0 ${d.id}: ${d.message}`)}`);
      }
    }
  }
  console.log();
  return { exitCode: 0 };
}

// src/commands/conflictsCommand.ts
import chalk5 from "chalk";

// src/diagnostics/conflictEngine.ts
import path19 from "node:path";
import crypto from "node:crypto";

// src/diagnostics/repositoryInventory.ts
import fs7 from "node:fs";
import path17 from "node:path";
import picomatch2 from "picomatch";
var RepositoryInventory = class {
  constructor(rootDir) {
    this.files = /* @__PURE__ */ new Set();
    this.directories = /* @__PURE__ */ new Set();
    this.packageJsons = /* @__PURE__ */ new Map();
    this.globMatchesCache = /* @__PURE__ */ new Map();
    this.rootDir = path17.resolve(rootDir);
    this.buildInventory();
  }
  buildInventory() {
    this.directories.add("");
    const queue = [""];
    while (queue.length > 0) {
      const currentRel = queue.shift();
      const currentAbs = currentRel ? path17.join(this.rootDir, currentRel) : this.rootDir;
      let entries = [];
      try {
        entries = fs7.readdirSync(currentAbs, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        const name = entry.name;
        if (IGNORED_DIRECTORIES.has(name)) {
          continue;
        }
        const childRel = currentRel ? `${currentRel}/${name}` : name;
        const normalized = normalizePath(childRel);
        if (entry.isDirectory()) {
          this.directories.add(normalized);
          queue.push(normalized);
        } else if (entry.isFile() || entry.isSymbolicLink()) {
          this.files.add(normalized);
          if (name === "package.json") {
            const absPath = path17.join(this.rootDir, normalized);
            const parsed = readJsonSafe(absPath);
            if (parsed) {
              const dirOfPkg = path17.posix.dirname(normalized) === "." ? "" : path17.posix.dirname(normalized);
              this.packageJsons.set(dirOfPkg, parsed);
            }
          }
        }
      }
    }
  }
  /**
   * Checks whether a repository-relative file exists.
   */
  hasFile(relPath) {
    const normalized = normalizePath(relPath);
    return this.files.has(normalized);
  }
  /**
   * Checks whether a repository-relative directory exists.
   */
  hasDirectory(relDir) {
    const normalized = normalizePath(relDir);
    return this.directories.has(normalized);
  }
  /**
   * Checks whether a repository-relative path exists either as a file or as a directory.
   */
  hasPath(relPath) {
    const normalized = normalizePath(relPath);
    return this.files.has(normalized) || this.directories.has(normalized);
  }
  /**
   * Returns all repository files as a list.
   */
  getAllFiles() {
    return Array.from(this.files);
  }
  /**
   * Returns all repository directories as a list.
   */
  getAllDirectories() {
    return Array.from(this.directories);
  }
  /**
   * Finds the closest package.json starting from the given relative path and walking up to repo root.
   */
  getClosestPackageJson(fromRelPath) {
    let currentDir = normalizePath(fromRelPath);
    if (this.files.has(currentDir)) {
      currentDir = path17.posix.dirname(currentDir) === "." ? "" : path17.posix.dirname(currentDir);
    }
    while (true) {
      const found = this.packageJsons.get(currentDir);
      if (found) {
        return { dir: currentDir, packageJson: found };
      }
      if (!currentDir) {
        break;
      }
      const parent = path17.posix.dirname(currentDir);
      currentDir = parent === "." ? "" : parent;
    }
    const rootPkg = this.packageJsons.get("");
    if (rootPkg) {
      return { dir: "", packageJson: rootPkg };
    }
    return void 0;
  }
  /**
   * Finds all files matching the given glob patterns, with caching.
   */
  findMatchingFiles(patterns) {
    const cacheKey = patterns.join("|||");
    const cached = this.globMatchesCache.get(cacheKey);
    if (cached) {
      return cached;
    }
    const posixPatterns = patterns.map((p) => normalizePath(p));
    const isMatch = picomatch2(posixPatterns, { dot: true });
    const matched = [];
    for (const f of this.files) {
      if (isMatch(f)) {
        matched.push(f);
      }
    }
    matched.sort();
    this.globMatchesCache.set(cacheKey, matched);
    return matched;
  }
};

// src/diagnostics/markdownParser.ts
import path18 from "node:path";
var COMMON_PACKAGES_AND_TOOLS = /* @__PURE__ */ new Set([
  "react",
  "react-dom",
  "vite",
  "vitest",
  "chalk",
  "commander",
  "express",
  "lodash",
  "typescript",
  "node",
  "npm",
  "pnpm",
  "yarn",
  "bun",
  "git",
  "docker",
  "esbuild",
  "picomatch",
  "yaml",
  "zod",
  "tailwindcss",
  "eslint",
  "prettier"
]);
var PROGRAMMING_KEYWORDS = /* @__PURE__ */ new Set([
  "import",
  "export",
  "default",
  "from",
  "function",
  "class",
  "interface",
  "type",
  "const",
  "let",
  "var",
  "true",
  "false",
  "null",
  "undefined",
  "void",
  "never",
  "unknown",
  "any",
  "string",
  "number",
  "boolean",
  "return",
  "async",
  "await",
  "new",
  "this",
  "super"
]);
var FILE_EXTENSIONS = /* @__PURE__ */ new Set([
  ".md",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".xml",
  ".css",
  ".scss",
  ".html",
  ".sh",
  ".bash",
  ".sql",
  ".env",
  ".txt",
  ".svg",
  ".png",
  ".jpg",
  ".lock"
]);
function extractPathReferences(markdownContent) {
  const results = [];
  const lines = markdownContent.split(/\r?\n/);
  let insideCodeFence = false;
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const lineNumber = lineIdx + 1;
    const trimmed = line.trim();
    if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
      insideCodeFence = !insideCodeFence;
      continue;
    }
    if (insideCodeFence) {
      continue;
    }
    const linkRegex = /\[(?:[^\]]*)\]\(([^)]+)\)/g;
    let linkMatch;
    while ((linkMatch = linkRegex.exec(line)) !== null) {
      const fullTarget = linkMatch[1].trim();
      const col = linkMatch.index + 1;
      let urlPart = fullTarget.split(/\s+/)[0];
      if (urlPart.startsWith("<") && urlPart.endsWith(">")) {
        urlPart = urlPart.slice(1, -1);
      }
      if (/^(?:https?:\/\/|ftp:\/\/|mailto:|data:)/i.test(urlPart) || urlPart.startsWith("#")) {
        continue;
      }
      const cleaned = urlPart.split("#")[0].split("?")[0].trim();
      if (!cleaned) {
        continue;
      }
      results.push({
        rawReference: urlPart,
        normalizedPath: normalizePath(cleaned),
        sourceType: "link",
        line: lineNumber,
        column: col
      });
    }
    const codeRegex = /`([^`\n]+)`/g;
    let codeMatch;
    while ((codeMatch = codeRegex.exec(line)) !== null) {
      const raw = codeMatch[1].trim();
      const col = codeMatch.index + 1;
      if (!looksLikePathReference(raw)) {
        continue;
      }
      let cleaned = raw;
      cleaned = cleaned.replace(/[,.:;)]+$/, "");
      if (cleaned.endsWith("/") && cleaned.length > 1) {
        cleaned = cleaned.slice(0, -1);
      }
      results.push({
        rawReference: raw,
        normalizedPath: normalizePath(cleaned),
        sourceType: "code",
        line: lineNumber,
        column: col
      });
    }
  }
  return results;
}
function looksLikePathReference(raw) {
  if (!raw || raw.includes(" ") || raw.includes("	") || raw.includes("\n")) {
    return false;
  }
  if (/^(?:https?:\/\/|ftp:\/\/|mailto:)/i.test(raw) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) {
    return false;
  }
  if (raw.startsWith("-")) {
    return false;
  }
  if (/^v?\d+\.\d+(\.\d+)?(-[a-zA-Z0-9.]+)?$/.test(raw) || /^[\^~><=]/.test(raw)) {
    return false;
  }
  if (raw.startsWith("@")) {
    return false;
  }
  if (PROGRAMMING_KEYWORDS.has(raw)) {
    return false;
  }
  if (COMMON_PACKAGES_AND_TOOLS.has(raw.toLowerCase())) {
    return false;
  }
  if (raw.startsWith("#")) {
    return false;
  }
  if (/^[A-Z][A-Z0-9_]{2,}$/.test(raw)) {
    return false;
  }
  if (raw.includes("*") || raw.includes("?") || raw.includes("{") || raw.includes("}")) {
    return false;
  }
  if (raw.includes("/") || raw.startsWith("./") || raw.startsWith("../")) {
    if (raw.includes("//")) return false;
    return true;
  }
  const ext = path18.extname(raw).toLowerCase();
  if (ext && FILE_EXTENSIONS.has(ext)) {
    return true;
  }
  return false;
}

// src/diagnostics/commandParser.ts
var BUILTIN_YARN_COMMANDS = /* @__PURE__ */ new Set([
  "install",
  "add",
  "remove",
  "upgrade",
  "publish",
  "init",
  "create",
  "config",
  "cache",
  "info",
  "pack",
  "help",
  "version",
  "workspace",
  "workspaces",
  "policies",
  "node",
  "set",
  "dlx",
  "explain",
  "why",
  "dedupe"
]);
var BUILTIN_PNPM_COMMANDS = /* @__PURE__ */ new Set([
  "install",
  "i",
  "add",
  "remove",
  "rm",
  "uninstall",
  "un",
  "update",
  "up",
  "publish",
  "init",
  "create",
  "exec",
  "dlx",
  "outdated",
  "why",
  "prune",
  "pack",
  "root",
  "bin",
  "setup",
  "link",
  "unlink",
  "import",
  "env",
  "server",
  "store",
  "audit"
]);
function extractCommandReferences(markdownContent) {
  const results = [];
  const lines = markdownContent.split(/\r?\n/);
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const lineNumber = lineIdx + 1;
    const pmRegex = /\b(npm|pnpm|yarn|bun)\s+([a-zA-Z0-9_:-]+)(?:\s+([a-zA-Z0-9_:-]+))?/g;
    let match;
    while ((match = pmRegex.exec(line)) !== null) {
      const pm = match[1];
      const firstArg = match[2];
      const secondArg = match[3];
      const col = match.index + 1;
      let scriptName = "";
      let rawCommand = "";
      if (firstArg === "run" || firstArg === "run-script") {
        if (secondArg) {
          scriptName = secondArg;
          rawCommand = `${pm} ${firstArg} ${secondArg}`;
        }
      } else if (firstArg === "test" || firstArg === "t" || firstArg === "tst") {
        scriptName = "test";
        rawCommand = `${pm} ${firstArg}`;
      } else if (firstArg === "start") {
        scriptName = "start";
        rawCommand = `${pm} start`;
      } else if (pm === "yarn" && !BUILTIN_YARN_COMMANDS.has(firstArg)) {
        scriptName = firstArg;
        rawCommand = `yarn ${firstArg}`;
      } else if (pm === "pnpm" && !BUILTIN_PNPM_COMMANDS.has(firstArg)) {
        scriptName = firstArg;
        rawCommand = `pnpm ${firstArg}`;
      }
      if (scriptName) {
        results.push({
          rawCommand,
          packageManager: pm,
          scriptName,
          line: lineNumber,
          column: col
        });
      }
    }
  }
  return results;
}

// src/diagnostics/conflictEngine.ts
var ConflictEngine = class {
  constructor(engine) {
    this.engine = engine;
    this.inventory = new RepositoryInventory(engine.rootDir);
  }
  /**
   * Runs all deterministic conflict and structural diagnostics.
   */
  runConflicts(options = {}) {
    const rawProfile = options.profile || "all";
    const profilesToRun = rawProfile === "all" ? ["codex", "copilot", "gemini", "generic"] : [rawProfile];
    const allDiagnostics = [];
    for (const profileId of profilesToRun) {
      const sources = this.engine.discover(profileId);
      const diagnosticsForProfile = this.analyzeSourcesForProfile(
        sources,
        profileId
      );
      allDiagnostics.push(...diagnosticsForProfile);
    }
    const contentDiagnostics = this.checkContentDuplication(profilesToRun);
    allDiagnostics.push(...contentDiagnostics);
    const deduped = this.deduplicateDiagnostics(allDiagnostics);
    const sorted = sortDiagnostics(deduped);
    const summary = {
      total: sorted.length,
      errors: sorted.filter((d) => d.severity === "error").length,
      warnings: sorted.filter((d) => d.severity === "warning").length,
      info: sorted.filter((d) => d.severity === "info").length
    };
    return {
      schemaVersion: 1,
      command: "conflicts",
      profile: rawProfile,
      repositoryRoot: this.engine.rootDir,
      diagnostics: sorted,
      summary,
      deterministicModeNotice: "Potential semantic conflict detection is not performed in deterministic mode. Only structural and objectively detectable findings are reported."
    };
  }
  analyzeSourcesForProfile(sources, profileId) {
    const diagnostics = [];
    for (const source of sources) {
      for (const d of source.diagnostics) {
        const normalizedId = this.mapToArmId(d.id);
        diagnostics.push(
          createDiagnostic(normalizedId, {
            severity: d.severity,
            message: d.message,
            sourcePath: d.sourcePath || source.filePath,
            targetPath: d.targetPath,
            line: d.line,
            column: d.column,
            details: d.details || void 0,
            profile: profileId
          })
        );
      }
    }
    for (const source of sources) {
      if (source.scope.rawApplyTo !== void 0) {
        const raw = source.scope.rawApplyTo.trim();
        if (!raw || source.scope.patterns && source.scope.patterns.length === 0) {
          diagnostics.push(
            createDiagnostic("ARM003_EMPTY_SCOPE", {
              sourcePath: source.filePath,
              profile: profileId,
              message: `Instruction file "${source.filePath}" declares an empty or whitespace-only scope.`,
              details: { rawApplyTo: source.scope.rawApplyTo }
            })
          );
        }
      }
      if (source.scope.patterns && source.scope.patterns.length > 0) {
        const matched = this.inventory.findMatchingFiles(source.scope.patterns);
        if (matched.length === 0) {
          diagnostics.push(
            createDiagnostic("ARM008_SCOPE_MATCHES_NO_FILES", {
              sourcePath: source.filePath,
              profile: profileId,
              message: `Path-specific instruction file "${source.filePath}" with scope "${source.scope.rawApplyTo || source.scope.patterns.join(", ")}" matches 0 files in repository.`,
              details: {
                patterns: source.scope.patterns,
                rawApplyTo: source.scope.rawApplyTo
              }
            })
          );
        }
      }
    }
    diagnostics.push(...this.checkScopesForProfile(sources, profileId));
    for (const source of sources) {
      diagnostics.push(...this.checkStalePathsInSource(source, profileId));
    }
    for (const source of sources) {
      diagnostics.push(...this.checkCommandReferencesInSource(source, profileId));
    }
    diagnostics.push(...this.checkShadowedSources(sources, profileId));
    return diagnostics;
  }
  /**
   * Checks for duplicate and overlapping scopes among path-specific sources.
   */
  checkScopesForProfile(sources, profileId) {
    const diagnostics = [];
    const pathSources = sources.filter(
      (s) => s.scope.patterns && s.scope.patterns.length > 0
    );
    const patternGroups = /* @__PURE__ */ new Map();
    for (const s of pathSources) {
      const key = [...s.scope.patterns].sort().join("||");
      const list = patternGroups.get(key) || [];
      list.push(s);
      patternGroups.set(key, list);
    }
    for (const [patternKey, group] of patternGroups) {
      if (group.length > 1) {
        const filePaths = group.map((s) => s.filePath);
        for (const s of group) {
          const others = filePaths.filter((p) => p !== s.filePath);
          diagnostics.push(
            createDiagnostic("ARM004_DUPLICATE_SCOPE", {
              sourcePath: s.filePath,
              profile: profileId,
              message: `Instruction file "${s.filePath}" shares identical scope "${s.scope.rawApplyTo || patternKey}" with: ${others.join(", ")}. Both rules may apply to the same targets.`,
              details: {
                sharedScope: s.scope.rawApplyTo || patternKey,
                conflictingSources: others
              }
            })
          );
        }
      }
    }
    for (let i = 0; i < pathSources.length; i++) {
      for (let j = i + 1; j < pathSources.length; j++) {
        const sA = pathSources[i];
        const sB = pathSources[j];
        const keyA = [...sA.scope.patterns].sort().join("||");
        const keyB = [...sB.scope.patterns].sort().join("||");
        if (keyA === keyB) {
          continue;
        }
        const filesA = this.inventory.findMatchingFiles(sA.scope.patterns);
        const filesB = this.inventory.findMatchingFiles(sB.scope.patterns);
        const setB = new Set(filesB);
        const overlap = filesA.filter((f) => setB.has(f));
        if (overlap.length > 0) {
          const sample = overlap[0];
          diagnostics.push(
            createDiagnostic("ARM011_OVERLAPPING_SCOPE", {
              sourcePath: sA.filePath,
              profile: profileId,
              message: `Overlapping instruction scopes between "${sA.filePath}" (${sA.scope.rawApplyTo || keyA}) and "${sB.filePath}" (${sB.scope.rawApplyTo || keyB}). Example overlap: ${sample}`,
              details: {
                sourceA: sA.filePath,
                sourceB: sB.filePath,
                patternsA: sA.scope.patterns,
                patternsB: sB.scope.patterns,
                overlappingFileCount: overlap.length,
                sampleFiles: overlap.slice(0, 5)
              }
            })
          );
        }
      }
    }
    return diagnostics;
  }
  /**
   * Validates markdown links and inline code paths against the repository inventory.
   */
  checkStalePathsInSource(source, profileId) {
    const diagnostics = [];
    const references = extractPathReferences(source.rawContent);
    const sourceDir = path19.posix.dirname(source.filePath) === "." ? "" : path19.posix.dirname(source.filePath);
    for (const ref of references) {
      const rawTarget = ref.normalizedPath;
      const candidateRelativeToFile = sourceDir ? normalizePath(`${sourceDir}/${rawTarget}`) : rawTarget;
      const candidateRelativeToRoot = rawTarget;
      const existsRelativeToFile = this.inventory.hasPath(candidateRelativeToFile);
      const existsRelativeToRoot = this.inventory.hasPath(candidateRelativeToRoot);
      if (!existsRelativeToFile && !existsRelativeToRoot) {
        diagnostics.push(
          createDiagnostic("ARM006_STALE_PATH_REFERENCE", {
            sourcePath: source.filePath,
            targetPath: rawTarget,
            line: ref.line,
            column: ref.column,
            profile: profileId,
            message: `Referenced path "${ref.rawReference}" does not exist in this repository.`,
            details: {
              referencedPath: ref.rawReference,
              referenceType: ref.sourceType,
              checkedPaths: [candidateRelativeToFile, candidateRelativeToRoot]
            }
          })
        );
      }
    }
    return diagnostics;
  }
  /**
   * Validates npm/pnpm/yarn/bun script commands against package.json.
   */
  checkCommandReferencesInSource(source, profileId) {
    const diagnostics = [];
    const commands = extractCommandReferences(source.rawContent);
    if (commands.length === 0) return diagnostics;
    const closestPkg = this.inventory.getClosestPackageJson(source.filePath);
    if (!closestPkg || !closestPkg.packageJson) {
      return diagnostics;
    }
    const scripts = closestPkg.packageJson.scripts || {};
    const pkgRelPath = closestPkg.dir ? `${closestPkg.dir}/package.json` : "package.json";
    for (const cmd of commands) {
      const scriptName = cmd.scriptName;
      if (!Object.prototype.hasOwnProperty.call(scripts, scriptName)) {
        diagnostics.push(
          createDiagnostic("ARM007_MISSING_PACKAGE_SCRIPT", {
            sourcePath: source.filePath,
            line: cmd.line,
            column: cmd.column,
            profile: profileId,
            message: `Instruction references script "${scriptName}" via "${cmd.rawCommand}", but script is not defined in "${pkgRelPath}".`,
            details: {
              script: scriptName,
              command: cmd.rawCommand,
              packageManager: cmd.packageManager,
              packageJsonPath: pkgRelPath
            }
          })
        );
      }
    }
    return diagnostics;
  }
  /**
   * Checks for content duplication across instruction files.
   */
  checkContentDuplication(profiles) {
    const diagnostics = [];
    const seenFiles = /* @__PURE__ */ new Map();
    for (const profileId of profiles) {
      const sources = this.engine.discover(profileId);
      for (const s of sources) {
        if (!seenFiles.has(s.filePath)) {
          seenFiles.set(s.filePath, s);
        }
      }
    }
    const fingerprintGroups = /* @__PURE__ */ new Map();
    for (const [, source] of seenFiles) {
      const normalizedContent = this.computeContentFingerprint(source.rawContent);
      if (normalizedContent.length < 20) {
        continue;
      }
      const hash = crypto.createHash("sha256").update(normalizedContent).digest("hex");
      const list = fingerprintGroups.get(hash) || [];
      list.push(source);
      fingerprintGroups.set(hash, list);
    }
    for (const [, group] of fingerprintGroups) {
      if (group.length > 1) {
        const fileList = group.map((s) => s.filePath);
        for (const s of group) {
          const others = fileList.filter((f) => f !== s.filePath);
          diagnostics.push(
            createDiagnostic("ARM005_DUPLICATE_CONTENT", {
              sourcePath: s.filePath,
              message: `Instruction file "${s.filePath}" contains identical effective content to: ${others.join(", ")}.`,
              details: {
                duplicateWith: others
              }
            })
          );
        }
      }
    }
    return diagnostics;
  }
  /**
   * Identifies shadowed instruction sources (e.g. override files shadowing base files).
   */
  checkShadowedSources(sources, profileId) {
    const diagnostics = [];
    const overrides = sources.filter((s) => s.sourceType === "override");
    for (const ov of overrides) {
      const shadowed = sources.find(
        (s) => s.sourceType === "root" && s.scopeRoot === ov.scopeRoot && s.filePath !== ov.filePath
      );
      if (shadowed) {
        diagnostics.push(
          createDiagnostic("ARM012_SHADOWED_SOURCE", {
            sourcePath: shadowed.filePath,
            profile: profileId,
            message: `Instruction file "${shadowed.filePath}" is shadowed by override "${ov.filePath}".`,
            details: {
              shadowedBy: ov.filePath
            }
          })
        );
      }
    }
    return diagnostics;
  }
  /**
   * Normalizes content ignoring trailing whitespaces and line endings.
   */
  computeContentFingerprint(content) {
    return content.split(/\r?\n/).map((line) => line.trimEnd()).filter((line) => line.length > 0).join("\n").trim();
  }
  /**
   * Maps existing or raw diagnostic IDs to canonical ARM IDs.
   */
  mapToArmId(rawId) {
    if (rawId.startsWith("ARM")) return rawId;
    switch (rawId) {
      case "INVALID_FRONTMATTER":
        return "ARM001_INVALID_FRONTMATTER";
      case "INVALID_APPLY_TO":
      case "INVALID_GLOB":
        return "ARM002_INVALID_GLOB";
      case "PATH_OUTSIDE_REPOSITORY":
        return "ARM009_PATH_OUTSIDE_REPOSITORY";
      case "SYMLINK_ESCAPE":
        return "ARM010_SYMLINK_ESCAPE";
      case "CYCLIC_SYMLINK_DETECTED":
        return "ARM014_CYCLIC_SYMLINK";
      case "UNREADABLE_INSTRUCTION_SOURCE":
        return "ARM013_UNREADABLE_SOURCE";
      default:
        return rawId;
    }
  }
  deduplicateDiagnostics(diagnostics) {
    const seen = /* @__PURE__ */ new Set();
    const result = [];
    for (const d of diagnostics) {
      const key = `${d.id}:${d.sourcePath || ""}:${d.targetPath || ""}:${d.line || ""}:${d.message}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(d);
      }
    }
    return result;
  }
};

// src/commands/conflictsCommand.ts
async function conflictsCommand(options) {
  const rootDir = options.cwd || process.cwd();
  const profileId = options.profile || "all";
  const engine = new InstructionEngine({ rootDir });
  const conflictEngine = new ConflictEngine(engine);
  const report = conflictEngine.runConflicts({
    profile: profileId,
    strict: options.strict
  });
  const isSarif = options.sarif || options.format === "sarif";
  const isJson = options.json || options.format === "json";
  if (isSarif) {
    const sarifLog = generateSarifReport(report.diagnostics);
    console.log(formatSarifReport(sarifLog));
  } else if (isJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printTextConflictReport(report);
  }
  if (options.strict && report.summary.errors > 0) {
    process.exitCode = 1;
  }
  return report;
}
function printTextConflictReport(report) {
  console.log(chalk5.bold.cyan("\nAgentRuleMap Conflicts"));
  console.log(chalk5.gray(`Repository: ${report.repositoryRoot}`));
  console.log(chalk5.gray(`Profile:    ${report.profile}
`));
  if (report.diagnostics.length === 0) {
    console.log(
      chalk5.green("\u2714 No structural conflicts or stale references detected.")
    );
  } else {
    console.log(chalk5.bold(`Findings (${report.diagnostics.length}):
`));
    for (const d of report.diagnostics) {
      printDiagnostic(d);
    }
  }
  console.log("");
  const errText = report.summary.errors > 0 ? chalk5.red(`${report.summary.errors} error${report.summary.errors > 1 ? "s" : ""}`) : chalk5.gray("0 errors");
  const warnText = report.summary.warnings > 0 ? chalk5.yellow(`${report.summary.warnings} warning${report.summary.warnings > 1 ? "s" : ""}`) : chalk5.gray("0 warnings");
  const infoText = report.summary.info > 0 ? chalk5.blue(`${report.summary.info} info`) : chalk5.gray("0 info");
  console.log(
    chalk5.bold(
      `Summary: ${errText}, ${warnText}, ${infoText} (${report.summary.total} total)`
    )
  );
  console.log(chalk5.gray(`
Notice: ${report.deterministicModeNotice}
`));
}
function printDiagnostic(d) {
  const badge = d.severity === "error" ? chalk5.bgRed.white(" ERROR ") : d.severity === "warning" ? chalk5.bgYellow.black(" WARN ") : chalk5.bgBlue.white(" INFO ");
  const idTag = chalk5.bold(d.id);
  const location = d.sourcePath ? chalk5.cyan(d.sourcePath + (d.line ? `:${d.line}${d.column ? `:${d.column}` : ""}` : "")) : "";
  console.log(`${badge} ${idTag} ${location}`);
  console.log(`  ${d.message}`);
  if (d.remediation) {
    console.log(`  ${chalk5.dim("Remediation:")} ${chalk5.green(d.remediation)}`);
  }
  console.log("");
}

// src/commands/coverageCommand.ts
import chalk6 from "chalk";

// src/coverage/coverageEngine.ts
import fs8 from "node:fs";
import path20 from "node:path";
import picomatch3 from "picomatch";
var CoverageEngine = class {
  constructor(engine) {
    this.engine = engine;
    this.rootDir = path20.resolve(engine.rootDir);
  }
  /**
   * Generates a coverage report for a specific profile or all profiles.
   */
  generateCoverage(profileId) {
    const profilesToRun = !profileId || profileId === "all" ? ["codex", "copilot", "gemini", "generic"] : [profileId];
    const sourceAreas = this.discoverSourceAreas();
    const profilesResult = {};
    for (const pid of profilesToRun) {
      profilesResult[pid] = this.analyzeProfileCoverage(pid, sourceAreas);
    }
    return {
      schemaVersion: 1,
      command: "coverage",
      repositoryRoot: this.rootDir,
      profiles: profilesResult
    };
  }
  /**
   * Discovers meaningful source boundaries in the repository (e.g. src/api/, packages/core/, tests/).
   */
  discoverSourceAreas() {
    const areas = /* @__PURE__ */ new Set();
    let rootEntries = [];
    try {
      rootEntries = fs8.readdirSync(this.rootDir, { withFileTypes: true });
    } catch {
      return [];
    }
    const standardSourceRoots = /* @__PURE__ */ new Set([
      "src",
      "apps",
      "packages",
      "services",
      "modules",
      "lib",
      "libs",
      "tests",
      "test"
    ]);
    for (const entry of rootEntries) {
      if (!entry.isDirectory()) continue;
      const name = entry.name;
      if (IGNORED_DIRECTORIES.has(name) || name.startsWith(".")) continue;
      if (["packages", "apps", "services", "modules", "libs"].includes(name)) {
        const parentDir = path20.join(this.rootDir, name);
        try {
          const children = fs8.readdirSync(parentDir, { withFileTypes: true });
          let hasChildPkg = false;
          for (const child of children) {
            if (child.isDirectory() && !child.name.startsWith(".")) {
              areas.add(`${name}/${child.name}`);
              hasChildPkg = true;
            }
          }
          if (!hasChildPkg) {
            areas.add(name);
          }
        } catch {
          areas.add(name);
        }
      } else if (name === "src") {
        const srcDir = path20.join(this.rootDir, "src");
        try {
          const srcChildren = fs8.readdirSync(srcDir, { withFileTypes: true });
          const subdirs = srcChildren.filter(
            (c) => c.isDirectory() && !c.name.startsWith(".")
          );
          if (subdirs.length > 0) {
            for (const sub of subdirs) {
              areas.add(`src/${sub.name}`);
            }
          } else {
            areas.add("src");
          }
        } catch {
          areas.add("src");
        }
      } else if (standardSourceRoots.has(name)) {
        areas.add(name);
      } else {
        areas.add(name);
      }
    }
    return Array.from(areas).sort();
  }
  analyzeProfileCoverage(profileId, sourceAreas) {
    const sources = this.engine.discover(profileId);
    const repositoryWide = [];
    const nestedScopes = [];
    const pathSpecificScopes = [];
    for (const s of sources) {
      if (s.scope.patterns && s.scope.patterns.length > 0) {
        pathSpecificScopes.push({
          filePath: s.filePath,
          patterns: s.scope.patterns
        });
      } else if (s.scopeRoot === "") {
        repositoryWide.push(s.filePath);
      } else {
        nestedScopes.push({
          scopeRoot: s.scopeRoot,
          filePath: s.filePath
        });
      }
    }
    const areas = [];
    const gaps = [];
    for (const area of sourceAreas) {
      const areaNormalized = normalizePath(area);
      const matchingNested = nestedScopes.filter(
        (n) => areaNormalized === n.scopeRoot || areaNormalized.startsWith(`${n.scopeRoot}/`)
      );
      const matchingPathSpecific = [];
      for (const ps of pathSpecificScopes) {
        const isMatch = picomatch3(ps.patterns, { dot: true });
        if (isMatch(`${areaNormalized}/sample.ts`) || isMatch(`${areaNormalized}/sample.js`) || isMatch(`${areaNormalized}/index.ts`) || isMatch(`${areaNormalized}/index.js`) || isMatch(areaNormalized)) {
          matchingPathSpecific.push(ps);
        }
      }
      if (matchingNested.length > 0) {
        matchingNested.sort((a, b) => b.scopeRoot.length - a.scopeRoot.length);
        const topNested = matchingNested[0];
        areas.push({
          directory: `${areaNormalized}/`,
          status: "nested",
          statusLabel: `nested instructions (${topNested.filePath})`,
          instructionFiles: matchingNested.map((m) => m.filePath)
        });
      } else if (matchingPathSpecific.length > 0) {
        areas.push({
          directory: `${areaNormalized}/`,
          status: "path-specific",
          statusLabel: "path-specific rules",
          instructionFiles: matchingPathSpecific.map((p) => p.filePath),
          patterns: matchingPathSpecific.flatMap((p) => p.patterns)
        });
      } else if (repositoryWide.length > 0) {
        areas.push({
          directory: `${areaNormalized}/`,
          status: "root",
          statusLabel: `root instructions only (${repositoryWide.join(", ")})`,
          instructionFiles: repositoryWide
        });
      } else {
        const gap = {
          directory: `${areaNormalized}/`,
          status: "uncovered",
          statusLabel: "no discovered instruction scope",
          instructionFiles: []
        };
        areas.push(gap);
        gaps.push(gap);
      }
    }
    return {
      profile: profileId,
      repositoryWide,
      nestedScopes,
      pathSpecificScopes,
      areas,
      gaps
    };
  }
};
function formatCoverageText(report) {
  const lines = [];
  lines.push(`AgentRuleMap Coverage`);
  lines.push(`Profile: ${report.profile}`);
  lines.push(`Repository-wide:`);
  if (report.repositoryWide.length > 0) {
    for (const f of report.repositoryWide) {
      lines.push(`  ${f}`);
    }
  } else {
    lines.push(`  (none)`);
  }
  if (report.nestedScopes.length > 0) {
    lines.push(`Nested instruction scopes:`);
    for (const ns of report.nestedScopes) {
      lines.push(`  ${ns.scopeRoot}/**`);
      lines.push(`    ${ns.filePath}`);
    }
  }
  if (report.pathSpecificScopes.length > 0) {
    lines.push(`Path-specific:`);
    for (const ps of report.pathSpecificScopes) {
      for (const pat of ps.patterns) {
        lines.push(`  ${pat} (${ps.filePath})`);
      }
    }
  }
  lines.push(`Source areas discovered:`);
  if (report.areas.length > 0) {
    const maxLen = Math.max(...report.areas.map((a) => a.directory.length), 14);
    for (const area of report.areas) {
      const padded = area.directory.padEnd(maxLen + 2, " ");
      lines.push(`  ${padded} ${area.statusLabel}`);
    }
  } else {
    lines.push(`  (none discovered)`);
  }
  if (report.gaps.length > 0) {
    lines.push(``);
    lines.push(`Coverage Gaps:`);
    const maxGapLen = Math.max(...report.gaps.map((g) => g.directory.length), 14);
    for (const gap of report.gaps) {
      const padded = gap.directory.padEnd(maxGapLen + 2, " ");
      lines.push(`  ${padded} ${gap.statusLabel}`);
    }
  }
  return lines.join("\n");
}

// src/commands/coverageCommand.ts
async function coverageCommand(options) {
  const rootDir = options.cwd || process.cwd();
  const rawProfile = options.profile;
  const engine = new InstructionEngine({ rootDir });
  const coverageEngine = new CoverageEngine(engine);
  const report = coverageEngine.generateCoverage(rawProfile);
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printTextCoverageReport(report);
  }
  return report;
}
function printTextCoverageReport(report) {
  const profileKeys = Object.keys(report.profiles);
  for (let i = 0; i < profileKeys.length; i++) {
    const pid = profileKeys[i];
    const profReport = report.profiles[pid];
    console.log(formatCoverageText(profReport));
    if (i < profileKeys.length - 1) {
      console.log("\n" + chalk6.gray("\u2500".repeat(50)) + "\n");
    }
  }
}

// src/commands/changedCommand.ts
import path23 from "node:path";
import chalk7 from "chalk";

// src/changed/changedEngine.ts
import path22 from "node:path";

// src/git/safeGit.ts
import fs9 from "node:fs";
import { execFile } from "node:child_process";
import path21 from "node:path";
import { promisify } from "node:util";
var execFileAsync = promisify(execFile);
var BANNED_GIT_SUBCOMMANDS = /* @__PURE__ */ new Set([
  "checkout",
  "reset",
  "clean",
  "commit",
  "push",
  "merge",
  "rebase",
  "stash",
  "pull",
  "branch",
  "tag",
  "rm",
  "mv",
  "apply",
  "cherry-pick",
  "revert"
]);
var ALLOWED_READ_ONLY_SUBCOMMANDS = /* @__PURE__ */ new Set([
  "rev-parse",
  "diff",
  "show",
  "merge-base",
  "status",
  "cat-file",
  "log",
  "ls-files"
]);
var GitError = class extends Error {
  constructor(details) {
    super(details.message);
    this.name = "GitError";
    this.details = details;
  }
};
async function runGitReadOnly(args, options = {}) {
  const subcommand = args[0];
  if (!subcommand) {
    throw new GitError({
      code: "UNSAFE_ARGUMENT",
      message: "No Git subcommand specified."
    });
  }
  if (BANNED_GIT_SUBCOMMANDS.has(subcommand)) {
    throw new GitError({
      code: "UNSAFE_ARGUMENT",
      message: `Mutating Git command "git ${subcommand}" is forbidden. AgentRuleMap only executes read-only operations.`,
      command: subcommand,
      args
    });
  }
  if (!ALLOWED_READ_ONLY_SUBCOMMANDS.has(subcommand)) {
    throw new GitError({
      code: "UNSAFE_ARGUMENT",
      message: `Unrecognized or non-read-only Git command "git ${subcommand}" is not permitted.`,
      command: subcommand,
      args
    });
  }
  for (const arg of args) {
    if (typeof arg !== "string") {
      throw new GitError({
        code: "UNSAFE_ARGUMENT",
        message: "All Git arguments must be strings."
      });
    }
  }
  const cwd = options.cwd ? path21.resolve(options.cwd) : process.cwd();
  const maxBuffer = options.maxBuffer || 20 * 1024 * 1024;
  const timeoutMs = options.timeoutMs || 3e4;
  try {
    const { stdout, stderr } = await execFileAsync("git", args, {
      cwd,
      maxBuffer,
      timeout: timeoutMs,
      shell: false,
      windowsHide: true,
      encoding: "utf8"
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (err) {
    const error = err;
    const stderr = (error.stderr || "").toString().trim();
    const stdout = (error.stdout || "").toString().trim();
    const exitCode = typeof error.code === "number" ? error.code : 1;
    if (stderr.includes("not a git repository") || stderr.includes("fatal: not a git repository")) {
      throw new GitError({
        code: "NOT_GIT_REPO",
        message: `Directory "${cwd}" is not inside a Git repository.`,
        command: subcommand,
        args,
        rawError: stderr
      });
    }
    return { stdout, stderr, exitCode };
  }
}
async function isInsideGitRepo(cwd) {
  try {
    const res = await runGitReadOnly(
      ["rev-parse", "--is-inside-work-tree"],
      { cwd }
    );
    return res.exitCode === 0 && res.stdout.trim() === "true";
  } catch {
    return false;
  }
}
async function isShallowRepository(cwd) {
  try {
    const shallowPath = path21.join(cwd, ".git", "shallow");
    if (fs9.existsSync(shallowPath)) {
      return true;
    }
  } catch {
  }
  try {
    const res = await runGitReadOnly(["rev-parse", "--is-shallow-repository"], {
      cwd
    });
    return res.stdout.trim() === "true";
  } catch {
    return false;
  }
}
function validateRefSyntax(ref) {
  if (!ref || typeof ref !== "string") return false;
  const trimmed = ref.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("-")) return false;
  if (/[\s\0\r\n]/.test(trimmed)) return false;
  if (/[\x00-\x1F\x7F]/.test(trimmed)) return false;
  return true;
}
async function verifyGitRef(ref, cwd) {
  if (!validateRefSyntax(ref)) {
    return {
      exists: false,
      error: `Invalid Git reference format: "${ref}". References cannot start with "-" or contain control characters.`
    };
  }
  const res = await runGitReadOnly(
    ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`],
    { cwd }
  );
  if (res.exitCode === 0 && res.stdout.trim()) {
    return { exists: true, commitSha: res.stdout.trim() };
  }
  const objRes = await runGitReadOnly(
    ["rev-parse", "--verify", "--quiet", ref],
    { cwd }
  );
  if (objRes.exitCode === 0 && objRes.stdout.trim()) {
    return { exists: true, commitSha: objRes.stdout.trim() };
  }
  const isShallow = await isShallowRepository(cwd);
  const shallowNote = isShallow ? " (Note: The repository is a shallow clone; requested base history may not be fetched)." : "";
  return {
    exists: false,
    error: `Git base could not be resolved: "${ref}"${shallowNote}`
  };
}
async function resolveDefaultBase(cwd) {
  const upstreamRes = await runGitReadOnly(
    ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"],
    { cwd }
  );
  if (upstreamRes.exitCode === 0 && upstreamRes.stdout.trim()) {
    const upstream = upstreamRes.stdout.trim();
    const verified = await verifyGitRef(upstream, cwd);
    if (verified.exists) {
      return upstream;
    }
  }
  const candidates = ["origin/main", "main", "origin/master", "master"];
  const validCandidates = [];
  for (const candidate of candidates) {
    const check = await verifyGitRef(candidate, cwd);
    if (check.exists) {
      validCandidates.push(candidate);
    }
  }
  if (validCandidates.length === 1) {
    return validCandidates[0];
  }
  if (validCandidates.includes("origin/main")) {
    return "origin/main";
  }
  if (validCandidates.includes("main")) {
    return "main";
  }
  if (validCandidates.includes("origin/master")) {
    return "origin/master";
  }
  if (validCandidates.includes("master")) {
    return "master";
  }
  throw new GitError({
    code: "AMBIGUOUS_BASE",
    message: "No Git comparison base specified and default base could not be determined unambiguously. Please specify a base explicitly, e.g.: agentrulemap changed --base main (or --staged for staged changes)."
  });
}
function parseNameStatusZ(rawZOutput) {
  if (!rawZOutput) return [];
  const tokens = rawZOutput.split("\0");
  if (tokens.length > 0 && tokens[tokens.length - 1] === "") {
    tokens.pop();
  }
  const results = [];
  let i = 0;
  while (i < tokens.length) {
    const statusToken = tokens[i].trim();
    i++;
    if (!statusToken) continue;
    let codePart = statusToken;
    if (codePart.startsWith(":")) {
      const parts = codePart.split(/\s+/);
      codePart = parts[parts.length - 1];
    }
    const statusCode = codePart[0];
    const scoreStr = codePart.slice(1);
    const score = /^\d+$/.test(scoreStr) ? parseInt(scoreStr, 10) : void 0;
    if (statusCode === "R" || statusCode === "C") {
      const oldPathRaw = tokens[i];
      i++;
      const newPathRaw = tokens[i];
      i++;
      if (oldPathRaw !== void 0 && newPathRaw !== void 0) {
        const normOld = normalizePath(oldPathRaw);
        const normNew = normalizePath(newPathRaw);
        const status = statusCode === "R" ? "renamed" : "copied";
        results.push({
          status,
          path: normNew,
          oldPath: normOld,
          similarityScore: score
        });
      }
    } else {
      const pathRaw = tokens[i];
      i++;
      if (pathRaw !== void 0) {
        const normPath = normalizePath(pathRaw);
        let status = "modified";
        switch (statusCode) {
          case "A":
            status = "added";
            break;
          case "D":
            status = "deleted";
            break;
          case "M":
          case "T":
          default:
            status = "modified";
            break;
        }
        results.push({
          status,
          path: normPath
        });
      }
    }
  }
  results.sort((a, b) => a.path.localeCompare(b.path));
  return results;
}
async function getChangedFiles(comparison, cwd) {
  const inside = await isInsideGitRepo(cwd);
  if (!inside) {
    throw new GitError({
      code: "NOT_GIT_REPO",
      message: `Directory "${cwd}" is not inside a Git repository.`
    });
  }
  if (comparison.type === "staged") {
    const args2 = ["diff", "--cached", "--name-status", "-z", "--find-renames"];
    const res2 = await runGitReadOnly(args2, { cwd });
    if (res2.exitCode !== 0) {
      throw new GitError({
        code: "GIT_COMMAND_FAILED",
        message: `Failed to inspect staged changes: ${res2.stderr}`,
        args: args2,
        rawError: res2.stderr
      });
    }
    return {
      files: parseNameStatusZ(res2.stdout),
      comparisonInfo: {
        type: "staged",
        description: "Staged changes (HEAD \u2194 index)"
      }
    };
  }
  if (comparison.type === "unstaged") {
    const args2 = ["diff", "--name-status", "-z", "--find-renames"];
    const res2 = await runGitReadOnly(args2, { cwd });
    if (res2.exitCode !== 0) {
      throw new GitError({
        code: "GIT_COMMAND_FAILED",
        message: `Failed to inspect unstaged changes: ${res2.stderr}`,
        args: args2,
        rawError: res2.stderr
      });
    }
    const files2 = await appendUntrackedFiles(
      parseNameStatusZ(res2.stdout),
      cwd
    );
    return {
      files: files2,
      comparisonInfo: {
        type: "unstaged",
        description: "Unstaged changes (index \u2194 working tree)"
      }
    };
  }
  let baseRef = comparison.base;
  if (!baseRef) {
    baseRef = await resolveDefaultBase(cwd);
  }
  const verified = await verifyGitRef(baseRef, cwd);
  if (!verified.exists) {
    throw new GitError({
      code: "INVALID_BASE",
      message: verified.error || `Git base could not be resolved: "${baseRef}"`
    });
  }
  const args = ["diff", "--name-status", "-z", "--find-renames", baseRef, "--"];
  const res = await runGitReadOnly(args, { cwd });
  if (res.exitCode !== 0) {
    throw new GitError({
      code: "GIT_COMMAND_FAILED",
      message: `Failed to compute diff against base "${baseRef}": ${res.stderr}`,
      args,
      rawError: res.stderr
    });
  }
  const files = await appendUntrackedFiles(
    parseNameStatusZ(res.stdout),
    cwd
  );
  return {
    files,
    comparisonInfo: {
      type: "base",
      base: baseRef,
      target: "working tree",
      description: `Comparison against base "${baseRef}" (base \u2194 working tree)`
    }
  };
}
async function appendUntrackedFiles(files, cwd) {
  try {
    const res = await runGitReadOnly(
      ["ls-files", "--others", "--exclude-standard", "-z"],
      { cwd }
    );
    if (res.exitCode === 0 && res.stdout) {
      const existingPaths = new Set(files.map((f) => f.path));
      const tokens = res.stdout.split("\0");
      for (const token of tokens) {
        if (!token.trim()) continue;
        const norm = normalizePath(token.trim());
        if (!existingPaths.has(norm)) {
          files.push({
            status: "added",
            path: norm
          });
          existingPaths.add(norm);
        }
      }
      files.sort((a, b) => a.path.localeCompare(b.path));
    }
  } catch {
  }
  return files;
}
async function gitShowFileContent(ref, repoRelativePath, cwd) {
  if (!validateRefSyntax(ref)) return null;
  const normalized = normalizePath(repoRelativePath);
  if (!normalized) return null;
  const args = ["show", `${ref}:${normalized}`];
  const res = await runGitReadOnly(args, { cwd });
  if (res.exitCode === 0) {
    return res.stdout;
  }
  return null;
}

// src/changed/changedEngine.ts
var ChangedEngine = class {
  constructor(engine) {
    this.engine = engine;
    this.rootDir = engine.rootDir;
  }
  /**
   * Identifies whether a file path corresponds to a known AI agent instruction file.
   */
  isInstructionFilePath(relPath, discoveredSources) {
    const norm = normalizePath(relPath);
    if (discoveredSources.has(norm)) return true;
    const filename = path22.posix.basename(norm);
    if (filename === "AGENTS.md" || filename === "AGENTS.override.md" || filename === "GEMINI.md" || filename === "GEMINI.override.md" || filename === "CLAUDE.md" || filename === ".cursorrules" || filename === ".windsurfrules" || filename === "COPILOT.md") {
      return true;
    }
    if (norm === ".github/copilot-instructions.md" || norm.startsWith(".github/instructions/") && norm.endsWith(".instructions.md") || norm.startsWith(".cursor/rules/") && norm.endsWith(".mdc")) {
      return true;
    }
    return false;
  }
  /**
   * Analyzes a list of changed files against repository instructions.
   */
  async analyzeChangedFiles(changedFiles, comparison, options = {}) {
    const rawProfile = options.profile || "all";
    const activeProfiles = rawProfile === "all" ? ["codex", "copilot", "gemini", "generic"] : [rawProfile];
    const profileSources = /* @__PURE__ */ new Map();
    const allDiscoveredMap = /* @__PURE__ */ new Map();
    for (const profileId of activeProfiles) {
      const sources = this.engine.discover(profileId);
      profileSources.set(profileId, sources);
      for (const s of sources) {
        allDiscoveredMap.set(s.filePath, s);
      }
    }
    const changedInstructionFilesMap = /* @__PURE__ */ new Map();
    for (const file of changedFiles) {
      if (this.isInstructionFilePath(file.path, allDiscoveredMap)) {
        changedInstructionFilesMap.set(file.path, file);
      }
      if (file.oldPath && this.isInstructionFilePath(file.oldPath, allDiscoveredMap)) {
        changedInstructionFilesMap.set(file.oldPath, file);
      }
    }
    const analyzedFiles = [];
    const involvedSourcesByProfile = {
      codex: /* @__PURE__ */ new Set(),
      copilot: /* @__PURE__ */ new Set(),
      gemini: /* @__PURE__ */ new Set(),
      generic: /* @__PURE__ */ new Set()
    };
    const distinctScopesByProfile = {
      codex: /* @__PURE__ */ new Set(),
      copilot: /* @__PURE__ */ new Set(),
      gemini: /* @__PURE__ */ new Set(),
      generic: /* @__PURE__ */ new Set()
    };
    for (const file of changedFiles) {
      const isInstruction = changedInstructionFilesMap.has(file.path);
      const profilesData = {};
      const { target } = parseAndValidateTargetPath(file.path, this.rootDir);
      for (const profileId of activeProfiles) {
        const adapter = this.engine.registry.get(profileId);
        const sources = profileSources.get(profileId) || [];
        const resolution = adapter.resolveForTarget(
          target,
          sources
        );
        const matchedSourcePaths = resolution.matchedSources.map(
          (s) => s.filePath
        );
        for (const src of matchedSourcePaths) {
          involvedSourcesByProfile[profileId].add(src);
        }
        let primaryScope = "repository root";
        const scopeChain = [];
        if (profileId === "codex" || profileId === "gemini") {
          if (resolution.matchedSources.length > 0) {
            const deepest = resolution.matchedSources[resolution.matchedSources.length - 1];
            const dir = path22.posix.dirname(deepest.filePath);
            primaryScope = dir === "." ? "repository root" : `${dir}/`;
            for (const s of resolution.matchedSources) {
              const d = path22.posix.dirname(s.filePath);
              scopeChain.push(d === "." ? "repository root" : `${d}/`);
            }
          }
        } else if (profileId === "copilot") {
          const pathSpecific = resolution.matchedSources.filter(
            (s) => s.sourceType === "file-pattern"
          );
          if (pathSpecific.length > 0) {
            primaryScope = `path-specific: ${pathSpecific.map((s) => s.filePath).join(", ")}`;
          } else if (resolution.matchedSources.length > 0) {
            primaryScope = "repository instructions (.github/copilot-instructions.md)";
          } else {
            primaryScope = "no instructions";
          }
          for (const s of resolution.matchedSources) {
            scopeChain.push(s.filePath);
          }
        } else {
          if (resolution.matchedSources.length > 0) {
            primaryScope = resolution.matchedSources.map((s) => s.filePath).join(", ");
            for (const s of resolution.matchedSources) {
              scopeChain.push(s.filePath);
            }
          } else {
            primaryScope = "no instructions";
          }
        }
        if (primaryScope) {
          distinctScopesByProfile[profileId].add(primaryScope);
        }
        profilesData[profileId] = {
          profile: profileId,
          profileName: adapter.name,
          matchedSources: matchedSourcePaths,
          scopeChain,
          primaryScope
        };
      }
      let renameScopeDiff;
      if (file.oldPath && file.oldPath !== file.path) {
        const { target: oldTarget } = parseAndValidateTargetPath(
          file.oldPath,
          this.rootDir
        );
        const oldSources = {};
        const newSources = {};
        const details = [];
        let anyChanged = false;
        for (const profileId of activeProfiles) {
          const adapter = this.engine.registry.get(profileId);
          const sources = profileSources.get(profileId) || [];
          const oldRes = adapter.resolveForTarget(
            oldTarget,
            sources
          );
          const oldPaths = oldRes.matchedSources.map((s) => s.filePath);
          const newPaths = profilesData[profileId].matchedSources;
          oldSources[profileId] = oldPaths;
          newSources[profileId] = newPaths;
          const oldSet = new Set(oldPaths);
          const newSet = new Set(newPaths);
          const same = oldPaths.length === newPaths.length && oldPaths.every((p) => newSet.has(p));
          if (!same) {
            anyChanged = true;
            const added2 = newPaths.filter((p) => !oldSet.has(p));
            const removed = oldPaths.filter((p) => !newSet.has(p));
            const parts = [];
            if (added2.length > 0) parts.push(`added [${added2.join(", ")}]`);
            if (removed.length > 0) parts.push(`removed [${removed.join(", ")}]`);
            details.push(
              `Scope changed for ${profileId}: ${parts.join(", ")} (Old: ${oldPaths.length ? oldPaths.join(", ") : "none"} \u2192 New: ${newPaths.length ? newPaths.join(", ") : "none"})`
            );
          }
        }
        renameScopeDiff = {
          changed: anyChanged,
          oldSources,
          newSources,
          details
        };
      }
      analyzedFiles.push({
        status: file.status,
        path: file.path,
        oldPath: file.oldPath,
        similarityScore: file.similarityScore,
        isInstructionFile: isInstruction,
        profiles: profilesData,
        renameScopeDiff
      });
    }
    const changedInstructionFilesList = [];
    for (const [instrPath, changedFile] of changedInstructionFilesMap.entries()) {
      const applicableProfiles = [];
      for (const p of activeProfiles) {
        const sources = profileSources.get(p) || [];
        if (sources.some((s) => s.filePath === instrPath) || this.isInstructionFilePath(instrPath, allDiscoveredMap)) {
          applicableProfiles.push(p);
        }
      }
      const affectedTargets = [];
      const instrDir = path22.posix.dirname(instrPath);
      const isRootInstr = instrDir === "." || instrDir === "";
      for (const targetFile of changedFiles) {
        if (targetFile.path === instrPath) continue;
        let matches = false;
        for (const p of activeProfiles) {
          const matched = analyzedFiles.find(
            (af) => af.path === targetFile.path
          )?.profiles[p]?.matchedSources;
          if (matched && matched.includes(instrPath)) {
            matches = true;
            break;
          }
        }
        if (!matches) {
          if (isRootInstr) {
            matches = true;
          } else if (targetFile.path.startsWith(`${instrDir}/`) || targetFile.path === instrDir) {
            matches = true;
          }
        }
        if (matches) {
          affectedTargets.push(targetFile.path);
        }
      }
      affectedTargets.sort((a, b) => a.localeCompare(b));
      changedInstructionFilesList.push({
        path: instrPath,
        status: changedFile.status,
        profiles: applicableProfiles,
        affectedChangedFiles: affectedTargets
      });
    }
    changedInstructionFilesList.sort((a, b) => a.path.localeCompare(b.path));
    if (options.compareInstructions && comparison.base) {
      await this.performInstructionComparison(
        comparison.base,
        analyzedFiles,
        changedInstructionFilesList,
        activeProfiles
      );
    }
    const scopeSummary = {};
    for (const profileId of activeProfiles) {
      const distinct = Array.from(distinctScopesByProfile[profileId]).sort();
      scopeSummary[profileId] = {
        profile: profileId,
        distinctScopes: distinct,
        multipleScopesDetected: distinct.length > 1
      };
    }
    let added = 0;
    let modified = 0;
    let deleted = 0;
    let renamed = 0;
    let copied = 0;
    for (const f of changedFiles) {
      switch (f.status) {
        case "added":
          added++;
          break;
        case "modified":
          modified++;
          break;
        case "deleted":
          deleted++;
          break;
        case "renamed":
          renamed++;
          break;
        case "copied":
          copied++;
          break;
      }
    }
    const instructionSourcesInvolved = {
      codex: involvedSourcesByProfile.codex.size,
      copilot: involvedSourcesByProfile.copilot.size,
      gemini: involvedSourcesByProfile.gemini.size,
      generic: involvedSourcesByProfile.generic.size
    };
    const distinctScopesCount = {
      codex: distinctScopesByProfile.codex.size,
      copilot: distinctScopesByProfile.copilot.size,
      gemini: distinctScopesByProfile.gemini.size,
      generic: distinctScopesByProfile.generic.size
    };
    const summary = {
      totalChanged: changedFiles.length,
      added,
      modified,
      deleted,
      renamed,
      copied,
      instructionFilesChanged: changedInstructionFilesList.length,
      instructionSourcesInvolved,
      distinctScopes: distinctScopesCount
    };
    const conflictEngine = new ConflictEngine(this.engine);
    const fullReport = conflictEngine.runConflicts({
      profile: rawProfile === "all" ? "all" : rawProfile
    });
    const involvedSourcePaths = /* @__PURE__ */ new Set();
    for (const p of activeProfiles) {
      for (const s of involvedSourcesByProfile[p]) {
        involvedSourcePaths.add(s);
      }
    }
    for (const cif of changedInstructionFilesList) {
      involvedSourcePaths.add(cif.path);
    }
    const filteredDiagnostics = fullReport.diagnostics.filter((d) => {
      if (!d.sourcePath) return false;
      return involvedSourcePaths.has(d.sourcePath) || involvedSourcePaths.has(normalizePath(d.sourcePath));
    });
    analyzedFiles.sort((a, b) => a.path.localeCompare(b.path));
    return {
      schemaVersion: 1,
      command: "changed",
      repositoryRoot: this.rootDir,
      comparison,
      summary,
      changedInstructionFiles: changedInstructionFilesList,
      scopeSummary,
      files: analyzedFiles,
      diagnostics: filteredDiagnostics,
      deterministicModeNotice: "Deterministic analysis performed. Only structural instruction mappings and verifiable Git changes are reported."
    };
  }
  /**
   * Performs read-only historical comparison of instruction files at base ref without checkout.
   */
  async performInstructionComparison(baseRef, analyzedFiles, changedInstructionFiles, activeProfiles) {
    if (changedInstructionFiles.length === 0) {
      for (const file of analyzedFiles) {
        const baseSources = {};
        const currentSources = {};
        for (const p of activeProfiles) {
          const cur = file.profiles[p]?.matchedSources || [];
          baseSources[p] = cur;
          currentSources[p] = cur;
        }
        file.instructionComparison = {
          changed: false,
          baseSources,
          currentSources,
          details: ["No instruction files modified; instruction scope unchanged."]
        };
      }
      return;
    }
    const baseContents = /* @__PURE__ */ new Map();
    for (const cif of changedInstructionFiles) {
      const content = await gitShowFileContent(baseRef, cif.path, this.rootDir);
      baseContents.set(cif.path, content);
    }
    for (const file of analyzedFiles) {
      const baseSources = {};
      const currentSources = {};
      const details = [];
      let anyDiff = false;
      for (const p of activeProfiles) {
        const cur = file.profiles[p]?.matchedSources || [];
        currentSources[p] = cur;
        const baseList = [];
        for (const src of cur) {
          const cif = changedInstructionFiles.find((c) => c.path === src);
          if (cif && cif.status === "added") {
            continue;
          }
          baseList.push(src);
        }
        for (const cif of changedInstructionFiles) {
          if (cif.status === "deleted") {
            const rawBase = baseContents.get(cif.path);
            if (rawBase !== null) {
              if (p === "codex" && (cif.path.endsWith("AGENTS.md") || cif.path.endsWith("AGENTS.override.md"))) {
                const dir = path22.posix.dirname(cif.path);
                const scopeRoot = dir === "." ? "" : normalizePath(dir);
                if (file.path.startsWith(scopeRoot ? `${scopeRoot}/` : "")) {
                  baseList.push(cif.path);
                }
              } else if (p === "copilot" && cif.path.startsWith(".github/instructions/")) {
                const fm = parseFrontmatter(rawBase || "", cif.path);
                const { patterns } = parseApplyTo(fm.data.applyTo, cif.path);
                if (matchesGlobPatterns(file.path, patterns).matched) {
                  baseList.push(cif.path);
                }
              }
            }
          }
        }
        baseList.sort();
        baseSources[p] = baseList;
        const curSorted = [...cur].sort();
        const same = baseList.length === curSorted.length && baseList.every((val, idx) => val === curSorted[idx]);
        if (!same) {
          anyDiff = true;
          const added = curSorted.filter((x) => !baseList.includes(x));
          const removed = baseList.filter((x) => !curSorted.includes(x));
          const parts = [];
          if (added.length) parts.push(`+ ${added.join(", ")}`);
          if (removed.length) parts.push(`- ${removed.join(", ")}`);
          details.push(`${p}: ${parts.join(", ")}`);
        }
      }
      file.instructionComparison = {
        changed: anyDiff,
        baseSources,
        currentSources,
        details
      };
    }
  }
};

// src/commands/changedCommand.ts
async function changedCommand(options = {}) {
  const cwd = options.cwd ? path23.resolve(options.cwd) : process.cwd();
  const isSarif = options.sarif || options.format === "sarif";
  const isJson = options.json || options.format === "json";
  if (options.staged && options.unstaged) {
    console.error(
      chalk7.red("Error: Cannot specify both --staged and --unstaged together.")
    );
    process.exitCode = 1;
    return { exitCode: 1 };
  }
  if (options.base && (options.staged || options.unstaged)) {
    console.error(
      chalk7.red(
        "Error: Cannot specify --base together with --staged or --unstaged."
      )
    );
    process.exitCode = 1;
    return { exitCode: 1 };
  }
  let comparisonType = "default";
  if (options.staged) comparisonType = "staged";
  else if (options.unstaged) comparisonType = "unstaged";
  else if (options.base) comparisonType = "base";
  let changedFilesResult;
  try {
    changedFilesResult = await getChangedFiles(
      {
        type: comparisonType,
        base: options.base
      },
      cwd
    );
  } catch (err) {
    if (err instanceof GitError) {
      if (isSarif) {
        const sarifLog = generateSarifReport([
          {
            id: `GIT_${err.details.code}`,
            severity: "error",
            title: "Git Operation Error",
            message: err.details.message
          }
        ]);
        console.log(formatSarifReport(sarifLog));
      } else if (isJson) {
        console.log(
          JSON.stringify(
            {
              schemaVersion: 1,
              command: "changed",
              error: {
                code: err.details.code,
                message: err.details.message
              }
            },
            null,
            2
          )
        );
      } else {
        console.error(chalk7.red(`Git Error: ${err.message}`));
      }
      process.exitCode = 1;
      return { exitCode: 1 };
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error(chalk7.red(`Unexpected Error: ${msg}`));
    process.exitCode = 1;
    return { exitCode: 1 };
  }
  const { files: changedFiles, comparisonInfo } = changedFilesResult;
  const instructionEngine = new InstructionEngine({ rootDir: cwd });
  const changedEngine = new ChangedEngine(instructionEngine);
  if (changedFiles.length === 0) {
    const emptyReport = {
      schemaVersion: 1,
      command: "changed",
      repositoryRoot: cwd,
      comparison: comparisonInfo,
      summary: {
        totalChanged: 0,
        added: 0,
        modified: 0,
        deleted: 0,
        renamed: 0,
        copied: 0,
        instructionFilesChanged: 0,
        instructionSourcesInvolved: {
          codex: 0,
          copilot: 0,
          gemini: 0,
          generic: 0
        },
        distinctScopes: {
          codex: 0,
          copilot: 0,
          gemini: 0,
          generic: 0
        }
      },
      changedInstructionFiles: [],
      scopeSummary: {
        codex: { profile: "codex", distinctScopes: [], multipleScopesDetected: false },
        copilot: { profile: "copilot", distinctScopes: [], multipleScopesDetected: false },
        gemini: { profile: "gemini", distinctScopes: [], multipleScopesDetected: false },
        generic: { profile: "generic", distinctScopes: [], multipleScopesDetected: false }
      },
      files: [],
      diagnostics: [],
      deterministicModeNotice: "Deterministic analysis performed. Only structural instruction mappings and verifiable Git changes are reported."
    };
    if (isSarif) {
      const sarifLog = generateSarifReport([]);
      console.log(formatSarifReport(sarifLog));
    } else if (isJson) {
      console.log(JSON.stringify(emptyReport, null, 2));
    } else {
      console.log(chalk7.bold("AgentRuleMap Changed Files Analysis"));
      console.log(`Repository: ${cwd}`);
      console.log(`Comparison: ${comparisonInfo.description}`);
      console.log("");
      console.log("No changed files found for this comparison.");
    }
    process.exitCode = 0;
    return { report: emptyReport, exitCode: 0 };
  }
  const report = await changedEngine.analyzeChangedFiles(
    changedFiles,
    comparisonInfo,
    {
      profile: options.profile || "all",
      compareInstructions: Boolean(options.compareInstructions)
    }
  );
  if (isSarif) {
    const sarifLog = generateSarifReport(report.diagnostics);
    console.log(formatSarifReport(sarifLog));
  } else if (isJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHumanChangedReport(report, options);
  }
  const hasErrors = report.diagnostics.some((d) => d.severity === "error");
  const exitCode = options.strict && hasErrors ? 1 : 0;
  process.exitCode = exitCode;
  return { report, exitCode };
}
function printHumanChangedReport(report, options) {
  console.log(chalk7.bold.cyan("AgentRuleMap Changed Files Analysis"));
  console.log(`Repository: ${chalk7.gray(report.repositoryRoot)}`);
  console.log(`Comparison: ${chalk7.blue(report.comparison.description)}`);
  console.log(`Profile:    ${options.profile || "all"}`);
  console.log("");
  console.log(chalk7.bold(`Changed files: ${report.summary.totalChanged}`));
  for (const file of report.files) {
    let statusLabel = file.status;
    if (file.status === "added") statusLabel = chalk7.green("added");
    else if (file.status === "modified") statusLabel = chalk7.yellow("modified");
    else if (file.status === "deleted") statusLabel = chalk7.red("deleted");
    else if (file.status === "renamed") statusLabel = chalk7.magenta("renamed");
    else if (file.status === "copied") statusLabel = chalk7.blue("copied");
    const renameExtra = file.oldPath && file.oldPath !== file.path ? ` (${chalk7.gray(file.oldPath)} \u2192 ${chalk7.cyan(file.path)})` : "";
    console.log(`  ${chalk7.bold(file.path)}`);
    console.log(`    status: ${statusLabel}${renameExtra}`);
    for (const [profileId, profileData] of Object.entries(file.profiles)) {
      const pName = profileId === "codex" ? "Codex" : profileId === "copilot" ? "GitHub Copilot" : profileId === "gemini" ? "Gemini" : "Generic";
      console.log(`    ${chalk7.bold(pName)}:`);
      if (profileData.matchedSources.length === 0) {
        console.log(`      ${chalk7.gray("(no instructions apply)")}`);
      } else {
        for (const src of profileData.matchedSources) {
          console.log(`      ${src}`);
        }
      }
    }
    if (file.renameScopeDiff?.changed) {
      console.log(
        chalk7.yellow("    Instruction scope changed after rename:")
      );
      for (const [pId, oldList] of Object.entries(
        file.renameScopeDiff.oldSources
      )) {
        const newList = file.renameScopeDiff.newSources[pId] || [];
        const oldStr = oldList.length ? oldList.join(", ") : "(none)";
        const newStr = newList.length ? newList.join(", ") : "(none)";
        if (oldStr !== newStr) {
          console.log(`      ${pId}:`);
          console.log(`        Old: ${chalk7.gray(oldStr)}`);
          console.log(`        New: ${chalk7.cyan(newStr)}`);
        }
      }
    }
    if (file.instructionComparison?.changed) {
      console.log(
        chalk7.yellow("    Instruction mapping difference vs base:")
      );
      for (const detail of file.instructionComparison.details) {
        console.log(`      ${detail}`);
      }
    }
    console.log("");
  }
  if (report.changedInstructionFiles.length > 0) {
    console.log(chalk7.bold.yellow("Instruction sources modified in this change set:"));
    for (const cif of report.changedInstructionFiles) {
      console.log(`  ${chalk7.bold(cif.path)} (${cif.status})`);
      if (cif.affectedChangedFiles.length > 0) {
        console.log(`  Potentially affected changed targets:`);
        for (const affected of cif.affectedChangedFiles) {
          console.log(`    ${chalk7.cyan(affected)}`);
        }
      } else {
        console.log(`    (No other changed files fall under this scope)`);
      }
    }
    console.log("");
  }
  const multiScopeProfiles = Object.values(report.scopeSummary).filter(
    (s) => s.multipleScopesDetected
  );
  if (multiScopeProfiles.length > 0) {
    console.log(
      chalk7.bold.cyan("Scope Analysis: Multiple Instruction Scopes Detected")
    );
    console.log(
      "The changed files span multiple instruction scopes. Review each scope before using a coding agent across the entire change set."
    );
    for (const s of multiScopeProfiles) {
      const pName = s.profile === "codex" ? "Codex" : s.profile === "copilot" ? "GitHub Copilot" : s.profile === "gemini" ? "Gemini" : "Generic";
      console.log(`  ${pName} (${s.distinctScopes.length} scopes):`);
      s.distinctScopes.forEach((sc, idx) => {
        console.log(`    ${idx + 1}. ${sc}`);
      });
    }
    console.log("");
  }
  console.log(chalk7.bold("Summary:"));
  console.log(`  Changed files: ${report.summary.totalChanged}`);
  console.log(`  Added: ${report.summary.added}`);
  console.log(`  Modified: ${report.summary.modified}`);
  console.log(`  Deleted: ${report.summary.deleted}`);
  console.log(`  Renamed: ${report.summary.renamed}`);
  if (report.summary.copied > 0) {
    console.log(`  Copied: ${report.summary.copied}`);
  }
  console.log("  Instruction sources involved:");
  for (const [pId, count] of Object.entries(
    report.summary.instructionSourcesInvolved
  )) {
    const pName = pId === "codex" ? "Codex" : pId === "copilot" ? "GitHub Copilot" : pId === "gemini" ? "Gemini" : "Generic";
    console.log(`    ${pName}: ${count}`);
  }
  console.log(
    `  Changed instruction files: ${report.summary.instructionFilesChanged}`
  );
  for (const [pId, count] of Object.entries(report.summary.distinctScopes)) {
    const pName = pId === "codex" ? "Codex" : pId === "copilot" ? "GitHub Copilot" : pId === "gemini" ? "Gemini" : "Generic";
    console.log(`  Distinct ${pName} scopes: ${count}`);
  }
  if (report.diagnostics.length > 0) {
    console.log("");
    console.log(
      chalk7.bold.yellow(
        `Diagnostics for involved instruction files (${report.diagnostics.length}):`
      )
    );
    for (const d of report.diagnostics) {
      const tag = d.severity === "error" ? chalk7.bgRed.black(" ERROR ") : d.severity === "warning" ? chalk7.bgYellow.black(" WARN ") : chalk7.bgBlue.black(" INFO ");
      const src = d.sourcePath ? chalk7.gray(` ${d.sourcePath}`) : "";
      console.log(`${tag} ${chalk7.bold(d.id)}${src}`);
      console.log(`  ${d.message}`);
    }
  }
  console.log("");
  console.log(chalk7.gray(`Notice: ${report.deterministicModeNotice}`));
}

// src/cli/index.ts
function createCli() {
  const program = new Command();
  program.name("agentrulemap").description("Deterministic AI coding-agent instruction discovery, scope resolution, conflicts & coverage engine").version("1.0.0");
  program.command("check").description("Analyze the repository and verify agent readiness").option("-j, --json", "Output results as structured JSON").option("-v, --verbose", "Show detailed check explanations").option("-C, --cwd <path>", "Target directory to analyze (default: current directory)").action((opts) => {
    const { exitCode } = runCheckCommand({
      json: Boolean(opts.json),
      verbose: Boolean(opts.verbose),
      cwd: opts.cwd
    });
    process.exitCode = exitCode;
  });
  program.command("init").description("Generate an AGENTS.md template tailored to the actual repository").option("-f, --force", "Overwrite existing AGENTS.md if present").option("-C, --cwd <path>", "Target directory (default: current directory)").action((opts) => {
    const result = runInitCommand({
      force: Boolean(opts.force),
      cwd: opts.cwd
    });
    process.exitCode = result.success ? 0 : 1;
  });
  program.command("fix").description("Perform safe deterministic fixes (add missing sections, update gitignore, etc.)").option("-d, --dry-run", "Show proposed changes without writing to disk").option("-C, --cwd <path>", "Target directory (default: current directory)").action((opts) => {
    runFixCommand({
      dryRun: Boolean(opts.dryRun),
      cwd: opts.cwd
    });
    process.exitCode = 0;
  });
  program.command("resolve <targetPath>").description("Resolve which AI instruction files apply to a specific target file path").option("-p, --profile <profile>", "Agent profile: codex, copilot, gemini, generic (default: codex)", "codex").option("-j, --json", "Output resolution as structured JSON").option("-C, --cwd <path>", "Repository root directory (default: current directory)").action((targetPath, opts) => {
    const { exitCode } = runResolveCommand(targetPath, {
      profile: opts.profile,
      json: Boolean(opts.json),
      cwd: opts.cwd
    });
    process.exitCode = exitCode;
  });
  program.command("trace <targetPath>").description("Trace which instruction sources match a target path with precedence ordering").option("-p, --profile <profile>", "Agent profile: codex, copilot, gemini, generic (default: codex)", "codex").option("-j, --json", "Output trace as structured JSON").option("-C, --cwd <path>", "Repository root directory (default: current directory)").action((targetPath, opts) => {
    const { exitCode } = runResolveCommand(targetPath, {
      profile: opts.profile,
      json: Boolean(opts.json),
      cwd: opts.cwd
    });
    process.exitCode = exitCode;
  });
  program.command("explain <targetPath>").description("Explain why specific instruction sources apply or do not apply to a target path").option("-p, --profile <profile>", "Agent profile: codex, copilot, gemini, generic (default: codex)", "codex").option("-j, --json", "Output explanation as structured JSON").option("-C, --cwd <path>", "Repository root directory (default: current directory)").action((targetPath, opts) => {
    const { exitCode } = runResolveCommand(targetPath, {
      profile: opts.profile,
      json: Boolean(opts.json),
      cwd: opts.cwd
    });
    process.exitCode = exitCode;
  });
  program.command("discover").description("Discover all AI agent instruction files in the repository for a profile").option("-p, --profile <profile>", "Agent profile: codex, copilot, gemini, generic (default: generic)", "generic").option("-j, --json", "Output discovered sources as structured JSON").option("--sarif", "Output discovered sources and diagnostics as SARIF 2.1.0").option("--format <format>", "Output format: text, json, sarif (default: text)", "text").option("-C, --cwd <path>", "Repository root directory (default: current directory)").action((opts) => {
    const { exitCode } = runDiscoverCommand({
      profile: opts.profile,
      json: Boolean(opts.json),
      sarif: Boolean(opts.sarif),
      format: opts.format,
      cwd: opts.cwd
    });
    process.exitCode = exitCode;
  });
  program.command("scan").description("Scan repository to discover instruction sources").option("-p, --profile <profile>", "Agent profile: codex, copilot, gemini, generic (default: generic)", "generic").option("-j, --json", "Output scan as structured JSON").option("--sarif", "Output scan and diagnostics as SARIF 2.1.0").option("--format <format>", "Output format: text, json, sarif (default: text)", "text").option("-C, --cwd <path>", "Repository root directory (default: current directory)").action((opts) => {
    const { exitCode } = runDiscoverCommand({
      profile: opts.profile,
      json: Boolean(opts.json),
      sarif: Boolean(opts.sarif),
      format: opts.format,
      cwd: opts.cwd
    });
    process.exitCode = exitCode;
  });
  program.command("conflicts").description("Find objectively detectable structural conflicts, stale references, and invalid scopes").option("-p, --profile <profile>", "Agent profile: codex, copilot, gemini, generic, all (default: all)", "all").option("-j, --json", "Output report as deterministic structured JSON").option("--sarif", "Output report as SARIF 2.1.0").option("--format <format>", "Output format: text, json, sarif (default: text)", "text").option("-s, --strict", "Exit with code 1 if any error-level diagnostic is detected").option("-C, --cwd <path>", "Repository root directory (default: current directory)").action(async (opts) => {
    await conflictsCommand({
      profile: opts.profile,
      json: Boolean(opts.json),
      sarif: Boolean(opts.sarif),
      format: opts.format,
      strict: Boolean(opts.strict),
      cwd: opts.cwd
    });
  });
  program.command("coverage").description("Describe where instruction coverage exists across repository boundaries").option("-p, --profile <profile>", "Agent profile: codex, copilot, gemini, generic, all (default: all)", "all").option("-j, --json", "Output coverage report as structured JSON").option("-C, --cwd <path>", "Repository root directory (default: current directory)").action(async (opts) => {
    await coverageCommand({
      profile: opts.profile,
      json: Boolean(opts.json),
      cwd: opts.cwd
    });
  });
  program.command("changed").description("Analyze which AI coding-agent instructions apply to files changed in branch, commit, staged, or PR").option("-b, --base <ref>", "Git base revision to compare working tree against (e.g. main, origin/main, HEAD~1)").option("--staged", "Analyze staged changes (HEAD \u2194 index)").option("--unstaged", "Analyze unstaged changes (index \u2194 working tree)").option("--compare-instructions", "Compare instruction mappings between base revision and working tree").option("-p, --profile <profile>", "Agent profile: codex, copilot, gemini, generic, all (default: all)", "all").option("-j, --json", "Output report as deterministic structured JSON").option("--sarif", "Output report as SARIF 2.1.0").option("--format <format>", "Output format: text, json, sarif (default: text)", "text").option("-s, --strict", "Exit with code 1 if any error-level diagnostic is detected").option("-C, --cwd <path>", "Repository root directory (default: current directory)").action(async (opts) => {
    await changedCommand({
      base: opts.base,
      staged: Boolean(opts.staged),
      unstaged: Boolean(opts.unstaged),
      compareInstructions: Boolean(opts.compareInstructions),
      profile: opts.profile,
      json: Boolean(opts.json),
      sarif: Boolean(opts.sarif),
      format: opts.format,
      strict: Boolean(opts.strict),
      cwd: opts.cwd
    });
  });
  return program;
}
function run() {
  const program = createCli();
  program.parse(process.argv);
}
run();
export {
  createCli,
  run
};
