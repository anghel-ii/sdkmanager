const esbuild = require('esbuild');
const fs      = require('fs');

// taci warning-ul „SQLite is an experimental feature" de la node:sqlite
const _emitWarning = process.emitWarning;
process.emitWarning = (w, ...rest) =>
  String(w).includes('SQLite is an experimental') ? undefined : _emitWarning.call(process, w, ...rest);

const CATALOG_DIR = 'js/catalog';
const CATALOG_OUT = 'js/catalog/catalog.generated.json';
const SELECT_ALL  = 'SELECT * FROM articol WHERE activ = 1 ORDER BY cod';   // `cod` e comun tuturor tabelelor

const mtime = f => (fs.existsSync(f) ? fs.statSync(f).mtimeMs : 0);

// ── Catalog: js/catalog/<family>.seed.sql → <family>.sqlite → catalog.generated.json ──
// Un fişier per familie de sisteme (numele = `meta.family`). Rezultatul e
// { "<family>": [ {articol}, ... ] }. Poţi menţine fie .seed.sql (text), fie
// .sqlite direct (DB Browser) — seed-ul mai nou reconstruieşte baza.
function buildCatalog() {
  let DatabaseSync;
  try {
    ({ DatabaseSync } = require('node:sqlite'));
  } catch (e) {
    if (!fs.existsSync(CATALOG_OUT)) fs.writeFileSync(CATALOG_OUT, '{}\n');
    console.error('Catalog: node:sqlite indisponibil (necesită Node ≥ 22.5) — păstrez ' + CATALOG_OUT);
    return;
  }

  const files   = fs.readdirSync(CATALOG_DIR);
  const families = new Set([
    ...files.filter(f => f.endsWith('.seed.sql')).map(f => f.replace('.seed.sql', '')),
    ...files.filter(f => f.endsWith('.sqlite')).map(f => f.replace('.sqlite', '')),
  ]);

  const out = {};
  for (const family of families) {
    const seed = `${CATALOG_DIR}/${family}.seed.sql`;
    const sqlite = `${CATALOG_DIR}/${family}.sqlite`;

    if (fs.existsSync(seed) && mtime(seed) > mtime(sqlite)) {
      fs.rmSync(sqlite, { force: true });
      const db = new DatabaseSync(sqlite);
      db.exec(fs.readFileSync(seed, 'utf8'));
      db.close();
      console.log(`Catalog[${family}]: reconstruit din ${family}.seed.sql`);
    }
    if (!fs.existsSync(sqlite)) { out[family] = []; continue; }

    const db = new DatabaseSync(sqlite);
    out[family] = db.prepare(SELECT_ALL).all();
    db.close();
  }

  fs.writeFileSync(CATALOG_OUT, JSON.stringify(out, null, 2) + '\n');
  const total = Object.values(out).reduce((s, r) => s + r.length, 0);
  console.log(`Catalog: ${total} articole în ${Object.keys(out).length || 0} familii → ${CATALOG_OUT}`);
}

async function build() {
  buildCatalog();

  fs.mkdirSync('dist/css', { recursive: true });

  await esbuild.build({
    entryPoints: ['js/app.js'],
    bundle:   true,
    outfile:  'dist/bundle.js',
    platform: 'browser',
    minify:   true,
  });

  // transforma index.html: scoate importmap + scriptul de modul, baga bundle.js
  let html = fs.readFileSync('index.html', 'utf8');
  html = html.replace(/<script type="importmap">[\s\S]*?<\/script>\n?/, '');
  html = html.replace(
    '<script type="module" src="js/app.js"></script>',
    '<script src="bundle.js"></script>'
  );
  fs.writeFileSync('dist/index.html', html);

  // toate foile de stil (main.css = interfaţa clasică, nou.css = cea nouă, sub body.ui-nou)
  fs.readdirSync('css').forEach(f => fs.copyFileSync(`css/${f}`, `dist/css/${f}`));

  // Gamele — acelaşi fişier pe care îl împachetează şi bundle-ul. Copiat în
  // dist/ ca pagina principală a managerului să-l poată citi prin HTTP
  // (/configurator/game.json), fără să dubleze lista de modele.
  fs.copyFileSync('js/systems/game.json', 'dist/game.json');

  // assets (schite)
  if (fs.existsSync('assets')) {
    fs.mkdirSync('dist/assets', { recursive: true });
    fs.readdirSync('assets').forEach(f => fs.copyFileSync(`assets/${f}`, `dist/assets/${f}`));
  }

  console.log('Build gata → dist/index.html (deschide direct in browser, fara server)');
}

if (process.argv.includes('--catalog-only')) {
  buildCatalog();
} else {
  build().catch(e => { console.error(e); process.exit(1); });
}
