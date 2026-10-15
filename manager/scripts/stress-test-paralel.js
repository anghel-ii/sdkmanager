#!/usr/bin/env node
// STRESS TEST PARALEL — Manager Comenzi
// Usage: node scripts/stress-test-paralel.js [port] [nrUtilizatori]

const fs   = require('node:fs');
const path = require('node:path');

const PORT    = process.argv[2] || '8080';
const N_USERS = parseInt(process.argv[3] || '8', 10);
const BAZA    = `http://127.0.0.1:${PORT}`;

const R = s => `\x1b[31m${s}\x1b[0m`;
const G = s => `\x1b[32m${s}\x1b[0m`;
const Y = s => `\x1b[33m${s}\x1b[0m`;
const B = s => `\x1b[34m${s}\x1b[0m`;
const M = s => `\x1b[35m${s}\x1b[0m`;
const C = s => `\x1b[36m${s}\x1b[0m`;
const W = s => `\x1b[1m${s}\x1b[0m`;

const raport = {
  total: 0, ok: 0, eroriLogica: [], eroriUI: [], eroriStress: [],
  latente: [], requesturi: 0, startMs: Date.now(),
};

function log(prefix, msg) {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`${C(`[${ts}]`)} ${prefix} ${msg}`);
}

function creeazaClient(label) {
  let cookie = null;
  const CULORI = [R, G, Y, B, M, C];
  const culoare = CULORI[Math.abs(label.charCodeAt(0)) % CULORI.length];

  async function cer(metoda, cale, corp, opts = {}) {
    const start = Date.now();
    raport.requesturi++;
    const r = await fetch(BAZA + cale, {
      method: metoda,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: corp === undefined ? undefined : JSON.stringify(corp),
      redirect: 'manual',
    });
    const latenta = Date.now() - start;
    raport.latente.push(latenta);
    if (latenta > 2000) {
      raport.eroriStress.push({ label, cale, latenta, mesaj: `Latenta ${latenta}ms pe ${metoda} ${cale}` });
      log(culoare(label), Y(`LENT ${latenta}ms -> ${metoda} ${cale}`));
    }
    const pus = r.headers.getSetCookie?.()[0];
    if (pus) cookie = pus.split(';')[0];
    const tip = r.headers.get('content-type') || '';
    const date = tip.includes('json') ? await r.json() : await r.text();
    return { stare: r.status, date, latenta };
  }

  async function login(user, parola) {
    const r = await cer('POST', '/api/login', { user, parola });
    return r.stare === 200;
  }

  async function logout() {
    cookie = null;
    await cer('POST', '/api/logout').catch(() => {});
  }

  return { cer, login, logout, culoare, label };
}

function verifica(label, categorie, test, mesaj, detaliu) {
  raport.total++;
  if (test) { raport.ok++; return true; }
  const entry = { label, mesaj, detaliu: String(detaliu || '').slice(0, 200) };
  if (categorie === 'logica') raport.eroriLogica.push(entry);
  if (categorie === 'ui')     raport.eroriUI.push(entry);
  if (categorie === 'stress') raport.eroriStress.push(entry);
  return false;
}

const SISTEME = ['confortVerona', 'confortGamma', 'suspendataA', 'suspendataB'];
const CLIENTI = [
  { nume: 'Andrei Popescu', telefon: '0722111222', adresa: 'Str. Florilor 12, Cluj' },
  { nume: 'Elena Ionescu',  telefon: '0744333444', adresa: 'Bd. Unirii 5, Bucuresti' },
  { nume: 'Gheorghe Marin', telefon: '0766555666', adresa: 'Al. Trandafirilor 8, Brasov' },
  { nume: 'Ioana Constantin', telefon: '0788777888', adresa: 'Str. Independentei 3, Timisoara' },
  { nume: 'Mihai Dumitru', telefon: '0733999000', adresa: 'Cal. Victoriei 100, Iasi' },
];

