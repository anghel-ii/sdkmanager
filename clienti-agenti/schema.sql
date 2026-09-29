-- Baza D1 „clienti-agenti" (Cloudflare) — BAZA DE CLIENŢI A FIRMEI.
-- Aici e originalul: agenţii de vânzări intră cu user + parolă, îşi văd şi îşi
-- modifică clienţii (cei cu numele lor în `agent`) şi adaugă clienţi noi.
-- Managerul (serverul din firmă) ţine o COPIE: trage tot ce s-a schimbat după
-- `versiune` — vezi manager/server/clienti.js.
-- Conturi: node agent.mjs "Nume Agent". Import iniţial: node importa.mjs <xlsx>.

CREATE TABLE IF NOT EXISTS agent (
  id          INTEGER PRIMARY KEY,
  user        TEXT NOT NULL UNIQUE,
  nume        TEXT NOT NULL UNIQUE,   -- exact ca în coloana AGENT din Excel
  parola_hash TEXT NOT NULL,          -- pbkdf2$<iteraţii>$<sare>$<hash>, vezi lib/comun.js
  activ       INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sesiune (
  token_hash TEXT PRIMARY KEY,        -- SHA-256 al tokenului din cookie
  agent_id   INTEGER NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
  expira_la  TEXT NOT NULL,
  admin      INTEGER NOT NULL DEFAULT 0   -- 1 = adminul intrat în contul agentului (8 ore)
);

-- „Intră ca acest agent" din /admin-ul managerului: bilet de o folosinţă, 60 s
CREATE TABLE IF NOT EXISTS bilet (
  token_hash TEXT PRIMARY KEY,
  agent_id   INTEGER NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
  expira_la  TEXT NOT NULL
);

-- Câmpurile = coloanele din „Livrare_MASINA_completat.xlsx".
CREATE TABLE IF NOT EXISTS client (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  agent                 TEXT,
  nume                  TEXT NOT NULL,
  cui                   TEXT,            -- 'Persoana Fizica' la persoane fizice, ca în Excel
  judet                 TEXT,
  localitate            TEXT,
  adresa_sediu          TEXT,
  adresa_livrare        TEXT,
  administrator         TEXT,
  telefon_administrator TEXT,
  email                 TEXT,
  delegat               TEXT,            -- cine preia marfa
  telefon_delegat       TEXT,
  discounturi           TEXT,
  creat_la              TEXT,            -- NULL la cei importaţi din Excel
  modificat_la          TEXT,
  -- creşte la FIECARE adăugare/modificare (MAX + 1); managerul cere „după versiunea X"
  versiune              INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS client_versiune ON client(versiune);
CREATE INDEX IF NOT EXISTS client_agent    ON client(agent);
