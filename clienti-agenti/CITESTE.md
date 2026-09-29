# Baza de clienţi — agenţii de vânzări

https://clienti-agenti.pages.dev — Cloudflare Pages + baza D1 `clienti-agenti` (gratuit).
Aici e ORIGINALUL bazei de clienţi. Managerul (serverul din firmă) ţine o copie şi preia
singur schimbările la 5 minute (`manager/server/clienti.js`).

- Agentul intră cu user + parolă şi vede doar clienţii cu numele lui în coloana AGENT;
  îi poate modifica şi poate adăuga clienţi noi (pe numele lui). Nu poate şterge.
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
