-- ═══════════════════════════════════════════════════════════════════════════
--  js/catalog/suspendata.seed.sql — catalogul familiei "suspendata" (A/D/E/F)
--
--  Numele fişierului (înainte de .seed.sql) = `meta.family` al sistemelor.
--  Familie nouă (ex. glisante) → js/catalog/<family>.seed.sql nou.
--
--  Regenerezi:  npm run catalog   (seed → js/catalog/suspendata.sqlite → catalog.generated.json)
--  Sau editezi direct js/catalog/suspendata.sqlite în DB Browser for SQLite.
--
--  Un rând = un cod din NeoManager. Codul depinde DOAR de tip + finisaj + mărime;
--  A/D/E/F folosesc aceleaşi coduri (diferenţa de montare/cantitate e în .js).
--
--    tip      : 'usa' | 'sina' | 'mascare_sina' | 'divizare'
--    finisaj  : 'ARG'|'ANT'|'ALB'|'LEM' ; sau NULL dacă acelaşi cod la orice culoare
--    lmin,lmax: banda de mărime (mm, inclusiv). Se testează pe:
--                 usa            → lăţimea UŞII
--                 sina/mascare   → lungimea ŞINEI
--                 divizare       → lăţimea LIBERĂ a uşii (între montanţi)
--    denumire : text pentru verificare în panou
--    um       : 'buc' implicit (poţi omite)
--
--  Benzile pe acelaşi (tip, finisaj) trebuie lipite, fără gol şi fără suprapunere:
--    0–6000, 6001–9000   (nu 0–6000, 6000–9000).
--  Un singur cod pe culoare (tăiat la comandă) → o bandă largă: lmin 0, lmax 99999.
-- ═══════════════════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS articol;
CREATE TABLE articol (
  cod      TEXT PRIMARY KEY,
  tip      TEXT NOT NULL,
  finisaj  TEXT,
  lmin     INTEGER,
  lmax     INTEGER,
  denumire TEXT,
  um       TEXT NOT NULL DEFAULT 'buc',
  activ    INTEGER NOT NULL DEFAULT 1
);

