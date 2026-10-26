const fs     = require('node:fs');
const path   = require('node:path');
const crypto = require('node:crypto');
const { config } = require('./config.js');

// taci warning-ul „SQLite is an experimental feature" de la node:sqlite
// (acelaşi truc ca în configurator_usi/build.js)
const _emitWarning = process.emitWarning;
process.emitWarning = (w, ...rest) =>
  String(w).includes('SQLite is an experimental') ? undefined : _emitWarning.call(process, w, ...rest);

const { DatabaseSync, constants: SQL } = require('node:sqlite');
const { AsyncLocalStorage } = require('node:async_hooks');

// ── Baza de date ─────────────────────────────────────────────────────────────
// node:sqlite, acelaşi modul folosit de configurator la catalog. Sincron, deci
// nu avem nevoie de async peste tot; la traficul unui atelier (câteva zeci de
// cereri pe minut) e mai mult decât suficient şi cu mult mai simplu de citit.

let _db = null;

// „Acum" în SQL: ora exactă (server/ora.js), ca funcţie SQLite `acum()` — dacă
// Node o permite (≥ 22.13); altfel ceasul serverului, ca înainte. Se foloseşte
// în SQL ca ${ACUM()} (text fix, fără date de la utilizator).
let _acum = "datetime('now')";
const ACUM = () => _acum;

function db() {
  if (!_db) throw new Error('Baza de date nu e deschisă — cheamă deschide() întâi.');
  const copie = _inTest.getStore();
  return copie ? copieTest(copie) : _db;
}

function deschide() {
  if (_db) return _db;

  fs.mkdirSync(path.dirname(config.db), { recursive: true });
  _db = configureaza(new DatabaseSync(config.db));

  migreaza();
  // copia de test (dacă există) se ţine la zi de la pornire — altfel s-ar pierde ce se face pe bune până la prima cerere de test.
  // Dacă nu merge (Windows, 2026-10-19: după update copia era încă ţinută deschisă → EPERM), serverul porneşte oricum:
  // copia se reface la prima cerere din modul test.
  for (const copie of COPII) if (modTestPosibil && fs.existsSync(caleTest(copie))) {
    try { copieTest(copie); } catch (e) { console.error(`Modul test: copia „${copie}" nu s-a putut deschide la pornire —`, e.message); }
  }
  setInterval(sincronizeaza, 30e3).unref();   // şi ce scriu timerele (clienţii de pe Cloudflare), nu doar cererile
  return _db;
}

function configureaza(d) {
  // WAL: cititorii nu blochează scriitorul. Contează când cineva scanează de pe
  // telefon exact când altcineva deschide lista de comenzi.
  d.exec('PRAGMA journal_mode = WAL');
  d.exec('PRAGMA foreign_keys = ON');
  d.exec('PRAGMA busy_timeout = 5000');
  if (typeof d.function === 'function') {
    d.function('acum', { deterministic: false }, require('./ora.js').acumSql);
    _acum = 'acum()';
    // căutările ignoră diacriticele şi majusculele (userul, 2026-10-26: „ramnicu valcea" găseşte „Râmnicu Vâlcea"):
    // WHERE fara_diacritice(nume) LIKE ?, cu textul căutat trecut prin faraDiacritice
    d.function('fara_diacritice', { deterministic: true }, t => (t == null ? null : faraDiacritice(t)));
  }
  return d;
}

// fără diacritice (ş/ș, ţ/ț, ă, â, î — şi orice altă literă cu semn), litere mici
const faraDiacritice = t => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ── Modul test (userul, 2026-10-14) ──────────────────────────────────────────
// Un lanţ de copii ale bazei (userul, 2026-10-19): baza reală → DEMO BIROU (copia comună a
// colegilor puşi în test, <baza>-test.sqlite) → DEMO ADMIN (<baza>-test-admin.sqlite).
// Fiecare copie primeşte tot ce se face în cea dinaintea ei, nimic nu urcă înapoi: ce fac
// colegii în demo vede şi adminul, ce face adminul nu vede nimeni. Cererile din test rulează
// în inTest(fn, copie), unde db() dă copia. Sursa fiecărei copii ţine o sesiune SQLite (lista
// modificărilor ei, inclusiv a celor primite); sincronizeaza() le aplică în ordine, după
// fiecare cerere. La conflict câştigă sursa, dar doar pe coloanele schimbate acolo. Rândurile
// create într-o copie primesc id-uri peste pragul ei (birou ≥ 1e9, admin ≥ 2e9), ca să nu se
// bată cu cele care vin din sursă.
const _inTest = new AsyncLocalStorage();
const ID_TEST = 1e9;
const modTestPosibil = typeof DatabaseSync.prototype.createSession === 'function';   // Node ≥ 22.12
const COPII = ['colegi', 'admin'];   // în ordinea lanţului
const SURSA = { colegi: null, admin: 'colegi' };   // null = baza reală
const PRAG = { colegi: ID_TEST, admin: 2 * ID_TEST };
const _copii = new Map();   // copie → { test, brut, sesiune, comparare }
const caleTest = (copie = 'colegi') => config.db.replace(/(\.sqlite)?$/, copie === 'admin' ? '-test-admin.sqlite' : '-test.sqlite');
const copiaLui = utilizator => (utilizator?.rol === 'admin' ? 'admin' : 'colegi');
const inTest = (fn, copie = 'colegi') => _inTest.run(copie, fn);
const copiaCurenta = () => _inTest.getStore() ?? null;   // null = pe bune
const esteTest = () => !!copiaCurenta();
const peBune = fn => _inTest.exit(fn);   // ceva citit din baza reală, chiar dintr-o cerere din demo
// conexiunea din care îşi ia copia modificările (baza reală sau copia dinainte, deschisă)
const sursa = copie => (SURSA[copie] ? (copieTest(SURSA[copie]), _copii.get(SURSA[copie]).brut) : _db);

