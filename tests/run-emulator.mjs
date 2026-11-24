import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
if (!/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw new Error('Set a loopback FIRESTORE_EMULATOR_HOST. This harness never uses production.');
// Optional tools may be installed outside the application checkout.
const toolsDir = process.env.VIAN_EMULATOR_TOOLS || process.cwd();
const dir = await mkdtemp(join(toolsDir, '.vian-integration-'));
try {
  const outfile = join(dir, 'run.mjs');
  await build({ entryPoints:['tests/emulator.test.ts'], bundle:true, packages:'external', platform:'node', format:'esm', outfile, plugins:[{ name:'isolated-db', setup(b) { b.onResolve({ filter:/\/lib\/firebase$/ }, () => ({ path:resolve('tests/emulatorFirebase.ts') })); } }] });
  const result = spawnSync(process.execPath,[outfile],{ stdio:'inherit' });
  process.exitCode = result.status ?? 1;
} finally { await rm(dir,{ recursive:true, force:true }); }
