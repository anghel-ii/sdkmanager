-- ═══════════════════════════════════════════════════════════════════════════
--  Catalog 'luxBreda' (gama LUX, model BREDA) — generat din „baza de date
--  completa.xlsx" (export NeoManager), denumirile VERBATIM; codurile profilelor din
--  „Calculator profile LUX 2025.xlsx" (verificate în NeoManager, 2026-10-05).
--    'usa'  — uşa culisantă întreagă (B302.xxx), pe LĂŢIMEA UŞII (doorWmm), ca la Confort
--    'rama' — rama pt. uşile cu sticlă (R300.xxx), tot pe lăţimea uşii, fără culoare
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
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201', 'sina inferioara', 'ALUMINIU', NULL, NULL, 'Sina inferioara dubla Confort/Lux finisaj aluminiu 5,8 m cod 201', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('111', 'sina inferioara', 'SAMPANIE', NULL, NULL, 'Sina dubla inferioara, finisaj sampanie lucioasa 5,8 m cod 111', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('122', 'sina inferioara', 'CROM', NULL, NULL, 'Sina dubla inferioara, finisaj crom lucios 5,8 m cod 122', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('241', 'sina inferioara', 'ALB', NULL, NULL, 'Sina inferioara dubla Confort/Lux finisaj alb mat 5,8 m cod 241', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('251', 'sina inferioara', 'NEGRU', NULL, NULL, 'Sina inferioara dubla Confort/Lux finisaj negru periat 5,8 m cod 251', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('102', 'orizontal', 'ALUMINIU', NULL, NULL, 'Orizontal superior/inferior ''''L'''' 18x5 mm  finisaj aluminiu 3 m cod 102', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('116', 'orizontal', 'SAMPANIE', NULL, NULL, 'Orizontal superior/inferior ''''L'''' 18x5 mm  finisaj sampanie lucioasa 3 m cod 116', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('127', 'orizontal', 'CROM', NULL, NULL, 'Orizontal superior/inferior ''''L'''' 18x5 mm finisaj crom lucios 3 m cod 127', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('136', 'orizontal', 'ALB', NULL, NULL, 'Orizontal superior/inferior ''''L'''' 18x5 mm  finisaj alb mat  3 m cod 136', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('147', 'orizontal', 'NEGRU', NULL, NULL, 'Orizontal superior/inferior ''''L'''' 18x5 mm  finisaj negru mat 3 m cod 147', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('103', 'divizare', 'ALUMINIU', NULL, NULL, 'Divizare ''''T'''' latime 5 mm finisaj aluminiu 3 m cod 103', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('117', 'divizare', 'SAMPANIE', NULL, NULL, 'Divizare ''''T'''' latime 5 mm finisaj sampanie luciosa 3 m cod 117', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('128', 'divizare', 'CROM', NULL, NULL, 'Divizare ''''T'''' latime 5 mm finisaj crom lucios 3 m cod 128', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('137', 'divizare', 'ALB', NULL, NULL, 'Divizare ''''T'''' latime 5 mm finisaj alb mat  3 m cod 137', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('148', 'divizare', 'NEGRU', NULL, NULL, 'Divizare ''''T'''' latime 5 mm finisaj negru mat 3 m cod 148', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('104', 'divizare aplicata 10', 'ALUMINIU', NULL, NULL, 'Divizare aplicata  10x1,4 mm, finisaj aluminiu 3 m cod 104', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('118', 'divizare aplicata 10', 'SAMPANIE', NULL, NULL, 'Divizare aplicata 10x1,4 mm, finisaj sampanie luciosa 3 m cod 118', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('129', 'divizare aplicata 10', 'CROM', NULL, NULL, 'Divizare aplicata  10x1,4 mm, finisaj crom lucios 3 m cod 129', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('138', 'divizare aplicata 10', 'ALB', NULL, NULL, 'Divizare aplicata 10x1,4 mm, finisaj alb mat 3 m cod 138', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('149', 'divizare aplicata 10', 'NEGRU', NULL, NULL, 'Divizare aplicata 10x1,4 mm, finisaj negru mat 3 m cod 149', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('105', 'divizare aplicata 20', 'ALUMINIU', NULL, NULL, 'Divizare aplicata 20x1,4 mm, finisaj aluminiu 3 m cod 105 cod 105', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('119', 'divizare aplicata 20', 'SAMPANIE', NULL, NULL, 'Divizare aplicata 20x1,4 mm, finisaj sampanie lucioasa 3 m cod 119', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('130', 'divizare aplicata 20', 'CROM', NULL, NULL, 'Divizare aplicata  20x1,4 mm, finisaj crom lucios 3 m cod 130', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('139', 'divizare aplicata 20', 'ALB', NULL, NULL, 'Divizare aplicata 20x1,4 mm, alb mat 3 m cod 139', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('150', 'divizare aplicata 20', 'NEGRU', NULL, NULL, 'Divizare aplicata 20x1,4 mm, finisaj negru mat 3 m cod 150', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('101', 'vertical', 'ALUMINIU', NULL, NULL, 'Profil maner Breda finisaj aluminiu 5,5 m cod 101 cod 101', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('115', 'vertical', 'SAMPANIE', NULL, NULL, 'Profil maner Breda finisaj sampanie luciosa 5,5 m cod 115', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('126', 'vertical', 'CROM', NULL, NULL, 'Profil maner Breda finisaj crom lucios 5,5 m cod 126', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('135', 'vertical', 'ALB', NULL, NULL, 'Profil maner Breda finisaj alb mat 5,5 m cod 135', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('146', 'vertical', 'NEGRU', NULL, NULL, 'Profil maner Breda finisaj negru mat 5,5 m cod 146', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.005', 'usa', 'ALUMINIU', 501, 600, 'Usa culisanta Breda Aluminiu 501-600mm Cod B302.005', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.006', 'usa', 'ALUMINIU', 601, 700, 'Usa culisanta Breda Aluminiu 601-700mm Cod B302.006', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.007', 'usa', 'ALUMINIU', 701, 800, 'Usa culisanta Breda Aluminiu 701-800mm Cod B302.007', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.008', 'usa', 'ALUMINIU', 801, 900, 'Usa culisanta Breda Aluminiu 801-900mm Cod B302.008', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.009', 'usa', 'ALUMINIU', 901, 1000, 'Usa culisanta Breda Aluminiu 901-1000mm Cod B302.009', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.010', 'usa', 'ALUMINIU', 1001, 1100, 'Usa culisanta Breda Aluminiu 1001-1100mm Cod B302.010', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.011', 'usa', 'ALUMINIU', 1101, 1200, 'Usa culisanta Breda Aluminiu 1101-1200mm Cod B302.011', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.012', 'usa', 'ALUMINIU', 1201, 1300, 'Usa culisanta Breda Aluminiu 1201-1300Mm Cod B302.012', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.013', 'usa', 'ALUMINIU', 1301, 1400, 'Usa culisanta Breda Aluminiu 1301-1400mm Cod B302.013', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.014', 'usa', 'ALUMINIU', 1401, 1500, 'Usa culisanta Breda Aluminiu 1401-1500mm Cod B302.014', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.015', 'usa', 'ALUMINIU', 1501, 2000, 'Usa culisanta Breda Aluminiu 1500-2000mm cod B302.015', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.025', 'usa', 'SAMPANIE', 501, 600, 'Usa culisanta Breda Sampanie lucios 501-600mm Cod B302.025', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.026', 'usa', 'SAMPANIE', 601, 700, 'Usa culisanta Breda Sampanie lucios 601-700mm Cod B302.026', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.027', 'usa', 'SAMPANIE', 701, 800, 'Usa culisanta Breda Sampanie lucios 701-800mm Cod B302.027', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.028', 'usa', 'SAMPANIE', 801, 900, 'Usa culisanta Breda Sampanie lucios 801-900mm Cod B302.028', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.029', 'usa', 'SAMPANIE', 901, 1000, 'Usa culisanta Breda Sampanie lucios 901-1000mm Cod B302.029', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.210', 'usa', 'SAMPANIE', 1001, 1100, 'Usa culisanta Breda Sampanie lucios 1001-1100mm Cod B302.210', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.211', 'usa', 'SAMPANIE', 1101, 1200, 'Usa culisanta Breda Sampanie lucios 1101-1200mm Cod B302.211', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.212', 'usa', 'SAMPANIE', 1201, 1300, 'Usa culisanta Breda Sampanie lucios 1201-1300mm Cod B302.212', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.213', 'usa', 'SAMPANIE', 1301, 1400, 'Usa culisanta Breda Sampanie lucios 1301-1400mm Cod B302.213', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.214', 'usa', 'SAMPANIE', 1401, 1500, 'Usa culisanta Breda Sampanie lucios 1401-1500mm Cod B302.214', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.215', 'usa', 'SAMPANIE', 1501, 2000, 'Usa culisanta Breda Sampanie lucios 1500-2000mm cod B302.215', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.035', 'usa', 'CROM', 501, 600, 'Usa culisanta Breda Crom lucios 501-600mm Cod B302.035', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.036', 'usa', 'CROM', 601, 700, 'Usa culisanta Breda Crom lucios 601-700mm Cod B302.036', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.037', 'usa', 'CROM', 701, 800, 'Usa culisanta Breda Crom lucios 701-800mm Cod B302.037', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.038', 'usa', 'CROM', 801, 900, 'Usa culisanta Breda Crom lucios 801-900mm Cod B302.038', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.039', 'usa', 'CROM', 901, 1000, 'Usa culisanta Breda Crom lucios 901-1000mm Cod B302.039', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.310', 'usa', 'CROM', 1001, 1100, 'Usa culisanta Breda Crom lucios 1001-1100mm Cod B302.310', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.311', 'usa', 'CROM', 1101, 1200, 'Usa culisanta Breda Crom lucios 1101-1200mm Cod B302.311', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.312', 'usa', 'CROM', 1201, 1300, 'Usa culisanta Breda Crom lucios 1201-1300mm Cod B302.312', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.313', 'usa', 'CROM', 1301, 1400, 'Usa culisanta Breda Crom lucios 1301-1400mm Cod B302.313', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.314', 'usa', 'CROM', 1401, 1500, 'Usa culisanta Breda Crom lucios 1401-1500mm Cod B302.314', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.316', 'usa', 'CROM', 1501, 2000, 'Usa culisanta Breda Crom lucios 1500-2000mm cod B302.315', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.055', 'usa', 'ALB', 501, 600, 'Usa culisanta Breda Alb 501-600mm Cod B302.055', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.056', 'usa', 'ALB', 601, 700, 'Usa culisanta Breda Alb 601-700mm Cod B302.056', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.057', 'usa', 'ALB', 701, 800, 'Usa culisanta Breda Alb 701-800mm Cod B302.057', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.058', 'usa', 'ALB', 801, 900, 'Usa culisanta Breda Alb 801-900mm Cod B302.058', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.059', 'usa', 'ALB', 901, 1000, 'Usa culisanta Breda Alb 901-1000mm Cod B302.059', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.510', 'usa', 'ALB', 1001, 1100, 'Usa culisanta Breda Alb 1001-1100mm Cod B302.510', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.511', 'usa', 'ALB', 1101, 1200, 'Usa culisanta Breda Alb 1101-1200mm Cod B302.511', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.512', 'usa', 'ALB', 1201, 1300, 'Usa culisanta Breda Alb 1201-1300mm Cod B302.512', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.513', 'usa', 'ALB', 1301, 1400, 'Usa culisanta Breda Alb 1301-1400mm Cod B302.513', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.514', 'usa', 'ALB', 1401, 1500, 'Usa culisanta Breda Alb 1401-1500mm Cod B302.514', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.515', 'usa', 'ALB', 1501, 2000, 'Usa culisanta Breda Alb 1500-2000mm cod B302.515', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.045', 'usa', 'NEGRU', 501, 600, 'Usa culisanta Breda Negru 501-600mm Cod B302.045', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.046', 'usa', 'NEGRU', 601, 700, 'Usa culisanta Breda Negru 601-700mm Cod B302.046', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.047', 'usa', 'NEGRU', 701, 800, 'Usa culisanta Breda Negru 701-800mm Cod B302.047', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.048', 'usa', 'NEGRU', 801, 900, 'Usa culisanta Breda Negru 801-900mm Cod B302.048', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.049', 'usa', 'NEGRU', 901, 1000, 'Usa culisanta Breda Negru 901-1000mm Cod B302.049', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.410', 'usa', 'NEGRU', 1001, 1100, 'Usa culisanta Breda Negru 1001-1100mm Cod B302.410', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.411', 'usa', 'NEGRU', 1101, 1200, 'Usa culisanta Breda Negru 1101-1200mm Cod B302.411', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.412', 'usa', 'NEGRU', 1201, 1300, 'Usa culisanta Breda Negru 1201-1300mm Cod B302.412', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.413', 'usa', 'NEGRU', 1301, 1400, 'Usa culisanta Breda Negru 1301-1400mm Cod B302.413', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.414', 'usa', 'NEGRU', 1401, 1500, 'Usa culisanta Breda Negru 1401-1500mm Cod B302.414', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('B302.415', 'usa', 'NEGRU', 1501, 2000, 'Usa culisanta Breda Negru 1500-2000mm cod B302.415', 'buc');
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
