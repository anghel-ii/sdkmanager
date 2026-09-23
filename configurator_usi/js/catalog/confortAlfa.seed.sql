-- ═══════════════════════════════════════════════════════════════════════════
--  Catalog familia 'confortAlfa' (Confort Alfa) — din "db debitare CONFORT.xlsx".
--  `cod` NU e cheie unică: acelaşi cod apare la tip='divizare' şi
--  tip='orizontal superior' (acelaşi profil fizic, folosit în 2 poziţii) —
--  de-aia (spre deosebire de schema.sql de referinţă) `cod` e coloană simplă,
--  nu PRIMARY KEY. Lookup-ul (js/lib/confort/billing.js resolveLine) oricum caută
--  după tip + finisaj, nu după cod.
--  lmin/lmax: NULL — codul nu depinde de lungimea de debitare (bara se
--  cumpără la fix, se taie la cotă).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE articol (
  cod      TEXT,
  tip      TEXT NOT NULL,
  finisaj  TEXT,
  lmin     INTEGER,
  lmax     INTEGER,
  denumire TEXT,
  um       TEXT NOT NULL DEFAULT 'buc',
  activ    INTEGER NOT NULL DEFAULT 1
);

INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('213', 'divizare', 'ALUMINIU', 'DIVIZARI CONFORT ALFA ALUMINIU');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('232', 'divizare', 'SAMPANIE', 'DIVIZARI CONFORT ALFA SAMPANIE');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('212', 'orizontal inferior', 'ALUMINIU', 'ORIZONTAL INFERIOR ALFA ALUMINIU');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('231', 'orizontal inferior', 'SAMPANIE', 'ORIZONTAL INFERIOR ALFA SAMPANIE');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('213', 'orizontal superior', 'ALUMINIU', 'ORIZONTAL SUPERIOR ALFA ALUMINIU');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('232', 'orizontal superior', 'SAMPANIE', 'ORIZONTAL SUPERIOR ALFA SAMPANIE');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('211', 'vertical', 'ALUMINIU', 'PROFIL VERTICAL ALFA ALUMINIU');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('230', 'vertical', 'SAMPANIE', 'PROFIL VERTICAL ALFA SAMPANIE');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('201', 'sina inferioara', 'ALUMINIU', 'SINA INFERIOARA DUBLA ALUMINIU');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('221', 'sina inferioara', 'SAMPANIE', 'SINA INFERIOARA DUBLA SAMPANIE');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('200', 'sina superioara', 'ALUMINIU', 'SINA SUPERIOARA DUBLA ALUMINIU');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('220', 'sina superioara', 'SAMPANIE', 'SINA SUPERIOARA DUBLA SAMPANIE');

