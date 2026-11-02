# Produse din exportul NeoManager — design

Ramura: `produse-neomanager`. Data: 2026-11-02.

## Ce se cere

Colegii scot un export din NeoManager, îl încarcă în manager, iar produsele noi apar la
oferta cu amănuntul fără intervenţia lui Anghel şi fără o actualizare a aplicaţiei. În bază
stau toate produsele, cele care nu trebuie găsite de colegi fiind marcate „nelistat”.

Azi lista e fixă: `configurator_usi/scripts/amanunt.mjs` generează `js/catalog/amanunt.json`,
care intră în bundle-ul paginii `amanunt.html`.

## Reguli (decise de user)

1. **Pornire:** tot exportul existent intră în bază. Ce apare azi la amănunt rămâne listat,
   restul devine nelistat.
2. **Export nou:** comparaţie după cod. Un cod care nu e în bază se adaugă **listat**.
3. **Ce lipseşte din export** nu se şterge şi nu se trece pe nelistat. Exportul poate fi
   complet sau doar cu produsele noi.
4. **Ce e nelistat rămâne nelistat** la orice export.
5. **Produs listat** = colegii îl găsesc la oferta cu amănuntul.
6. **Produsele noi se vând la bucată întreagă.** Regula se schimbă din pagina „Produse”.

## Decizii de design

- **Produsele existente nu se modifică la import**, nici denumirea, UM sau grupa. Se
  păstrează astfel cele 24 de denumiri din „Toata baza de date”, care diferă de export.
- **Produsele noi nu au `bara` şi nici `fact`:** fără debitare, fără mod de facturare.
- Fără preţuri şi stocuri în bază; din export se citesc doar `Cod`, `Denumire`, `UM`, `Grupa`.
- Listarea din pagina nouă e singura excepţie de la „nu se schimbă”: un produs trece
  listat ↔ nelistat doar prin acţiunea unui om.
- **Regula de facturare** se schimbă pe rând, din coloana „Facturare”: bucăţi întregi, întreg sau
  jumătate, lungimea + 15 % (doar la bară), multiplu de N. O schimbă cine are permisiunea „Produse”.
  „După lungimea bucăţii” şi „H × L × buc” nu se aleg, doar se pot înlocui, cu confirmare.
  Ofertele salvate îşi păstrează cantităţile; regula nouă se aplică la următoarea modificare.
- **Căutarea** merge şi după grupă, la „Produse” şi la oferta cu amănuntul; acolo denumirea are
  întâietate faţă de grupă, iar lista rămâne tăiată la 30 de rezultate.

## Date

Tabel nou în baza managerului, migraţia v39:

```sql
CREATE TABLE produs (
  cod        TEXT PRIMARY KEY,
  denumire   TEXT NOT NULL,
  um         TEXT NOT NULL DEFAULT '',
  grupa      TEXT NOT NULL DEFAULT '',
  bara       INTEGER,                    -- lungimea barei în mm (debitare)
  fact       TEXT,                       -- modul de facturare, JSON
  listat     INTEGER NOT NULL DEFAULT 1,
  adaugat_la TEXT                        -- NULL la pornire; data importului la cele noi
);
```

**Pornirea:** `manager/server/produse-start.json` (în repo), generat o singură dată de un
script din cel mai nou export complet şi `amanunt.json`. Cu exportul din septembrie:
1362 listate (inclusiv 11 care nu sunt în export) + 5296 nelistate = 6658. Rândurile listate
vin din `amanunt.json`, cu `bara` şi `fact` neschimbate.

`amanunt.json` iese din bundle. `scripts/amanunt.mjs` nu mai e calea de actualizare; testele
îşi iau produsele din `produse-start.json`.

## Server

`manager/server/produse.js`:

| Rută | Cine | Ce face |
|---|---|---|
| `GET /api/produse` | autentificat | produsele listate, pentru `amanunt.html` |
| `GET /api/produse/coduri?coduri=…` | autentificat | produsele cerute, şi nelistate (oferte vechi) |
| `GET /api/produse/lista?cauta=&stare=&pagina=` | permisiunea „Produse” | lista paginii „Produse”, câte 100 |
| `POST /api/produse/verifica` | permisiunea „Produse” | citeşte fişierul, întoarce noile fără să scrie |
| `POST /api/produse/incarca` | permisiunea „Produse” | citeşte fişierul din nou şi adaugă noile |
| `POST /api/produse/listare` | permisiunea „Produse” | `{ cod, listat }` |
| `POST /api/produse/regula` | permisiunea „Produse” | `{ cod, regula, multiplu? }` |