function pozitieRandom(idx) {
  idx = idx || 0;
  const sistem = SISTEME[Math.floor(Math.random() * SISTEME.length)];
  const latime = 800 + Math.floor(Math.random() * 1600);
  const inaltime = 2000 + Math.floor(Math.random() * 300);
  const nrUsi = 1 + Math.floor(Math.random() * 3);
  return {
    sistem, eticheta: sistem + ' ' + (idx + 1),
    finisaj: 'ALUMINIU', latime, inaltime, nrUsi,
    config: { system: sistem, width: latime, height: inaltime, doors: nrUsi },
    linii: {
      facturare: [{ cod: 'USI' + idx, denumire: 'Usa ' + sistem, um: 'buc', cantitate: nrUsi }],
      necesar:   [{ cod: 'AL-M19', denumire: 'Profil vertical', um: 'buc', cantitate: 2 * nrUsi, debitare: (inaltime + 18) + ' mm' }],
    },
  };
}

const pauza = ms => new Promise(r => setTimeout(r, ms));
const rand  = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

// SCENARIU 1: Flux complet oferta -> comanda -> finalizare
async function scenariuFluxComplet(client, idx) {
  const label = client.label;
  const culoare = client.culoare;
  log(culoare(label), B('Flux complet #' + idx));

  const clientDate = CLIENTI[idx % CLIENTI.length];
  const nrPoz = rand(1, 3);
  const pozitii = [];
  for (let i = 0; i < nrPoz; i++) pozitii.push(pozitieRandom(i));

  const r1 = await client.cer('POST', '/api/comenzi', {
    client: Object.assign({}, clientDate, { nume: clientDate.nume + ' #' + idx }),
    detalii: { livrare: 'Curier ramburs', agent: 'Agent ' + idx },
    observatii: 'Test stress scenariu ' + idx,
    pozitii,
  });
  verifica(label, 'logica', r1.stare === 201, 'Creare oferta -> 201 (primit ' + r1.stare + ')', JSON.stringify(r1.date).slice(0, 100));
  if (r1.stare !== 201) return null;

  const id = r1.date.comanda.id;
  const numar = r1.date.comanda.numar;
  log(culoare(label), '  Oferta ' + numar + ' creata (id=' + id + ')');

  verifica(label, 'logica', /^OF-\d{4}-\d{4}$/.test(numar), 'Numerotare OF-AAAA-NNNN: ' + numar, numar);

  await pauza(rand(50, 200));
  const lista = await client.cer('GET', '/api/comenzi');
  const gasita = lista.date.comenzi && lista.date.comenzi.some(function(c) { return c.id === id; });
  verifica(label, 'logica', gasita, 'Oferta ' + id + ' apare in lista', String(lista.date.comenzi && lista.date.comenzi.length) + ' oferte');

  const det = await client.cer('GET', '/api/comenzi/' + id);
  verifica(label, 'logica', det.stare === 200, 'Detaliu oferta -> 200');
  verifica(label, 'logica', det.date.pozitii && det.date.pozitii.length === nrPoz,
    'Detaliu: ' + nrPoz + ' pozitii salvate', 'gasite: ' + (det.date.pozitii && det.date.pozitii.length));

  // Acceptare
  const acc1 = await client.cer('POST', '/api/comenzi/' + id + '/accepta', {
    plata: 'fiscala', avans: '500', telefon: clientDate.telefon, adresa: clientDate.adresa,
  });
  verifica(label, 'logica', acc1.stare === 200, 'Acceptare oferta -> 200', JSON.stringify(acc1.date).slice(0, 100));

  // A doua acceptare trebuie 409
  const acc2 = await client.cer('POST', '/api/comenzi/' + id + '/accepta', { plata: 'bon' });
  verifica(label, 'logica', acc2.stare === 409, 'A doua acceptare -> 409', 'primit: ' + acc2.stare);

  // Modificare dupa acceptare -> 409
  const mod = await client.cer('PUT', '/api/comenzi/' + id, {
    client: { nume: 'Hack Client' }, pozitii: [pozitieRandom()],
  });
  verifica(label, 'logica', mod.stare === 409, 'Modificare dupa acceptare -> 409 (blocat)', 'primit: ' + mod.stare);

  // Apare in tab Comenzi
  const comenzi = await client.cer('GET', '/api/comenzi?tip=comanda');
  const inComanda = comenzi.date.comenzi && comenzi.date.comenzi.some(function(c) { return c.id === id; });
  verifica(label, 'logica', inComanda, 'Comanda ' + id + ' in tab Comenzi');

  await pauza(rand(100, 300));

  // Finalizare
  const fin = await client.cer('POST', '/api/comenzi/' + id + '/finalizeaza');
  verifica(label, 'logica', fin.stare === 200, 'Finalizare -> 200');

  const finalizate = await client.cer('GET', '/api/comenzi?tip=finalizata');
  const inFin = finalizate.date.comenzi && finalizate.date.comenzi.some(function(c) { return c.id === id; });
  verifica(label, 'logica', inFin, 'Comanda ' + id + ' in Finalizate');

  // Facturare
  const facRef = 'F-STRESS-' + idx + '-' + Date.now();
  const fac = await client.cer('POST', '/api/comenzi/' + id + '/factura', { numar: facRef });
  verifica(label, 'logica', fac.stare === 200 && fac.date.comanda && fac.date.comanda.factura_nr === facRef,
    'Facturare -> 200, numar salvat', 'primit: ' + (fac.date.comanda && fac.date.comanda.factura_nr));

  log(culoare(label), G('  Flux complet #' + idx + ' terminat: ' + numar));
  return { id, numar };
}

