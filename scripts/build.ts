import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const viteBin = join(repoRoot, 'node_modules', 'vite', 'bin', 'vite.js');

const candidateNodes = [
  join(process.env.USERPROFILE || '', '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'bin', process.platform === 'win32' ? 'node.exe' : 'node'),
  process.execPath,
].filter((nodePath, index, list) => nodePath && list.indexOf(nodePath) === index && existsSync(nodePath));

let lastStatus = 1;
for (const nodePath of candidateNodes) {
  const result = spawnSync(nodePath, [viteBin, 'build'], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  });

  lastStatus = result.status ?? 1;
  if (lastStatus === 0) {
    process.exit(0);
  }
}

process.exit(lastStatus);
