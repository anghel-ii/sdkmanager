// ═══════════════════════════════════════════════════════════════════════════
//  PRODUSELE din exportul NeoManager (userul, 2026-11-02): pornirea, regulile
//  importului şi rutele paginii. Exporturile de test se fac aici, ca .xlsx minime.
// ═══════════════════════════════════════════════════════════════════════════
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'manager-produse-'));
Object.assign(process.env, { MANAGER_DB: path.join(TEMP, 'manager.sqlite'), MANAGER_BACKUP: path.join(TEMP, 'backup'), MANAGER_RAPORTARE: '0', MANAGER_RELEU_URL: '' });

const { deschide, db, inchide } = require('../server/db.js');
const { rute } = require('../server/produse.js');
const PORNIRE = require('../server/produse-start.json');

let treceri = 0, caderi = 0;
function verifica(nume, conditie, detaliu = '') {
  if (conditie) { treceri++; console.log(`  ✓ ${nume}`); }
  else          { caderi++;  console.log(`  ✗ ${nume}${detaliu ? ` — ${detaliu}` : ''}`); }
}

// un .xlsx cu o foaie, cu texte inline, în zip fără compresie
function xlsx(randuri) {
  const coloana = i => String.fromCharCode(65 + i);
  const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const foaie = `<worksheet><sheetData>${randuri.map((r, y) => `<row r="${y + 1}">${r.map((v, x) =>
    `<c r="${coloana(x)}${y + 1}" t="inlineStr"><is><t>${esc(v)}</t></is></c>`).join('')}</row>`).join('')}</sheetData></worksheet>`;
  const nume = Buffer.from('xl/worksheets/sheet1.xml'), date = Buffer.from(foaie);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(nume.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt32LE(date.length, 20); central.writeUInt16LE(nume.length, 28);
  const inceput = 30 + nume.length + date.length;
  const sfarsit = Buffer.alloc(22);
  sfarsit.writeUInt32LE(0x06054b50, 0); sfarsit.writeUInt16LE(1, 10);
  sfarsit.writeUInt32LE(46 + nume.length, 12); sfarsit.writeUInt32LE(inceput, 16);
  return Buffer.concat([local, nume, date, central, nume, sfarsit]);
}
const CAP = ['Gestiune', 'Grupa', 'Denumire', 'Cod', 'UM', 'Pret vanzare'];
const rand = (cod, denumire, grupa = 'Grupa noua', um = 'Buc') => ['Cluj', grupa, denumire, cod, um, '1'];

// rutele chemate direct: răspunsul ajunge în `iese`
async function cheama(metoda, cale, { corp, query = '' } = {}) {
  const spec = rute.find(([m, c]) => m === metoda && c === cale)[2];
  const brut = corp === undefined ? '' : JSON.stringify(corp);
  const iese = { cod: 0, date: null };
  const req = { url: cale + query, on(e, f) { if (e === 'data' && brut) f(Buffer.from(brut)); if (e === 'end') f(); return this; } };
  const res = { writeHead(c) { iese.cod = c; }, setHeader() {}, end(t) { iese.date = t ? JSON.parse(t) : null; } };
  try { await spec.handler({ req, res, params: {} }); }
  catch (e) { iese.cod = e.cod ?? 500; iese.date = { eroare: e.message }; }
  return iese;
}
const fisier = randuri => ({ corp: { continut: xlsx(randuri).toString('base64') } });
const produsul = cod => db().prepare('SELECT * FROM produs WHERE cod = ?').get(cod);
const cate = () => db().prepare('SELECT COUNT(*) AS n FROM produs').get().n;

(async () => {
  deschide();
  const total = PORNIRE.length;

  console.log('\nPornirea');
  const listate = PORNIRE.filter(p => p.listat);
  verifica('toate produsele în bază', cate() === total, String(cate()));
  verifica('listatele de la pornire', db().prepare('SELECT COUNT(*) AS n FROM produs WHERE listat = 1').get().n === listate.length);
  const cuFact = listate.find(p => p.fact), cuBara = listate.find(p => p.bara);
  verifica('modul de facturare păstrat', JSON.stringify(JSON.parse(produsul(cuFact.cod).fact)) === JSON.stringify(cuFact.fact));
  verifica('lungimea barei păstrată', produsul(cuBara.cod).bara === cuBara.bara);

  const lista = (await cheama('GET', '/api/produse')).date.produse;
  verifica('oferta primeşte doar cele listate', lista.length === listate.length, String(lista.length));
  verifica('cu tot cu fact şi bară', lista.find(p => p.cod === cuFact.cod).fact && lista.find(p => p.cod === cuBara.cod).bara);
  verifica('fără câmpuri goale', !('bara' in lista.find(p => !p.bara)));

  const listat = listate[0], nelistat = PORNIRE.find(p => !p.listat), ramas = listate[1];

  console.log('\nVerificarea nu scrie');
  const v = await cheama('POST', '/api/produse/verifica', fisier([CAP, rand('NOU-1', 'Produs nou 1'), rand(listat.cod, 'Alta denumire')]));
  verifica('arată produsul nou', v.cod === 200 && v.date.noi.length === 1 && v.date.noi[0].cod === 'NOU-1', JSON.stringify(v));
  verifica('numără ce există', v.date.existente === 1);
  verifica('n-a scris nimic', cate() === total);

  console.log('\nÎncărcarea');
  const exportul = [CAP, rand('NOU-1', 'Produs nou 1'), rand(' NOU-2 ', 'Produs nou 2'), rand('NOU-1', 'Rând repetat'), rand('', 'Fără cod'),
    rand('NOU-3', ''), rand(listat.cod, 'Alta denumire', 'Alta grupa', 'set'), rand(nelistat.cod, 'Alta denumire')];
  const i = await cheama('POST', '/api/produse/incarca', fisier(exportul));
  verifica('adaugă doar ce e nou', i.date.adaugate === 2 && cate() === total + 2, JSON.stringify(i.date));
  verifica('rândurile fără cod / denumire sărite', i.date.sarite === 2);
  verifica('codul nou intră listat', produsul('NOU-1').listat === 1);
  verifica('fără debitare şi fără mod de facturare', produsul('NOU-1').bara === null && produsul('NOU-1').fact === null);
  verifica('are data adăugării', !!produsul('NOU-1').adaugat_la);
  verifica('codul e curăţat de spaţii', !!produsul('NOU-2'));
  verifica('la cod repetat contează primul rând', produsul('NOU-1').denumire === 'Produs nou 1');
  verifica('produsul existent nu se schimbă', produsul(listat.cod).denumire === listat.denumire && produsul(listat.cod).um === listat.um && produsul(listat.cod).grupa === listat.grupa);
  verifica('nelistatul rămâne nelistat', produsul(nelistat.cod).listat === 0 && produsul(nelistat.cod).denumire === nelistat.denumire);
  verifica('ce lipseşte din export rămâne listat', produsul(ramas.cod).listat === 1);
  verifica('apare la ofertă', (await cheama('GET', '/api/produse')).date.produse.some(p => p.cod === 'NOU-1'));

  const din2 = await cheama('POST', '/api/produse/incarca', fisier(exportul));
  verifica('acelaşi fişier a doua oară nu adaugă nimic', din2.date.adaugate === 0 && cate() === total + 2);

  console.log('\nFişiere greşite');
  const fara = await cheama('POST', '/api/produse/incarca', fisier([['Cod', 'Denumire'], ['X-1', 'Ceva']]));
  verifica('coloane lipsă → refuzat', fara.cod === 400 && /Grupa/.test(fara.date.eroare) && !produsul('X-1'), JSON.stringify(fara));
  const stricat = await cheama('POST', '/api/produse/verifica', { corp: { continut: Buffer.from('nu e excel').toString('base64') } });
  verifica('fişier stricat → refuzat', stricat.cod === 400 && /xlsx/.test(stricat.date.eroare), JSON.stringify(stricat));
  const gol = await cheama('POST', '/api/produse/verifica', { corp: {} });
  verifica('fără fişier → refuzat', gol.cod === 400);

  console.log('\nListat / nelistat');
  await cheama('POST', '/api/produse/listare', { corp: { cod: 'NOU-1', listat: false } });
  verifica('dispare de la ofertă', !(await cheama('GET', '/api/produse')).date.produse.some(p => p.cod === 'NOU-1'));
  await cheama('POST', '/api/produse/incarca', fisier([CAP, rand('NOU-1', 'Produs nou 1')]));
  verifica('rămâne nelistat după alt export', produsul('NOU-1').listat === 0);
  const coduri = await cheama('GET', '/api/produse/coduri', { query: `?cod=NOU-1&cod=${encodeURIComponent(cuFact.cod)}&cod=NIMIC` });
  verifica('oferta veche îl găseşte după cod', coduri.date.produse.length === 2 && coduri.date.produse.some(p => p.cod === 'NOU-1'));
  const lipsa = await cheama('POST', '/api/produse/listare', { corp: { cod: 'NIMIC', listat: true } });
  verifica('cod inexistent → 404', lipsa.cod === 404);
  await cheama('POST', '/api/produse/listare', { corp: { cod: nelistat.cod, listat: true } });
  verifica('un nelistat poate fi listat', (await cheama('GET', '/api/produse')).date.produse.some(p => p.cod === nelistat.cod));

  console.log('\nRegula de facturare');
  const regula = c => cheama('POST', '/api/produse/regula', { corp: c });
  const factul = cod => JSON.parse(produsul(cod).fact ?? 'null');
  await regula({ cod: 'NOU-2', regula: 'jumatate' });
  verifica('întreg sau jumătate', factul('NOU-2')?.pas === 0.5);
  verifica('oferta primeşte regula nouă', (await cheama('GET', '/api/produse')).date.produse.find(p => p.cod === 'NOU-2').fact?.pas === 0.5);
  await regula({ cod: 'NOU-2', regula: 'intreg' });
  verifica('înapoi la bucăţi întregi', factul('NOU-2') === null);
  verifica('+ 15 % doar la bară', (await regula({ cod: 'NOU-2', regula: 'procent' })).cod === 400 && factul('NOU-2') === null);
  await regula({ cod: cuBara.cod, regula: 'procent' });
  verifica('+ 15 % la un produs la bară', factul(cuBara.cod)?.procent === 1.15);
  await regula({ cod: 'NOU-2', regula: 'multiplu', multiplu: '10' });
  verifica('multiplu', factul('NOU-2')?.multiplu === 10);
  verifica('multiplu greşit → refuzat', (await regula({ cod: 'NOU-2', regula: 'multiplu', multiplu: 'abc' })).cod === 400 && (await regula({ cod: 'NOU-2', regula: 'multiplu', multiplu: 1 })).cod === 400);
  const set = PORNIRE.find(p => p.fact?.set);
  await regula({ cod: set.cod, regula: 'multiplu', multiplu: 12 });
  verifica('multiplul la set rămâne la set', factul(set.cod).multiplu === 12 && factul(set.cod).set === true);
  verifica('regulă necunoscută → refuzat', (await regula({ cod: 'NOU-2', regula: 'constructor' })).cod === 400);
  verifica('cod inexistent la regulă → 404', (await regula({ cod: 'NIMIC', regula: 'intreg' })).cod === 404);
  await cheama('POST', '/api/produse/incarca', fisier([CAP, rand('NOU-2', 'Altă denumire')]));
  verifica('regula rămâne după alt export', factul('NOU-2')?.multiplu === 10);

  console.log('\nCăutarea din pagină');
  const q = (s) => cheama('GET', '/api/produse/lista', { query: s }).then(r => r.date);
  const dupaDen = await q(`?cauta=${encodeURIComponent('produs nou 2')}`);
  verifica('după cuvinte din denumire', dupaDen.total === 1 && dupaDen.produse[0].cod === 'NOU-2', JSON.stringify(dupaDen.total));
  verifica('după cod', (await q('?cauta=nou-2')).total === 1);
  const dupaGrupa = await q(`?cauta=${encodeURIComponent('grupa noua')}`);
  verifica('după grupă', dupaGrupa.total === 2 && dupaGrupa.produse.every(p => p.grupa === 'Grupa noua'), String(dupaGrupa.total));
  verifica('lista aduce regula', dupaGrupa.produse.find(p => p.cod === 'NOU-2').fact?.multiplu === 10);
  verifica('caracterele LIKE sunt text', (await q(`?cauta=${encodeURIComponent('%')}`)).total < cate());
  const n = await q('?stare=nelistate');
  verifica('filtrul nelistate', n.produse.every(p => !p.listat) && n.total === n.nelistate);
  verifica('câte 100 pe pagină', n.produse.length === 100 && n.pagini === Math.ceil(n.total / 100));
  verifica('pagina a doua', (await q('?stare=nelistate&pagina=2')).produse[0].cod !== n.produse[0].cod);
  verifica('pagina peste ultima → ultima', (await q('?pagina=99999')).pagina === (await q('')).pagini);

  inchide();
  fs.rmSync(TEMP, { recursive: true, force: true });
  console.log(`\n${treceri} trecute, ${caderi} căzute`);
  process.exit(caderi ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