function copieTest(copie = 'colegi') {
  const c = _copii.get(copie);
  if (c) return c.test;
  if (SURSA[copie]) copieTest(SURSA[copie]);   // întâi copia din care se hrăneşte
  if (fs.existsSync(caleTest(copie))) {
    const d = new DatabaseSync(caleTest(copie));
    const versiune = x => x.prepare('PRAGMA user_version').get().user_version;
    if (versiune(d) === versiune(_db)) return pornesteTest(copie, d);
    d.close();   // altă schemă (după un update cu migraţie) → copie nouă
  }
  return refaTest(copie);
}

// Copia luată din nou din sursa ei — demo birou = baza reală, demo admin = demo birou;
// tot ce s-a lucrat în ea se pierde. Copiile făcute din ea se refac şi ele (demo birou
// resetat → şi demo admin): altfel ce vine nou din ea s-ar bate (id-uri, numere de ofertă)
// cu ce rămăsese de dinainte şi s-ar pierde pe tăcute.
function refaTest(copie = 'colegi') {
  if (!modTestPosibil) throw Object.assign(new Error('Modul test cere Node 22.12 sau mai nou pe server.'), { cod: 409 });
  sincronizeaza();   // sursa la zi înainte de copiere
  const din = sursa(copie);
  inchideTest(copie);
  // pe Windows fişierul poate fi încă ţinut câteva clipe (serverul vechi care se opreşte, antivirusul) — mai încearcă
  for (const f of ['', '-wal', '-shm']) fs.rmSync(caleTest(copie) + f, { force: true, maxRetries: 10, retryDelay: 300 });
  din.exec(`VACUUM INTO '${caleTest(copie).replace(/'/g, "''")}'`);
  const t = pornesteTest(copie, new DatabaseSync(caleTest(copie)));
  for (const fiica of COPII) if (SURSA[fiica] === copie && (_copii.has(fiica) || fs.existsSync(caleTest(fiica)))) refaTest(fiica);
  return t;
}

// Sincron, fără nimic între copie şi sesiune: nicio modificare din sursă nu scapă.
function pornesteTest(copie, d) {
  const c = { brut: configureaza(d), test: cuIdTest(d, PRAG[copie]), sesiune: sursa(copie).createSession(), comparare: null };
  _copii.set(copie, c);
  // copiile care se hrănesc din asta (demo admin din demo birou) îşi iau sesiunea pe conexiunea nouă
  for (const [nume, urm] of _copii) if (SURSA[nume] === copie && !urm.sesiune) urm.sesiune = c.brut.createSession();
  return c.test;
}

// fără argument: toate copiile (la oprirea serverului). Sesiunile copiilor care se hrănesc
// din cea închisă se închid şi ele (stau pe conexiunea ei) — se refac la redeschidere.
function inchideTest(copie) {
  for (const nume of [...COPII].reverse()) {
    const c = _copii.get(nume);
    if (!c || (copie && nume !== copie)) continue;
    for (const [alta, urm] of _copii) if (SURSA[alta] === nume) { urm.sesiune?.close(); urm.sesiune = null; }
    c.comparare?.close();
    c.sesiune?.close();
    c.brut.close();
    _copii.delete(nume);
  }
}

// Comenzile din copia de test care nu mai sunt ca pe bune (userul, 2026-10-19: marcate „DEMO"
// peste tot — comenzi, sticlă, livrări): făcute în demo, schimbate în demo (trecute mai departe,
// modificate, produse altele), cu sticla bifată „comandată", programate la livrare sau cu o
// cerere de anulare din demo. → Set de id-uri; gol în afara demo-ului.
// Copia se compară cu baza reală printr-o legătură separată, doar pt. citire (ATTACH).
function comenziDemo() {
  const copie = _inTest.getStore();
  if (!copie) return new Set();
  copieTest(copie);
  const c = _copii.get(copie);
  if (!c.comparare) {
    c.comparare = new DatabaseSync(caleTest(copie), { readOnly: true });
    c.comparare.exec(`ATTACH DATABASE '${config.db.replace(/'/g, "''")}' AS reala`);
  }
  const coloane = t => c.comparare.prepare(`PRAGMA main.table_info(${t})`).all().map(x => x.name).filter(x => x !== 'id');
  const difera = t => coloane(t).map(x => `t.${x} IS NOT r.${x}`).join(' OR ');
  return new Set(c.comparare.prepare(`
    SELECT t.id FROM main.comanda t LEFT JOIN reala.comanda r ON r.id = t.id WHERE r.id IS NULL OR ${difera('comanda')}
    UNION SELECT t.comanda_id FROM main.pozitie t LEFT JOIN reala.pozitie r ON r.id = t.id WHERE r.id IS NULL OR ${difera('pozitie')}
    UNION SELECT r.comanda_id FROM reala.pozitie r LEFT JOIN main.pozitie t ON t.id = r.id WHERE t.id IS NULL
    UNION SELECT p.comanda_id FROM main.pozitie_linie t JOIN main.pozitie p ON p.id = t.pozitie_id
            JOIN reala.pozitie_linie r ON r.id = t.id WHERE t.comandat_la IS NOT r.comandat_la
    UNION SELECT t.comanda_id FROM main.livrare_comanda t LEFT JOIN reala.livrare_comanda r
            ON r.comanda_id = t.comanda_id AND r.livrare_id = t.livrare_id WHERE r.comanda_id IS NULL
    UNION SELECT r.comanda_id FROM reala.livrare_comanda r LEFT JOIN main.livrare_comanda t
            ON t.comanda_id = r.comanda_id AND t.livrare_id = r.livrare_id WHERE t.comanda_id IS NULL
    UNION SELECT comanda_id FROM main.cerere WHERE id >= ${ID_TEST}`).all().map(r => Object.values(r)[0]));
}

