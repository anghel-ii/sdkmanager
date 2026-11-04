// ═══════════════════════════════════════════════════════════════════════════
//  VOPSITORIE (userul, 2026-11-04): comenzile în lucru cu RAL (rame + uşi), data
//  dusă la vopsit + vopsitorul, notificarea la fiecare 5 zile celui care a scris-o.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'manager-vopsitorie-'));
Object.assign(process.env, { MANAGER_DB: path.join(TEMP, 'manager.sqlite'), MANAGER_BACKUP: path.join(TEMP, 'backup'), MANAGER_RAPORTARE: '0', MANAGER_RELEU_URL: '' });

const { deschide, db, inchide } = require('../server/db.js');
const { creeazaUtilizator } = require('../server/auth.js');
const { rute, verificaNotificari, nrNeduse } = require('../server/vopsitorie.js');

let treceri = 0, caderi = 0;
function verifica(nume, conditie, detaliu = '') {
  if (conditie) { treceri++; console.log(`  ✓ ${nume}`); }
  else          { caderi++;  console.log(`  ✗ ${nume}${detaliu ? ` — ${detaliu}` : ''}`); }
}

let eu = null;
async function cheama(metoda, cale, { corp, id } = {}) {
  const spec = rute.find(([m, c]) => m === metoda && c === cale)[2];
  const brut = corp === undefined ? '' : JSON.stringify(corp);
  const iese = { cod: 0, date: null };
  const req = { url: cale, on(e, f) { if (e === 'data' && brut) f(Buffer.from(brut)); if (e === 'end') f(); return this; } };
  const res = { writeHead(c) { iese.cod = c; }, setHeader() {}, end(t) { iese.date = t ? JSON.parse(t) : null; } };
  try { await spec.handler({ req, res, params: { id: String(id ?? '') }, utilizator: eu }); }
  catch (e) { iese.cod = e.cod ?? 500; iese.date = { eroare: e.message }; }
  return iese;
}
const lista = async () => (await cheama('GET', '/api/vopsitorie')).date;
const salveaza = (id, corp) => cheama('PUT', '/api/vopsitorie/:id', { id, corp });
const zi = dif => db().prepare(`SELECT date('now', 'localtime', ?) AS d`).get(`${dif} days`).d;
const notificari = uid => db().prepare('SELECT titlu, text, link FROM notificare WHERE utilizator_id = ? ORDER BY id').all(uid);

let nr = 0;
function comanda({ tip = 'comanda', pozitii }) {
  nr++;
  const id = Number(db().prepare(`INSERT INTO comanda (numar, tip, client_nume, creat_de, confirmat_la)
    VALUES (?, ?, ?, ?, datetime('now'))`).run(`OF-2026-${String(nr).padStart(4, '0')}`, tip, `Client ${nr}`, eu.id).lastInsertRowid);
  pozitii.forEach(([sistem, config], k) => db().prepare(`INSERT INTO pozitie (comanda_id, idx, sistem, eticheta, finisaj, latime, inaltime, nr_usi, config_json)
    VALUES (?, ?, ?, ?, 'ALUMINIU', 1200, 2100, 2, ?)`).run(id, k + 1, sistem, `Produs ${sistem}`, JSON.stringify({ system: sistem, ...config })));
  return id;
}