-- ─────────────────────────────────────────────────────────────────────────────
--  DE COMPLETAT — codurile reale. Şablon (decomentează şi înlocuieşte):
--
INSERT INTO articol (tip, finisaj, lmin, lmax, cod, denumire) VALUES
--   -- UŞĂ  (band pe LĂŢIMEA UŞII; cantitate = nr. uşi, din .js)
('usa','ALUMINIU',601,700,'USA001','Usa Culisanta Suspendata Aluminiu 601-700Mm Cod Usa001'),
('usa','ALUMINIU',701,800,'USA002','Usa Culisanta Suspendata Aluminiu 701-800Mm Cod Usa002'),
('usa','ALUMINIU',801,900,'USA003','Usa Culisanta Suspendata Aluminiu 801-900Mm Cod Usa003'),
('usa','ALUMINIU',901,1000,'USA004','Usa Culisanta Suspendata Aluminiu 901-1000Mm Cod Usa004'),
('usa','ALUMINIU',1001,1100,'USA005','Usa Culisanta Suspendata Aluminiu 1001-1100Mm Cod Usa005'),
('usa','ALUMINIU',1101,1200,'USA006','Usa Culisanta Suspendata Aluminiu 1101-1200Mm Cod Usa006'),
('usa','ALUMINIU',1201,1300,'USA007','Usa Culisanta Suspendata Aluminiu 1201-1300Mm Cod Usa007'),
('usa','ALUMINIU',1301,1400,'USA008','Usa Culisanta Suspendata Aluminiu 1301-1400Mm Cod Usa008'),
('usa','ALUMINIU',1401,1500,'USA009','Usa Culisanta Suspendata Aluminiu 1401-1500Mm Cod Usa009'),
('usa','ALUMINIU',1501,2000,'USA010','Usa Culisanta Suspendata Aluminiu 1501-2000Mm Cod Usa010'),
('usa','NEGRU MAT',601,700,'USA101','Usa Culisanta Suspendata Negru Mat 601-700Mm  Cod Usa101'),
('usa','NEGRU MAT',701,800,'USA102','Usa Culisanta Suspendata Negru Mat 701-800Mm Cod Usa 102'),
('usa','NEGRU MAT',801,900,'USA103','Usa Culisanta Suspendata Negru Mat 801-900Mm Cod Usa103'),
('usa','NEGRU MAT',901,1000,'USA104','Usa Culisanta Suspendata Negru Mat 901-1000Mm Cod Usa104'),
('usa','NEGRU MAT',1001,1100,'USA105','Usa Culisanta Suspendata Negru Mat 1001-1100Mm Cod Usa105'),
('usa','NEGRU MAT',1101,1200,'USA106','Usa Culisanta Suspendata Negru Mat 1101-1200Mm Cod Usa106'),
('usa','NEGRU MAT',1201,1300,'USA107','Usa Culisanta Suspendata Negru Mat 1201-1300Mm Cod Usa107'),
('usa','NEGRU MAT',1301,1400,'USA108','Usa Culisanta Suspendata Negru Mat 1301-1400Mm Cod Usa108'),
('usa','NEGRU MAT',1401,1500,'USA109','Usa Culisanta Suspendata Negru Mat 1401-1500Mm Cod Usa109'),
('usa','NEGRU MAT',1501,2000,'USA110','Usa Culisanta Suspendata Negru Mat 1501-2000Mm Cod Usa110'),
('usa','SAMPANIE LUCIOS',601,700,'USA201','Usa Culisanta Suspendata Samp.Lucios 601-700Mm Cod Usa201'),
('usa','SAMPANIE LUCIOS',701,800,'USA202','Usa Culisanta Suspendata Samp.Lucios 701-800Mm Cod Usa202'),
('usa','SAMPANIE LUCIOS',801,900,'USA203','Usa culisanta Suspendata Samp.Lucios 801-900mm Cod Usa203'),
('usa','SAMPANIE LUCIOS',901,1000,'USA204','Usa Culisanta Suspendata Samp.Lucios  901-1000Mm Cod Usa204'),
('usa','SAMPANIE LUCIOS',1001,1100,'USA205','Usa Culisanta Suspendata Samp.Lucios 1001-1100Mm Cod Usa205'),
('usa','SAMPANIE LUCIOS',1101,1200,'USA206','Usa Culisanta Suspendata Samp.Lucios 1101-1200Mm Cod Usa206'),
('usa','SAMPANIE LUCIOS',1201,1300,'USA207','Usa Culisanta Suspendata Samp. Lucios 1201-1300Mm Cod Usa207'),
('usa','SAMPANIE LUCIOS',1301,1400,'USA208','Usa Culisanta Suspendata Samp.Lucios 1300-1401Mm Cod Usa208'),
('usa','SAMPANIE LUCIOS',1401,1500,'USA209','Usa Culisanta Suspendata Samp.Lucios 1401-1500Mm Cod Usa209'),
('usa','SAMPANIE LUCIOS',1501,2000,'USA210','Usa Culisanta Suspendata Samp.Lucios 1501-2000Mm Cod Usa210'),
('usa','AURIU PERIAT',601,700,'USA301','Usa culisanta suspendata Auriu periat 601-700mm cod USA301'),
('usa','AURIU PERIAT',701,800,'USA302','Usa culisanta suspendata Auriu periat 701-800mm cod USA302'),
('usa','AURIU PERIAT',801,900,'USA303','Usa culisanta suspendata Auriu periat 801-900mm cod USA303'),
('usa','AURIU PERIAT',901,1000,'USA304','Usa culisanta suspendata Auriu periat  901-1000mm cod USA304'),
('usa','AURIU PERIAT',1001,1100,'USA305','Usa culisanta suspendata Auriu periat 1001-1100mm cod USA305'),
('usa','AURIU PERIAT',1101,1200,'USA306','Usa culisanta suspendata Auriu periat 1101-1200mm cod USA306'),
('usa','AURIU PERIAT',1201,1300,'USA307','Usa culisanta suspendata Auriu periat 1201-1300mm cod USA307'),
('usa','AURIU PERIAT',1301,1400,'USA308','Usa culisanta suspendata Auriu periat 1301-1400mm cod USA308'),
('usa','AURIU PERIAT',1401,1500,'USA309','Usa culisanta suspendata Auriu periat 1401-1500mm cod USA309'),
('usa','AURIU PERIAT',1501,2000,'USA310','Usa culisanta suspendata Auriu periat 1501-2000mm cod USA310'),
('usa','CUPRU',601,700,'USA401','Usa culisanta suspendata Cupru 601-700mm cod USA401'),
('usa','CUPRU',701,800,'USA402','Usa culisanta suspendata Cupru 701-800mm cod USA402'),
('usa','CUPRU',801,900,'USA403','Usa culisanta suspendata Cupru 801-900mm cod USA403'),
('usa','CUPRU',901,1000,'USA404','Usa culisanta suspendata Cupru 901-1000mm cod USA404'),
('usa','CUPRU',1001,1100,'USA405','Usa culisanta suspendata Cupru 1001-1100mm cod USA405'),
('usa','CUPRU',1101,1200,'USA406','Usa culisanta suspendata Cupru 1101-1200mm cod USA406'),
('usa','CUPRU',1201,1300,'USA407','Usa culisanta suspendata Cupru 1201-1300mm cod USA407'),
('usa','CUPRU',1301,1400,'USA408','Usa culisanta suspendata Cupru 1301-1400mm cod USA408'),
('usa','CUPRU',1401,1500,'USA409','Usa culisanta suspendata Cupru 1401-1500mm cod USA409'),

