-- ═══════════════════════════════════════════════════════════════════════════
--  manager/server/schema.sql — schema managerului de comenzi
--
--  Se rulează la FIECARE pornire a serverului (db.js → migreaza()). Toate
--  instrucţiunile sunt idempotente (`IF NOT EXISTS`), deci rularea repetată
--  nu strică nimic. Pentru schimbări care NU se pot exprima aşa (redenumiri,
--  coloane noi cu date de completat) se adaugă o migraţie numerotată în
--  db.js şi se ridică PRAGMA user_version.
--
--  Ierarhia: comandă → poziţie → uşă.
--    comandă  = o ofertă sau o comandă a unui client
--    poziţie  = o configuraţie din configurator (un model, o cotă, un finisaj)
--    uşă      = un exemplar FIZIC dintr-o poziţie; poartă codul de bare.
--  O poziţie Suspendată E dă 2 uşi, un Confort cu doors=5 dă 5 uşi.
-- ═══════════════════════════════════════════════════════════════════════════

PRAGMA foreign_keys = ON;

-- ── Utilizatori şi sesiuni ──────────────────────────────────────────────────
-- Parolele: scrypt cu salt per utilizator (vezi server/auth.js). Nu stocăm
-- niciodată parola în clar şi nu o trimitem înapoi în niciun răspuns.

