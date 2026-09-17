import { describe, expect, it } from 'vitest';
import { parseInstructionFile } from '../src/scanners/instructionParser.js';

describe('Instruction Analysis and Section Detection', () => {
  it('detects all standard sections from comprehensive markdown', () => {
    const markdown = `
# AGENTS.md

## Project Overview
This repository contains a developer CLI tool.

## Development Setup
Run npm install to configure dependencies.

## Build Instructions
npm run build compiles TypeScript files.

## Test Instructions
npm test executes the vitest suite.

## Coding Conventions
Use TypeScript strict mode.

## Important Repository Paths
- \`src/api\`: main endpoint routes
- \`tests/\`: test directory

## Safety Constraints
Do not commit credentials or private tokens.

## Environment Information
Configure .env following .env.example.
    `;

    const parsed = parseInstructionFile(markdown, 'AGENTS.md');
    expect(parsed.sections.projectOverview).toBe(true);
    expect(parsed.sections.installation).toBe(true);
    expect(parsed.sections.build).toBe(true);
    expect(parsed.sections.test).toBe(true);
    expect(parsed.sections.conventions).toBe(true);
    expect(parsed.sections.paths).toBe(true);
    expect(parsed.sections.safety).toBe(true);
    expect(parsed.sections.environment).toBe(true);
  });

  it('detects missing sections correctly', () => {
    const minimal = `# Quick Note\nJust run npm start`;
    const parsed = parseInstructionFile(minimal, 'CLAUDE.md');

    expect(parsed.sections.projectOverview).toBe(false);
    expect(parsed.sections.safety).toBe(false);
    expect(parsed.sections.test).toBe(false);
  });
});