// în ordinea lanţului: real → demo birou, apoi demo birou (cu ce tocmai a primit) → demo admin
function sincronizeaza() {
  for (const nume of COPII) {
    const c = _copii.get(nume);
    if (!c?.sesiune) continue;
    try {
      const schimbari = c.sesiune.changeset();
      c.sesiune.close();
      c.sesiune = sursa(nume).createSession();
      if (schimbari.length) c.brut.applyChangeset(schimbari, {
        filter: tabel => !['sesiune', 'activitate', 'tichet_poza'].includes(tabel),   // jurnalul şi pozele tichetelor — mereu din baza reală
        onConflict: tip => tip === SQL.SQLITE_CHANGESET_DATA || tip === SQL.SQLITE_CHANGESET_CONFLICT
          ? SQL.SQLITE_CHANGESET_REPLACE : SQL.SQLITE_CHANGESET_OMIT,
      });
    } catch (e) {
      console.error(`Modul test: sincronizarea copiei „${nume}" a eşuat:`, e.message);
    }
  }
}

// Copia, cu INSERT-urile mutate peste pragul ei (PRAG): SQLite dă max(id)+1, deci după primul
// rând mutat într-un tabel restul vin singure peste prag. (Rândul tocmai inserat n-are
// încă copii care să-l refere; INSERT ... ON CONFLICT se lasă în pace — acolo
// lastInsertRowid poate fi al altui rând.)
function cuIdTest(d, prag) {
  const cuId = new Map();
  const areId = t => {
    if (!cuId.has(t)) {
      const pk = d.prepare(`PRAGMA table_info(${t})`).all().filter(c => c.pk);
      cuId.set(t, pk.length === 1 && pk[0].name === 'id' && /int/i.test(pk[0].type));
    }
    return cuId.get(t);
  };
  const leaga = (o, k) => (typeof o[k] === 'function' ? o[k].bind(o) : o[k]);
  return new Proxy(d, { get: (_, k) => k !== 'prepare' ? leaga(d, k) : sql => {
    const st = d.prepare(sql);
    const t = /^\s*INSERT\s+INTO\s+(\w+)/i.exec(sql)?.[1];
    if (!t || /ON\s+CONFLICT/i.test(sql) || !areId(t)) return st;
    return new Proxy(st, { get: (_, k) => k !== 'run' ? leaga(st, k) : (...a) => {
      const r = st.run(...a);
      const id = Number(r.lastInsertRowid);
      if (r.changes !== 1 || id >= prag) return r;
      d.prepare(`UPDATE ${t} SET id = ? WHERE id = ?`).run(prag + id, id);
      return { ...r, lastInsertRowid: prag + id };
    } });
  } });
}

