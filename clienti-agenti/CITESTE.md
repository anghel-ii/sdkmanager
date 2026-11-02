# Baza de clienţi — agenţii de vânzări

https://clienti-agenti.pages.dev — Cloudflare Pages + baza D1 `clienti-agenti` (gratuit).
Aici e ORIGINALUL bazei de clienţi. Managerul (serverul din firmă) ţine o copie şi preia
singur schimbările la 5 minute (`manager/server/clienti.js`).

- Agentul intră cu user + parolă şi vede doar clienţii cu numele lui în coloana AGENT;
  îi poate modifica (cu aprobare) şi poate adăuga clienţi noi pe numele lui (direct în bază, fără aprobare, + mail). Nu poate şterge.
- Conturi de CONDUCERE (`agent.rol = 'conducere'`, alese din /admin al managerului: „Tip cont"): văd TOŢI clienţii,
  cu coloana Agent în plus, şi scriu direct, fără aprobare (şi clienţi noi). Agentul schimbat = clientul trece la noul
  agent (îl vede şi îl modifică din contul lui); modificarea în aşteptare a celui vechi pe el se pierde. Agentul trebuie
  să fie un cont de agent sau o valoare deja în coloana AGENT (BIROU, SITE…) — altfel 400.
  ✅ FĂCUT pe baza remote (2026-10-27) — nu se mai rulează (dă „duplicate column name"):
  `npx wrangler d1 execute clienti-agenti --remote --command="ALTER TABLE agent ADD COLUMN rol TEXT NOT NULL DEFAULT 'agent'"`.
- Conducerea / adminul, din pagina Clienţi a managerului: modifică direct (fără aprobare, şi agentul) şi
  şterge clienţi (`PUT` / `DELETE /api/clienti/:id` cu cheia managerului). Şters = `sters_la` + versiune
  nouă: rândul rămâne, ca ştergerea să ajungă în copiile managerului; agentul nu-l mai vede.
  ✅ FĂCUT pe baza remote (2026-10-27): `npx wrangler d1 execute clienti-agenti --remote --command="ALTER TABLE client ADD COLUMN sters_la TEXT"`.
- **Reduceri pe grupe de produse + modalitate de plată + ştergere + fără refresh (2026-10-29).** Reducerile au câte o coloană
  pe fiecare „GrupaProdus" din NeoManager (34, lista `GAME` din public/index.html); textul vechi („LUX 15%, GOLA 5%")
  se citeşte singur în grupele noi; gamele vechi fără grupă nouă (Usi, MANER, Sertare, Hairpin, Jolly, Rehau, Acc SDK,
  Lamele) nu mai sunt relevante — nu se mai arată. „Alte" = doar notiţe text. Lista şi citirea: `public/reduceri.js`.
  După publicare, o singură dată: `node curata-reduceri.mjs` (arată ce schimbă) şi `node curata-reduceri.mjs --aplica`
  — rescrie reducerile tuturor clienţilor (şi ale cererilor în aşteptare) pe grupele noi, cu backup în ../date-clienti/. „Modalitate de plată" = text liber
  (`client.modalitate_plata`). 🗑 în stânga: conducerea şterge direct, agentul CERE ştergerea (cu aprobare, ↺ o anulează).
  Un rând = o singură cerere: ce mai trimite agentul până la aprobare o înlocuieşte (şi o ştergere / o modificare
  una pe alta); înapoi exact cum era = cererea dispare. Pagina întreabă `GET /api/clienti?semn` la 30 s între 7 şi 18, altfel la 10 minute, şi
  reîncarcă lista doar când s-a schimbat ceva (rândul în care scrii nu se atinge).
  Pe baza remote, o singură dată, ÎNAINTE de publicare (rulat din folderul ăsta):
  `npx wrangler d1 execute clienti-agenti --remote --command="ALTER TABLE client ADD COLUMN modalitate_plata TEXT; ALTER TABLE propunere ADD COLUMN stergere INTEGER NOT NULL DEFAULT 0"`.
- Conturile agenţilor se fac din manager: `/admin` → „Conturi agenţi de vânzări" (cont nou, parolă nouă,
  dezactivare, „Intră ca agent" = link de o folosinţă, 60 s → sesiune de 8 ore în contul agentului, cu bandă
  galbenă; nu-i schimbă parola şi nu apare la „Logat acum"). Tabelele `sesiune.admin` + `bilet`. Aceleaşi operaţii şi din linia de comandă, pe laptop, din folderul ăsta:

| Ce | Comanda |
|---|---|
| cont nou / parolă nouă | `node agent.mjs "Serban Dragos"` (numele EXACT ca în coloana AGENT) |
| dezactivare | `node agent.mjs --dezactiveaza "Serban Dragos"` |
| republicare după modificări | `npx wrangler pages deploy --branch main` |
| test cititor Excel | `node test/xlsx.test.mjs` |

`importa.mjs` a adus Excel-ul „Livrare_MASINA_completat" o singură dată (2026-09-29); refuză
să mai ruleze cât baza are clienţi. Cheia managerului: secretul `CHEIE_MANAGER` din Pages;
copia locală e în `.dev.vars` (nu intră în git).

## Mailul pentru NeoManager

La fiecare client nou (agent sau conducere; şi la aprobarea celor vechi rămaşi „De aprobat") pleacă un mail cu toate
datele, ca un coleg să-l treacă în NeoManager (`lib/mail.js`). Nu pleacă la modificări sau ştergeri. Dacă nu pleacă,
clientul rămâne salvat, iar cine l-a salvat vede un avertisment.

Mailul îl trimite un Google Apps Script (`mail-script.gs`) de pe contul Gmail al portalului. Rulează pe serverele Google:
nu trebuie să stea nimeni logat. Limita Google: 100 de destinatari pe zi, iar CC-ul se numără (destinatar + un CC = 50 de mailuri pe zi). Destinatarul şi CC-ul se schimbă DOAR în script.

Punere în funcţiune:
1. `openssl rand -hex 24` → cheia. Pe script.google.com, proiect nou, lipeşti `mail-script.gs`, completezi CHEIE, DESTINATAR şi CC.
2. Run pe funcţia `proba` → autorizezi → trebuie să ajungă mailul de probă.
3. Deploy → New deployment → Web app; Execute as: Me; Who has access: Anyone → copiezi URL-ul (se termină cu /exec).
4. Din folderul ăsta, ÎNAINTE de publicarea codului:
   `npx wrangler pages secret put MAIL_URL --project-name clienti-agenti`, apoi la fel `MAIL_CHEIE`.
5. Publici portalul. Schimbi scriptul → Deploy → Manage deployments → versiune nouă (URL-ul rămâne).