--   -- ŞINĂ  (band pe lungimea şinei; cantitate = 1 buc)
('sina','ALUMINIU',1201,1400,'S001','Sina Superioara Usi Suspendate Aluminiu 1201-1400Mm Cod S001'),
('sina','ALUMINIU',1401,1600,'S002','Sina Superioara Usi Suspendate Aluminiu 1401-1600Mm Cod S002'),
('sina','ALUMINIU',1601,1800,'S003','Sina Superioara Usi Suspendate Aluminiu 1601-1800Mm Cod S003'),
('sina','ALUMINIU',1801,2000,'S004','Sina Superioara Usi Suspendate Aluminiu 1801-2000Mm Cod S004'),
('sina','ALUMINIU',2001,2200,'S005','Sina Superioara Usi Suspendate Aluminiu 2001-2200Mm Cod S005'),
('sina','ALUMINIU',2201,2400,'S006','Sina Superioara Usi Suspendate Aluminiu 2201-2400Mm Cod S006'),
('sina','ALUMINIU',2401,2600,'S007','Sina Superioara Usi Suspendate Aluminiu 2401-2600Mm Cod S007'),
('sina','ALUMINIU',2601,3000,'S008','Sina Superioara Usi Suspendate Aluminiu 2601-3000Mm Cod S008'),
('sina','ALUMINIU',3001,4000,'S009','Sina Super. Usi Suspendate Aluminiu 3001-4000Mm Cod S009'),
('sina','ALUMINIU',4001,5800,'S010','Sina Superioara Usi Suspendate Aluminiu 4001-5800Mm Cod S010'),
('sina','NEGRU MAT',1201,1400,'S101','Sina Super. Usi Suspendate Negru Mat 1201-1400Mm Cod S101'),
('sina','NEGRU MAT',1401,1600,'S102','Sina Super. Usa Suspendata Negru Mat 1401-1600Mm Cod S102'),
('sina','NEGRU MAT',1601,1800,'S103','Sina Super. Usa Suspendata Negru Mat 1601-1800Mm Cod S103'),
('sina','NEGRU MAT',1801,2000,'S104','Sina Super. Usa Suspendata Negru Mat 1801-2000Mm Cod S104'),
('sina','NEGRU MAT',2001,2200,'S105','Sina Super. Usa Suspendata Negru Mat 2001-2200Mm Cod S105'),
('sina','NEGRU MAT',2201,2400,'S106','Sina Super. Usa Suspendata Negru Mat 2201-2400Mm Cod S106'),
('sina','NEGRU MAT',2401,2600,'S107','Sina Super. Usa Suspendata Negru Mat 2401-2600Mm Cod S107'),
('sina','NEGRU MAT',2601,3000,'S108','Sina Super. Usa Suspendata Negru Mat 2601-3000Mm Cod S108'),
('sina','NEGRU MAT',3001,4000,'S109','Sina Super. Usa Suspendata Negru Mat 3001-4000Mm Cod S109'),
('sina','NEGRU MAT',4001,5800,'S110','Sina Super. Usa Suspendata Negru Mat 4001-5800Mm Cod S110'),
('sina','SAMPANIE LUCIOS',1201,1400,'S201','Sina Super. Usa Suspendata Samp.Lucios 1201-1400Mm Cod S201'),
('sina','SAMPANIE LUCIOS',1401,1600,'S202','Sina Super. Usa Suspendata Samp.Lucios 1401-1600Mm Cod S202'),
('sina','SAMPANIE LUCIOS',1601,1800,'S203','Sina Super. Usa Suspendata Samp.Lucios 1601-1800Mm Cod S203'),
('sina','SAMPANIE LUCIOS',1801,2000,'S204','Sina Super. Usa Suspendata Samp. Lucios 1801-2000Mm Cod S204'),
('sina','SAMPANIE LUCIOS',2001,2200,'S205','Sina Super. Usa Suspendata Samp.Lucios 2001-2200Mm Cod S205'),
('sina','SAMPANIE LUCIOS',2201,2400,'S206','Sina Super. Usa Suspendata samp.Lucios 2201-2400Mm Cod S206'),
('sina','SAMPANIE LUCIOS',2401,2600,'S207','Sina Super. Usa Suspendata Samp.Lucios 2401-2600Mm Cod S207'),
('sina','SAMPANIE LUCIOS',2601,3000,'S208','Sina Super. Usa Suspendata Samp.Lucios 2601-3000Mm Cod S208'),
('sina','SAMPANIE LUCIOS',3001,4000,'S209','Sina Super. Usa Suspendata Samp.Lucios 3001-4000Mm Cod S209'),
('sina','SAMPANIE LUCIOS',4001,5800,'S210','Sina Super. Usa Suspendata Samp.Lucios 4001-5800Mm Cod S210'),
('sina','AURIU PERIAT',1201,1400,'S301','Sina superioara pentru usi suspendate Auriu periat 1201-1400mm cod S301'),
('sina','AURIU PERIAT',1401,1600,'S302','Sina superioara pentru usi suspendate Auriu periat 1401-1600mm cod S302'),
('sina','AURIU PERIAT',1601,1800,'S303','Sina superioara pentru usi suspendate Auriu periat 1601-1800mm cod S303'),
('sina','AURIU PERIAT',1801,2000,'S304','Sina superioara pentru usi suspendate Auriu periat 1801-2000mm cod S304'),
('sina','AURIU PERIAT',2001,2200,'S305','Sina superioara pentru usi suspendate Auriu periat 2001-2200mm cod S305'),
('sina','AURIU PERIAT',2201,2400,'S306','Sina superioara pentru usi suspendate Auriu periat 2201-2400mm cod S306'),
('sina','AURIU PERIAT',2401,2600,'S307','Sina superioara pentru usi suspendate Auriu periat 2401-2600mm cod S307'),
('sina','AURIU PERIAT',2601,3000,'S308','Sina superioara pentru usi suspendate Auriu periat 2601-3000mm cod S308'),
('sina','AURIU PERIAT',3001,4000,'S309','Sina superioara pentru usi suspendate Auriu periat 3001-4000mm cod S309'),
('sina','AURIU PERIAT',4001,5800,'S310','Sina superioara pentru usi suspendate Auriu periat 4001-5800mm cod S310'),
('sina','CUPRU',1,3500,'900','Sina superioara usi suspendate finisaj cupru 3,5 m cod 900'),

