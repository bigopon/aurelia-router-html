import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const [version, ...extraArgs] = process.argv.slice(2);

if (version === undefined || extraArgs.length > 0) {
  throw new Error('Usage: npm run release -- <version>');
}

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(version)) {
  throw new Error(`Invalid version: ${version}`);
}

const run = (command, args) => execFileSync(command, args, { stdio: 'inherit' });
const output = (command, args) => execFileSync(command, args, { encoding: 'utf8' }).trim();
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
const tag = `v${version}`;

if (version === packageJson.version) {
  throw new Error(`Version ${version} is already in package.json.`);
}

if (output('git', ['status', '--porcelain']) !== '') {
  throw new Error('Working tree must be clean before releasing.');
}

const branch = output('git', ['branch', '--show-current']);
if (branch === '') {
  throw new Error('Releases must be created from a branch, not a detached HEAD.');
}

try {
  run('git', ['remote', 'get-url', 'origin']);
} catch {
  throw new Error('The origin remote is required to publish a release.');
}

try {
  run('git', ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}`]);
  throw new Error(`Tag ${tag} already exists locally.`);
} catch (error) {
  if (error.status !== 1) {
    throw error;
  }
}

try {
  run('git', ['ls-remote', '--exit-code', '--tags', 'origin', `refs/tags/${tag}`]);
  throw new Error(`Tag ${tag} already exists on origin.`);
} catch (error) {
  if (error.status !== 2) {
    throw error;
  }
}

run('npm', ['version', version, '--no-git-tag-version', '--ignore-scripts']);
run('git', ['add', 'package.json', 'package-lock.json']);
run('git', ['commit', '-m', `chore(release): ${version}`]);
run('git', ['tag', tag]);
run('git', ['push', '--atomic', 'origin', branch, `refs/tags/${tag}`]);
