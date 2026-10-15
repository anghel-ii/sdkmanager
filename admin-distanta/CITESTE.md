# Tabloul de admin de oriunde

https://sdk-admin.iacob2anghel2004.workers.dev — tot managerul din firmă, logat ca admin, de oriunde.
Worker + un Durable Object (gratuit). Serverul din firmă se leagă singur aici (`manager/server/releu.js`,
doar pe Windows) şi execută cererile paginii; nu primeşte nimic din internet. Intrarea: parola `PAROLA_ADMIN`
(10 greşeli / 15 min → blocat), ţine 30 de zile pe dispozitiv; schimbarea parolei scoate pe toată lumea.

| Ce | Comanda (din folderul ăsta) |
|---|---|
| parola de intrare | `npx wrangler secret put PAROLA_ADMIN` |
| cheia managerului (aceeaşi ca în clienti-agenti) | `npx wrangler secret put CHEIE_MANAGER` |
| publicare | `npx wrangler deploy` |
| probă pe laptop | `npx wrangler dev` (`.dev.vars`: CHEIE_MANAGER, PAROLA_ADMIN) + managerul cu `MANAGER_RELEU_URL=ws://127.0.0.1:8787/_releu` |
