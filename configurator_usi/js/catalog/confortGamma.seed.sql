-- ═══════════════════════════════════════════════════════════════════════════
--  Catalog familia 'confortGamma' (Confort Gamma) — din "db debitare CONFORT.xlsx".
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

INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('266', 'divizare', 'AURIU', 'DIVIZARE AURIU PERIAT');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('248', 'divizare', 'ALB', 'DIVIZARE CONFORT ALB MAT');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('208', 'divizare', 'ALUMINIU', 'DIVIZARE CONFORT ALUMINIU');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('228', 'divizare', 'SAMPANIE', 'DIVIZARE CONFORT SAMPANIE');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('295', 'divizare', 'CUPRU', 'DIVIZARE CUPRU');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('258', 'divizare', 'NEGRU', 'DIVIZARE NEGRU PERIAT');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('247', 'orizontal inferior', 'ALB', 'ORIZONTAL INFERIOR ALB MAT');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('207', 'orizontal inferior', 'ALUMINIU', 'ORIZONTAL INFERIOR ALUMINIU');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('265', 'orizontal inferior', 'AURIU', 'ORIZONTAL INFERIOR AURIU PERIAT');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('294', 'orizontal inferior', 'CUPRU', 'ORIZONTAL INFERIOR CUPRU');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('257', 'orizontal inferior', 'NEGRU', 'ORIZONTAL INFERIOR NEGRU PERIAT');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('227', 'orizontal inferior', 'SAMPANIE', 'ORIZONTAL INFERIOR SAMPANIE');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('248', 'orizontal superior', 'ALB', 'ORIZONTAL SUPERIOR ALB MAT');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('208', 'orizontal superior', 'ALUMINIU', 'ORIZONTAL SUPERIOR ALUMINIU');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('266', 'orizontal superior', 'AURIU', 'ORIZONTAL SUPERIOR AURIU PERIAT');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('295', 'orizontal superior', 'CUPRU', 'ORIZONTAL SUPERIOR CUPRU');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('258', 'orizontal superior', 'NEGRU', 'ORIZONTAL SUPERIOR NEGRU PERIAT');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('228', 'orizontal superior', 'SAMPANIE', 'ORIZONTAL SUPERIOR SAMPANIE');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('246', 'vertical', 'ALB', 'PROFIL VERTICAL GAMMA ALB MAT');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('206', 'vertical', 'ALUMINIU', 'PROFIL VERTICAL GAMMA ALUMINIU');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('264', 'vertical', 'AURIU', 'PROFIL VERTICAL GAMMA AURIU PERIAT');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('292', 'vertical', 'CUPRU', 'PROFIL VERTICAL GAMMA GAMMA CUPRU');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('256', 'vertical', 'NEGRU', 'PROFIL VERTICAL GAMMA NEGRU PERIAT');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('226', 'vertical', 'SAMPANIE', 'PROFIL VERTICAL GAMMA SAMPANIE');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('241', 'sina inferioara', 'ALB', 'SINA INFERIOARA DUBLA ALB MAT');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('201', 'sina inferioara', 'ALUMINIU', 'SINA INFERIOARA DUBLA ALUMINIU');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('261', 'sina inferioara', 'AURIU', 'SINA INFERIOARA DUBLA AURIU PERIAT');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('291', 'sina inferioara', 'CUPRU', 'SINA INFERIOARA DUBLA CUPRU');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('251', 'sina inferioara', 'NEGRU', 'SINA INFERIOARA DUBLA NEGRU PERIAT');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('221', 'sina inferioara', 'SAMPANIE', 'SINA INFERIOARA DUBLA SAMPANIE');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('240', 'sina superioara', 'ALB', 'SINA SUPERIOARA DUBLA ALB MAT');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('200', 'sina superioara', 'ALUMINIU', 'SINA SUPERIOARA DUBLA ALUMINIU');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('260', 'sina superioara', 'AURIU', 'SINA SUPERIOARA DUBLA AURIU PERIAT');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('290', 'sina superioara', 'CUPRU', 'SINA SUPERIOARA DUBLA CUPRU');
INSERT INTO articol (cod, tip, finisaj, denumire) VALUES ('250', 'sina superioara', 'NEGRU', 'SINA SUPERIOARA DUBLA NEGRU PERIAT');
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
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.045', 'divizare_vanzare', 'ALB', 501, 600, 'Profil orizontal divizare Alb 501-600mm Cod 206.045', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.046', 'divizare_vanzare', 'ALB', 601, 700, 'Profil orizontal divizare Alb 601-700mm Cod 206.046', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.047', 'divizare_vanzare', 'ALB', 701, 800, 'Profil orizontal divizare Alb 701-800mm Cod 206.047', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.048', 'divizare_vanzare', 'ALB', 801, 900, 'Profil orizontal divizare Alb 801-900mm Cod 206.048', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.049', 'divizare_vanzare', 'ALB', 901, 1000, 'Profil orizontal divizare Alb 901-1000mm Cod 206.049', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.410', 'divizare_vanzare', 'ALB', 1001, 1100, 'Profil orizontal divizare Alb 1001-1100mm Cod 206.410', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.411', 'divizare_vanzare', 'ALB', 1101, 1200, 'Profil orizontal divizare Alb 1101-1200mm Cod 206.411', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.412', 'divizare_vanzare', 'ALB', 1201, 1300, 'Profil orizontal divizare Alb 1201-1300mm Cod 206.412', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.413', 'divizare_vanzare', 'ALB', 1301, 1400, 'Profil orizontal divizare Alb 1301-1400mm Cod 206.413', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.414', 'divizare_vanzare', 'ALB', 1401, 1500, 'Profil orizontal divizare Alb 1401-1500mm Cod 206.414', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.415', 'divizare_vanzare', 'ALB', 1501, 2000, 'Profil orizontal divizare Alb 1501-2000mm Cod 206.415', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.025', 'divizare_vanzare', 'ALUMINIU', 501, 600, 'Profil orizontal divizare Aluminiu 501-600mm Cod 206.025', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.026', 'divizare_vanzare', 'ALUMINIU', 601, 700, 'Profil orizontal divizare Aluminiu 601-700mm Cod 206.026', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.027', 'divizare_vanzare', 'ALUMINIU', 701, 800, 'Profil orizontal divizare Aluminiu 701-800mm Cod 206.027', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.028', 'divizare_vanzare', 'ALUMINIU', 801, 900, 'Profil orizontal divizare Aluminiu 801-900mm Cod 206.028', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.029', 'divizare_vanzare', 'ALUMINIU', 901, 1000, 'Profil orizontal divizare Aluminiu 901-1000mm Cod 206.029', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.210', 'divizare_vanzare', 'ALUMINIU', 1001, 1100, 'Profil orizontal divizare Aluminiu 1001-1100mm Cod 206.210', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.211', 'divizare_vanzare', 'ALUMINIU', 1101, 1200, 'Profil orizontal divizare Aluminiu 1101-1200mm Cod 206.211', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.212', 'divizare_vanzare', 'ALUMINIU', 1201, 1300, 'Profil orizontal divizare Aluminiu 1201-1300mm Cod 206.212', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.213', 'divizare_vanzare', 'ALUMINIU', 1301, 1400, 'Profil orizontal divizare Aluminiu 1301-1400mm Cod 206.213', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.214', 'divizare_vanzare', 'ALUMINIU', 1401, 1500, 'Profil orizontal divizare Aluminiu 1401-1500mm Cod 206.214', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.215', 'divizare_vanzare', 'ALUMINIU', 1501, 2000, 'Profil orizontal divizare Aluminiu 1501-2000mm Cod 206.215', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.065', 'divizare_vanzare', 'AURIU', 501, 600, 'Profil orizontal divizare Auriu Periat 501-600mm Cod 206.065', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.066', 'divizare_vanzare', 'AURIU', 601, 700, 'Profil orizontal divizare Auriu Periat 601-700mm Cod 206.066', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.067', 'divizare_vanzare', 'AURIU', 701, 800, 'Profil orizontal divizare Auriu Periat 701-800mm Cod 206.067', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.068', 'divizare_vanzare', 'AURIU', 801, 900, 'Profil orizontal divizare Auriu Periat 801-900mm Cod 206.068', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.069', 'divizare_vanzare', 'AURIU', 901, 1000, 'Profil orizontal divizare Auriu Periat 901-1000mm Cod 206.069', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.610', 'divizare_vanzare', 'AURIU', 1001, 1100, 'Profil orizontal divizare Auriu Periat 1001-1100mm Cod 206.610', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.611', 'divizare_vanzare', 'AURIU', 1101, 1200, 'Profil orizontal divizare Auriu Periat 1101-1200mm Cod 206.611', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.612', 'divizare_vanzare', 'AURIU', 1201, 1300, 'Profil orizontal divizare Auriu Periat 1201-1300mm Cod 206.612', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.613', 'divizare_vanzare', 'AURIU', 1301, 1400, 'Profil orizontal divizare Auriu Periat 1301-1400mm Cod 206.613', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.614', 'divizare_vanzare', 'AURIU', 1401, 1500, 'Profil orizontal divizare Auriu Periat 1401-1500mm Cod 206.614', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.615', 'divizare_vanzare', 'AURIU', 1501, 2000, 'Profil orizontal divizare Auriu Periat 1501-2000mm Cod 206.615', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.075', 'divizare_vanzare', 'CUPRU', 501, 600, 'Profil orizontal divizare Cupru 501-600mm cod 206.075', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.076', 'divizare_vanzare', 'CUPRU', 601, 700, 'Profil orizontal divizare Cupru 601-700mm cod 206.076', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.077', 'divizare_vanzare', 'CUPRU', 701, 800, 'Profil orizontal divizare Cupru 701-800mm cod 206.077', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.078', 'divizare_vanzare', 'CUPRU', 801, 900, 'Profil orizontal divizare Cupru 801-900mm cod 206.078', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.079', 'divizare_vanzare', 'CUPRU', 901, 1000, 'Profil orizontal divizare Cupru 901-1000mm cod 206.079', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.710', 'divizare_vanzare', 'CUPRU', 1001, 1100, 'Profil orizontal divizare Cupru 1001-1100mm cod 206.710', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.711', 'divizare_vanzare', 'CUPRU', 1101, 1200, 'Profil orizontal divizare Cupru 1101-1200mm cod 206.711', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.712', 'divizare_vanzare', 'CUPRU', 1201, 1300, 'Profil orizontal divizare Cupru 1201-1300mm cod 206.712', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.713', 'divizare_vanzare', 'CUPRU', 1301, 1400, 'Profil orizontal divizare Cupru 1301-1400mm cod 206.713', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.714', 'divizare_vanzare', 'CUPRU', 1401, 1500, 'Profil orizontal divizare Cupru 1401-1500mm cod 206.714', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.055', 'divizare_vanzare', 'NEGRU', 501, 600, 'Profil orizontal divizare Negru Periat 501-600mm Cod 206.055', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.056', 'divizare_vanzare', 'NEGRU', 601, 700, 'Profil orizontal divizare Negru Periat 601-700mm Cod 206.056', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.057', 'divizare_vanzare', 'NEGRU', 701, 800, 'Profil orizontal divizare Negru Periat 701-800mm Cod 206.057', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.058', 'divizare_vanzare', 'NEGRU', 801, 900, 'Profil orizontal divizare Negru Periat 801-900mm Cod 206.058', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.059', 'divizare_vanzare', 'NEGRU', 901, 1000, 'Profil orizontal divizare Negru Periat 901-1000mm Cod 206.059', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.510', 'divizare_vanzare', 'NEGRU', 1001, 1100, 'Profil orizontal divizare Negru Periat 1001-1100mm Cod 206.510', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.511', 'divizare_vanzare', 'NEGRU', 1101, 1200, 'Profil orizontal divizare Negru Periat 1101-1200mm Cod 206.511', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.512', 'divizare_vanzare', 'NEGRU', 1201, 1300, 'Profil orizontal divizare Negru Periat 1201-1300 Cod 206.512', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.513', 'divizare_vanzare', 'NEGRU', 1301, 1400, 'Profil orizontal divizare Negru Periat 1301-1400mm Cod 206.513', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.514', 'divizare_vanzare', 'NEGRU', 1401, 1500, 'Profil orizontal divizare Negru Periat 1401-1500mm Cod 206.514', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.515', 'divizare_vanzare', 'NEGRU', 1501, 2000, 'Profil orizontal divizare Negru Periat 1501-2000mm Cod 206.515', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.035', 'divizare_vanzare', 'SAMPANIE', 501, 600, 'Profil orizontal divizare Sampanie 501-600mm Cod 206.035', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.036', 'divizare_vanzare', 'SAMPANIE', 601, 700, 'Profil orizontal divizare Sampanie 601-700mm Cod 206.036', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.037', 'divizare_vanzare', 'SAMPANIE', 701, 800, 'Profil orizontal divizare Sampanie 701-800mm Cod 206.037', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.038', 'divizare_vanzare', 'SAMPANIE', 801, 900, 'Profil orizontal divizare Sampanie 801-900mm Cod 206.038', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.039', 'divizare_vanzare', 'SAMPANIE', 901, 1000, 'Profil orizontal divizare Sampanie 901-1000mm Cod 206.039', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.310', 'divizare_vanzare', 'SAMPANIE', 1001, 1100, 'Profil orizontal divizare Sampanie 1001-1100mm Cod 206.310', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.311', 'divizare_vanzare', 'SAMPANIE', 1101, 1200, 'Profil orizontal divizare Sampanie 1101-1200mm Cod 206.311', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.312', 'divizare_vanzare', 'SAMPANIE', 1201, 1300, 'Profil orizontal divizare Sampanie 1201-1300mm Cod 206.312', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.313', 'divizare_vanzare', 'SAMPANIE', 1301, 1400, 'Profil orizontal divizare Sampanie 1300-1400mm Cod 206.313', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.314', 'divizare_vanzare', 'SAMPANIE', 1401, 1500, 'Profil orizontal divizare Sampanie 1401-1500mm Cod 206.314', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('206.315', 'divizare_vanzare', 'SAMPANIE', 1501, 2000, 'Profil orizontal divizare Sampanie 1501-2000mm Cod 206.315', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.045', 'usa', 'ALB', 501, 600, 'Usa culisanta Gamma Alb 501-600mm Cod 201.045', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.046', 'usa', 'ALB', 601, 700, 'Usa culisanta Gamma Alb 601-700mm Cod 201.046', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.047', 'usa', 'ALB', 701, 800, 'Usa culisanta Gamma Alb 701-800mm Cod 201.047', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.048', 'usa', 'ALB', 801, 900, 'Usa culisanta Gamma Alb 801-900mm Cod 201.048', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.049', 'usa', 'ALB', 901, 1000, 'Usa culisanta Gamma Alb 901-1000mm Cod 201.049', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.410', 'usa', 'ALB', 1001, 1100, 'Usa culisanta Gamma Alb 1001-1100mm Cod 201.410', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.411', 'usa', 'ALB', 1101, 1200, 'Usa culisanta Gamma Alb 1101-1200mm Cod 201.411', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.412', 'usa', 'ALB', 1201, 1300, 'Usa culisanta Gamma Alb 1201-1300mm Cod 201.412', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.413', 'usa', 'ALB', 1301, 1400, 'Usa culisanta Gamma Alb 1301-1400mm Cod 201.413', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.414', 'usa', 'ALB', 1401, 1500, 'Usa culisanta Gamma Alb 1401-1500mm Cod 201.414', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.415', 'usa', 'ALB', 1501, 2000, 'Usa culisanta Gamma Alb 1501-2000mm Cod 201.415', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.025', 'usa', 'ALUMINIU', 501, 600, 'Usa culisanta Gamma Aluminiu 501-600mm Cod 201.025', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.026', 'usa', 'ALUMINIU', 601, 700, 'Usa culisanta Gamma Aluminiu 601-700mm Cod 201.026', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.027', 'usa', 'ALUMINIU', 701, 800, 'Usa culisanta Gamma Aluminiu 701-800mm Cod 201.027', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.028', 'usa', 'ALUMINIU', 801, 900, 'Usa culisanta Gamma Aluminiu 801-900mm Cod 201.028', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.029', 'usa', 'ALUMINIU', 901, 1000, 'Usa culisanta Gamma Aluminiu 901-1000mm Cod 201.029', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.210', 'usa', 'ALUMINIU', 1001, 1100, 'Usa culisanta Gamma Aluminiu 1001-1100mm Cod 201.210', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.211', 'usa', 'ALUMINIU', 1101, 1200, 'Usa culisanta Gamma Aluminiu 1101-1200mm Cod 201.211', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.212', 'usa', 'ALUMINIU', 1201, 1300, 'Usa culisanta Gamma Aluminiu 1201-1300mm Cod 201.212', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.213', 'usa', 'ALUMINIU', 1301, 1400, 'Usa culisanta Gamma Aluminiu 1301-1400mm Cod 201.213', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.214', 'usa', 'ALUMINIU', 1401, 1500, 'Usa culisanta Gamma Aluminiu 1401-1500mm Cod 201.214', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.215', 'usa', 'ALUMINIU', 1501, 2000, 'Usa culisanta Gamma Aluminiu 1501-2000mm Cod 201.215', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.065', 'usa', 'AURIU', 501, 600, 'Usa culisanta Gamma Auriu Periat 501-600mm Cod 201.065', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.066', 'usa', 'AURIU', 601, 700, 'Usa culisanta Gamma Auriu Periat 601-700mm Cod 201.066', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.067', 'usa', 'AURIU', 701, 800, 'Usa culisanta Gamma Auriu Periat 701-800mm Cod 201.067', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.068', 'usa', 'AURIU', 801, 900, 'Usa culisanta Gamma Auriu Periat 801-900mm Cod 201.068', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.069', 'usa', 'AURIU', 901, 1000, 'Usa culisanta Gamma Auriu Periat 901-1000mm Cod 201.069', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.610', 'usa', 'AURIU', 1001, 1100, 'Usa culisanta Gamma Auriu Periat 1001-1100mm Cod 201.610', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.611', 'usa', 'AURIU', 1101, 1200, 'Usa culisanta Gamma Auriu Periat 1101-1200mm Cod 201.611', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.612', 'usa', 'AURIU', 1201, 1300, 'Usa culisanta Gamma Auriu Periat 1201-1300mm Cod 201.612', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.613', 'usa', 'AURIU', 1301, 1400, 'Usa culisanta Gamma Auriu Periat 1301-1400mm Cod 201.613', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.614', 'usa', 'AURIU', 1401, 1500, 'Usa culisanta Gamma Auriu Periat 1401-1500mm Cod 201.614', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.615', 'usa', 'AURIU', 1501, 2000, 'Usa culisanta Gamma Auriu Periat 1501-2000mm Cod 201.615', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.075', 'usa', 'CUPRU', 501, 600, 'Usa culisanta Gamma Cupru periat 501-600mm cod 201.075 (fara sine de culisare)', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.076', 'usa', 'CUPRU', 601, 700, 'Usa culisanta Gamma Cupru periat 601-700mm cod 201.076 (fara sine de culisare)', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.077', 'usa', 'CUPRU', 701, 800, 'Usa culisanta Gamma Cupru periat 701-800mm cod 201.077 (fara sine de culisare)', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.078', 'usa', 'CUPRU', 801, 900, 'Usa culisanta Gamma Cupru periat 801-900mm cod 201.078 (fara sine de culisare)', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.079', 'usa', 'CUPRU', 901, 1000, 'Usa culisanta Gamma Cupru periat 901-1000mm cod 201.079 (fara sine de culisare)', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.710', 'usa', 'CUPRU', 1001, 1100, 'Usa culisanta Gamma Cupru periat 1001-1100mm cod 201.710 (fara sine de culisare)', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.711', 'usa', 'CUPRU', 1101, 1200, 'Usa culisanta Gamma Cupru periat 1101-1200mm cod 201.711 (fara sine de culisare)', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.712', 'usa', 'CUPRU', 1201, 1300, 'Usa culisanta Gamma Cupru periat 1201-1300mm cod 201.712 (fara sine de culisare)', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.713', 'usa', 'CUPRU', 1301, 1400, 'Usa culisanta Gamma Cupru periat 1301-1400mm cod 201.713 (fara sine de culisare)', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.714', 'usa', 'CUPRU', 1401, 1500, 'Usa culisanta Gamma Cupru periat 1401-1500mm cod 201.714 (fara sine de culisare)', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.055', 'usa', 'NEGRU', 501, 600, 'Usa culisanta Gamma Negru Periat 501-600mm Cod 201.055', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.056', 'usa', 'NEGRU', 601, 700, 'Usa culisanta Gamma Negru Periat 601-700mm Cod 201.056', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.057', 'usa', 'NEGRU', 701, 800, 'Usa culisanta Gamma Negru Periat 701-800mm Cod 201.057', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.058', 'usa', 'NEGRU', 801, 900, 'Usa culisanta Gamma Negru Periat 801-900mm Cod 201.058', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.059', 'usa', 'NEGRU', 901, 1000, 'Usa culisanta Gamma Negru Periat 901-1000mm Cod 201.059', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.510', 'usa', 'NEGRU', 1001, 1100, 'Usa culisanta Gamma Negru Periat 1001-1100mm Cod 201.510', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.511', 'usa', 'NEGRU', 1101, 1200, 'Usa culisanta Gamma Negru Periat 1101-1200mm Cod 201.511', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.512', 'usa', 'NEGRU', 1201, 1300, 'Usa culisanta Gamma Negru Periat 1200-1300mm Cod 201.512', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.513', 'usa', 'NEGRU', 1301, 1400, 'Usa culisanta Gamma Negru Periat 1301-1400mm Cod 201.513', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.514', 'usa', 'NEGRU', 1401, 1500, 'Usa culisanta Gamma Negru Periat 1400-1500mm Cod 201.514', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.515', 'usa', 'NEGRU', 1501, 2000, 'Usa culisanta Gamma Negru Periat 1501-2000mm Cod 201.515', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.035', 'usa', 'SAMPANIE', 501, 600, 'Usa culisanta Gamma Sampanie 501-600mm Cod 201.035', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.036', 'usa', 'SAMPANIE', 601, 700, 'Usa culisanta Gamma Sampanie 601-700mm Cod 201.036', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.037', 'usa', 'SAMPANIE', 701, 800, 'Usa culisanta Gamma Sampanie 701-800mm Cod 201.037', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.038', 'usa', 'SAMPANIE', 801, 900, 'Usa culisanta Gamma Sampanie 801-900mm Cod 201.038', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.039', 'usa', 'SAMPANIE', 901, 1000, 'Usa culisanta Gamma Sampanie 901-1000mm Cod 201.039', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.310', 'usa', 'SAMPANIE', 1001, 1100, 'Usa culisanta Gamma Sampanie 1001-1100mm Cod 201.310', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.311', 'usa', 'SAMPANIE', 1101, 1200, 'Usa culisanta Gamma Sampanie 1101-1200mm Cod 201.311', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.312', 'usa', 'SAMPANIE', 1201, 1300, 'Usa culisanta Gamma Sampanie 1201-1300mm Cod 201.312', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.313', 'usa', 'SAMPANIE', 1301, 1400, 'Usa culisanta Gamma Sampanie 1301-1400mm Cod 201.313', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.314', 'usa', 'SAMPANIE', 1401, 1500, 'Usa culisanta Gamma Sampanie 1401-1500mm Cod 201.314', 'buc');
INSERT INTO articol (cod, tip, finisaj, lmin, lmax, denumire, um) VALUES ('201.315', 'usa', 'SAMPANIE', 1501, 2000, 'Usa culisanta Gamma Sampanie 1501-2000mm Cod 201.315', 'buc');

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