// Schema de bază e idempotentă (`IF NOT EXISTS`), deci se rulează la fiecare
// pornire. Pentru schimbări care nu se pot exprima aşa se adaugă o funcţie în
// MIGRATII şi se ridică `user_version` — rulează o singură dată, în ordine.
const MIGRATII = [
  // v0 → v1 (2026-09-22): operaţiile de atelier devin cele de pe fişa de comandă
  // (Debitare, Gaurire, Garnitura, Asamblare, Coletare). Cele vechi implicite
  // se DEZACTIVEAZĂ, nu se şterg (pot avea scanări). Pe o bază nouă tabelul e
  // gol aici — le pune semanta(), care rulează după migraţii.
  d => {
    if (!d.prepare('SELECT COUNT(*) AS n FROM operatie').get().n) return;
    const pune = d.prepare(`INSERT INTO operatie (cod, nume, ordine, activ) VALUES (?, ?, ?, 1)
      ON CONFLICT(cod) DO UPDATE SET nume = excluded.nume, ordine = excluded.ordine, activ = 1`);
    for (const [cod, nume, ordine] of OPERATII_IMPLICITE) pune.run(cod, nume, ordine);
    d.prepare(`UPDATE operatie SET activ = 0 WHERE cod NOT IN (${OPERATII_IMPLICITE.map(() => '?').join(',')})`)
      .run(...OPERATII_IMPLICITE.map(o => o[0]));
  },
  // v1 → v2 (2026-09-22): comenzi finalizate — automat la scanarea „Coletare"
  // sau manual din manager (tabul „Comenzi finalizate").
  d => d.exec('ALTER TABLE comanda ADD COLUMN finalizat_la TEXT'),
  // v2 → v3 (2026-09-22): facturare — nr. facturii (din NeoManager), trecut de
  // mână în manager; o comandă e „facturată" doar cu număr completat.
  d => {
    d.exec('ALTER TABLE comanda ADD COLUMN factura_nr TEXT');
    d.exec('ALTER TABLE comanda ADD COLUMN facturat_la TEXT');
  },
  // v3 → v4 (2026-09-22): comenzi fixate (pin) şi preferinţe — PER UTILIZATOR,
  // nu globale (fiecare îşi fixează ce-l interesează, îşi alege sortarea).
  d => d.exec(`
    CREATE TABLE fixare (
      utilizator_id INTEGER NOT NULL REFERENCES utilizator(id) ON DELETE CASCADE,
      comanda_id    INTEGER NOT NULL REFERENCES comanda(id)    ON DELETE CASCADE,
      creat_la      TEXT    NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (utilizator_id, comanda_id)
    );
    CREATE TABLE preferinta (
      utilizator_id INTEGER NOT NULL REFERENCES utilizator(id) ON DELETE CASCADE,
      cheie         TEXT    NOT NULL,
      valoare       TEXT,
      PRIMARY KEY (utilizator_id, cheie)
    );`),
  // v4 → v5 (2026-09-22): comanda de sticlă la furnizor — o linie din lista
  // „sticla" a unei comenzi e „comandată" când s-a trimis la furnizor.
  d => {
    d.exec('ALTER TABLE pozitie_linie ADD COLUMN comandat_la TEXT');
    d.exec('ALTER TABLE pozitie_linie ADD COLUMN comandat_de INTEGER REFERENCES utilizator(id)');
  },
  // v5 → v6 (2026-09-23): sesiunile ţin SHA-256 al tokenului, nu tokenul în
  // clar (vezi auth.js). Sesiunile deschise se convertesc — nimeni nu e delogat.
  d => hashSesiuniInClar(d),
  // v6 → v7 (2026-09-23): la acceptarea ofertei se alege obligatoriu modalitatea
  // de plată ('op' | 'bon' | 'factura') şi, opţional, avansul încasat (lei; 0 =
  // fără avans). Comenzile acceptate înainte rămân cu NULL (nealese).
  d => {
    d.exec('ALTER TABLE comanda ADD COLUMN plata TEXT');
    d.exec('ALTER TABLE comanda ADD COLUMN avans REAL');
  },
  // v7 → v8 (2026-09-23): rolurile devin admin / conducere / birou; vechiul
  // 'operator' (şi orice rol necunoscut) trece pe 'birou', cel mai restrâns.
  d => roluriNoi(d),
  // v8 → v9 (2026-09-23): cine a făcut fiecare pas al comenzii (pe lângă
  // creat_de): acceptată / facturată / finalizată de. Comenzile de dinainte
  // rămân cu NULL — nu se ştie cine.
  d => {
    d.exec('ALTER TABLE comanda ADD COLUMN confirmat_de INTEGER REFERENCES utilizator(id)');
    d.exec('ALTER TABLE comanda ADD COLUMN facturat_de  INTEGER REFERENCES utilizator(id)');
    d.exec('ALTER TABLE comanda ADD COLUMN finalizat_de INTEGER REFERENCES utilizator(id)');
  },
  // v9 → v10 (2026-09-25): adresa clientului separat de telefon, şi detaliile
  // comenzii din configurator (toate gamele): mod de livrare, agent, tipul de
  // facturare (BF / factură fiscală / ofertă). Comenzile de dinainte: NULL.
  d => {
    for (const col of ['client_adresa', 'livrare', 'agent', 'tip_facturare']) d.exec(`ALTER TABLE comanda ADD COLUMN ${col} TEXT`);
  },
  // v10 → v11 (2026-09-28): nr. de ofertă scris de mână în configurator (ex.
  // cel din NeoManager), lângă numărul automat OF-. Starea nouă tip = 'plata'
  // („aşteaptă plata") nu cere coloană — `tip` e text.
  d => d.exec('ALTER TABLE comanda ADD COLUMN oferta_nr TEXT'),
  // v11 → v12 (2026-09-29): COPIA bazei de clienţi. Originalul e pe Cloudflare
  // (clienti-agenti/, D1): acolo agenţii de vânzări îşi modifică clienţii şi
  // adaugă alţii. server/clienti.js trage tot ce s-a schimbat după `versiune`
  // şi suprascrie rândul după extern_id (= id-ul de acolo).
  d => d.exec(`
    CREATE TABLE client (
      id                    INTEGER PRIMARY KEY,
      extern_id             INTEGER NOT NULL UNIQUE,
      agent                 TEXT,
      nume                  TEXT NOT NULL,
      cui                   TEXT,
      judet                 TEXT,
      localitate            TEXT,
      adresa_sediu          TEXT,
      adresa_livrare        TEXT,
      administrator         TEXT,
      telefon_administrator TEXT,
      email                 TEXT,
      delegat               TEXT,
      telefon_delegat       TEXT,
      discounturi           TEXT,
      creat_la              TEXT,
      modificat_la          TEXT,
      versiune              INTEGER NOT NULL
    )`),
  // v12 → v13 (2026-09-29): setări globale ale serverului, puse din /admin — ca
  // să nu se umble pe server prin Remote Desktop. Prima: cheia bazei de clienţi
  // de pe Cloudflare (`clienti_cheie`); nu intră în git, stă doar în bază.
  d => d.exec('CREATE TABLE setare (cheie TEXT PRIMARY KEY, valoare TEXT)'),
  // v13 → v14 (2026-10-05): când a ieşit oferta din „oferte" (în lucru sau
  // aşteaptă plata) — „Înapoi în ofertă" merge doar câteva minute după (userul).
  // Comenzile de dinainte: NULL, deci nu se mai pot întoarce.
  d => d.exec('ALTER TABLE comanda ADD COLUMN tip_schimbat_la TEXT'),
  // v14 → v15 (2026-10-06): „Organizează livrări" (server/livrari.js). Pe comandă:
  // judeţul (NULL = recunoscut din adresă), suma de încasat la livrare (o trec
  // colegii) şi coordonatele adresei (găsite în browser, ca harta să nu le caute
  // din nou; geo_adresa = adresa pt. care sunt — altă adresă = se caută iar).
  // O livrare = o zi + comenzile ei, în ordinea traseului; o comandă — o singură livrare.
  d => {
    for (const col of ['judet TEXT', 'de_incasat REAL', 'lat REAL', 'lon REAL', 'geo_adresa TEXT']) d.exec(`ALTER TABLE comanda ADD COLUMN ${col}`);
    d.exec(`
      CREATE TABLE livrare (
        id        INTEGER PRIMARY KEY,
        data      TEXT NOT NULL,                         -- ziua livrării, AAAA-LL-ZZ
        creat_la  TEXT NOT NULL,
        creat_de  INTEGER REFERENCES utilizator(id)
      );
      CREATE TABLE livrare_comanda (
        livrare_id INTEGER NOT NULL REFERENCES livrare(id) ON DELETE CASCADE,
        comanda_id INTEGER NOT NULL UNIQUE REFERENCES comanda(id) ON DELETE CASCADE,
        ordine     INTEGER NOT NULL,
        PRIMARY KEY (livrare_id, comanda_id)
      );`);
  },
  // v15 → v16 (2026-10-08): taskuri cu reminder (server/taskuri.js). Unul dat de
  // cineva (creat_de) cuiva (pentru), opţional legat de o comandă; scadenta = când
  // apare notificarea (UTC, ca restul datelor; NULL = fără reminder).
  d => d.exec(`
    CREATE TABLE task (
      id         INTEGER PRIMARY KEY,
      text       TEXT NOT NULL,
      scadenta   TEXT,
      pentru     INTEGER NOT NULL REFERENCES utilizator(id),
      creat_de   INTEGER NOT NULL REFERENCES utilizator(id),
      comanda_id INTEGER REFERENCES comanda(id) ON DELETE SET NULL,
      creat_la   TEXT NOT NULL,
      facut_la   TEXT
    );
    CREATE INDEX task_pentru ON task (pentru, facut_la);`),
  // v16 → v17 (2026-10-13): cererile (tichetele) pt. conducere / admin — deocamdată anularea
  // unei comenzi: oricine o cere cu un motiv, conducerea o aprobă sau o respinge (server/cereri.js).
  // O singură cerere deschisă de acelaşi fel pe o comandă.
  d => d.exec(`
    CREATE TABLE cerere (
      id         INTEGER PRIMARY KEY,
      tip        TEXT NOT NULL,                    -- 'anulare' | 'factura' (v32)
      comanda_id INTEGER REFERENCES comanda(id) ON DELETE CASCADE,
      motiv      TEXT NOT NULL,
      creat_de   INTEGER NOT NULL REFERENCES utilizator(id),
      creat_la   TEXT NOT NULL,
      stare      TEXT NOT NULL DEFAULT 'deschisa', -- deschisa | aprobata | respinsa
      decis_de   INTEGER REFERENCES utilizator(id),
      decis_la   TEXT,
      raspuns    TEXT
    );
    CREATE UNIQUE INDEX cerere_deschisa ON cerere (comanda_id, tip) WHERE stare = 'deschisa';`),
  // v17 → v18 (2026-10-13): când s-a printat fişa de atelier ultima dată şi de cine (butonul „Fişă" din manager)
  d => {
    d.exec('ALTER TABLE comanda ADD COLUMN fisa_printata_la TEXT');
    d.exec('ALTER TABLE comanda ADD COLUMN fisa_printata_de INTEGER REFERENCES utilizator(id)');
  },
  // v18 → v19 (2026-10-13): tichetele colegilor pentru administrator — probleme, idei (server/tichete.js)
  d => d.exec(`
    CREATE TABLE tichet (
      id             INTEGER PRIMARY KEY,
      tip            TEXT NOT NULL,                   -- 'problema' | 'idee' | 'altceva'
      text           TEXT NOT NULL,
      pagina         TEXT,                            -- de unde a venit (adresa paginii de dinainte)
      creat_de       INTEGER NOT NULL REFERENCES utilizator(id),
      creat_la       TEXT NOT NULL,
      stare          TEXT NOT NULL DEFAULT 'nou',     -- 'nou' | 'in_lucru' | 'rezolvat' | 'respins'
      raspuns        TEXT,
      raspuns_de     INTEGER REFERENCES utilizator(id),
      modificat_la   TEXT NOT NULL,
      vazut_de_autor INTEGER NOT NULL DEFAULT 1       -- 0 = adminul a schimbat ceva, autorul n-a văzut încă
    );
    CREATE INDEX tichet_stare ON tichet (stare, modificat_la);`),
  // v19 → v20 (2026-10-14): modul test, bifat de admin pe fiecare cont (vezi „Modul test" mai sus)
  d => d.exec('ALTER TABLE utilizator ADD COLUMN mod_test INTEGER NOT NULL DEFAULT 0'),
  // v20 → v21 (2026-10-15): tichetul legat de o comandă / ofertă („+ Tichet" de pe comandă). Fără REFERENCES:
  // tichetele stau mereu în baza reală, iar o ofertă făcută în modul test există doar în copie.
  d => d.exec('ALTER TABLE tichet ADD COLUMN comanda_id INTEGER'),
  // v21 → v22 (2026-10-15): taskurile au o mini-conversaţie (răspunsuri + evenimentele lor) şi se pot pune
  // în aşteptare — fără reminder până se reiau (server/taskuri.js)
  d => d.exec(`
    ALTER TABLE task ADD COLUMN in_asteptare_la TEXT;
    CREATE TABLE task_mesaj (
      id        INTEGER PRIMARY KEY,
      task_id   INTEGER NOT NULL REFERENCES task(id) ON DELETE CASCADE,
      autor     INTEGER NOT NULL REFERENCES utilizator(id),
      text      TEXT NOT NULL DEFAULT '',
      eveniment TEXT,                            -- NULL = răspuns; 'asteptare' | 'reluat' | 'facut' | 'redeschis'
      creat_la  TEXT NOT NULL,
      citit     INTEGER NOT NULL DEFAULT 0       -- 1 = l-a văzut celălalt (un task are doar doi oameni)
    );
    CREATE INDEX task_mesaj_task ON task_mesaj (task_id, creat_la);`),
  // v22 → v23 (2026-10-19): fiecare printare a fişei (nu doar ultima) — prima rămâne, se văd şi retipăririle,
  // iar la retipărire managerul întreabă întâi. poz = produsul ofertei (fiecare are fişa lui).
  d => d.exec(`
    CREATE TABLE fisa_printare (
      id         INTEGER PRIMARY KEY,
      comanda_id INTEGER NOT NULL REFERENCES comanda(id) ON DELETE CASCADE,
      poz        INTEGER NOT NULL DEFAULT 0,
      la         TEXT NOT NULL,
      de         INTEGER REFERENCES utilizator(id)
    );
    CREATE INDEX fisa_printare_comanda ON fisa_printare (comanda_id, la);
    INSERT INTO fisa_printare (comanda_id, poz, la, de)
      SELECT id, 0, fisa_printata_la, fisa_printata_de FROM comanda WHERE fisa_printata_la IS NOT NULL;`),
  // v23 → v24 (2026-10-19): furnizorii de sticlă cu adresa de comenzi — până acum în cod (server/sticla.js),
  // acum modificabilă din pagina Comandă sticlă (tichet: adresa GoldenGlass greşită); cine şi când a schimbat-o
  d => d.exec(`
    CREATE TABLE furnizor (
      cod          TEXT PRIMARY KEY,                -- prefixul codului de sticlă: GG001 → GG
      nume         TEXT NOT NULL,
      email        TEXT NOT NULL DEFAULT '',        -- una sau mai multe, „a@x.ro, b@y.ro"; gol = o scrii în mail
      modificat_la TEXT,
      modificat_de INTEGER REFERENCES utilizator(id)
    );
    INSERT INTO furnizor (cod, nume, email) VALUES ('GG', 'GoldenGlass', 'comenzi@goldenglass.ro'), ('OVI', 'OviBest', ''),
      ('CS', 'CS', ''), ('HD', 'HD', ''), ('CG', 'CG', ''), ('TG', 'TG', '');`),
  // v24 → v25 (2026-10-19): notificările unui om (răspuns / stare nouă la tichetul lui) — stau în stânga jos
  // până le închide el cu X (server/notificari.js, web/bara.js)
  d => d.exec(`
    CREATE TABLE notificare (
      id            INTEGER PRIMARY KEY,
      utilizator_id INTEGER NOT NULL REFERENCES utilizator(id) ON DELETE CASCADE,
      titlu         TEXT NOT NULL,
      text          TEXT NOT NULL DEFAULT '',
      link          TEXT,                            -- unde duce un clic pe ea (ex. /tichete)
      creat_la      TEXT NOT NULL,
      inchisa_la    TEXT                             -- NULL = încă pe ecran
    );
    CREATE INDEX notificare_deschise ON notificare (utilizator_id, inchisa_la);`),
  // v25 → v26 (2026-10-19): când s-a schimbat ultima dată livrarea / adresa unei comenzi acceptate — dacă fişa
  // era deja printată, la finalizare se întreabă dacă s-a completat de mână (până la o fişă reprintată)
  d => d.exec('ALTER TABLE comanda ADD COLUMN livrare_modificata_la TEXT'),
  // v26 → v27 (2026-10-19): observaţiile de livrare, scrise la Organizează livrări — pe borderou (nu cele din ofertă)
  d => d.exec('ALTER TABLE comanda ADD COLUMN observatii_livrare TEXT'),
  // v27 → v28 (2026-10-21): jurnalul de activitate — tot ce face fiecare om în aplicaţie (server/activitate.js).
  // Stă mereu în baza REALĂ (şi ce se face în modul test, cu test = 1); nu se copiază în copiile de test.
  // comanda_nr / client_nume / utilizator_nume — cum erau atunci (comanda se poate şterge / redenumi).
  d => d.exec(`
    CREATE TABLE activitate (
      id              INTEGER PRIMARY KEY,
      la              TEXT NOT NULL,
      utilizator_id   INTEGER,
      utilizator_nume TEXT,
      fel             TEXT NOT NULL,                  -- 'schimbare' | 'cont' | 'vizualizare'
      operatie        TEXT NOT NULL,
      detalii         TEXT,
      comanda_id      INTEGER,
      comanda_nr      TEXT,
      client_nume     TEXT,
      test            INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX activitate_la ON activitate (la);
    CREATE INDEX activitate_comanda ON activitate (comanda_id, la);
    CREATE INDEX activitate_utilizator ON activitate (utilizator_id, la);`),
  // v28 → v29 (2026-10-22): unde ajunge preţul pe borderou — 'bon' | 'factura' (factură + chitanţă) | 'op'; ales la
  // Organizează livrări, lângă preţ (înainte se deducea din metoda de plată — aşa se completează la comenzile cu preţ)
  d => d.exec(`
    ALTER TABLE comanda ADD COLUMN coloana_borderou TEXT;
    UPDATE comanda SET coloana_borderou = CASE plata WHEN 'bon' THEN 'bon' WHEN 'fiscala' THEN 'factura'
      WHEN 'proforma' THEN 'op' WHEN 'proforma_amanunt' THEN 'op' WHEN 'avans' THEN 'op' END
     WHERE de_incasat IS NOT NULL;`),
  // v29 → v30 (2026-10-22): conversaţie pe fiecare tichet, ca la taskuri (server/tichete.js) — autorul şi adminii.
  // eveniment NULL = mesaj; 'stare' = adminul a schimbat starea (text = starea nouă). citit = l-a văzut cealaltă
  // parte (autorul — mesajele adminilor; adminii — ale autorului). Răspunsurile de până acum devin primul mesaj.
  d => d.exec(`
    CREATE TABLE tichet_mesaj (
      id        INTEGER PRIMARY KEY,
      tichet_id INTEGER NOT NULL REFERENCES tichet(id) ON DELETE CASCADE,
      autor     INTEGER NOT NULL REFERENCES utilizator(id),
      text      TEXT NOT NULL DEFAULT '',
      eveniment TEXT,
      creat_la  TEXT NOT NULL,
      citit     INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX tichet_mesaj_tichet ON tichet_mesaj (tichet_id, creat_la);
    INSERT INTO tichet_mesaj (tichet_id, autor, text, creat_la, citit)
      SELECT id, raspuns_de, raspuns, modificat_la, vazut_de_autor FROM tichet WHERE raspuns IS NOT NULL AND raspuns_de IS NOT NULL;`),
  // v30 → v31 (2026-10-22): poze în conversaţia tichetelor — micşorate în browser (JPEG), aici ca blob. Nu se copiază
  // în copiile de test (tichetele se citesc oricum din baza reală).
  d => d.exec(`
    CREATE TABLE tichet_poza (
      id       INTEGER PRIMARY KEY,
      mesaj_id INTEGER NOT NULL REFERENCES tichet_mesaj(id) ON DELETE CASCADE,
      tip      TEXT NOT NULL,                   -- 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
      date     BLOB NOT NULL
    );
    CREATE INDEX tichet_poza_mesaj ON tichet_poza (mesaj_id);`),
  // v31 → v32 (2026-10-23): cererea de schimbare a nr. facturii (tip 'factura', server/cereri.js) — numărul nou,
  // pus pe comandă la aprobare
  d => d.exec('ALTER TABLE cerere ADD COLUMN numar_nou TEXT'),
  // v32 → v33 (2026-10-26): un task poate fi dat mai multor oameni (userul) — task_destinatar; task.pentru rămâne
  // primul dintre ei. Fiecare îşi bifează partea (userul: „dacă cineva face taskul nu trebuie să apară făcut
  // pentru toţi") şi o pune în aşteptare — facut_la / in_asteptare_la pe destinatar; task.facut_la = când l-au
  // făcut toţi. „Necitit" se ţine pe fiecare om (task_citit: ultimul mesaj văzut), în locul lui task_mesaj.citit,
  // care mergea doar cu doi oameni pe task — stările şi citirile de până acum se păstrează.
  d => d.exec(`
    CREATE TABLE task_destinatar (
      task_id         INTEGER NOT NULL REFERENCES task(id) ON DELETE CASCADE,
      utilizator_id   INTEGER NOT NULL REFERENCES utilizator(id),
      facut_la        TEXT,                     -- şi-a făcut partea
      in_asteptare_la TEXT,                     -- partea lui e în aşteptare: fără reminder până o reia
      PRIMARY KEY (task_id, utilizator_id)
    );
    CREATE INDEX task_destinatar_om ON task_destinatar (utilizator_id);
    INSERT INTO task_destinatar (task_id, utilizator_id, facut_la, in_asteptare_la) SELECT id, pentru, facut_la, in_asteptare_la FROM task;
    CREATE TABLE task_citit (
      task_id       INTEGER NOT NULL REFERENCES task(id) ON DELETE CASCADE,
      utilizator_id INTEGER NOT NULL REFERENCES utilizator(id),
      pana_la       INTEGER NOT NULL,             -- task_mesaj.id: ce e până la el (inclusiv) e văzut
      PRIMARY KEY (task_id, utilizator_id)
    );
    INSERT INTO task_citit (task_id, utilizator_id, pana_la)
      SELECT o.task_id, o.om, MAX(m.id)
        FROM (SELECT id AS task_id, pentru AS om FROM task UNION SELECT id, creat_de FROM task) o
        JOIN task_mesaj m ON m.task_id = o.task_id AND m.autor != o.om AND m.citit = 1
       GROUP BY o.task_id, o.om;`),
  // v33 → v34 (2026-10-26): comanda trecută prin „Aşteaptă plata" şi apoi „Plată primită" e ACHITATĂ (userul) —
  // achitat_la = momentul plăţii primite; suma încasată stă în `avans`. Retroactiv, din jurnalul de activitate
  // (pornit 2026-10-21, doar ce s-a făcut pe bune): trimisă la „Aşteaptă plata" înainte de acceptare şi neîntoarsă
  // în oferte între timp. Ce s-a acceptat înainte de jurnal nu se mai poate şti.
  d => {
    const { OPERATII } = require('./activitate.js');
    const op = cale => OPERATII[`POST /api/comenzi/:id/${cale}`][0];
    d.exec('ALTER TABLE comanda ADD COLUMN achitat_la TEXT');
    d.prepare(`
      UPDATE comanda SET achitat_la = confirmat_la
       WHERE tip = 'comanda' AND confirmat_la IS NOT NULL
         AND EXISTS (SELECT 1 FROM activitate p
                      WHERE p.comanda_id = comanda.id AND p.test = 0 AND p.operatie = :plata AND p.la <= comanda.confirmat_la
                        AND NOT EXISTS (SELECT 1 FROM activitate o
                                         WHERE o.comanda_id = comanda.id AND o.test = 0 AND o.operatie = :oferta
                                           AND o.la >= p.la AND o.la <= comanda.confirmat_la))`)
      .run({ plata: op('asteapta-plata'), oferta: op('inapoi-oferta') });
  },
  // v34 → v35 (2026-10-26): metoda de încasare (userul) — „plata" rămâne documentul (afişat „Facturare"), încasarea
  // (OP avans, Cash BF la sofer, Card…) e câmp separat, obligatoriu la salvare; comenzile vechi rămân fără (NULL).
  d => d.exec('ALTER TABLE comanda ADD COLUMN incasare TEXT'),
  // v35 → v36 (2026-10-26): o comandă facturată e şi finalizată (userul: „facturare fără finalizare să nu se poată")
  // — cele facturate dar rămase în lucru trec la finalizate, cu data şi omul facturării.
  d => d.exec(`UPDATE comanda SET finalizat_la = COALESCE(facturat_la, datetime('now')), finalizat_de = facturat_de
                WHERE tip = 'comanda' AND factura_nr IS NOT NULL AND finalizat_la IS NULL`),
];

