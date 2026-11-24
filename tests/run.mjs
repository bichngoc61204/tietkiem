import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const dir = await mkdtemp(join(tmpdir(), 'vian-tests-'));
try {
  const outfile = join(dir, 'tests.mjs');
  await build({ entryPoints: ['tests/finance.test.ts'], bundle: true, platform: 'node', format: 'esm', outfile, plugins: [{ name: 'isolated-firebase', setup(build) { build.onResolve({ filter: /^firebase\/firestore$/ }, () => ({ path: resolve('tests/fakeFirestore.ts') })); build.onResolve({ filter: /\/lib\/firebase$/ }, () => ({ path: resolve('tests/fakeFirebase.ts') })); } }] });
  const result = spawnSync(process.execPath, [outfile], { stdio: 'inherit' });
  process.exitCode = result.status || 0;
} finally { await rm(dir, { recursive: true, force: true }); }
