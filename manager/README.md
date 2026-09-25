# Manager de comenzi

Partea a doua a aplicaţiei: ofertele şi comenzile tuturor utilizatorilor, la un loc, cu
urmărirea producţiei prin scanarea unui cod de bare de pe foaia de comandă.

Un singur proces Node serveşte tot, pe acelaşi origin — de-aia acelaşi cookie de sesiune
funcţionează şi în configurator:

| Cale | Ce e |
|---|---|
| `/` | managerul (taburile Oferte / Comenzi în lucru) |
| `/login` | autentificare |
| `/scan` | pagina de scanare, pentru telefon |
| `/test-camera` | verifică dacă browserul telefonului dă acces la cameră |
| `/configurator/` | configuratorul 3D, din `../configurator_usi/dist` |
| `/api/*` | API-ul JSON |

Zero dependenţe de runtime: `node:http`, `node:https`, `node:sqlite`, `node:crypto`.
Necesită **Node ≥ 22.5** (pentru `node:sqlite`).

## Pornire

```bash
cd configurator_usi && node build.js     # o dată, ca să existe dist/
cd ../manager
node scripts/init.js                     # creează baza + primul admin (afişează parola O DATĂ)
npm start
```

Rulat a doua oară, `init.js` nu strică nimic: dacă există deja utilizatori, se opreşte.
Conturile următoare se adaugă din aplicaţie, cu un cont de administrator.

```bash
npm test       # 35 de verificări end-to-end, pe o bază temporară
```

## Pe serverul Windows al firmei

Instalare şi update-uri: vezi [`deploy/windows/CITESTE.md`](../deploy/windows/CITESTE.md)
(Node + Git instalate automat, pornire odată cu serverul, update cu revenire automată).

## Configurare

Totul din variabile de mediu; în atelier se pun într-un fişier de unit systemd.

| Variabilă | Implicit |
|---|---|
| `MANAGER_PORT` | `8443` cu TLS, `8080` fără |
| `MANAGER_DB` | `date/manager.sqlite` |
| `MANAGER_BACKUP` | `date/backup` |
| `MANAGER_TLS_CERT` | `certs/fullchain.pem` |
| `MANAGER_TLS_KEY` | `certs/privkey.pem` |
| `MANAGER_DIST` | `../configurator_usi/dist` |

Serverul porneşte pe HTTPS **doar dacă ambele fişiere de certificat există pe disc**;
altfel cade pe HTTP şi spune asta în log.

## Camera telefonului — HTTPS, sau excepţia din Chrome

Camera nu porneşte pe HTTP simplu: browserele blochează `getUserMedia` pe origini
nesecurizate, iar `http://192.168.x.x` e nesecurizată. Sunt două căi.

### Acum: excepţia din Chrome pe Android

Cât timp se scanează **numai de pe Android**, Chrome acceptă o excepţie explicită pentru o
origine anume — deci poţi porni fără certificat şi fără să aştepţi DNS-ul. Pe fiecare telefon:

1. `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
2. lipeşte exact originea serverului, cu tot cu port: `http://192.168.x.x:8080`
3. pune lista pe **Enabled** → **Relaunch**

Pagina `/test-camera` detectează Android şi afişează paşii ăştia cu originea corectă
pre-completată şi un buton de copiere.

Ce trebuie ştiut: excepţia e **per telefon** şi se poate pierde la actualizări de Chrome;
pe HTTP simplu parola de login circulă necriptată prin reţea; şi **nu funcţionează pe iPhone**.

### Durabil: certificat real

Obligatoriu din momentul în care apare primul iPhone în echipă — acolo **nu există niciun
ocol**, fiindcă toate browserele de pe iOS folosesc motorul Safari şi flag-ul de mai sus n-are
echivalent. *(Verificat septembrie 2026: DMA permite alte motoare în UE din iOS 17.4, dar
niciun browser n-a livrat aşa ceva — doar prototipuri.)*

Paşii, cu domeniul firmei:

1. **A-record** `atelier.<domeniu> → IP-ul serverului din LAN`. Un nume public care indică
   spre o adresă privată e perfect valid.
2. **Certificat prin DNS-01**, nu HTTP-01 — nu vrem ca Let's Encrypt să intre pe portul 80
   dinspre internet. DNS-01 scrie un record TXT prin API-ul DNS-ului, deci serverul are
   nevoie doar de internet spre exterior:

   ```bash
   certbot certonly --preferred-challenges dns \
     --dns-<furnizor> --dns-<furnizor>-credentials ~/.secrets/dns.ini \
     -d atelier.<domeniu>
   ```

   **Singura cerinţă reală: furnizorul de DNS să aibă API.** Dacă nu are, mută DNS-ul pe
   Cloudflare (gratis, domeniul rămâne unde e).
3. Leagă certificatul şi porneşte:

   ```bash
   MANAGER_TLS_CERT=/etc/letsencrypt/live/atelier.<domeniu>/fullchain.pem \
   MANAGER_TLS_KEY=/etc/letsencrypt/live/atelier.<domeniu>/privkey.pem \
   npm start
   ```
4. **Verifică de pe un telefon real**: deschide `https://atelier.<domeniu>/test-camera` şi
   apasă butonul. Dacă pagina spune că totul e verde, scanarea va merge.

### Două capcane

- Telefoanele trebuie să intre prin **numele de domeniu, nu prin IP** — certificatul e emis
  pe nume. Linkul dat colegilor trebuie să fie numele.
- Routerele şi Pi-hole au adesea „DNS rebinding protection", care aruncă răspunsurile DNS
  ce indică spre IP-uri private. Dacă numele nu se rezolvă în reţea, asta e cauza.

### Dacă certificatul devine o bătaie de cap

Pagina de scanare are şi un câmp de introducere manuală a codului. Acelaşi câmp face
aplicaţia compatibilă cu scanerele Bluetooth/HID şi cu terminalele Android cu scaner
încorporat — toate se comportă ca o tastatură. Trecerea pe hardware nu cere nicio
modificare de cod.

## Backup

Baza de date e singura copie a ofertelor şi comenzilor firmei. Serverul face zilnic
`VACUUM INTO` în `date/backup/` (copie consistentă, fără oprirea serverului) şi păstrează
ultimele 30 de zile. Folderul ăla trebuie să ajungă şi în afara serverului.

## Structură

```
server/
  index.js    rutare, fişiere statice, pornire
  config.js   variabile de mediu
  db.js       node:sqlite, migraţii, backup
  auth.js     scrypt, sesiuni, cookie
  http.js     json, corp, static, router
  schema.sql  toată schema, idempotentă
  api/        un fişier per zonă a API-ului
web/          paginile (login, manager, scan, test-camera)
scripts/      init.js, test.js
```
