#!/usr/bin/env node

/**
 * Conventional Commits 1.0.0 Validator for Project Visor
 * Validates commit messages according to repository standards.
 * Can be run standalone or as a Git commit-msg hook.
 */

import fs from 'node:fs';
import { execSync } from 'node:child_process';

const ALLOWED_TYPES = [
  'feat',
  'fix',
  'docs',
  'style',
  'refactor',
  'perf',
  'test',
  'build',
  'ci',
  'chore',
  'revert'
];

const ALLOWED_SCOPES = [
  'api',
  'mcp',
  'db',
  'auth',
  'rbac',
  'ui',
  'kanban',
  'infra',
  'docker',
  'release',
  'deps',
  'config'
];

const MAX_HEADER_LENGTH = 72;

// ANSI escape codes for formatting
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

function getCommitMessage() {
  const arg = process.argv[2];
  if (arg && fs.existsSync(arg)) {
    // Called by git commit-msg hook with file path
    return fs.readFileSync(arg, 'utf-8');
  } else if (arg && !arg.startsWith('-')) {
    // Passed raw commit message as argument
    return arg;
  } else {
    // Check the latest git commit
    try {
      return execSync('git log -1 --pretty=%B', { encoding: 'utf-8' });
    } catch {
      console.error(`${RED}Error: Unable to read commit message from git log.${RESET}`);
      process.exit(1);
    }
  }
}

export function validateCommitMessage(rawMessage) {
  const errors = [];
  const warnings = [];

  // Remove leading/trailing whitespace and comments (#)
  const lines = rawMessage
    .split('\n')
    .map(line => line.trimEnd())
    .filter(line => !line.startsWith('#'));

  const message = lines.join('\n').trim();

  if (!message) {
    errors.push('Commit message cannot be empty.');
    return { valid: false, errors, warnings };
  }

  // Allow standard Merge and Revert commits
  if (/^Merge\s+(branch|pull\s+request|tag)/i.test(lines[0])) {
    return { valid: true, errors: [], warnings: [] };
  }

  const header = lines[0];

  // Length check
  if (header.length > MAX_HEADER_LENGTH) {
    errors.push(`Header exceeds maximum length of ${MAX_HEADER_LENGTH} characters (current length: ${header.length}).`);
  }

  // Conventional Commits regex
  // Format: <type>(<scope>)?: <subject> or <type>(<scope>)?!: <subject>
  const commitRegex = /^([a-z]+)(?:\(([a-z0-9-_]+)\))?(!)?:\s+(.+)$/;
  const match = header.match(commitRegex);

  if (!match) {
    errors.push(`Header does not match Conventional Commits format: "<type>(<scope>): <subject>".`);
    errors.push(`Received header: "${header}"`);
  } else {
    const [, type, scope, breakingFlag, subject] = match;

    // Check type
    if (!ALLOWED_TYPES.includes(type)) {
      errors.push(`Unknown type "${type}". Allowed types are: ${ALLOWED_TYPES.join(', ')}.`);
    }

    // Check scope if provided
    if (scope && !ALLOWED_SCOPES.includes(scope)) {
      warnings.push(`Non-standard scope "${scope}". Recommended scopes: ${ALLOWED_SCOPES.join(', ')}.`);
    }

    // Subject checks
    if (!subject || subject.trim().length === 0) {
      errors.push('Subject description cannot be empty.');
    } else {
      // First character should not be uppercase
      const firstChar = subject.trim()[0];
      if (firstChar >= 'A' && firstChar <= 'Z') {
        warnings.push(`Subject starts with an uppercase letter "${firstChar}". Conventional Commits prefers lowercase.`);
      }

      // Should not end with a period
      if (subject.trim().endsWith('.')) {
        errors.push('Subject must not end with a period (dot).');
      }
    }
  }

  // If there is a body, check for a blank line after header
  if (lines.length > 1 && lines[1] !== '') {
    errors.push('A blank line is required between the commit header and the body.');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    header
  };
}

// CLI runner
if (process.argv[1]?.endsWith('check-commit-msg.mjs')) {
  const commitMessage = getCommitMessage();
  const result = validateCommitMessage(commitMessage);

  if (result.warnings.length > 0) {
    console.log(`\n${YELLOW}${BOLD}⚠ Commit Message Warnings:${RESET}`);
    result.warnings.forEach(w => console.log(`  ${YELLOW}• ${w}${RESET}`));
  }

  if (!result.valid) {
    console.error(`\n${RED}${BOLD}❌ Invalid Commit Message!${RESET}\n`);
    result.errors.forEach(e => console.error(`  ${RED}✖ ${e}${RESET}`));
    console.error(`\n${CYAN}--- Correct Format Examples ---${RESET}`);
    console.error(`  ${GREEN}feat(ui): add project access sharing modal${RESET}`);
    console.error(`  ${GREEN}fix(auth): prevent session expiration on token refresh${RESET}`);
    console.error(`  ${GREEN}docs(mcp): document SSE transport protocol${RESET}`);
    console.error(`  ${GREEN}chore(release): v1.1.0${RESET}\n`);
    console.error(`Refer to ${BOLD}docs/COMMIT_CONVENTION.md${RESET} for full specifications.\n`);
    process.exit(1);
  } else {
    console.log(`${GREEN}✔ Commit message conforms to Conventional Commits standard.${RESET}`);
    process.exit(0);
  }
}