// Exportată pt. test.
function roluriNoi(d) {
  d.prepare("UPDATE utilizator SET rol = 'birou' WHERE rol NOT IN ('admin', 'conducere', 'birou')").run();
}

// Înlocuieşte tokenurile în clar din `sesiune` cu SHA-256 lor (acelaşi calcul
// ca hashToken din auth.js). Sigură şi la o a doua rulare: un hash (64 de
// caractere hex) se lasă în pace — tokenurile în clar sunt base64url, 43 car.
// Exportată pt. test.
function hashSesiuniInClar(d) {
  const pune = d.prepare('UPDATE sesiune SET token = ? WHERE token = ?');
  for (const { token } of d.prepare('SELECT token FROM sesiune').all()) {
    if (/^[0-9a-f]{64}$/.test(token)) continue;
    pune.run(crypto.createHash('sha256').update(token).digest('hex'), token);
  }
}

function migreaza() {
  _db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

  // Fiecare migraţie, cu tot cu ridicarea versiunii, într-o tranzacţie: ori
  // se aplică întreagă, ori deloc. Altfel o migraţie oprită la jumătate (ex.
  // după primul din două ALTER-uri) bloca pornirea serverului pentru totdeauna.
  const versiune = _db.prepare('PRAGMA user_version').get().user_version ?? 0;
  MIGRATII.slice(versiune).forEach((mig, i) => {
    tranzactie(d => {
      mig(d);
      d.exec(`PRAGMA user_version = ${versiune + i + 1}`);
    });
    console.log(`DB: migraţie ${versiune + i + 1} aplicată`);
  });

  semanta();
}

