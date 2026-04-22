import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const rootDir = resolve('.');

async function run(cmd, args, cwd) {
  const useShell = process.platform === 'win32' && cmd === 'npm';
  await execFileAsync(cmd, args, {
    cwd,
    shell: useShell,
    env: process.env,
  });
}

async function makeProject(dir, pkg) {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'package.json'), JSON.stringify(pkg, null, 2));
}

async function main() {
  const tempRoot = await mkdtemp(join(tmpdir(), 'local-ai-sdk-pack-smoke-'));
  const nodeProject = join(tempRoot, 'node-consumer');
  const rnProject = join(tempRoot, 'rn-consumer');
  try {
    const tarballOutput = (
      await execFileAsync('npm', ['pack', '-w', 'local-ai-sdk', '--pack-destination', tempRoot], {
        cwd: rootDir,
        shell: process.platform === 'win32',
        env: process.env,
      })
    ).stdout;
    const tarballName = tarballOutput
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.endsWith('.tgz'))
      .at(-1);
    if (!tarballName) {
      throw new Error('Unable to locate npm pack tarball name in command output.');
    }
    const tarball = join(tempRoot, tarballName);

    await makeProject(nodeProject, { name: 'node-consumer', private: true, type: 'module' });
    await run('npm', ['install', tarball], nodeProject);
    await run(
      'node',
      [
        '--input-type=module',
        '-e',
        "import('local-ai-sdk').then(()=>import('local-ai-sdk/models/node')).then(()=>import('local-ai-sdk/models/rn'))",
      ],
      nodeProject
    );

    await makeProject(rnProject, { name: 'rn-consumer', private: true, type: 'module' });
    await run('npm', ['install', tarball], rnProject);
    await run(
      'node',
      [
        '--conditions=react-native',
        '--input-type=module',
        '-e',
        "import('local-ai-sdk').then(()=>import('local-ai-sdk/models/rn'))",
      ],
      rnProject
    );
    const installedPkg = JSON.parse(
      await readFile(join(rnProject, 'node_modules', 'local-ai-sdk', 'package.json'), 'utf8')
    );
    if (!installedPkg.exports?.['./llama'] || !installedPkg.exports?.['./react']) {
      throw new Error('Installed tarball is missing llama/react subpath exports.');
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

await main();