--   -- PROFIL MASCARE ŞINĂ  (band pe lungimea şinei; cantitate 1 sau 2, din .js)
('mascare_sina','ALUMINIU',1201,1400,'M001','Profil Mascare Sina Aluminiu 1201-1400Mm Cod M001'),
('mascare_sina','ALUMINIU',1401,1600,'M002','Profil Mascare Sina Aluminiu 1401-1600Mm Cod M002'),
('mascare_sina','ALUMINIU',1601,1800,'M003','Profil Mascare Sina Aluminiu 1601-1800Mm Cod M003'),
('mascare_sina','ALUMINIU',1801,2000,'M004','Profil Mascare Sina Aluminiu 1801-2000Mm Cod M004'),
('mascare_sina','ALUMINIU',2001,2200,'M005','Profil Mascare Sina Aluminiu 2001-2200Mm Cod M005'),
('mascare_sina','ALUMINIU',2201,2400,'M006','Profil Mascare Sina Aluminiu 2201-2400Mm Cod M006'),
('mascare_sina','ALUMINIU',2401,2600,'M007','Profil Mascare Sina Aluminiu 2401-2600Mm Cod M007'),
('mascare_sina','ALUMINIU',2601,3000,'M008','Profil Mascare Sina Aluminiu 2601-3000Mm Cod M008'),
('mascare_sina','ALUMINIU',3001,4000,'M009','Profil Mascare Sina Aluminiu 3001-4000Mm Cod M009'),
('mascare_sina','ALUMINIU',4001,5800,'M010','Profil Mascare Sina Aluminiu 4001-5800Mm Cod M010'),
('mascare_sina','NEGRU MAT',1201,1400,'M101','Profil Mascare Sina Negru Mat 1201-1400Mm Cod M101'),
('mascare_sina','NEGRU MAT',1401,1600,'M102','Profil Mascare Sina Negru Mat 1401-1600Mm Cod M102'),
('mascare_sina','NEGRU MAT',1601,1800,'M103','Profil Mascare Sina Negru Mat 1601-1800Mm Cod M103'),
('mascare_sina','NEGRU MAT',1801,2000,'M104','Profil Mascare Sina Negru Mat 1801-2000Mm Cod M104'),
('mascare_sina','NEGRU MAT',2001,2200,'M105','Profil Mascare Sina Negru Mat 2001-2200Mm Cod M105'),
('mascare_sina','NEGRU MAT',2201,2400,'M106','Profil Mascare Sina Negru Mat 2201-2400Mm Cod M106'),
('mascare_sina','NEGRU MAT',2401,2600,'M107','Profil Mascare Negru Mat 2401-2600Mm Cod M107'),
('mascare_sina','NEGRU MAT',2601,3000,'M108','Profil Mascare Negru Mat 2601-3000Mm Cod M108'),
('mascare_sina','NEGRU MAT',3001,4000,'M109','Profil Mascare Negru Mat 3001-4000Mm Cod M109'),
('mascare_sina','NEGRU MAT',4001,5800,'M110','Profil Mascare Negru Mat 4001-5800Mm Cod M110'),
('mascare_sina','SAMPANIE LUCIOS',1201,1400,'M201','Profil Mascare Sina Sampanie Lucioasa 1201-1400Mm Cod M201'),
('mascare_sina','SAMPANIE LUCIOS',1401,1600,'M202','Profil Mascare Sina Sampanie Lucios 1401-1600Mm Cod M202'),
('mascare_sina','SAMPANIE LUCIOS',1601,1800,'M203','Profil Mascare Sina Sampanie Lucios 1601-1800Mm Cod M203'),
('mascare_sina','SAMPANIE LUCIOS',1801,2000,'M204','Profil Mascare Sina Sampanie Lucios 1801-2000Mm Cod M204'),
('mascare_sina','SAMPANIE LUCIOS',2001,2200,'M205','Profil Mascare Sina Sampanie Lucios 2001-2200Mm Cod M205'),
('mascare_sina','SAMPANIE LUCIOS',2201,2400,'M206','Profil Mascare Sina Sampanie Lucios 2201-2400Mm Cod M206'),
('mascare_sina','SAMPANIE LUCIOS',2401,2600,'M207','Profil Mascare Sina Sampanie Lucios 2401-2600Mm Cod M207'),
('mascare_sina','SAMPANIE LUCIOS',2601,3000,'M208','Profil Mascare Sina Sampanie Lucios  2601-3000Mm Cod M208'),
('mascare_sina','SAMPANIE LUCIOS',3001,4000,'M209','Profil Mascare Sina Sampanie Lucios 3001-4000Mm Cod M209'),
('mascare_sina','SAMPANIE LUCIOS',4001,5800,'M210','Profil Mascare Sina Sampanie Lucios 4001-5800Mm Cod M210'),
('mascare_sina','AURIU PERIAT',1201,1400,'M301','Profil pentru mascarea sinei Auriu periat 1201-1400mm cod M301'),
('mascare_sina','AURIU PERIAT',1401,1600,'M302','Profil pentru mascarea sinei Auriu periat 1401-1600mm cod M302'),
('mascare_sina','AURIU PERIAT',1601,1800,'M303','Profil pentru mascarea sinei Auriu periat 1601-1800mm cod M303'),
('mascare_sina','AURIU PERIAT',1801,2000,'M304','Profil pentru mascarea sinei Auriu periat 1801-2000mm cod M304'),
('mascare_sina','AURIU PERIAT',2001,2200,'M305','Profil pentru mascarea sinei Auriu periat 2001-2200mm cod M305'),
('mascare_sina','AURIU PERIAT',2201,2400,'M306','Profil pentru mascarea sinei Auriu periat 2201-2400mm cod M306'),
('mascare_sina','AURIU PERIAT',2401,2600,'M307','Profil pentru mascarea sinei Auriu periat 2401-2600mm cod M307'),
('mascare_sina','AURIU PERIAT',2601,3000,'M308','Profil pentru mascarea sinei Auriu periat 2601-3000mm cod M308'),
('mascare_sina','AURIU PERIAT',3001,4000,'M309','Profil pentru mascarea sinei Auriu periat 3001-4000mm cod M309'),
('mascare_sina','AURIU PERIAT',4001,5800,'M310','Profil pentru mascarea sinei Auriu periat 4001-5800mm cod M310'),
('mascare_sina','CUPRU',1,3500,'901','Profil mascare sina finisaj cupru 3,5 m cod 901'),