// Operaţiile implicite de atelier — un punct de plecare pe care utilizatorul îl
// corectează din UI. Se pun o SINGURĂ dată (doar dacă tabelul e gol), ca
// ştergerea uneia să nu fie anulată la următoarea pornire.
// Aceleaşi 5 etape ca pe fişa de comandă (userul, 2026-09-22). Codurile sunt
// cele trimise de pagina de scanare (scanare/index.html) — ţine-le sincron.
const OPERATII_IMPLICITE = [
  ['DEBITARE',  'Debitare',  10],
  ['GAURIRE',   'Gaurire',   20],
  ['GARNITURA', 'Garnitura', 30],
  ['ASAMBLARE', 'Asamblare', 40],
  ['COLETARE',  'Coletare',  50],
];

function semanta() {
  const { n } = _db.prepare('SELECT COUNT(*) AS n FROM operatie').get();
  if (n > 0) return;

  const ins = _db.prepare('INSERT INTO operatie (cod, nume, ordine) VALUES (?, ?, ?)');
  for (const [cod, nume, ordine] of OPERATII_IMPLICITE) ins.run(cod, nume, ordine);
  console.log(`DB: ${OPERATII_IMPLICITE.length} operaţii implicite adăugate (modificabile din UI)`);
}

// ── Backup ───────────────────────────────────────────────────────────────────
// Baza asta devine singura copie a ofertelor şi comenzilor firmei, deci backup
// din prima zi. `VACUUM INTO` face o copie consistentă fără să oprească
// serverul (spre deosebire de un simplu cp, care poate prinde WAL-ul la mijloc).

