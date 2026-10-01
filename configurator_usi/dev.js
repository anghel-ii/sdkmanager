const esbuild = require('esbuild');
const { execSync } = require('child_process');

async function dev() {
  // build initial HTML + CSS in dist/
  execSync('node build.js', { stdio: 'inherit' });

  const ctx = await esbuild.context({
    entryPoints: { bundle: 'js/app.js', amanunt: 'js/amanunt.js' },
    bundle:    true,
    outdir:    'dist',
    platform:  'browser',
    sourcemap: true,
  });

  await ctx.watch();

  const { host, port } = await ctx.serve({ servedir: 'dist', port: 3001 });
  console.log(`Dev server: http://${host}:${port}  (rebuild automat la save)`);
}

dev().catch(e => { console.error(e); process.exit(1); });