// SCENARIU 2: Validari negative
async function scenariuValidari(client) {
  const label = client.label;
  log(client.culoare(label), B('Validari negative'));

  const r1 = await client.cer('POST', '/api/comenzi', { client: {}, pozitii: [pozitieRandom()] });
  verifica(label, 'logica', r1.stare === 400, 'Fara nume client -> 400');

  const r2 = await client.cer('POST', '/api/comenzi', { client: { nume: 'X' }, pozitii: [] });
  verifica(label, 'logica', r2.stare === 400, 'Fara pozitii -> 400');

  const poz3 = pozitieRandom(); poz3.latime = -100;
  const r3 = await client.cer('POST', '/api/comenzi', { client: { nume: 'X' }, pozitii: [poz3] });
  verifica(label, 'logica', r3.stare === 400, 'Latime negativa -> 400');

  const poz4 = pozitieRandom(); poz4.linii = { facturare: [{ denumire: 'X', cantitate: 'multe' }] };
  const r4 = await client.cer('POST', '/api/comenzi', { client: { nume: 'X' }, pozitii: [poz4] });
  verifica(label, 'logica', r4.stare === 400, 'Cantitate string -> 400');

  const r5 = await client.cer('GET', '/api/comenzi/999999999');
  verifica(label, 'logica', r5.stare === 404, 'ID inexistent -> 404');

  const of = await client.cer('POST', '/api/comenzi', {
    client: { nume: 'Test Validare', telefon: '0700000001', adresa: 'Str. Test 1' },
    pozitii: [pozitieRandom()],
  });
  if (of.stare === 201) {
    const id = of.date.comanda.id;

    const r6 = await client.cer('POST', '/api/comenzi/' + id + '/accepta', {});
    verifica(label, 'logica', r6.stare === 400, 'Acceptare fara plata -> 400');

    const r7 = await client.cer('POST', '/api/comenzi/' + id + '/accepta', { plata: 'card_bancar' });
    verifica(label, 'logica', r7.stare === 400, 'Plata necunoscuta -> 400');

    const r8 = await client.cer('POST', '/api/comenzi/' + id + '/accepta', { plata: 'bon', avans: -100 });
    verifica(label, 'logica', r8.stare === 400, 'Avans negativ -> 400');

    const r9 = await client.cer('POST', '/api/comenzi/' + id + '/fisa');
    log(client.culoare(label), '  Fisa pe oferta -> ' + r9.stare);

    const r10 = await client.cer('POST', '/api/comenzi/' + id + '/finalizeaza');
    verifica(label, 'logica', r10.stare === 409, 'Finalizare oferta neacceptata -> 409');

    await client.cer('POST', '/api/comenzi/' + id + '/accepta', {
      plata: 'fiscala', telefon: '0700000001', adresa: 'Str. Test 1',
    });
  }

  log(client.culoare(label), G('  Validari OK'));
}