CREATE TABLE IF NOT EXISTS utilizator (
  id          INTEGER PRIMARY KEY,
  nume        TEXT    NOT NULL,                      -- numele afişat, ex. "Ion Popescu"
  user        TEXT    NOT NULL UNIQUE,               -- numele de login, minuscule
  parola_hash TEXT    NOT NULL,
  parola_salt TEXT    NOT NULL,
  rol         TEXT    NOT NULL DEFAULT 'operator',   -- 'admin' | 'birou' | 'operator'
  activ       INTEGER NOT NULL DEFAULT 1,
  creat_la    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Sesiunile stau în DB (nu în memorie) ca repornirea serverului să nu
-- delogheze pe nimeni — important când oamenii scanează de pe telefon.
CREATE TABLE IF NOT EXISTS sesiune (
  token         TEXT    PRIMARY KEY,
  utilizator_id INTEGER NOT NULL REFERENCES utilizator(id) ON DELETE CASCADE,
  creat_la      TEXT    NOT NULL DEFAULT (datetime('now')),
  vazut_la      TEXT    NOT NULL DEFAULT (datetime('now')),
  expira_la     TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sesiune_utilizator ON sesiune(utilizator_id);
CREATE INDEX IF NOT EXISTS idx_sesiune_expira     ON sesiune(expira_la);

-- ── Comenzi şi oferte ───────────────────────────────────────────────────────
-- `tip` separă cele două taburi din UI. O ofertă acceptată NU se copiază:
-- rămâne acelaşi rând, îşi schimbă `tip` şi primeşte `numar_comanda`, ca
-- istoricul şi poziţiile să rămână legate de aceeaşi înregistrare.

CREATE TABLE IF NOT EXISTS comanda (
  id              INTEGER PRIMARY KEY,
  numar           TEXT    NOT NULL UNIQUE,           -- OF-2026-0001
  numar_comanda   TEXT             UNIQUE,           -- CMD-2026-0001, NULL cât e ofertă
  tip             TEXT    NOT NULL DEFAULT 'oferta', -- 'oferta' | 'comanda'
  client_nume     TEXT    NOT NULL,
  client_telefon  TEXT,
  client_email    TEXT,
  observatii      TEXT,
  creat_de        INTEGER NOT NULL REFERENCES utilizator(id),
  creat_la        TEXT    NOT NULL DEFAULT (datetime('now')),
  confirmat_la    TEXT,                              -- când a devenit comandă
  erp_proforma_id INTEGER,                           -- Proforma_ID din WinMentor (faza 6)
  anulat          INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_comanda_tip  ON comanda(tip, anulat);
CREATE INDEX IF NOT EXISTS idx_comanda_data ON comanda(creat_la);

-- O poziţie = o configuraţie completă din configurator.
-- `config_json` e state-ul întreg (js/state.js) — sursa de adevăr, din care
-- configuratorul poate re-randa poziţia oricând, identic.
CREATE TABLE IF NOT EXISTS pozitie (
  id          INTEGER PRIMARY KEY,
  comanda_id  INTEGER NOT NULL REFERENCES comanda(id) ON DELETE CASCADE,
  idx         INTEGER NOT NULL,                      -- ordinea în ofertă, de la 1
  sistem      TEXT    NOT NULL,                      -- meta.id, ex. 'suspendataE'
  eticheta    TEXT    NOT NULL,                      -- meta.label, pt. afişare
  finisaj     TEXT    NOT NULL,
  latime      INTEGER NOT NULL,                      -- mm, cota de gol
  inaltime    INTEGER NOT NULL,
  nr_usi      INTEGER NOT NULL,
  config_json TEXT    NOT NULL,
  creat_la    TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (comanda_id, idx)
);

CREATE INDEX IF NOT EXISTS idx_pozitie_comanda ON pozitie(comanda_id);

-- Cele trei liste, îngheţate la confirmare. Se copiază INTENŢIONAT în loc să
-- se recalculeze: o editare ulterioară a catalogului nu trebuie să rescrie
-- retroactiv o comandă deja dată în lucru.
CREATE TABLE IF NOT EXISTS pozitie_linie (
  id         INTEGER PRIMARY KEY,
  pozitie_id INTEGER NOT NULL REFERENCES pozitie(id) ON DELETE CASCADE,
  lista      TEXT    NOT NULL,   -- 'facturare' | 'necesar' | 'client'
  idx        INTEGER NOT NULL,   -- ordinea în listă, ca la afişare
  cod        TEXT,               -- NULL la lista 'client' (nu sunt articole de-ale noastre)
  denumire   TEXT    NOT NULL,
  um         TEXT,
  cantitate  REAL    NOT NULL,
  debitare   TEXT                -- cota de debitare, ex. "1213 × 1016 mm"
);

CREATE INDEX IF NOT EXISTS idx_linie_pozitie ON pozitie_linie(pozitie_id, lista, idx);

-- Un exemplar fizic. Codul de bare se lipeşte pe uşa asta şi se scanează
-- la fiecare operaţie din atelier.
CREATE TABLE IF NOT EXISTS usa (
  id         INTEGER PRIMARY KEY,
  pozitie_id INTEGER NOT NULL REFERENCES pozitie(id) ON DELETE CASCADE,
  idx        INTEGER NOT NULL,          -- a câta uşă din poziţie, de la 1
  cod_bare   TEXT    NOT NULL UNIQUE,   -- ex. "260042-1-03", Code128
  creat_la   TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (pozitie_id, idx)
);

CREATE INDEX IF NOT EXISTS idx_usa_pozitie ON usa(pozitie_id);

-- ── Fluxul de atelier ───────────────────────────────────────────────────────
-- Operaţiile sunt configurabile din UI (nu hardcodate), fiindcă fluxul se
-- schimbă mai des decât codul.

CREATE TABLE IF NOT EXISTS operatie (
  id     INTEGER PRIMARY KEY,
  cod    TEXT    NOT NULL UNIQUE,      -- scurt, stabil; nu se schimbă la redenumire
  nume   TEXT    NOT NULL,             -- ce vede omul pe telefon
  ordine INTEGER NOT NULL DEFAULT 0,   -- ordinea în flux şi în lista de pe telefon
  activ  INTEGER NOT NULL DEFAULT 1
);

-- Log append-only. Statusul unei uşi = ultima scanare neanulată.
-- Nu ştergem niciodată un rând: o scanare greşită se corectează printr-una
-- nouă sau se marchează `anulat`, ca să rămână urma „cine şi când".
CREATE TABLE IF NOT EXISTS scanare (
  id            INTEGER PRIMARY KEY,
  usa_id        INTEGER NOT NULL REFERENCES usa(id)         ON DELETE CASCADE,
  operatie_id   INTEGER NOT NULL REFERENCES operatie(id),
  utilizator_id INTEGER NOT NULL REFERENCES utilizator(id),
  moment        TEXT    NOT NULL DEFAULT (datetime('now')),
  observatii    TEXT,
  anulat        INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_scanare_usa    ON scanare(usa_id, moment);
CREATE INDEX IF NOT EXISTS idx_scanare_moment ON scanare(moment);