(async () => {
  deschide();
  creeazaUtilizator({ nume: 'Ana Birou', user: 'ana', parola: 'parola-ana-123', rol: 'birou' });
  creeazaUtilizator({ nume: 'Dan Birou', user: 'dan', parola: 'parola-dan-123', rol: 'birou' });
  const ana = db().prepare("SELECT id, nume, rol FROM utilizator WHERE user = 'ana'").get();
  const dan = db().prepare("SELECT id, nume, rol FROM utilizator WHERE user = 'dan'").get();
  eu = ana;

  console.log('\nCe comenzi apar');
  const usa = comanda({ pozitii: [['confortVerona', { vopsire: { ral: ' 9005 ', cant: 2 } }], ['suspendataA', { vopsire: { ral: '', cant: 0 } }]] });
  const rama = comanda({ pozitii: [['rama820', { rame: { ral: '7016' }, vopsire: { ral: 'NU-SE-IA' } }]] });
  const faraRal = comanda({ pozitii: [['suspendataA', {}]] });
  const oferta = comanda({ tip: 'oferta', pozitii: [['confortVerona', { vopsire: { ral: '1013' } }]] });
  const ramaGoala = comanda({ pozitii: [['rama831', { rame: { ral: '' } }]] });
  let l = await lista();
  const ids = l.comenzi.map(c => c.id);
  verifica('uşa cu RAL şi rama cu RAL apar', ids.includes(usa) && ids.includes(rama), JSON.stringify(ids));
  verifica('fără RAL / ofertă / ramă cu RAL gol — nu', !ids.includes(faraRal) && !ids.includes(oferta) && !ids.includes(ramaGoala));
  const cu = l.comenzi.find(c => c.id === usa);
  verifica('doar produsele cu RAL, codul fără spaţii', cu.produse.length === 1 && cu.produse[0].ral === '9005', JSON.stringify(cu.produse));
  verifica('la rame RAL-ul din rame, nu din vopsire', l.comenzi.find(c => c.id === rama).produse[0].ral === '7016');
  verifica('meniul: 2 neduse', nrNeduse() === 2);

  console.log('\nSalvarea');
  verifica('fără vopsitor → 400', (await salveaza(usa, { dus_la: zi(0), vopsitor: '' })).cod === 400);
  verifica('fără dată → 400', (await salveaza(usa, { dus_la: '', vopsitor: 'Vopsitoria X' })).cod === 400);
  verifica('dată greşită → 400', (await salveaza(usa, { dus_la: '2026-02-30', vopsitor: 'X' })).cod === 400);
  verifica('dată în viitor → 400', (await salveaza(usa, { dus_la: zi(1), vopsitor: 'X' })).cod === 400);
  verifica('comandă fără RAL → 404', (await salveaza(faraRal, { dus_la: zi(0), vopsitor: 'X' })).cod === 404);
  verifica('ofertă → 404', (await salveaza(oferta, { dus_la: zi(0), vopsitor: 'X' })).cod === 404);
  verifica('salvată', (await salveaza(usa, { dus_la: zi(-3), vopsitor: '  Vopsitoria   Ionescu ' })).cod === 200);
  l = await lista();
  const s = l.comenzi.find(c => c.id === usa);
  verifica('data, vopsitorul (spaţii curăţate), cine, zilele', s.dus_la === zi(-3) && s.vopsitor === 'Vopsitoria Ionescu'
    && s.dus_de_nume === 'Ana Birou' && s.zile === 3, JSON.stringify(s));
  verifica('vopsitorul apare la sugestii', l.vopsitori.includes('Vopsitoria Ionescu'));
  verifica('cele neduse — primele', l.comenzi[0].id === rama);
  verifica('meniul: 1 nedusă', nrNeduse() === 1);

  console.log('\nNotificările (la fiecare 5 zile, celui care a scris)');
  verificaNotificari();
  verifica('la 3 zile — nimic', notificari(ana.id).length === 0);
  db().prepare('UPDATE vopsire SET dus_la = ? WHERE comanda_id = ?').run(zi(-5), usa);
  verificaNotificari();
  let n = notificari(ana.id);
  verifica('la 5 zile — una, la Ana', n.length === 1 && /Vopsitoria Ionescu/.test(n[0].titlu) && /OF-2026-0001/.test(n[0].text)
    && /5 zile/.test(n[0].text) && n[0].link === '/vopsitorie', JSON.stringify(n));
  verificaNotificari();
  verifica('aceeaşi zi, a doua verificare — nu se repetă', notificari(ana.id).length === 1);
  db().prepare('UPDATE vopsire SET dus_la = ? WHERE comanda_id = ?').run(zi(-10), usa);
  verificaNotificari();
  verifica('la 10 zile — a doua', notificari(ana.id).length === 2);

  eu = dan;   // Dan schimbă data: de acum lui îi vin, de la capăt
  await salveaza(usa, { dus_la: zi(-12), vopsitor: 'Vopsitoria Ionescu' });
  verificaNotificari();
  verifica('data schimbată de Dan (12 zile în urmă) — una singură, la Dan', notificari(dan.id).length === 1 && notificari(ana.id).length === 2,
    JSON.stringify(notificari(dan.id)));
  await salveaza(usa, { dus_la: zi(-12), vopsitor: 'Alt vopsitor' });
  verificaNotificari();
  verifica('doar vopsitorul schimbat — nu se repetă', notificari(dan.id).length === 1);

  console.log('\nCând iese din listă');
  db().prepare(`UPDATE comanda SET finalizat_la = datetime('now') WHERE id = ?`).run(usa);
  l = await lista();
  verifica('finalizată → nu mai apare', !l.comenzi.some(c => c.id === usa));
  db().prepare('UPDATE vopsire SET dus_la = ? WHERE comanda_id = ?').run(zi(-15), usa);
  verificaNotificari();
  verifica('finalizată → fără notificări', notificari(dan.id).length === 1);
  verifica('finalizată → nu se mai poate salva', (await salveaza(usa, { dus_la: zi(0), vopsitor: 'X' })).cod === 404);

  console.log('\nŞtergerea');
  await salveaza(rama, { dus_la: zi(0), vopsitor: 'X' });
  verifica('salvată rama', (await lista()).comenzi.find(c => c.id === rama).dus_la === zi(0));
  verifica('golită → ştearsă', (await salveaza(rama, { dus_la: '', vopsitor: '' })).cod === 200
    && (await lista()).comenzi.find(c => c.id === rama).dus_la === null);

  inchide();
  try { fs.rmSync(TEMP, { recursive: true, force: true }); } catch {}
  console.log(`\n${treceri} trecute, ${caderi} căzute\n`);
  process.exit(caderi ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
