// ═══════════════════════════════════════════════════════════════════════════
//  Pachetul pentru update-ul FĂRĂ drepturi de administrator pe Windows
//  (userul, 2026-10-08 — managerul rulează sub un cont fără admin şi nu poate
//  citi cheia de deploy, deci nici git). Îl face CI la fiecare push pe main,
//  după teste, şi îl pune în release-ul „ultima" de pe GitHub; serverul îl
//  descarcă din /admin cu o cheie GitHub doar de citire (manager/server/actualizare.js).
//
//  pachet/versiune.json  { sha, scurt, mesaj, data }
//  pachet/sdk.json.gz    { versiune, fisiere: { 'manager/server/index.js': <base64>, … } }
//    = tot ce rulează pe server: manager/ şi deploy/windows/ (fişierele din git) +
//      configurator_usi/dist/ (construit înainte, fără .map). Doar stdlib — serverul
//      îl desface cu zlib, fără unzip / tar.
//
//  Rulare (din rădăcina repo-ului, după `npm run build` în configurator_usi):
//    node deploy/pachet.mjs
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
const DIST = 'configurator_usi/dist';
if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error(`Lipseşte ${DIST} — rulează întâi npm run build în configurator_usi.`);

const dinDist = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
  const p = `${dir}/${e.name}`;
  return e.isDirectory() ? dinDist(p) : p.endsWith('.map') ? [] : [p];
});
const lista = [...git('ls-files', 'manager', 'deploy/windows').split('\n').filter(Boolean), ...dinDist(DIST)];

const sha = process.env.GITHUB_SHA || git('rev-parse', 'HEAD');
const versiune = { sha, scurt: sha.slice(0, 7), mesaj: git('log', '-1', '--format=%s', sha),
  data: git('log', '-1', '--format=%cd', '--date=format:%d.%m.%Y %H:%M', sha) };
const fisiere = Object.fromEntries(lista.map(f => [f, fs.readFileSync(f).toString('base64')]));

fs.mkdirSync('pachet', { recursive: true });
fs.writeFileSync('pachet/versiune.json', JSON.stringify(versiune));
fs.writeFileSync('pachet/sdk.json.gz', zlib.gzipSync(JSON.stringify({ versiune, fisiere }), { level: 9 }));
console.log(`pachet ${versiune.scurt}: ${lista.length} fişiere, ${(fs.statSync('pachet/sdk.json.gz').size / 1024).toFixed(0)} KB`);
