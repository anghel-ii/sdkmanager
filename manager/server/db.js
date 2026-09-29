const fs     = require('node:fs');
const path   = require('node:path');
const crypto = require('node:crypto');
const { config } = require('./config.js');

// taci warning-ul „SQLite is an experimental feature" de la node:sqlite
// (acelaşi truc ca în configurator_usi/build.js)
const _emitWarning = process.emitWarning;
process.emitWarning = (w, ...rest) =>
  String(w).includes('SQLite is an experimental') ? undefined : _emitWarning.call(process, w, ...rest);

const { DatabaseSync } = require('node:sqlite');

// ── Baza de date ─────────────────────────────────────────────────────────────
// node:sqlite, acelaşi modul folosit de configurator la catalog. Sincron, deci
// nu avem nevoie de async peste tot; la traficul unui atelier (câteva zeci de
// cereri pe minut) e mai mult decât suficient şi cu mult mai simplu de citit.

let _db = null;

function db() {
  if (!_db) throw new Error('Baza de date nu e deschisă — cheamă deschide() întâi.');
  return _db;
}

function deschide() {
  if (_db) return _db;

  fs.mkdirSync(path.dirname(config.db), { recursive: true });
  _db = new DatabaseSync(config.db);

  // WAL: cititorii nu blochează scriitorul. Contează când cineva scanează de pe
  // telefon exact când altcineva deschide lista de comenzi.
  _db.exec('PRAGMA journal_mode = WAL');
  _db.exec('PRAGMA foreign_keys = ON');
  _db.exec('PRAGMA busy_timeout = 5000');

  migreaza();
  return _db;
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
  if (_db) { _db.close(); _db = null; }
}

module.exports = { db, deschide, inchide, backup, tranzactie, hashSesiuniInClar, roluriNoi };
