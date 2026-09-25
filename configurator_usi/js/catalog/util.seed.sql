-- ═══════════════════════════════════════════════════════════════════════════
--  Catalog familia 'util' (profile UTIL: Atena, Roma, Soft) — din
--  "Calculator profile UTIL 15.09.xlsm", foaia ascunsă Sheet1 (A:D şi F:G).
--  Şina şi orizontalele/divizarea sunt comune celor 3 modele (acelaşi cod);
--  profilul mâner vertical diferă pe model → tip 'maner vertical <MODEL>'.
--  Accesoriile nu depind de culoare (finisaj NULL).
--  Denumirile şi UM: VERBATIM din „baza de date completa.xlsx" (export NeoManager,
--  2026-09-24), inclusiv spaţiile duble.
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

INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('300', 'sina superioara', 'ALUMINIU', 'Sina superioara dubla Util finisaj aluminiu  5,8 m cod 300', 'buc');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('301', 'sina inferioara', 'ALUMINIU', 'Sina inferioara dubla Util finisaj aluminiu 5,8 m cod 301', 'buc');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('302', 'maner vertical ATENA', 'ALUMINIU', 'Profil maner Atena finisaj aluminiu 5,5 m cod 302', 'buc');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('306', 'orizontal U', 'ALUMINIU', 'Orizontal sus/jos ''''U'''' finisaj aluminiu 5,8m cod 306', 'buc');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('305', 'divizare H', 'ALUMINIU', 'Divizare ''''H'''' inegal finisaj aluminiu  5,8 m cod 305', 'buc');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('310', 'sina superioara', 'SAMPANIE', 'Sina superioara dubla Util finisaj sampanie  5,8 m cod 310', 'buc');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('311', 'sina inferioara', 'SAMPANIE', 'Sina inferioara dubla Util finisaj sampanie 5,8 m cod 311', 'buc');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('312', 'maner vertical ATENA', 'SAMPANIE', 'Profil maner Atena  finisaj sampanie 5,5 m cod 312', 'buc');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('316', 'orizontal U', 'SAMPANIE', 'Orizontal sus/jos ''''U'''' finisaj sampanie 5,8m cod 316', 'buc');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('315', 'divizare H', 'SAMPANIE', 'Divizare ''''H'''' finisaj sampanie 5,8 m cod 315', 'buc');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('320', 'sina superioara', 'ALB MAT', 'Sina superioara dubla Util finisaj alb mat 5,8 m cod 320', 'buc');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('321', 'sina inferioara', 'ALB MAT', 'Sina inferioara dubla Util finisaj alb mat 5,8 m cod 321', 'buc');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('322', 'maner vertical ATENA', 'ALB MAT', 'Profil maner Atena  finisaj alb mat 5,5 m cod 322', 'buc');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('325', 'orizontal U', 'ALB MAT', 'Orizontal sus/jos ''''U'''' finisaj alb mat  5,8m cod 325', 'buc');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('324', 'divizare H', 'ALB MAT', 'Divizare ''''H'''' finisaj alb mat  5,8 m cod 324', 'buc');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('330', 'sina superioara', 'NEGRU MAT', 'Sina superioara dubla Util finisaj negru periat 5,8m cod 330', 'buc');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('331', 'sina inferioara', 'NEGRU MAT', 'Sina inferioara dubla Util finisaj negru periat 5,8 m cod 331', 'buc');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('332', 'maner vertical ATENA', 'NEGRU MAT', 'Profil maner Atena finisaj negru periat 5,5 m cod 332', 'buc');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('335', 'orizontal U', 'NEGRU MAT', 'Orizontal sus/jos ''''U'''' finisaj negru periat 5,8m cod 335', 'buc');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('334', 'divizare H', 'NEGRU MAT', 'Divizare ''''H'''' finisaj negru periat  5,8 m cod 334', 'buc');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('303', 'maner vertical ROMA', 'ALUMINIU', 'Profil maner Roma finisaj aluminiu 5,5 m cod 303', 'buc');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('313', 'maner vertical ROMA', 'SAMPANIE', 'Profil maner Roma finisaj sampanie 5,5 m cod 313', 'buc');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('323', 'maner vertical ROMA', 'ALB MAT', 'Profil maner Roma finisaj alb mat 5,5 m cod 323', 'buc');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('333', 'maner vertical ROMA', 'NEGRU MAT', 'Profil maner Roma finisaj negru periat 5,5 m cod 333', 'buc');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('304', 'maner vertical SOFT', 'ALUMINIU', 'Profil maner Soft finisaj aluminiu 5,5 m cod 304', 'buc');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('314', 'maner vertical SOFT', 'SAMPANIE', 'Profil maner Soft finisaj sampanie 5,5 m cod 314', 'buc');

INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('344', 'rotile inferioare', NULL, 'Rotila inferioara  K12 cod 344', 'buc');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('345', 'rotile superioare', NULL, 'Rotila superioara  K11 cod 345', 'buc');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('342', 'perie laterala', NULL, 'Perie laterala 9x5 mm cod 342', 'ml');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('343', 'perie spate', NULL, 'Perie spate antipraf 7x10 mm cod 343', 'ml');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('340', 'opritor', NULL, 'Opritor in sina inferioara cod 340', 'buc');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('341', 'amortizare', NULL, 'Amortizare pentru 35 kg la set pentru gama Util cod 341', 'set');

-- Divizări aplicate (benzi 10 / 20 mm, bară de 3 m) — aceleaşi coduri ca la Confort.
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('104', 'divizare aplicata 10', 'ALUMINIU', 'Divizare aplicata  10x1,4 mm, finisaj aluminiu 3 m cod 104', 'buc');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('105', 'divizare aplicata 20', 'ALUMINIU', 'Divizare aplicata 20x1,4 mm, finisaj aluminiu 3 m cod 105 cod 105', 'buc');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('118', 'divizare aplicata 10', 'SAMPANIE', 'Divizare aplicata 10x1,4 mm, finisaj sampanie luciosa 3 m cod 118', 'buc');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('119', 'divizare aplicata 20', 'SAMPANIE', 'Divizare aplicata 20x1,4 mm, finisaj sampanie lucioasa 3 m cod 119', 'buc');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('138', 'divizare aplicata 10', 'ALB MAT', 'Divizare aplicata 10x1,4 mm, finisaj alb mat 3 m cod 138', 'buc');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('139', 'divizare aplicata 20', 'ALB MAT', 'Divizare aplicata 20x1,4 mm, alb mat 3 m cod 139', 'buc');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('149', 'divizare aplicata 10', 'NEGRU MAT', 'Divizare aplicata 10x1,4 mm, finisaj negru mat 3 m cod 149', 'buc');
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('150', 'divizare aplicata 20', 'NEGRU MAT', 'Divizare aplicata 20x1,4 mm, finisaj negru mat 3 m cod 150', 'buc');

-- Manoperă asamblare — o bucată pe uşă asamblată de noi (ca la suspendate / Confort).
INSERT INTO articol (cod, tip, finisaj, denumire, um) VALUES ('Manopera 1', 'manopera', NULL, 'Manopera 1', 'buc');
