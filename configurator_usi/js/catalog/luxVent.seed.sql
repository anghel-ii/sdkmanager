-- ═══════════════════════════════════════════════════════════════════════════
--  Catalog 'luxVent' (gama LUX, model VENT) — generat din „baza de date
--  completa.xlsx" (export NeoManager), denumirile VERBATIM; codurile profilelor din
--  „Calculator profile LUX 2025.xlsx" (verificate în NeoManager, 2026-10-05).
--    'usa'  — uşa culisantă întreagă (V301.xxx), pe LĂŢIMEA UŞII (doorWmm), ca la Confort
--    'rama' — rama pt. uşile cu sticlă (R300.xxx), tot pe lăţimea uşii, fără culoare
--  CUPRU (doar Vent): uşa fără şine (290/291 se facturează separat), max 1500 mm, fără divizare T.
--  Ultima bandă (…15) e 1501–2000 mm: în NeoManager câteva denumiri zic altfel
--  („1501-1600" la Vent alb / negru, „1401-1500" la R300.015) — de confirmat.
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

INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('200', 'sina superioara', 'ALUMINIU', NULL, NULL, 'Sina superioara dubla Confort/Lux finisaj aluminiu  5,8 m cod 200', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('110', 'sina superioara', 'SAMPANIE', NULL, NULL, 'Sina dubla superioara, finisaj sampanie lucioasa 5,8 m cod 110', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('121', 'sina superioara', 'CROM', NULL, NULL, 'Sina dubla superioara, finisaj crom lucios 5,8 m cod 121', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('240', 'sina superioara', 'ALB', NULL, NULL, 'Sina superioara dubla Confort/Lux finisaj alb mat  5,8 m cod 240', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('250', 'sina superioara', 'NEGRU', NULL, NULL, 'Sina superioara dubla Confort/Lux finisaj negru periat 5,8 m cod 250', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('260', 'sina superioara', 'AURIU', NULL, NULL, 'Sina superioara dubla Confort/Lux finisaj auriu periat 5,8 m cod 260', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('290', 'sina superioara', 'CUPRU', NULL, NULL, 'Sina superioara dubla Confort/Lux finisaj cupru 3.5 m cod 290', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201', 'sina inferioara', 'ALUMINIU', NULL, NULL, 'Sina inferioara dubla Confort/Lux finisaj aluminiu 5,8 m cod 201', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('111', 'sina inferioara', 'SAMPANIE', NULL, NULL, 'Sina dubla inferioara, finisaj sampanie lucioasa 5,8 m cod 111', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('122', 'sina inferioara', 'CROM', NULL, NULL, 'Sina dubla inferioara, finisaj crom lucios 5,8 m cod 122', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('241', 'sina inferioara', 'ALB', NULL, NULL, 'Sina inferioara dubla Confort/Lux finisaj alb mat 5,8 m cod 241', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('251', 'sina inferioara', 'NEGRU', NULL, NULL, 'Sina inferioara dubla Confort/Lux finisaj negru periat 5,8 m cod 251', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('261', 'sina inferioara', 'AURIU', NULL, NULL, 'Sina inferioara dubla Confort/Lux finisaj auriu periat 5,8 m cod 261', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('291', 'sina inferioara', 'CUPRU', NULL, NULL, 'Sina inferioara dubla Confort/Lux finisaj cupru 3,5 m cod 291', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('102', 'orizontal', 'ALUMINIU', NULL, NULL, 'Orizontal superior/inferior ''''L'''' 18x5 mm  finisaj aluminiu 3 m cod 102', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('116', 'orizontal', 'SAMPANIE', NULL, NULL, 'Orizontal superior/inferior ''''L'''' 18x5 mm  finisaj sampanie lucioasa 3 m cod 116', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('127', 'orizontal', 'CROM', NULL, NULL, 'Orizontal superior/inferior ''''L'''' 18x5 mm finisaj crom lucios 3 m cod 127', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('136', 'orizontal', 'ALB', NULL, NULL, 'Orizontal superior/inferior ''''L'''' 18x5 mm  finisaj alb mat  3 m cod 136', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('147', 'orizontal', 'NEGRU', NULL, NULL, 'Orizontal superior/inferior ''''L'''' 18x5 mm  finisaj negru mat 3 m cod 147', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('154', 'orizontal', 'AURIU', NULL, NULL, 'Orizontal superior/inferior ''''L'''' 18x5 mm, finisaj auriu periat 3 m cod 154', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('181', 'orizontal', 'CUPRU', NULL, NULL, 'Orizontal superior/inferior ''''L'''' 18x5 mm  finisaj cupru 3 m cod 181', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('103', 'divizare', 'ALUMINIU', NULL, NULL, 'Divizare ''''T'''' latime 5 mm finisaj aluminiu 3 m cod 103', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('117', 'divizare', 'SAMPANIE', NULL, NULL, 'Divizare ''''T'''' latime 5 mm finisaj sampanie luciosa 3 m cod 117', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('128', 'divizare', 'CROM', NULL, NULL, 'Divizare ''''T'''' latime 5 mm finisaj crom lucios 3 m cod 128', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('137', 'divizare', 'ALB', NULL, NULL, 'Divizare ''''T'''' latime 5 mm finisaj alb mat  3 m cod 137', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('148', 'divizare', 'NEGRU', NULL, NULL, 'Divizare ''''T'''' latime 5 mm finisaj negru mat 3 m cod 148', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('155', 'divizare', 'AURIU', NULL, NULL, 'Divizare ''''T'''' latime 5 mm finisaj auriu periat 3 m cod 155', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('104', 'divizare aplicata 10', 'ALUMINIU', NULL, NULL, 'Divizare aplicata  10x1,4 mm, finisaj aluminiu 3 m cod 104', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('118', 'divizare aplicata 10', 'SAMPANIE', NULL, NULL, 'Divizare aplicata 10x1,4 mm, finisaj sampanie luciosa 3 m cod 118', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('129', 'divizare aplicata 10', 'CROM', NULL, NULL, 'Divizare aplicata  10x1,4 mm, finisaj crom lucios 3 m cod 129', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('138', 'divizare aplicata 10', 'ALB', NULL, NULL, 'Divizare aplicata 10x1,4 mm, finisaj alb mat 3 m cod 138', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('149', 'divizare aplicata 10', 'NEGRU', NULL, NULL, 'Divizare aplicata 10x1,4 mm, finisaj negru mat 3 m cod 149', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('156', 'divizare aplicata 10', 'AURIU', NULL, NULL, 'Divizare aplicata 10x1,4 mm, finisaj auriu periat 3 m cod 156', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('182', 'divizare aplicata 10', 'CUPRU', NULL, NULL, 'Divizare aplicata  10x1,4 mm, finisaj cupru 3 m cod 182', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('105', 'divizare aplicata 20', 'ALUMINIU', NULL, NULL, 'Divizare aplicata 20x1,4 mm, finisaj aluminiu 3 m cod 105 cod 105', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('119', 'divizare aplicata 20', 'SAMPANIE', NULL, NULL, 'Divizare aplicata 20x1,4 mm, finisaj sampanie lucioasa 3 m cod 119', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('130', 'divizare aplicata 20', 'CROM', NULL, NULL, 'Divizare aplicata  20x1,4 mm, finisaj crom lucios 3 m cod 130', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('139', 'divizare aplicata 20', 'ALB', NULL, NULL, 'Divizare aplicata 20x1,4 mm, alb mat 3 m cod 139', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('150', 'divizare aplicata 20', 'NEGRU', NULL, NULL, 'Divizare aplicata 20x1,4 mm, finisaj negru mat 3 m cod 150', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('157', 'divizare aplicata 20', 'AURIU', NULL, NULL, 'Divizare aplicata 20x1,4 mm, finisaj auriu periat 3 m cod 157', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('183', 'divizare aplicata 20', 'CUPRU', NULL, NULL, 'Divizare aplicata  20x1,4 mm, finisaj cupru 3 m cod 183', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('100', 'vertical', 'ALUMINIU', NULL, NULL, 'Profil maner Vent  finisaj aluminiu 5,5 m cod 100 cod 100', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('114', 'vertical', 'SAMPANIE', NULL, NULL, 'Profil maner Vent  finisaj sampanie luciosa 5,5 m cod 114', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('125', 'vertical', 'CROM', NULL, NULL, 'Profil maner Vent  finisaj crom lucios 5,5 m cod 125', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('134', 'vertical', 'ALB', NULL, NULL, 'Profil maner Vent  finisaj alb mat 5,5 m cod 134', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('145', 'vertical', 'NEGRU', NULL, NULL, 'Profil maner Vent  finisaj negru mat 5,5 m cod 145', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('153', 'vertical', 'AURIU', NULL, NULL, 'Profil maner Vent finisaj auriu periat 5,5 m cod 153', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('180', 'vertical', 'CUPRU', NULL, NULL, 'Profil maner Vent  finisaj cupru 3 m cod 180', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.005', 'usa', 'ALUMINIU', 501, 600, 'Usa culisanta Vent Aluminiu 501-600mm Cod V301.005', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.006', 'usa', 'ALUMINIU', 601, 700, 'Usa culisanta Vent Aluminiu 601-700mm Cod V301.006', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.007', 'usa', 'ALUMINIU', 701, 800, 'Usa culisanta Vent Aluminiu 701-800mm Cod V301.007', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.008', 'usa', 'ALUMINIU', 801, 900, 'Usa culisanta Vent Aluminiu 801-900mm Cod V301.008', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.009', 'usa', 'ALUMINIU', 901, 1000, 'Usa culisanta Vent Aluminiu 901-1000mm Cod V301.009', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.010', 'usa', 'ALUMINIU', 1001, 1100, 'Usa culisanta Vent Aluminiu 1001-1100mm Cod V301.010', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.011', 'usa', 'ALUMINIU', 1101, 1200, 'Usa culisanta Vent Aluminiu 1101-1200mm Cod V301.011', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.012', 'usa', 'ALUMINIU', 1201, 1300, 'Usa culisanta Vent Aluminiu 1201-1300mm Cod V301.012', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.013', 'usa', 'ALUMINIU', 1301, 1400, 'Usa culisanta Vent Aluminiu 1301-1400mm Cod V301.013', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.014', 'usa', 'ALUMINIU', 1401, 1500, 'Usa culisanta Vent Aluminiu 1401-1500mm Cod V301.014', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.015', 'usa', 'ALUMINIU', 1501, 2000, 'Usa culisanta Vent aluminiu 1500-2000mm cod V301.015', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.025', 'usa', 'SAMPANIE', 501, 600, 'Usa culisanta Vent Sampanie lucios 501-600mm Cod V301.015', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.026', 'usa', 'SAMPANIE', 601, 700, 'Usa culisanta Vent Sampanie lucios 601-700mm Cod V301.026', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.027', 'usa', 'SAMPANIE', 701, 800, 'Usa culisanta Vent Sampanie lucios 701-800mm Cod V301.027', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.028', 'usa', 'SAMPANIE', 801, 900, 'Usa culisanta Vent Sampanie lucios 801-900mm Cod V301.028', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.029', 'usa', 'SAMPANIE', 901, 1000, 'Usa culisanta Vent Sampanie lucios 901-100mm Cod V301.029', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.210', 'usa', 'SAMPANIE', 1001, 1100, 'Usa culisanta Vent Sampanie lucios 1001-1100mm Cod V301.210', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.211', 'usa', 'SAMPANIE', 1101, 1200, 'Usa culisanta Vent Sampanie lucios 1101-1200mm Cod V301.211', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.212', 'usa', 'SAMPANIE', 1201, 1300, 'Usa culisanta Vent Sampanie lucios 1201-1300mm Cod V301.212', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.213', 'usa', 'SAMPANIE', 1301, 1400, 'Usa culisanta Vent Sampanie lucios 1301-1400mm Cod V301.213', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.214', 'usa', 'SAMPANIE', 1401, 1500, 'Usa culisanta Vent Sampanie lucios 1401-1500mm Cod V301.214', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.215', 'usa', 'SAMPANIE', 1501, 2000, 'Usa culisanta Vent sampanie lucios 1500-2000mm cod V301.215', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.035', 'usa', 'CROM', 501, 600, 'Usa culisanta Vent Crom lucios 501-600mm Cod V301.035', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.036', 'usa', 'CROM', 601, 700, 'Usa culisanta Vent Crom lucios 601-700Mm Cod V301.036', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.037', 'usa', 'CROM', 701, 800, 'Usa culisanta Vent Crom lucios 701-800mm Cod V301.037', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.038', 'usa', 'CROM', 801, 900, 'Usa culisanta Vent Crom lucios 801-900mm Cod V301.038', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.039', 'usa', 'CROM', 901, 1000, 'Usa culisanta Vent Crom lucios 901-1000mm Cod V301.039', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.310', 'usa', 'CROM', 1001, 1100, 'Usa culisanta Vent Crom lucios 1001-1100mm Cod 301.310', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.311', 'usa', 'CROM', 1101, 1200, 'Usa culisanta Vent Crom lucios 1101-1200mm  Cod V301.311', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.312', 'usa', 'CROM', 1201, 1300, 'Usa culisanta Vent Crom lucios 1201-1300mm Cod V301.312', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.313', 'usa', 'CROM', 1301, 1400, 'Usa culisanta Vent Crom lucios 1301-1400mm Cod V301.313', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.314', 'usa', 'CROM', 1401, 1500, 'Usa culisanta Vent Crom lucios 1401-1500mm Cod V301.314', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.315', 'usa', 'CROM', 1501, 2000, 'Usa culisanta Vent Crom lucios 1500-2000mm cod V301.315', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.055', 'usa', 'ALB', 501, 600, 'Usa culisanta Vent Alb 501-600mm Cod V301.055', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.056', 'usa', 'ALB', 601, 700, 'Usa culisanta Vent Alb 601-700mm Cod V301.056', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.057', 'usa', 'ALB', 701, 800, 'Usa culisanta Vent Alb 701-800mm Cod V301.057', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.058', 'usa', 'ALB', 801, 900, 'Usa culisanta Vent Alb 801-900mm Cod V301.058', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.059', 'usa', 'ALB', 901, 1000, 'Usa culisanta Vent Alb 901-1000mm Cod V301.059', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.510', 'usa', 'ALB', 1001, 1100, 'Usa culisanta Vent Alb 1001-1100mm Cod V301.510', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.511', 'usa', 'ALB', 1101, 1200, 'Usa culisanta Vent Alb 1101-1200mm Cod V301.511', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.512', 'usa', 'ALB', 1201, 1300, 'Usa culisanta Vent Alb 1201-1300mm Cod V301.512', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.513', 'usa', 'ALB', 1301, 1400, 'Usa culisanta Vent Alb 1301-1400mm Cod V301.513', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.514', 'usa', 'ALB', 1401, 1500, 'Usa culisanta Vent Alb 1401-1500mm Cod V301.514', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.515', 'usa', 'ALB', 1501, 2000, 'Usa culisanta Vent Alb 1501-1600mm Cod V301.515', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.045', 'usa', 'NEGRU', 501, 600, 'Usa culisanta Vent Negru 501-600mm Cod V301.045', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.046', 'usa', 'NEGRU', 601, 700, 'Usa culisanta Vent Negru 601-700mm Cod V301.046', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.047', 'usa', 'NEGRU', 701, 800, 'Usa culisanta Vent Negru 701-800mm Cod V301.047', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.048', 'usa', 'NEGRU', 801, 900, 'Usa culisanta Vent Negru 801-900mm Cod V301.048', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.049', 'usa', 'NEGRU', 901, 1000, 'Usa culisanta Vent Negru 901-1000mm Cod V301.049', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.410', 'usa', 'NEGRU', 1001, 1100, 'Usa culisanta Vent Negru 1001-1100mm Cod V301.410', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.411', 'usa', 'NEGRU', 1101, 1200, 'Usa culisanta Vent Negru 1101-1200mm Cod V301.411', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.412', 'usa', 'NEGRU', 1201, 1300, 'Usa culisanta Vent Negru 1201-1300mm Cod V301.412', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.413', 'usa', 'NEGRU', 1301, 1400, 'Usa culisanta Vent Negru 1301-1400mm Cod V301.413', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.414', 'usa', 'NEGRU', 1401, 1500, 'Usa culisanta Vent Negru 1401-1500mm Cod V301.414', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.415', 'usa', 'NEGRU', 1501, 2000, 'Usa culisanta Vent Negru 1501-1600mm Cod V301.415', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.065', 'usa', 'AURIU', 501, 600, 'Usa culisanta Vent Auriu periat 501-600mm cod V301.065', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.066', 'usa', 'AURIU', 601, 700, 'Usa culisanta Vent Auriu periat 601-700mm cod V301.066', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.067', 'usa', 'AURIU', 701, 800, 'Usa culisanta Vent Auriu periat 701-800mm cod V301.067', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.068', 'usa', 'AURIU', 801, 900, 'Usa culisanta Vent Auriu periat 801-900mm cod V301.068', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.069', 'usa', 'AURIU', 901, 1000, 'Usa culisanta Vent Auriu periat 901-1000mm cod V301.069', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.610', 'usa', 'AURIU', 1001, 1100, 'Usa culisanta Vent Auriu periat 1001-1100mm cod V301.610', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.611', 'usa', 'AURIU', 1101, 1200, 'Usa culisanta Vent Auriu periat 1101-1200mm cod V301.611', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.612', 'usa', 'AURIU', 1201, 1300, 'Usa culisanta Vent Auriu periat 1201-1300mm cod V301.612', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.613', 'usa', 'AURIU', 1301, 1400, 'Usa culisanta Vent Auriu periat 1301-1400mm cod V301.613', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.614', 'usa', 'AURIU', 1401, 1500, 'Usa culisanta Vent Auriu periat 1401-1500mm cod V301.614', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.615', 'usa', 'AURIU', 1501, 2000, 'Usa culisanta Vent Auriu periat 1501-2000mm cod V301.615', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.075', 'usa', 'CUPRU', 501, 600, 'Usa culisanta Vent Cupru 501-600mm cod V301.075  (fara sine de culisare)', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.076', 'usa', 'CUPRU', 601, 700, 'Usa culisanta Vent Cupru 601-700mm cod V301.076 (fara sine de culisare)', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.077', 'usa', 'CUPRU', 701, 800, 'Usa culisanta Vent Cupru 701-800mm cod V301.077 (fara sine de culisare)', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.078', 'usa', 'CUPRU', 801, 900, 'Usa culisanta Vent Cupru 801-900mm cod V301.078 (fara sine de culisare)', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.079', 'usa', 'CUPRU', 901, 1000, 'Usa culisanta Vent Cupru 901-1000mm cod V301.079 (fara sine de culisare)', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.710', 'usa', 'CUPRU', 1001, 1100, 'Usa culisanta Vent Cupru 1001-1100mm cod V301.710 (fara sine de culisare)', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.711', 'usa', 'CUPRU', 1101, 1200, 'Usa culisanta Vent Cupru 1101-1200mm cod V301.711 (fara sine de culisare)', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.712', 'usa', 'CUPRU', 1201, 1300, 'Usa culisanta Vent Cupru 1201-1300mm cod V301.712 (fara sine de culisare)', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.713', 'usa', 'CUPRU', 1301, 1400, 'Usa culisanta Vent Cupru 1301-1400mm cod V301.713 (fara sine de culisare)', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('V301.714', 'usa', 'CUPRU', 1401, 1500, 'Usa culisanta Vent Cupru 1401-1500mm cod V301.714 (fara sine de culisare)', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('R300.005', 'rama', NULL, 501, 600, 'Rame pt usi cu sticla la gama Lux 501-600mm Cod R300.005', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('R300.006', 'rama', NULL, 601, 700, 'Rame pt usi cu sticla la gama Lux 601-700Mm Cod R300.006', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('R300.007', 'rama', NULL, 701, 800, 'Rame pt usi cu sticla la gama Lux 701-800mm Cod R300.007', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('R300.008', 'rama', NULL, 801, 900, 'Rame pt usi cu sticla la gama Lux 801-900mm Cod R300.008', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('R300.009', 'rama', NULL, 901, 1000, 'Rame pt usi cu sticla la gama Lux 901-1000mm Cod R300.009', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('R300.010', 'rama', NULL, 1001, 1100, 'Rame pt usi cu sticla la gama Lux 1001-1100mm Cod R300.010', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('R300.011', 'rama', NULL, 1101, 1200, 'Rame pt usi cu sticla la gama Lux 1101-1200mm Cod R300.011', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('R300.012', 'rama', NULL, 1201, 1300, 'Rame pt usi cu sticla la gama Lux 1201-1300mm Cod R300.012', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('R300.013', 'rama', NULL, 1301, 1400, 'Rame pt usi cu sticla la gama Lux 1301-1400mm Cod R300.013', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('R300.014', 'rama', NULL, 1401, 1500, 'Rame pt usi cu sticla la gama Lux 1401-1500Mm Cod R300.014', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('R300.015', 'rama', NULL, 1501, 2000, 'Rame pt usi cu sticla la gama Lux 1401-1500Mm Cod R300.015', 'buc');
