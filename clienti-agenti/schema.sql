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
  activ       INTEGER NOT NULL DEFAULT 1,
  -- 'agent' = îşi vede clienţii, modificările aşteaptă aprobarea; 'conducere' (userul, 2026-10-27) = vede şi
  -- modifică direct TOŢI clienţii, inclusiv agentul lor (clientul trece la noul agent). Pe baza veche (remote):
  --   ALTER TABLE agent ADD COLUMN rol TEXT NOT NULL DEFAULT 'agent';
  rol         TEXT NOT NULL DEFAULT 'agent'
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
  -- text liber (userul, 2026-10-29: „OP 30 zile", „Cash"…). Pe baza veche (remote):
  --   ALTER TABLE client ADD COLUMN modalitate_plata TEXT;
  modalitate_plata      TEXT,
  creat_la              TEXT,            -- NULL la cei importaţi din Excel
  modificat_la          TEXT,
  -- creşte la FIECARE adăugare/modificare (MAX + 1); managerul cere „după versiunea X"
  versiune              INTEGER NOT NULL,
  -- şters din manager (conducerea, 2026-10-27): rândul rămâne, cu versiune nouă, ca ştergerea
  -- să ajungă şi în copiile managerului; agenţii nu-l mai văd. Pe baza veche (remote):
  --   ALTER TABLE client ADD COLUMN sters_la TEXT;
  sters_la              TEXT
);
CREATE INDEX IF NOT EXISTS client_versiune ON client(versiune);
CREATE INDEX IF NOT EXISTS client_agent    ON client(agent);

-- Ce adaugă / modifică agenţii NU intră direct în `client`: aşteaptă aprobarea din
-- manager (pagina Clienţi → Aprobă / Respinge, userul 2026-10-01). Abia aprobarea
-- scrie în `client` şi îi creşte versiunea — deci managerul preia doar ce s-a aprobat.
CREATE TABLE IF NOT EXISTS propunere (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER REFERENCES client(id) ON DELETE CASCADE,   -- NULL = client nou
  agent     TEXT NOT NULL,
  date_json TEXT NOT NULL,          -- câmpurile propuse (CAMPURI din lib/comun.js); '{}' la ştergere
  creat_la  TEXT NOT NULL,          -- ultima trimitere a agentului
  -- 1 = agentul cere ştergerea clientului (userul, 2026-10-29). Tot o singură cerere pe client:
  -- o modificare trimisă după o ştergere (sau invers) o înlocuieşte. Pe baza veche (remote):
  --   ALTER TABLE propunere ADD COLUMN stergere INTEGER NOT NULL DEFAULT 0;
  stergere  INTEGER NOT NULL DEFAULT 0,
  UNIQUE (client_id)                -- o singură modificare în aşteptare pe client (NULL-urile nu se ciocnesc)
);

-- Pagina /admin (userul, 2026-10-08): update la serverul din firmă şi când nu eşti acolo.
-- Serverul nu primeşte nimic din internet — la 20 s îşi trimite aici starea şi ia
-- cererea lăsată de pe pagină (manager/server/actualizare.js, raporteaza). Un singur rând.
CREATE TABLE IF NOT EXISTS server (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  raport_json TEXT,       -- ultima stare trimisă de manager: versiune, jurnal, noutăţi…
  raportat_la TEXT,
  cerere      TEXT,       -- 'verifica' | 'actualizeaza' — o ia managerul la următoarea raportare
  cerere_la   TEXT,
  esecuri     TEXT        -- JSON: momentele parolelor greşite din ultimele 15 minute
);
