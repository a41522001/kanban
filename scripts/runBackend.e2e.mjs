import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, '..');
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const dockerCommand = process.platform === 'win32' ? 'docker.exe' : 'docker';

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} 執行失敗`);
  }
}

let e2eContainersStarted = false;

try {
  e2eContainersStarted = true;
  run(dockerCommand, ['compose', '-f', 'compose.e2e.yml', 'up', '-d', '--wait', '--wait-timeout', '60']);

  run(pnpmCommand, ['--filter', 'backend', 'db:e2e:migrate']);
  run(pnpmCommand, ['--filter', 'backend', 'test:e2e']);
} finally {
  if (e2eContainersStarted) {
    run(dockerCommand, ['compose', '-f', 'compose.e2e.yml', 'down', '--volumes', '--remove-orphans']);
  }
}
