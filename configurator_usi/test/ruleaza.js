// Împachetează test/referinta.mjs cu esbuild (importă JSON şi module ESM ale
// browserului) şi îl rulează în Node. Argumentele trec mai departe.
// `--script <fişier.mjs>` rulează alt script din test/ (ex. recalculeaza.mjs).
const esbuild = require('esbuild');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const argv = process.argv.slice(2);
const i = argv.indexOf('--script');
const script = i >= 0 ? argv.splice(i, 2)[1] : 'referinta.mjs';

const out = path.join(os.tmpdir(), `configurator-test-${process.pid}.mjs`);
esbuild.buildSync({
  entryPoints: [path.join(__dirname, script)],
  bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error',
  // referinta.json se scrie lângă sursă, nu lângă bundle-ul temporar
  define: { 'import.meta.url': JSON.stringify('file://' + path.join(__dirname, script)) },
});
const r = spawnSync(process.execPath, [out, ...argv], { stdio: 'inherit' });
require('node:fs').rmSync(out, { force: true });
process.exit(r.status ?? 1);
