-- ═══════════════════════════════════════════════════════════════════════════
--  Catalog articole — SCHEMA DE REFERINȚĂ
--
--  Catalogul real e per FAMILIE de sisteme: js/catalog/<family>.seed.sql
--  (`<family>` = `meta.family`, ex. 'suspendata'). Aceeași schemă în fiecare.
--  `npm run catalog` face: <family>.seed.sql → <family>.sqlite →
--  js/catalog/catalog.generated.json  ({ "<family>": [ ...rânduri... ] }).
--
--  Un singur tabel per familie. Codul depinde DOAR de: tip + finisaj + mărime.
--  A/D/E/F folosesc aceleași coduri — diferența dintre ele (montare, cantități)
--  stă în js/systems/suspendata_x.js (spec() + secțiunea 7 `billing`).
--  Accesoriile și sticla NU stau aici: linii cu cod fix în secțiunea 7.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE articol (
  cod      TEXT PRIMARY KEY,      -- codul EXACT din NeoManager
  tip      TEXT NOT NULL,         -- 'usa' | 'sina' | 'mascare_sina' | 'divizare'
  finisaj  TEXT,                  -- 'ARG'|'ANT'|'ALB'|'LEM' ; NULL = orice culoare
  lmin     INTEGER,               -- banda de mărime [lmin, lmax] mm (inclusiv). Se testează pe:
  lmax     INTEGER,               --   usa           → lățimea UŞII
                                  --   sina / mascare → lungimea ȘINEI
                                  --   divizare      → lățimea LIBERĂ a uşii
  denumire TEXT,                  -- pentru afișare în panoul de facturare
  um       TEXT NOT NULL DEFAULT 'buc',
  activ    INTEGER NOT NULL DEFAULT 1
);

-- Bandele pe același (tip, finisaj) nu trebuie să se suprapună.
-- Ce cade în afara oricărei benzi → linie de eroare „lipsă cod" în app.