--   -- PROFIL DIVIZARE  (band pe lăţimea liberă a uşii; cantitate = divisions × uşi)
('divizare','ALUMINIU',601,700,'DIV001','Profil Diviz. Usa Suspendata Aluminiu 601-700Mm Cod Div001'),
('divizare','ALUMINIU',701,800,'DIV002','Profil Diviz. Usa Suspendata Aluminiu 701-800Mm Cod Div002'),
('divizare','ALUMINIU',801,900,'DIV003','Profil Diviz. Usa Suspendata Aluminiu 801-900Mm Cod  Div003'),
('divizare','ALUMINIU',901,1000,'DIV004','Profil Diviz. Usa Suspendata Aluminiu 901-1000Mm Cod Div004'),
('divizare','ALUMINIU',1001,1100,'DIV005','Profil Diviz. Usa Suspendata Aluminiu 1001-1100Mm Cod Div005'),
('divizare','ALUMINIU',1101,1200,'DIV006','Profil Diviz. Usa Suspendata Aluminiu 1101-1200Mm Cod Div006'),
('divizare','ALUMINIU',1201,1300,'DIV007','Profil Diviz. Usa Suspendata Aluminiu 1201-1300Mm Cod Div007'),
('divizare','ALUMINIU',1301,1400,'DIV008','Profil Diviz. Usa Suspendata Aluminiu 1301-1400Mm Cod Div008'),
('divizare','ALUMINIU',1401,1500,'DIV009','Profil Diviz. Usa Suspendata Aluminiu 1401-1500Mm Cod Div009'),
('divizare','ALUMINIU',1501,2000,'DIV010','Profil Diviz. Usa Suspendata Aluminiu 1501-2000Mm Cod Div010'),
('divizare','NEGRU MAT',601,700,'DIV101','Profil Diviz. Usa Suspend. Negru Mat 601-700Mm Cod Div101'),
('divizare','NEGRU MAT',701,800,'DIV102','Profil Diviz. Usa Suspend. Negru Mat 701-800Mm Cod Div102'),
('divizare','NEGRU MAT',801,900,'DIV103','Profil Diviz. Usa Suspend. Negru Mat 801-900Mm Cod Div103'),
('divizare','NEGRU MAT',901,1000,'DIV104','Profil Diviz. Usa Suspend. Negru Mat 901-1000Mm Cod Div104'),
('divizare','NEGRU MAT',1001,1100,'DIV105','Profil Diviz. Usa Suspen. Negru Mat 1001-1100Mm Cod Div105'),
('divizare','NEGRU MAT',1101,1200,'DIV106','Profil Diviz. Usa Suspen. Negru Mat 1101-1200Mm Cod Div106'),
('divizare','NEGRU MAT',1201,1300,'DIV107','Profil Diviz. Usa Suspen. Negru Mat 1201-1300Mm Cod Div107'),
('divizare','NEGRU MAT',1301,1400,'DIV108','Profil Diviz. Usa Suspen. Negru Mat 1301-1400Mm Cod Div108'),
('divizare','NEGRU MAT',1401,1500,'DIV109','Profil Diviz. Usa Suspen. Negru Mat 1401-1500Mm Cod Div109'),
('divizare','NEGRU MAT',1501,2000,'DIV110','Profil Diviz. Usa Suspen. Negru Mat 1500-2000Mm Cod Div110'),
('divizare','SAMPANIE LUCIOS',601,700,'DIV201','Profil Diviz. Usa Suspendata Sampanie Lucios 601-700Mm Cod Div201'),
('divizare','SAMPANIE LUCIOS',701,800,'DIV202','Profil Diviz. Usa Suspendata Sampanie Lucios 701-800Mm Cod Div202'),
('divizare','SAMPANIE LUCIOS',801,900,'DIV203','Profil Diviz. Usa Suspendata Sampanie Lucios 801-900Mm Cod Div203'),
('divizare','SAMPANIE LUCIOS',901,1000,'DIV204','Profil Diviz. Usa Suspendata Sampanie Lucios 901-1000Mm Cod Div204'),
('divizare','SAMPANIE LUCIOS',1001,1100,'DIV205','Profil Diviz. Usa Suspen. Sampanie Lucios 1001-1100Mm Cod Div205'),
('divizare','SAMPANIE LUCIOS',1101,1200,'DIV206','Profil Diviz. Usa Suspen. Sanpanie Lucios 1101-1200Mm Cod Div206'),
('divizare','SAMPANIE LUCIOS',1201,1300,'DIV207','Profil Diviz. Usa Suspen. Sampanie Lucios1201-1300Mm Cod Div207'),
('divizare','SAMPANIE LUCIOS',1301,1400,'DIV208','Profil Diviz. Usa Suspen. Sampanie Lucios 1301-1400Mm Cod Div208'),
('divizare','SAMPANIE LUCIOS',1401,1500,'DIV209','Profil Diviz. Usa Suspen. Sampanie Lucios 1401-1500Mm Cod Div209'),
('divizare','SAMPANIE LUCIOS',1501,2000,'DIV210','Profil Diviz. Usa Suspen. Sampanie Lucios 1501-2000Mm Cod Div201'),
('divizare','AURIU PERIAT',601,700,'DIV301','Profil pentru divizarea usilor suspendate Auriu periat 601-700mm cod DIV301'),
('divizare','AURIU PERIAT',701,800,'DIV302','Profil pentru divizarea usilor suspendate Auriu periat 701-800mm cod DIV302'),
('divizare','AURIU PERIAT',801,900,'DIV303','Profil pentru divizarea usilor suspendate Auriu periat 801-900mm Cod  DIV303'),
('divizare','AURIU PERIAT',901,1000,'DIV304','Profil pentru divizarea usilor suspendate Auriu periat 901-1000mm cod DIV304'),
('divizare','AURIU PERIAT',1001,1100,'DIV305','Profil pentru divizarea usilor suspendate Auriu periat 1001-1100mm cod DIV305'),
('divizare','AURIU PERIAT',1101,1200,'DIV306','Profil pentru divizarea usilor suspendate Auriu periat 1101-1200mm cod DIV306'),
('divizare','AURIU PERIAT',1201,1300,'DIV307','Profil pentru divizarea usilor suspendate Auriu periat 1201-1300mm cod DIV307'),
('divizare','AURIU PERIAT',1301,1400,'DIV308','Profil pentru divizarea usilor suspendate Auriu periat 1301-1400mm cod DIV308'),
('divizare','AURIU PERIAT',1401,1500,'DIV309','Profil pentru divizarea usilor suspendate Auriu periat 1401-1500mm cod DIV309'),
('divizare','AURIU PERIAT',1501,2000,'DIV310','Profil pentru divizarea usilor suspendate Auriu periat 1501-2000mm cod DIV310'),
('divizare','CUPRU',601,700,'DIV401','Profil pentru divizarea usilor suspendate Cupru 601-700mm cod DIV401'),
('divizare','CUPRU',701,800,'DIV402','Profil pentru divizarea usilor suspendate Cupru 701-800mm cod DIV402'),
('divizare','CUPRU',801,900,'DIV403','Profil pentru divizarea usilor suspendate Cupru 801-900mm Cod  DIV403'),
('divizare','CUPRU',901,1000,'DIV404','Profil pentru divizarea usilor suspendate Cupru 901-1000mm cod DIV404'),
('divizare','CUPRU',1001,1100,'DIV405','Profil pentru divizarea usilor suspendate Cupru 1001-1100mm cod DIV405'),
('divizare','CUPRU',1101,1200,'DIV406','Profil pentru divizarea usilor suspendate Cupru 1101-1200mm cod DIV406'),
('divizare','CUPRU',1201,1300,'DIV407','Profil pentru divizarea usilor suspendate Cupru 1201-1300mm cod DIV407'),
('divizare','CUPRU',1301,1400,'DIV408','Profil pentru divizarea usilor suspendate Cupru 1301-1400mm cod DIV408'),
('divizare','CUPRU',1401,1500,'DIV409','Profil pentru divizarea usilor suspendate Cupru 1401-1500mm cod DIV409');

