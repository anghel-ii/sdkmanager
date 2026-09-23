-- ═══════════════════════════════════════════════════════════════════════════
--  js/catalog/geam.seed.sql — catalog GEAM + OGLINDĂ (comun tuturor sistemelor)
--
--  Sursă: "db geam(1).xlsx" din rădăcina proiectului.
--  Regenerezi:  npm run catalog   (→ js/catalog/geam.sqlite → catalog.generated.json["geam"])
--
--    cod      : codul EXACT din NeoManager
--    denumire : denumirea din nomenclator (afişată în selectorul din UI)
--    grosime  : mm — decide codul garniturii (277 la 4mm, 278 la 8mm)
--    oglinda  : 1 = oglindă (adaugă automat folie de securizare cod 283), 0 = geam
-- ═══════════════════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS articol;
CREATE TABLE articol (
  cod      TEXT PRIMARY KEY,
  denumire TEXT NOT NULL,
  grosime  INTEGER NOT NULL,
  oglinda  INTEGER NOT NULL DEFAULT 0,
  activ    INTEGER NOT NULL DEFAULT 1
);

INSERT INTO articol (cod, denumire, grosime, oglinda) VALUES
  ('GG006', 'Geam fumuriu 4mm GG cod GG006', 4, 0),
  ('HD011', 'Geam fumuriu bronz 4mm HD cod HD011', 4, 0),
  ('HD012', 'Geam fumuriu bronz 4mm HD slefuit perimetral cod HD012', 4, 0),
  ('OVI003', 'Geam parsol BRONZ de 4mm, securizat cod:OVI003', 4, 0),
  ('GG008', 'Geam gri 4mm GG cod GG008', 4, 0),
  ('HD029', 'Geam gri 4mm HD cod HD029', 4, 0),
  ('HD030', 'Geam gri 4mm HD slefuit perimetral cod HD030', 4, 0),
  ('OVI002', 'Geam parsol GRI de 4mm, securizat cod:OVI002', 4, 0),
  ('CS003', 'Geam GRI 4mm slefuit perimetral CS cod CS003', 4, 0),
  ('OVI004', 'Geam FLOAT de 4mm, securizat cod:OVI004', 4, 0),
  ('GG004', 'Geam float transparent 4mm GG cod GG004', 4, 0),
  ('HD007', 'Geam float transparent 4mm HD cod HD007', 4, 0),
  ('HD008', 'Geam float transparent 4mm HD slefuit perimetral cod HD008', 4, 0),
  ('GG007', 'Geam reflexiv 4mm GG cod GG007', 4, 0),
  ('HD013', 'Geam reflexiv 4mm HD cod HD013', 4, 0),
  ('HD014', 'Geam reflexiv 4mm HD slefuit perimetral cod HD014', 4, 0),
  ('CS012', 'Geam reflexiv maro 4mm,  securizat termic CS cod CS012', 4, 0),
  ('CS013', 'Geam canelat(riglat) 4mm securizat CS cod CS013', 4, 0),
  ('GG011', 'Geam riglat 4mm GG cod GG011', 4, 0),
  ('HD019', 'Geam riglat 4mm HD cod HD019', 4, 0),
  ('HD020', 'Geam riglat 4mm HD slefuit perimetral cod HD020', 4, 0),
  ('GG009', 'Geam satinat alb 4mm GG cod GG009', 4, 0),
  ('HD015', 'Geam satinat alb 4mm HD cod HD015', 4, 0),
  ('HD016', 'Geam satinat alb 4mm HD slefuit perimetral cod HD016', 4, 0),
  ('CS005', 'Geam satinat alb 4mm securizat termic CS cod CS005', 4, 0),
  ('GG010', 'Geam satinat fumuriu 4mm GG cod GG010', 4, 0),
  ('HD018', 'Geam satinat fumuriu 4mm HD cod HD018', 4, 0),
  ('HD017', 'Geam satinat fumuriu 4mm HD slefuit perimetral cod HD017', 4, 0),
  ('CT063', 'Geam satinat maro 4mm securizat CT cod CT063', 4, 0),
  ('CS009', 'Geam satinat maro(fumuriu) 4mm CS cod CS009', 4, 0),
  ('CS006', 'Geam satinat maro(fumuriu) 4mm securizat termic CS cod CS006', 4, 0),
  ('HD009', 'Geam ultra clear 4mm HD transparent cod HD009', 4, 0),
  ('HD010', 'Geam ultra clear 4mm HD transparent slefuit perimetrial cod HD010', 4, 0),
  ('GG013', 'Geam ultra clear alb 4mm GG cod GG013', 4, 0),
  ('HD023', 'Geam ultra clear alb 4mm HD cod HD023', 4, 0),
  ('HD024', 'Geam ultra clear alb 4mm HD slefuit perimetral cod HD024', 4, 0),
  ('GG005', 'Geam ultra clear transparent 4mm GG cod GG005', 4, 0),
  ('GG014', 'Geam lacobel negru 4mm GG', 4, 0),
  ('HD025', 'Geam lacobel negru 4mm HD cod HD025', 4, 0),
  ('HD026', 'Geam lacobel negru 4mm HD slefuit perimetral cod HD026', 4, 0),
  ('GG001', 'Oglinda 4mm GG cod GG001', 4, 1),
  ('HD001', 'Oglinda 4mm HD cod HD001', 4, 1),
  ('HD002', 'Oglinda 4mm HD slefuita perimetral cod HD002', 4, 1),
  ('GG002', 'Oglinda fumurie 4mm GG cod GG002', 4, 1),
  ('HD003', 'Oglinda fumurie 4mm HD cod HD003', 4, 1),
  ('HD004', 'Oglinda fumurie 4mm HD slefuita perimetral cod HD004', 4, 1),
  ('CS008', 'Oglinda fumurie 4mm slefuita perimetral CS cod CS008', 4, 1),
  ('GG003', 'Oglinda gri 4mm GG cod GG003', 4, 1),
  ('HD005', 'Oglinda gri 4mm HD cod HD005', 4, 1),
  ('HD006', 'Oglinda gri 4mm HD slefuita perimetral cod HD006', 4, 1),
  ('CS007', 'Oglinda normala 4mm slefuita perimetral CS cod CS007', 4, 1),
  ('CS002', 'Geam fumuriu bronz 4mm securizat termic CS cod CS002', 4, 0),
  ('CS004', 'Geam GRI 4mm securizat termic CS cod CS004', 4, 0),
  ('CS001', 'Geam float 4mm transparent securizat termic CS cod CS001', 4, 0),
  ('CG001', 'Geam float 8 MM SECURIZAT CG', 8, 0),
  ('GG016', 'Geam float 8mm GG', 8, 0),
  ('OVI001', 'Geam float 8mm securizat termic OVI001', 8, 0),
  ('CS010', 'Geam float 8mm transparent securizat termic CS 010', 8, 0),
  ('TG002', 'Geam Float de 8mm, Securizata cod: TG002', 8, 0),
  ('HD027', 'Geam float transparent 8mm HD slefuit perimetral, securizat', 8, 0),
  ('CG002', 'Geam fumuriu 8 MM SECURIZAT CG', 8, 0),
  ('GG017', 'Geam fumuriu bronz 8mm', 8, 0),
  ('CS011', 'Geam fumuriu bronz 8mm securizat termic CS011', 8, 0),
  ('CS020', 'Geam fumuriu sablat de 8mm securizat termic CS', 8, 0),
  ('CS014', 'Geam fumuriu sablat(satinat) 8 mm securizat cod CS014', 8, 0),
  ('CS018', 'Geam GRI de 8 mm slefuit perimetral CS', 8, 0),
  ('TG001', 'Geam sablat  bronz 8 mm TG', 8, 0),
  ('CS019', 'Geam satinat alb 8mm securizat termic CS cod:CS019', 8, 0),
  ('TG 004', 'Geam transparent de 8 mm Securizat TG', 8, 0);