// SCENARIU 3: Concurenta
async function scenariuConcurenta(clientA, clientB) {
  log(M('CONCURENTA'), B('Scenariu concurenta: 2 utilizatori pe aceeasi comanda'));

  const of = await clientA.cer('POST', '/api/comenzi', {
    client: { nume: 'Client Concurenta', telefon: '0700000099', adresa: 'Str. Concurentei 1' },
    pozitii: [pozitieRandom()],
  });
  if (of.stare !== 201) {
    log(M('CONCURENTA'), R('Nu s-a creat oferta pentru test concurenta'));
    return;
  }
  const id = of.date.comanda.id;
  log(M('CONCURENTA'), '  Oferta ' + id + ' creata de A');

  const results = await Promise.all([
    clientA.cer('POST', '/api/comenzi/' + id + '/accepta', { plata: 'fiscala', telefon: '0700', adresa: 'X' }),
    clientB.cer('POST', '/api/comenzi/' + id + '/accepta', { plata: 'bon', telefon: '0700', adresa: 'X' }),
  ]);
  const accA = results[0], accB = results[1];

  const ok = (accA.stare === 200 && accB.stare === 409) || (accA.stare === 409 && accB.stare === 200);
  verifica('CONCURENTA', 'stress', ok,
    'Acceptare simultana: exact una reuseste, cealalta -> 409',
    'A=' + accA.stare + ', B=' + accB.stare);
  log(M('CONCURENTA'), ok ? G('  Concurenta gestionata corect (A=' + accA.stare + ', B=' + accB.stare + ')') :
    R('  AMBELE au primit ' + accA.stare + '/' + accB.stare + '!'));

  const det = await clientA.cer('GET', '/api/comenzi/' + id);
  verifica('CONCURENTA', 'stress', det.date.comanda && det.date.comanda.tip === 'comanda',
    'Stare finala consistenta = comanda', 'tip=' + (det.date.comanda && det.date.comanda.tip));

  const fins = await Promise.all([
    clientA.cer('POST', '/api/comenzi/' + id + '/finalizeaza'),
    clientB.cer('POST', '/api/comenzi/' + id + '/finalizeaza'),
  ]);
  log(M('CONCURENTA'), '  Finalizare simultana: A=' + fins[0].stare + ', B=' + fins[1].stare);

  const det2 = await clientA.cer('GET', '/api/comenzi/' + id);
  verifica('CONCURENTA', 'stress', !!(det2.date.comanda && det2.date.comanda.finalizat_la),
    'Comanda finalizata o data', String(det2.date.comanda && det2.date.comanda.finalizat_la));

  log(M('CONCURENTA'), G('  Scenariu concurenta terminat'));
}

