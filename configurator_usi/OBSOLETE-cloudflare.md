# Configuratorul pe Cloudflare Pages — SCOS DIN FUNCŢIUNE (2026-11-03)

Ramură de arhivă: nu se mai lucrează pe ea şi nu se mai publică. În producţie rămân doar
managerul de comenzi (cu configuratorul servit de el) şi portalul agenţilor (clienti-agenti).

Ce era aici:
- proiectul Cloudflare Pages `configuratorconfort` (https://configuratorconfort.pages.dev, ramura de producţie `test`),
  publicat din 2026-09-18 pentru review — şters 2026-11-03;
- `build_pages.js` — după `node build.js`, face `dist_pages/`: pagina principală statică (`pages/index.html`, gamele
  din `js/systems/game.json`) la `/` + configuratorul la `/configurator/` (fără `.map`), cu `<meta name="acasa">`
  pentru linkul „← Acasă” (citit de renderOferta în `js/ui.js`);
- publicarea: `cd configurator_usi && node build.js && node build_pages.js && cd .. &&
  npx wrangler pages deploy configurator_usi/dist_pages --project-name configuratorconfort --branch test`.