Permisiunea se bifează în Tabloul admin, la fiecare cont de birou; adminul şi conducerea au tot.

Codurile conţin spaţii şi `/` („SM10/GLASS”), de aceea `listare` ia codul din corp, nu din cale.

Fişierul vine în JSON, ca base64, sub limita de corp de 8 MB; fişiere de cel mult 5 MB.
Parserul `.xlsx` se copiază în `manager/server/xlsx.js`, pentru că `clienti-agenti/` nu intră în
pachetul de actualizare (`PARTI` din `actualizare.js`).

**Importul:** rândurile fără cod sau fără denumire se sar şi se numără; codul se compară exact,
după `trim`; la un cod repetat în fişier contează primul rând; totul într-o tranzacţie. Al doilea
import cu acelaşi fişier nu adaugă nimic.

**Erori:** fişier care nu e `.xlsx`, sau fără coloanele `Cod`, `Denumire`, `UM`, `Grupa` → refuzat,
cu mesaj pe înţeles şi fără nicio scriere.

**Jurnal:** încărcarea şi listarea au nume în `OPERATII` (`activitate.js`).

**Modul test:** importul şi listarea urmează regula generală: din test scriu doar pe copie,
iar ce e pe bune ajunge şi în copie. Tabelul are cheie primară, deci sesiunile îl urmăresc.

## Pagina „Produse”

`/produse`, link în meniu pentru cine are permisiunea „Produse”.

- Sus: încărcarea exportului. După alegerea fişierului apare „X produse noi” cu lista lor şi
  butonul de confirmare. Cu 0 noi, doar un mesaj.
- Dedesubt: căutare, filtru Toate / Listate / Nelistate, tabel Cod, Denumire, UM, Grupa şi
  buton „Listează” / „Nu lista”.
- Mesajele trec prin `dialog.js`. Pagina se verifică la ~1440 px.

## Oferta cu amănuntul

`amanunt.js` îşi ia produsele din `GET /api/produse` înainte de pornire, nu din import. Ordinea
e `localeCompare(…, 'ro')`, ca azi, pentru că departajează rezultatele căutării.

- Dacă lista nu se încarcă: mesaj clar şi buton de reîncercare, fără pagină goală.
- La deschiderea unei oferte salvate se cer prin `/api/produse/coduri` codurile care nu sunt
  în listă, ca `bara` şi `fact` să rămână corecte şi la produsele trecute pe nelistat.
- Oferta salvată nu se recalculează: liniile rămân copiate, ca până acum.
- Produsele noi apar la următoarea deschidere a paginii.

## Teste

- Import: cod nou → listat; cod existent → neschimbat, inclusiv denumirea; cod nelistat → rămâne
  nelistat; cod lipsă din export → neschimbat; export parţial; acelaşi fişier de două ori; coloane
  lipsă; rânduri fără cod; cod repetat.
- `verifica` nu scrie nimic.
- Pornire: 1362 listate, identice cu `amanunt.json`.
- Amănunt: produs nelistat dispare din căutare; oferta veche cu produs nelistat îşi păstrează
  `bara` şi `fact`.
- Înainte de push: toţi paşii din `teste.yml`, inclusiv `npm run tipuri`.

## Riscuri

- **Exportul de pornire e din septembrie** (ultimul produs creat: 2026-09-07). Tot ce s-a creat
  după aceea ar apărea „nou” la prima încărcare. Lista de confirmare îl arată. Un export proaspăt
  înainte de lansare rezolvă problema.
- **Ramele cu cod nou intră listate** (regula 2). În cele 6 luni dinaintea exportului s-au creat
  959. Se trec pe nelistat din pagină, câte unul.
- **Numărul migraţiei:** ramurile `securitate-clienti`, `reclamatii` şi `clienti-birou` nu sunt
  pe main şi pot folosi aceleaşi versiuni. Se renumerotează la merge.