-- ─────────────────────────────────────────────────────────────────────────────
--  VERIFICĂRI (rulează după populare, în DB Browser → Execute SQL):
--
--   -- benzi care se suprapun pe acelaşi (tip, finisaj):
--   SELECT a.tip,a.finisaj,a.cod,b.cod FROM articol a JOIN articol b
--     ON a.tip=b.tip AND IFNULL(a.finisaj,'')=IFNULL(b.finisaj,'')
--        AND a.cod<b.cod AND a.lmin<=b.lmax AND b.lmin<=a.lmax;
--
--   -- câte coduri pe tip × finisaj:
--   SELECT tip, finisaj, COUNT(*) FROM articol GROUP BY tip, finisaj ORDER BY 1,2;
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
--  Divizări APLICATE (opţiuni avansate) — benzi lipite pe panouri, bară de 3m,
--  la bară întreagă. Aceleaşi coduri ca la Confort, pe culorile suspendatelor;
--  denumiri EXACT ca de la user (2026-09-18). Crom lucios (129/130) — fără
--  finisaj corespondent la suspendate.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO articol (tip, finisaj, lmin, lmax, cod, denumire, um) VALUES
('divizare aplicata 10','ALUMINIU',NULL,NULL,'104','Divizare aplicata  10x1,4 mm, finisaj aluminiu 3 m cod 104','bară'),
('divizare aplicata 10','SAMPANIE LUCIOS',NULL,NULL,'118','Divizare aplicata 10x1,4 mm, finisaj sampanie luciosa 3 m cod 118','bară'),
('divizare aplicata 10','NEGRU MAT',NULL,NULL,'149','Divizare aplicata 10x1,4 mm, finisaj negru mat 3 m cod 149','bară'),
('divizare aplicata 10','AURIU PERIAT',NULL,NULL,'156','Divizare aplicata 10x1,4 mm, finisaj auriu periat 3 m cod 156','bară'),
('divizare aplicata 10','CUPRU',NULL,NULL,'182','Divizare aplicata  10x1,4 mm, finisaj cupru 3 m cod 182','bară'),
('divizare aplicata 20','ALUMINIU',NULL,NULL,'105','Divizare aplicata 20x1,4 mm, finisaj aluminiu 3 m cod 105 cod 105','bară'),
('divizare aplicata 20','SAMPANIE LUCIOS',NULL,NULL,'119','Divizare aplicata 20x1,4 mm, finisaj sampanie lucioasa 3 m cod 119','bară'),
('divizare aplicata 20','NEGRU MAT',NULL,NULL,'150','Divizare aplicata 20x1,4 mm, finisaj negru mat 3 m cod 150','bară'),
('divizare aplicata 20','AURIU PERIAT',NULL,NULL,'157','Divizare aplicata 20x1,4 mm, finisaj auriu periat 3 m cod 157','bară'),
('divizare aplicata 20','CUPRU',NULL,NULL,'183','Divizare aplicata  20x1,4 mm, finisaj cupru 3 m cod 183','bară');

