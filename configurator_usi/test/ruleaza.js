// Împachetează test/referinta.mjs cu esbuild (importă JSON şi module ESM ale
// browserului) şi îl rulează în Node. Argumentele trec mai departe.
const esbuild = require('esbuild');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const out = path.join(os.tmpdir(), `configurator-test-${process.pid}.mjs`);
esbuild.buildSync({
  entryPoints: [path.join(__dirname, 'referinta.mjs')],
  bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error',
  // referinta.json se scrie lângă sursă, nu lângă bundle-ul temporar
  define: { 'import.meta.url': JSON.stringify('file://' + path.join(__dirname, 'referinta.mjs')) },
});
const r = spawnSync(process.execPath, [out, ...process.argv.slice(2)], { stdio: 'inherit' });
require('node:fs').rmSync(out, { force: true });
process.exit(r.status ?? 1);