// SCENARIU 4: Consistenta UI
async function scenariuConsistentaUI(client) {
  const label = client.label;
  log(client.culoare(label), B('Consistenta UI'));

  const of = await client.cer('POST', '/api/comenzi', {
    client: { nume: 'Client UI Test', telefon: '0711222333', adresa: 'Str. UI 5, Cluj' },
    detalii: { livrare: 'Curier op avans', agent: 'Agentul Meu' },
    pozitii: [pozitieRandom(0), pozitieRandom(1)],
  });
  if (of.stare !== 201) return;
  const id = of.date.comanda.id;

  const sumar1 = await client.cer('GET', '/api/sumar');
  const listaOferte = await client.cer('GET', '/api/comenzi');
  verifica(label, 'ui',
    sumar1.date.oferte >= (listaOferte.date.comenzi && listaOferte.date.comenzi.length || 0),
    'Sumar.oferte >= count(lista oferte)',
    'sumar=' + sumar1.date.oferte + ', lista=' + (listaOferte.date.comenzi && listaOferte.date.comenzi.length));

  await client.cer('POST', '/api/comenzi/' + id + '/accepta', {
    plata: 'proforma', avans: '1000', telefon: '0711222333', adresa: 'Str. UI 5, Cluj',
  });

  const sumar2 = await client.cer('GET', '/api/sumar');
  const listaComanda = await client.cer('GET', '/api/comenzi?tip=comanda');
  const detaliuComanda = await client.cer('GET', '/api/comenzi/' + id);

  const dinLista = listaComanda.date.comenzi && listaComanda.date.comenzi.find(function(c) { return c.id === id; });
  if (dinLista && detaliuComanda.date.comanda) {
    verifica(label, 'ui', dinLista.client_nume === detaliuComanda.date.comanda.client_nume,
      'Consistenta: client_nume = acelasi in lista si detaliu',
      'lista="' + dinLista.client_nume + '", detaliu="' + detaliuComanda.date.comanda.client_nume + '"');

    verifica(label, 'ui', dinLista.plata === detaliuComanda.date.comanda.plata,
      'Consistenta: plata = aceeasi in lista si detaliu',
      'lista="' + dinLista.plata + '", detaliu="' + detaliuComanda.date.comanda.plata + '"');

    verifica(label, 'ui', dinLista.avans === detaliuComanda.date.comanda.avans,
      'Consistenta: avans = acelasi in lista si detaliu',
      'lista=' + dinLista.avans + ', detaliu=' + detaliuComanda.date.comanda.avans);
  }

  verifica(label, 'ui', (sumar2.date.comenzi || 0) >= 1,
    'Sumar.comenzi >= 1 dupa acceptare', JSON.stringify(sumar2.date));

  await client.cer('POST', '/api/comenzi/' + id + '/finalizeaza');
  const sumar3 = await client.cer('GET', '/api/sumar');
  verifica(label, 'ui', (sumar3.date.finalizate || 0) >= 1,
    'Sumar.finalizate >= 1 dupa finalizare', JSON.stringify(sumar3.date));

  await client.cer('PUT', '/api/preferinte', { sortare: 'facturare' });
  const pref = await client.cer('GET', '/api/preferinte');
  verifica(label, 'ui', pref.date.sortare === 'facturare', 'Preferinta sortare persista', 'gasit: ' + pref.date.sortare);
  await client.cer('PUT', '/api/preferinte', { sortare: 'data' });

  log(client.culoare(label), G('  Consistenta UI OK'));
}

// SCENARIU 5: Securitate
async function scenariuSecuritate(client) {
  const label = client.label;
  log(client.culoare(label), B('Securitate sub sarcina'));

  for (const atac of ['/../server/auth.js', '/%2e%2e/server/db.js', '/../../etc/passwd']) {
    const r = await client.cer('GET', atac);
    verifica(label, 'stress', r.stare === 404, 'Traversare "' + atac + '" -> 404', 'primit: ' + r.stare);
  }

  const r1 = await client.cer('GET', '/api/login');
  verifica(label, 'logica', r1.stare === 405, 'GET /api/login -> 405');

  const r2 = await client.cer('GET', '/api/nonexistent/ruta');
  verifica(label, 'logica', r2.stare === 404, 'Ruta API inexistenta -> 404');

  const clientAnon = creeazaClient('ANON');
  const r3 = await clientAnon.cer('GET', '/api/comenzi');
  verifica(label, 'logica', r3.stare === 401, 'Fara sesiune -> 401');

  const r4 = await clientAnon.cer('POST', '/api/comenzi', { client: { nume: 'X' }, pozitii: [pozitieRandom()] });
  verifica(label, 'logica', r4.stare === 401, 'POST fara auth -> 401');

  log(client.culoare(label), G('  Securitate OK'));
}

// SCENARIU 6: Sticla
async function scenariuSticla(client, idx) {
  const label = client.label;
  log(client.culoare(label), B('Sticla'));

  const sticlaPoz = {
    sistem: 'rama842', eticheta: 'Rama 842', finisaj: 'ALUMINIU',
    latime: 450, inaltime: 600, nrUsi: 2,
    config: { system: 'rama842', width: 450, height: 600, doors: 2 },
    linii: {
      facturare: [{ cod: 'X', denumire: 'Rama', cantitate: 1 }],
      sticla: [
        { cod: 'GG004', denumire: 'Geam float transparent 4mm GG cod GG004', um: 'buc', cantitate: 2, debitare: '400 x 300 mm' },
        { cod: 'CT063', denumire: 'Geam satinat maro 4mm securizat CT cod CT063', um: 'buc', cantitate: 1, debitare: '350 x 250 mm' },
      ],
    },
  };

  const of = await client.cer('POST', '/api/comenzi', {
    client: { nume: 'Client Sticla ' + idx, telefon: '0700', adresa: 'X' },
    pozitii: [sticlaPoz],
  });
  if (of.stare !== 201) { log(client.culoare(label), Y('  Nu s-a creat oferta sticla')); return; }
  const id = of.date.comanda.id;

  const st0 = await client.cer('GET', '/api/sticla');
  verifica(label, 'ui', st0.stare === 200, 'GET /api/sticla -> 200');

  await client.cer('POST', '/api/comenzi/' + id + '/accepta', { plata: 'bon', telefon: '0700', adresa: 'X' });

  const st1 = await client.cer('GET', '/api/sticla');
  log(client.culoare(label), '  Linii sticla dupa acceptare: ' + (st1.date.linii && st1.date.linii.length));

  await client.cer('POST', '/api/comenzi/' + id + '/finalizeaza');
  log(client.culoare(label), G('  Sticla OK'));
}

