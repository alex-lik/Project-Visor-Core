#!/usr/bin/env node

/**
 * Release Automation CLI for Project Visor
 * Follows Semantic Versioning 2.0.0 and Keep a Changelog standards.
 * 
 * Usage:
 *   node scripts/release.mjs <patch|minor|major|x.y.z> [--dry-run]
 *   npm run release -- minor
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const packageJsonPath = path.join(rootDir, 'package.json');
const changelogPath = path.join(rootDir, 'CHANGELOG.md');

// Colors
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

function parseSemVer(versionStr) {
  const match = versionStr.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] || null
  };
}

function calculateNextVersion(currentVersion, bumpType) {
  const parsed = parseSemVer(currentVersion);
  if (!parsed) {
    throw new Error(`Invalid current version: "${currentVersion}"`);
  }

  if (bumpType === 'major') {
    return `${parsed.major + 1}.0.0`;
  } else if (bumpType === 'minor') {
    return `${parsed.major}.${parsed.minor + 1}.0`;
  } else if (bumpType === 'patch') {
    return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
  } else if (parseSemVer(bumpType)) {
    // Explicit version passed (e.g. 1.2.0)
    return bumpType;
  } else {
    throw new Error(`Invalid bump type "${bumpType}". Must be 'major', 'minor', 'patch' or a valid SemVer string.`);
  }
}

async function runRelease() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const bumpTypeArg = args.find(a => !a.startsWith('--'));

  console.log(`\n${CYAN}${BOLD}🚀 Project Visor Release Automation${RESET}`);
  console.log(`${CYAN}===================================${RESET}`);

  if (!bumpTypeArg) {
    console.error(`\n${RED}Error: Release bump type is required!${RESET}`);
    console.log(`\nUsage:`);
    console.log(`  npm run release -- patch     (e.g. 1.1.0 -> 1.1.1)`);
    console.log(`  npm run release -- minor     (e.g. 1.1.0 -> 1.2.0)`);
    console.log(`  npm run release -- major     (e.g. 1.1.0 -> 2.0.0)`);
    console.log(`  npm run release -- 1.2.5     (explicit version)`);
    console.log(`  npm run release -- minor --dry-run (preview without changes)\n`);
    process.exit(1);
  }

  // 1. Read package.json
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  const currentVersion = pkg.version;
  const nextVersion = calculateNextVersion(currentVersion, bumpTypeArg);

  console.log(`Current version: ${YELLOW}v${currentVersion}${RESET}`);
  console.log(`Next release:    ${GREEN}${BOLD}v${nextVersion}${RESET}`);
  if (isDryRun) {
    console.log(`${YELLOW}⚡ DRY RUN MODE: No files will be modified and no git tags created.${RESET}`);
  }

  // 2. Check git status
  if (!isDryRun) {
    try {
      const gitStatus = execSync('git status --porcelain', { encoding: 'utf-8' }).trim();
      if (gitStatus.length > 0) {
        console.warn(`\n${YELLOW}⚠ Warning: Working directory contains uncommitted changes:${RESET}`);
        console.warn(gitStatus);
        console.warn(`\n${YELLOW}Please commit or stash your changes before creating an official release.${RESET}`);
      }
    } catch {
      // Ignore if not in git repo
    }
  }

  // 3. Update CHANGELOG.md
  if (fs.existsSync(changelogPath)) {
    let changelogContent = fs.readFileSync(changelogPath, 'utf-8');
    const today = new Date().toISOString().split('T')[0];
    const newVersionHeader = `## [${nextVersion}] - ${today}`;

    if (!changelogContent.includes(`## [${nextVersion}]`)) {
      if (changelogContent.includes('## [Unreleased]')) {
        changelogContent = changelogContent.replace(
          '## [Unreleased]',
          `## [Unreleased]\n\n---\n\n${newVersionHeader}`
        );
      } else {
        changelogContent = `${newVersionHeader}\n\n` + changelogContent;
      }

      if (!isDryRun) {
        fs.writeFileSync(changelogPath, changelogContent, 'utf-8');
        console.log(`✔ Updated ${BOLD}CHANGELOG.md${RESET} with section [${nextVersion}] - ${today}`);
      } else {
        console.log(`[DRY RUN] Would update CHANGELOG.md with section [${nextVersion}] - ${today}`);
      }
    } else {
      console.log(`ℹ Section for [${nextVersion}] already exists in CHANGELOG.md`);
    }
  }

  // 4. Update package.json
  if (!isDryRun) {
    pkg.version = nextVersion;
    fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
    console.log(`✔ Updated ${BOLD}package.json${RESET} version to ${nextVersion}`);
  } else {
    console.log(`[DRY RUN] Would update package.json version to ${nextVersion}`);
  }

  // 5. Git Commit & Tag
  if (!isDryRun) {
    try {
      execSync(`git add package.json CHANGELOG.md`, { stdio: 'inherit' });
      execSync(`git commit -m "chore(release): v${nextVersion}"`, { stdio: 'inherit' });
      execSync(`git tag -a v${nextVersion} -m "Release v${nextVersion}"`, { stdio: 'inherit' });
      console.log(`✔ Git commit and tag ${GREEN}v${nextVersion}${RESET} created successfully!`);
    } catch (err) {
      console.error(`${RED}Git tagging failed:${RESET}`, err.message);
    }
  } else {
    console.log(`[DRY RUN] Would execute:`);
    console.log(`  git add package.json CHANGELOG.md`);
    console.log(`  git commit -m "chore(release): v${nextVersion}"`);
    console.log(`  git tag -a v${nextVersion} -m "Release v${nextVersion}"`);
  }

  console.log(`\n${GREEN}${BOLD}🎉 Release v${nextVersion} preparation completed!${RESET}`);
  console.log(`Next steps to finalize release:`);
  console.log(`  1. Push release commit and tags:  ${CYAN}git push origin main --tags${RESET}`);
  console.log(`  2. Build & deploy Docker image:   ${CYAN}docker compose up -d --build${RESET}\n`);
}

runRelease().catch(err => {
  console.error(`${RED}Release failed:${RESET}`, err);
  process.exit(1);
});