-- ═══════════════════════════════════════════════════════════════════════════
--  FACTURARE — din "coduri facturare confort.xlsx" (userul, 2026-09-17).
--  DOUĂ tipuri noi, DISTINCTE de necesarul de mai sus:
--    'usa'              — uşa CULISANTĂ întreagă, bandată pe LĂŢIMEA UŞII
--                          (doorWmm) — la fel ca familia "suspendata".
--    'divizare_vanzare'  — bara de divizare, dar bandată pe LĂŢIMEA LIBERĂ
--                          (innerWmm) — DIFERIT de tip='divizare' de mai sus,
--                          care e profilul BRUT (fără bandă, se taie la cotă).
--                          Nu le uni sub acelaşi tip — necesarul (confortLine,
--                          lib/confort/confort.js) caută flat pe (tip, finisaj), fără
--                          bandă; dacă ar exista mai multe rânduri 'divizare'
--                          per finisaj, ar lua PRIMUL găsit, la întâmplare.
--  Benzile din Excel se atingeau exact la graniţă (500-600, 600-700) — corectat
--  aici la +1mm pe banda următoare (500-600, 601-700), ca să respecte convenţia
--  din schema.sql de referinţă ("lipite, fără gol şi fără suprapunere").
--  12 coduri unde coloana Cod nu se potrivea cu textul din Denumire au fost
--  deja corectate de user direct în Excel înainte de acest import.
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('207.025', 'divizare_vanzare', 'ALUMINIU', 500, 600, 'Profil Orizontal De Divizare Alfa Aluminiu 500-600Mm Cod 207.025', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('207.026', 'divizare_vanzare', 'ALUMINIU', 601, 700, 'Profil Orizontal De Divizare Alfa Aluminiu 600-700Mm Cod 207.026', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('207.027', 'divizare_vanzare', 'ALUMINIU', 701, 800, 'Profil Orizontal De Divizare Alfa Aluminiu 700-800Mm Cod 207.027', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('207.028', 'divizare_vanzare', 'ALUMINIU', 801, 900, 'Profil Orizontal De Divizare Alfa Aluminiu 800-900Mm Cod 207.028', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('207.029', 'divizare_vanzare', 'ALUMINIU', 901, 1000, 'Profil Orizontal De Divizare Alfa Aluminiu 900-1000Mm Cod 207.029', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('207.210', 'divizare_vanzare', 'ALUMINIU', 1001, 1100, 'Profil Orizontal De Divizare Alfa Aluminiu 1000-1100Mm Cod 207.210', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('207.211', 'divizare_vanzare', 'ALUMINIU', 1101, 1200, 'Profil Orizontal De Divizare Alfa Aluminiu 1100-1200Mm Cod 207.211', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('207.212', 'divizare_vanzare', 'ALUMINIU', 1201, 1300, 'Profil Orizontal De Divizare Alfa Aluminiu 1200-1300Mm Cod 207.212', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('207.213', 'divizare_vanzare', 'ALUMINIU', 1301, 1400, 'Profil Orizontal De Divizare Alfa Aluminiu 1300-1400Mm Cod 207.213', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('207.214', 'divizare_vanzare', 'ALUMINIU', 1401, 1500, 'Profil Orizontal De Divizare Alfa Aluminiu 1400-1500Mm Cod 207.214', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('207.215', 'divizare_vanzare', 'ALUMINIU', 1501, 2000, 'Profil Orizontal De Divizare Alfa Aluminiu 1500-2000Mm Cod 207.215', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('207.035', 'divizare_vanzare', 'SAMPANIE', 500, 600, 'Profil Orizontal De Divizare Alfa Sampanie 500-600Mm Cod 207.035', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('207.036', 'divizare_vanzare', 'SAMPANIE', 601, 700, 'Profil Orizontal De Divizare Alfa Sampanie 600-700Mm Cod 207.036', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('207.037', 'divizare_vanzare', 'SAMPANIE', 701, 800, 'Profil Orizontal De Divizare Alfa Sampanie 700-800Mm Cod 207.037', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('207.038', 'divizare_vanzare', 'SAMPANIE', 801, 900, 'Profil Orizontal De Divizare Alfa Sampanie 800-900Mm Cod 207.038', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('207.039', 'divizare_vanzare', 'SAMPANIE', 901, 1000, 'Profil Orizontal De Divizare Alfa Sampanie 900-1000Mm Cod 207.039', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('207.310', 'divizare_vanzare', 'SAMPANIE', 1001, 1100, 'Profil Orizontal De Divizare Alfa Sampanie 1000-1100Mm Cod 207.310', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('207.311', 'divizare_vanzare', 'SAMPANIE', 1101, 1200, 'Profil Orizontal De Divizare Alfa Sampanie 1100-1200Mm Cod 207.311', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('207.312', 'divizare_vanzare', 'SAMPANIE', 1201, 1300, 'Profil Orizontal De Divizare Alfa Sampanie 1200-1300Mm Cod 207.312', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('207.313', 'divizare_vanzare', 'SAMPANIE', 1301, 1400, 'Profil Orizontal De Divizare Alfa Sampanie 1300-1400Mm Cod 207.313', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('207.314', 'divizare_vanzare', 'SAMPANIE', 1401, 1500, 'Profil Orizontal De Divizare Alfa Sampanie 1400-1500Mm Cod 207.314', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('207.315', 'divizare_vanzare', 'SAMPANIE', 1501, 2000, 'Profil Orizontal De Divizare Alfa Sampanie 1500-2000Mm Cod 207.315', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('203.025', 'usa', 'ALUMINIU', 500, 600, 'Usa Culisanta Alfa Aluminiu 500-600 Cod 203.025', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('203.026', 'usa', 'ALUMINIU', 601, 700, 'Usa Culisanta Alfa Aluminiu 600-700 Cod 203.026', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('203.027', 'usa', 'ALUMINIU', 701, 800, 'Usa Culisanta Alfa Aluminiu 700-800Mm Cod 203.027', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('203.028', 'usa', 'ALUMINIU', 801, 900, 'Usa Culisanta Alfa Aluminiu 800-900Mm Cod 203.028', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('203.029', 'usa', 'ALUMINIU', 901, 1000, 'Usa Culisanta Alfa Aluminiu 900-1000Mm Cod 203.029', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('203.210', 'usa', 'ALUMINIU', 1001, 1100, 'Usa Culisanta Alfa Aluminiu 1000-1100Mm Cod 203.210', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('203.211', 'usa', 'ALUMINIU', 1101, 1200, 'Usa Culisanta Alfa Aluminiu 1100-1200Mm Cod 203.211', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('203.212', 'usa', 'ALUMINIU', 1201, 1300, 'Usa Culisanta Alfa Aluminiu 1200-1300Mm Cod 203.212', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('203.213', 'usa', 'ALUMINIU', 1301, 1400, 'Usa Culisanta Alfa Aluminiu 1300-1400Mm Cod 203.213', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('203.214', 'usa', 'ALUMINIU', 1401, 1500, 'Usa Culisanta Alfa Aluminiu 1400-1500Mm Cod 203.214', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('203.035', 'usa', 'SAMPANIE', 500, 600, 'Usa Culisanta Alfa Sampanie 500-600Mm Cod 203.035', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('203.036', 'usa', 'SAMPANIE', 601, 700, 'Usa Culisanta Alfa Sampanie 600-700Mm Cod 203.036', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('203.037', 'usa', 'SAMPANIE', 701, 800, 'Usa Culisanta Alfa Sampanie 700-800Mm Cod 203.037', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('203.038', 'usa', 'SAMPANIE', 801, 900, 'Usa Culisanta Alfa Sampanie 800-900Mm Cod 203.038', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('203.039', 'usa', 'SAMPANIE', 901, 1000, 'Usa Culisanta Alfa Sampanie 900-1000Mm Cod 203.039', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('203.310', 'usa', 'SAMPANIE', 1001, 1100, 'Usa Culisanta Alfa Sampanie 1000-1100Mm Cod 203.310', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('203.311', 'usa', 'SAMPANIE', 1101, 1200, 'Usa Culisanta Alfa Sampanie 1100-1200Mm Cod 203.311', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('203.312', 'usa', 'SAMPANIE', 1201, 1300, 'Usa Culisanta Alfa Sampanie 1200-1300Mm Cod 203.312', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('203.313', 'usa', 'SAMPANIE', 1301, 1400, 'Usa Culisanta Alfa Sampanie 1300-1400Mm Cod 203.313', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('203.314', 'usa', 'SAMPANIE', 1401, 1500, 'Usa Culisanta Alfa Sampanie 1400-1500Mm Cod 203.314', 'buc');

-- Divizare H — doar între două panouri de PAL (opţiuni avansate), userul 2026-09-17.
-- Există DOAR în 4 culori (fără AURIU/CUPRU). Aceleaşi coduri la toate modelele.
-- Necesar: bucăţi la cota de debitare (ca divizarea Confort). Facturare: la bară
-- întreagă de 5800mm, rotunjit în sus la jumătate de bară — de-aia um = 'bară'.
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('305', 'divizare H', 'ALUMINIU', 'DIVIZARE H ALUMINIU', 'bară');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('315', 'divizare H', 'SAMPANIE', 'DIVIZARE H SAMPANIE', 'bară');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('324', 'divizare H', 'ALB', 'DIVIZARE H ALB', 'bară');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('334', 'divizare H', 'NEGRU', 'DIVIZARE H NEGRU', 'bară');

-- Divizări APLICATE — benzi lipite pe panourile de PAL/sticlă (nu separă panouri),
-- opţiuni avansate. Bară de 3m, se cumpără la bară întreagă (um 'bară').
-- Denumirile sunt EXACT cum le-a dat userul (2026-09-18). Codurile de CROM LUCIOS
-- (129 / 130) nu sunt aici: Confort nu are finisajul crom.
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('104', 'divizare aplicata 10', 'ALUMINIU', 'Divizare aplicata  10x1,4 mm, finisaj aluminiu 3 m cod 104', 'bară');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('118', 'divizare aplicata 10', 'SAMPANIE', 'Divizare aplicata 10x1,4 mm, finisaj sampanie luciosa 3 m cod 118', 'bară');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('138', 'divizare aplicata 10', 'ALB',      'Divizare aplicata 10x1,4 mm, finisaj alb mat 3 m cod 138', 'bară');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('149', 'divizare aplicata 10', 'NEGRU',    'Divizare aplicata 10x1,4 mm, finisaj negru mat 3 m cod 149', 'bară');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('156', 'divizare aplicata 10', 'AURIU',    'Divizare aplicata 10x1,4 mm, finisaj auriu periat 3 m cod 156', 'bară');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('182', 'divizare aplicata 10', 'CUPRU',    'Divizare aplicata  10x1,4 mm, finisaj cupru 3 m cod 182', 'bară');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('105', 'divizare aplicata 20', 'ALUMINIU', 'Divizare aplicata 20x1,4 mm, finisaj aluminiu 3 m cod 105', 'bară');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('119', 'divizare aplicata 20', 'SAMPANIE', 'Divizare aplicata 20x1,4 mm, finisaj sampanie lucioasa 3 m cod 119', 'bară');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('139', 'divizare aplicata 20', 'ALB',      'Divizare aplicata 20x1,4 mm, alb mat 3 m cod 139', 'bară');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('150', 'divizare aplicata 20', 'NEGRU',    'Divizare aplicata 20x1,4 mm, finisaj negru mat 3 m cod 150', 'bară');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('157', 'divizare aplicata 20', 'AURIU',    'Divizare aplicata 20x1,4 mm, finisaj auriu periat 3 m cod 157', 'bară');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('183', 'divizare aplicata 20', 'CUPRU',    'Divizare aplicata  20x1,4 mm, finisaj cupru 3 m cod 183', 'bară');

-- Şină SIMPLĂ (1 uşă, sau 2 uşi cu 0 suprapuneri) — în loc de şina dublă. Bară de
-- 5,8m, se vinde întreagă sau la jumătate. Denumiri EXACT ca de la user (2026-09-18).
-- Doar 4 culori (fără AURIU / CUPRU).
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('222', 'sina superioara simpla', 'SAMPANIE', 'Sina superioara simpla Confort finisaj sampanie 5,8 m cod 222');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('242', 'sina superioara simpla', 'ALB',      'Sina superioara simpla Confort/Lux finisaj alb mat 5,8 m cod 242');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('202', 'sina superioara simpla', 'ALUMINIU', 'Sina superioara simpla Confort/Lux finisaj aluminiu  5,8 m cod 202');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('252', 'sina superioara simpla', 'NEGRU',    'Sina superioara simpla Confort/Lux finisaj negru periat 5,8 m cod 252');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('223', 'sina inferioara simpla', 'SAMPANIE', 'Sina inferioara simpla Confort finisaj sampanie 5,8 m cod 223');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('243', 'sina inferioara simpla', 'ALB',      'Sina inferioara simpla Confort/Lux finisaj alb mat 5,8 m cod 243');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('203', 'sina inferioara simpla', 'ALUMINIU', 'Sina inferioara simpla Confort/Lux finisaj aluminiu 5,8 m cod 203');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('253', 'sina inferioara simpla', 'NEGRU',    'Sina inferioara simpla Confort/Lux finisaj negru periat 5,8 m cod 253');