// SCENARIU 7: Filtrare liste
async function scenariuFiltrareListe(client) {
  const label = client.label;
  log(client.culoare(label), B('Filtrare liste'));

  for (const tab of ['oferta', 'comanda', 'finalizata', 'plata']) {
    const r = await client.cer('GET', '/api/comenzi?tip=' + tab);
    verifica(label, 'ui', r.stare === 200 && Array.isArray(r.date.comenzi),
      'Tab "' + tab + '" -> 200 cu array', 'primit: ' + r.stare);
  }

  const r = await client.cer('GET', '/api/comenzi?tip=aiurea');
  verifica(label, 'ui', r.stare === 200, 'Tab inexistent -> 200 (fallback)');

  const sumar = await client.cer('GET', '/api/sumar');
  verifica(label, 'ui', sumar.stare === 200 && typeof sumar.date.oferte === 'number',
    'Sumar returneaza numere', JSON.stringify(sumar.date));

  log(client.culoare(label), G('  Filtrare OK'));
}

// WORKER
async function runWorker(user, parola, rol, idx) {
  const label = '[' + rol.toUpperCase()[0] + idx + ']';
  const client = creeazaClient(label);
  log(client.culoare(label), W('=== START worker ' + label + ' (' + user + ') ==='));

  const logat = await client.login(user, parola);
  verifica(label, 'logica', logat, 'Login ' + user + ' -> 200');
  if (!logat) { log(client.culoare(label), R('Nu s-a putut loga ' + user)); return; }

  try {
    const nFluxuri = rand(2, 3);
    for (let i = 0; i < nFluxuri; i++) {
      await scenariuFluxComplet(client, idx * 10 + i);
      await pauza(rand(100, 300));
    }
    await scenariuValidari(client);
    await pauza(rand(50, 150));
    await scenariuConsistentaUI(client);
    await pauza(rand(50, 150));
    await scenariuSecuritate(client);
    await pauza(rand(50, 150));
    await scenariuSticla(client, idx);
    await pauza(rand(50, 100));
    await scenariuFiltrareListe(client);
  } catch (err) {
    log(client.culoare(label), R('EXCEPTIE: ' + err.message));
    raport.eroriStress.push({ label, mesaj: 'Exceptie: ' + err.message, detaliu: String(err.stack).slice(0, 300) });
  }

  await client.logout();
  log(client.culoare(label), W('=== DONE worker ' + label + ' ==='));
}

