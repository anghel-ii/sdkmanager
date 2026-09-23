// Site-ul pt. Cloudflare Pages: pagina principală statică (pages/index.html,
// cu gamele din game.json) + configuratorul în /configurator/ — aceeaşi
// structură de URL ca la managerul de comenzi. Rulează după `node build.js`:
//   node build_pages.js  →  dist_pages/
// Fără bundle.js.map (lăsat de `npm run dev`) — ar publica codul sursă.
const fs = require('fs');
const path = require('path');

const OUT = 'dist_pages';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(`${OUT}/configurator`, { recursive: true });

fs.cpSync('dist', `${OUT}/configurator`, { recursive: true, filter: f => !f.endsWith('.map') });

// „← Acasă" în configurator: acolo apare doar lângă manager; pe Pages îl
// aprindem prin meta-ul ăsta (vezi renderOferta în js/ui.js).
const cfg = `${OUT}/configurator/index.html`;
fs.writeFileSync(cfg, fs.readFileSync(cfg, 'utf8')
  .replace('<head>', '<head>\n  <meta name="acasa" content="../">'));

const game = JSON.parse(fs.readFileSync('js/systems/game.json', 'utf8')).game;
fs.writeFileSync(`${OUT}/index.html`, fs.readFileSync('pages/index.html', 'utf8')
  .replace('/*GAME*/[]', JSON.stringify(game)));

console.log(`Pages gata → ${OUT}/ (${game.length} game)`);