function backup() {
  fs.mkdirSync(config.backup, { recursive: true });
  const zi = new Date().toISOString().slice(0, 10);
  const dest = path.join(config.backup, `manager-${zi}.sqlite`);

  fs.rmSync(dest, { force: true });   // rescrie backup-ul zilei curente
  db().exec(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);

  // păstrăm ultimele 30 de zile
  const vechi = fs.readdirSync(config.backup)
    .filter(f => /^manager-\d{4}-\d{2}-\d{2}\.sqlite$/.test(f))
    .sort()
    .slice(0, -30);
  vechi.forEach(f => fs.rmSync(path.join(config.backup, f), { force: true }));

  return dest;
}

// Cel mai nou backup din folderul de backup — pt. /admin („Ultimul backup", cu avertisment
// dacă e mai vechi de o zi; userul, 2026-10-13). null = niciunul.
function ultimulBackup() {
  let f;
  try {
    f = fs.readdirSync(config.backup).filter(x => /^manager-\d{4}-\d{2}-\d{2}\.sqlite$/.test(x))
      .map(x => ({ x, st: fs.statSync(path.join(config.backup, x)) })).sort((a, b) => b.st.mtimeMs - a.st.mtimeMs)[0];
  } catch { return null; }
  return f ? { fisier: path.join(config.backup, f.x), la: f.st.mtime.toISOString(), mb: Math.round(f.st.size / 1e5) / 10 } : null;
}

// Rulează `fn` într-o tranzacţie; la orice excepţie se anulează tot.
// Necesar la crearea unei comenzi: ori intră comanda CU poziţiile, liniile şi
// uşile ei, ori nu intră nimic.
function tranzactie(fn) {
  const d = db();
  d.exec('BEGIN');
  try {
    const r = fn(d);
    d.exec('COMMIT');
    return r;
  } catch (e) {
    d.exec('ROLLBACK');
    throw e;
  }
}

// Închidere curată (la oprirea serverului): SQLite scrie WAL-ul în fişierul
// principal, ca manager.sqlite să fie complet şi fără -wal alături.
function inchide() {
  sincronizeaza();
  inchideTest();
  if (_db) { _db.close(); _db = null; }
}

module.exports = { db, deschide, inchide, backup, ultimulBackup, tranzactie, hashSesiuniInClar, roluriNoi, ACUM, faraDiacritice,
  inTest, esteTest, peBune, copiaLui, copiaCurenta, sincronizeaza, copieTest, refaTest, modTestPosibil, comenziDemo, COPII };