-- ─────────────────────────────────────────────────────────────────────────────
--  Profilele uşii — DOAR pt. NECESAR (userul, 2026-09-21). La facturare sunt
--  incluse în codul uşii (împreună cu şuruburile 276, 4/uşă), deci nu apar
--  separat acolo. Codul nu depinde de lungime (se taie la cotă).
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO articol (tip, finisaj, lmin, lmax, cod, denumire) VALUES
('vertical','ALUMINIU',NULL,NULL,'352','Profil maner usi suspendate finisaj aluminiu 5,8 m'),
('vertical','NEGRU MAT',NULL,NULL,'362','Profil maner usi suspendate finisaj negru periat  5,8 m'),
('vertical','SAMPANIE LUCIOS',NULL,NULL,'372','Profil maner usi suspendate finisaj sampanie lucios  5,8 m'),
('vertical','AURIU PERIAT',NULL,NULL,'392','Profil maner usi suspendate finisaj auriu periat 5,5 m'),
('vertical','CUPRU',NULL,NULL,'902','Profil maner usi suspendate finisaj cupru 3 m cod 902'),
('orizontal superior','ALUMINIU',NULL,NULL,'353','Orizontal superior usi suspendate finisaj aluminiu 5,8 m'),
('orizontal superior','NEGRU MAT',NULL,NULL,'363','Orizontal superior usi suspendate finisaj negru periat 5,8 m'),
('orizontal superior','SAMPANIE LUCIOS',NULL,NULL,'373','Orizontal superior usi suspendate finisaj sampanie lucios 5,8 m'),
('orizontal superior','AURIU PERIAT',NULL,NULL,'393','Orizontal superior usi suspendate finisaj auriu periat 5,8 m'),
('orizontal superior','CUPRU',NULL,NULL,'903','Orizontal superior usi suspendate finisaj cupru 3,5 m cod 903'),
('orizontal inferior','ALUMINIU',NULL,NULL,'354','Orizontal inferior usi suspendate finisaj aluminiu 5,8 m'),
('orizontal inferior','NEGRU MAT',NULL,NULL,'364','Orizontal inferior usi suspendate finisaj negru periat 5,8 m'),
('orizontal inferior','SAMPANIE LUCIOS',NULL,NULL,'374','Orizontal inferior usi suspendate finisaj sampanie lucios 5,8 m'),
('orizontal inferior','AURIU PERIAT',NULL,NULL,'394','Orizontal inferior usi suspendate finisaj auriu periat 5,8 m'),
('orizontal inferior','CUPRU',NULL,NULL,'904','Orizontal inferior usi suspendate finisaj cupru 3,5 m cod 904');
