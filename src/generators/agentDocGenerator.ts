import type { RepoContext } from '../types/index.js';

export function generateAgentsTemplate(context: RepoContext): string {
  const name = context.name || 'Project';
  const desc = context.packageJson?.description || 'Repository configured for AI coding agents.';
  const types = context.detectedTypes.join(', ');
  const scripts = context.packageJson?.scripts || {};

  const buildCmd = scripts.build ? 'npm run build' : 'None configured';
  const testCmd = scripts.test ? 'npm test' : (scripts['test:run'] ? 'npm run test:run' : 'None configured');
  const lintCmd = scripts.lint ? 'npm run lint' : 'None configured';

  // Format detected directories
  const importantDirs = Object.entries(context.structure.importantDirs)
    .filter(([_, relPath]) => Boolean(relPath))
    .map(([type, relPath]) => `- \`${relPath}/\`: ${formatDirDescription(type)}`)
    .join('\n');

  return `# AGENTS.md - Instructions for AI Coding Agents

## Project Overview
- **Name**: ${name}
- **Description**: ${desc}
- **Detected Stack**: ${types}

## Repository Structure
Key directories in this codebase:
${importantDirs || '- `src/`: Core source code\n- `tests/`: Automated test suite'}

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
${
  scripts.build
    ? `\`\`\`bash\n${buildCmd}\n\`\`\``
    : 'No build command detected in package.json.'
}

## Test Commands
Run the automated test suite before proposing changes:
${
  scripts.test || scripts['test:run']
    ? `\`\`\`bash\n${testCmd}\n\`\`\``
    : 'No test script configured yet.'
}

## Lint & Quality Verification
Verify static analysis and formatting:
${
  scripts.lint
    ? `\`\`\`bash\n${lintCmd}\n\`\`\``
    : 'No lint script configured yet.'
}

## Coding Guidelines
- **TypeScript**: Strict mode enabled. Avoid arbitrary \`any\` types; declare explicit interfaces.
- **Modularity**: Keep modules focused and avoid oversized multi-responsibility files.
- **Clean Architecture**: Place reusable utilities in appropriate subdirectories.
- **Verification**: Always run tests and type checking after modifying code.

## Important Files
- \`package.json\`: Project manifest, scripts, and dependency definitions.
${context.hasTsConfig ? '- `tsconfig.json`: TypeScript compiler options and path aliases.\n' : ''}- \`README.md\`: High-level human documentation.
- \`.gitignore\`: Git exclusion rules.

## Safety Rules
- **Secrets**: Never commit \`.env\`, API keys, private certificates, or session tokens.
- **Destructive Actions**: Do not delete critical configuration files or force-push without confirmation.
- **Command Safety**: Do not run arbitrary shell scripts without explicit user review.
`;
}

function formatDirDescription(type: string): string {
  switch (type) {
    case 'src':
      return 'Primary application source code';
    case 'app':
      return 'Application entry points and routing';
    case 'components':
      return 'Reusable UI/logic components';
    case 'tests':
    case 'test':
    case '__tests__':
      return 'Automated unit and integration test suites';
    case 'docs':
      return 'Project documentation and guides';
    case 'scripts':
      return 'Build, deployment, and automation scripts';
    default:
      return `${type} directory`;
  }
}