// MAIN
async function main() {
  console.log(W('\n' + '='.repeat(70)));
  console.log(W('  STRESS TEST PARALEL -- Manager Comenzi'));
  console.log(W('  Server: ' + BAZA));
  console.log(W('  Utilizatori virtuali: ' + N_USERS));
  console.log(W('='.repeat(70) + '\n'));

  try {
    const ping = await fetch(BAZA + '/api/eu');
    log('MAIN', G('Server accesibil (' + BAZA + ')'));
  } catch (e) {
    console.error(R('Server indisponibil la ' + BAZA));
    process.exit(1);
  }

  const utilizatori = [
    { user: 'admin',  parola: 'parola-admin-1',  rol: 'admin' },
    { user: 'maria',  parola: 'parola-maria-1',   rol: 'birou' },
    { user: 'vasile', parola: 'parola-vasile-1',  rol: 'birou' },
    { user: 'ion',    parola: 'parola-ion-123',   rol: 'conducere' },
  ];

  const clientConc1 = creeazaClient('[C1]');
  const clientConc2 = creeazaClient('[C2]');
  await clientConc1.login('admin', 'parola-admin-1');
  await clientConc2.login('admin', 'parola-admin-1');

  const promises = [scenariuConcurenta(clientConc1, clientConc2)];
  for (let i = 0; i < N_USERS; i++) {
    const u = utilizatori[i % utilizatori.length];
    promises.push(runWorker(u.user, u.parola, u.rol, i + 1));
  }
  await Promise.all(promises);

  const durata = ((Date.now() - raport.startMs) / 1000).toFixed(1);
  const latMedia = raport.latente.length
    ? Math.round(raport.latente.reduce(function(a, b) { return a + b; }, 0) / raport.latente.length)
    : 0;
  const latMax = raport.latente.length ? Math.max.apply(null, raport.latente) : 0;

  console.log('\n' + W('='.repeat(70)));
  console.log(W('  RAPORT FINAL'));
  console.log(W('='.repeat(70)));
  console.log('  Durata totala  : ' + W(durata + 's'));
  console.log('  Requesturi HTTP: ' + W(String(raport.requesturi)));
  console.log('  Latenta medie  : ' + W(latMedia + 'ms'));
  console.log('  Latenta max    : ' + (latMax > 1000 ? R(latMax + 'ms') : W(latMax + 'ms')));
  console.log('  Verificari     : ' + W(String(raport.total)) + ' total');
  console.log('  Trecute        : ' + G(String(raport.ok)));
  console.log('  Esuate total   : ' + R(String(raport.total - raport.ok)));

  if (raport.eroriLogica.length) {
    console.log('\n' + R('-- ERORI DE LOGICA -------------------------------------------------------'));
    raport.eroriLogica.forEach(function(e) {
      console.log(R('  [' + e.label + '] ' + e.mesaj));
      if (e.detaliu) console.log(Y('    -> ' + e.detaliu));
    });
  }

  if (raport.eroriUI.length) {
    console.log('\n' + Y('-- INCONSISTENTE UI -------------------------------------------------------'));
    raport.eroriUI.forEach(function(e) {
      console.log(Y('  [' + e.label + '] ' + e.mesaj));
      if (e.detaliu) console.log('    -> ' + e.detaliu);
    });
  }

  if (raport.eroriStress.length) {
    console.log('\n' + M('-- ERORI STRESS / CONCURENTA ---------------------------------------------'));
    raport.eroriStress.forEach(function(e) {
      console.log(M('  [' + e.label + '] ' + e.mesaj));
      if (e.detaliu) console.log('    -> ' + e.detaliu);
    });
  }

  const procentOk = raport.total > 0 ? Math.round(raport.ok / raport.total * 100) : 0;
  console.log('\n' + W('='.repeat(70)));
  if (procentOk === 100) {
    console.log(G('  TOATE TESTELE TRECUTE (' + raport.ok + '/' + raport.total + ') -- 100%'));
  } else {
    console.log('  Scor: ' + (procentOk >= 90 ? G(procentOk + '%') : R(procentOk + '%')) + ' (' + raport.ok + '/' + raport.total + ')');
  }
  console.log(W('='.repeat(70) + '\n'));

  const raportFile = path.join(__dirname, '../stress-report-' + Date.now() + '.json');
  fs.writeFileSync(raportFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    server: BAZA,
    utilizatoriVirtuali: N_USERS,
    durataSec: parseFloat(durata),
    requesturi: raport.requesturi,
    latentaMedieMs: latMedia,
    latentaMaxMs: latMax,
    verificari: { total: raport.total, ok: raport.ok, esuate: raport.total - raport.ok },
    eroriLogica: raport.eroriLogica,
    eroriUI: raport.eroriUI,
    eroriStress: raport.eroriStress,
  }, null, 2));
  console.log(C('  Raport JSON: ' + raportFile + '\n'));

  process.exit(raport.total - raport.ok > 0 ? 1 : 0);
}

main().catch(function(err) {
  console.error(R('\nEROARE FATALA: ' + err.message));
  console.error(err.stack);
  process.exit(2);
});
