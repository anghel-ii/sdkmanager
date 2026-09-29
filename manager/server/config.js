const path = require('node:path');
const fs   = require('node:fs');

// ── Configurare ──────────────────────────────────────────────────────────────
// Totul din variabile de mediu, cu valori implicite bune pentru rularea locală.
// În atelier se pun într-un fişier de unit systemd, nu în cod.
//
//   MANAGER_PORT       portul de ascultare
//   MANAGER_DB         calea bazei de date
//   MANAGER_TLS_CERT   certificat (fullchain.pem)   ─┐ dacă AMBELE sunt setate
//   MANAGER_TLS_KEY    cheie privată (privkey.pem)  ─┘ serverul porneşte pe HTTPS
//   MANAGER_DIST       dist-ul configuratorului
//   MANAGER_BACKUP     folderul de backup zilnic
//   MANAGER_SCANARE    1 = porneşte scanarea din atelier (coduri de bare);
//                      implicit OPRITĂ — vezi mai jos
//   MANAGER_CLIENTI_URL    adresa formularului agenţilor (Cloudflare), ex.
//   MANAGER_CLIENTI_CHEIE  https://clienti-agenti.pages.dev + cheia de acolo;
//                          fără ele preluarea clienţilor e oprită

const RADACINA = path.resolve(__dirname, '..');

const cert = process.env.MANAGER_TLS_CERT || path.join(RADACINA, 'certs', 'fullchain.pem');
const key  = process.env.MANAGER_TLS_KEY  || path.join(RADACINA, 'certs', 'privkey.pem');

// HTTPS doar dacă perechea chiar există pe disc — altfel serverul ar refuza să
// pornească din cauza unei căi implicite care nu s-a completat niciodată.
const tlsGata = fs.existsSync(cert) && fs.existsSync(key);

const config = {
  radacina: RADACINA,
  https:    tlsGata,
  tls:      tlsGata ? { cert, key } : null,
  port:     +(process.env.MANAGER_PORT || (tlsGata ? 8443 : 8080)),

  db:     process.env.MANAGER_DB     || path.join(RADACINA, 'date', 'manager.sqlite'),
  backup: process.env.MANAGER_BACKUP || path.join(RADACINA, 'date', 'backup'),

  web:  path.join(RADACINA, 'web'),
  dist: process.env.MANAGER_DIST || path.resolve(RADACINA, '..', 'configurator_usi', 'dist'),

  // Scanarea din atelier (coduri de bare, pagina /scan, istoricul operaţiilor)
  // — OPRITĂ deocamdată (userul, 2026-09-23: „o chestiune pt mai târziu").
  // Codul (server/scanare.js, tabelele usa/scanare/operatie) rămâne; cu ea
  // oprită serverul nu-l încarcă, nu serveşte /scan*, iar API-ul nu trimite
  // coduri de bare, status sau istoric — interfeţele le ascund singure.
  // Codul de bare se generează în continuare la fiecare comandă (în DB), ca
  // la repornire să nu existe comenzi fără cod. Repornire: MANAGER_SCANARE=1.
  scanare: process.env.MANAGER_SCANARE === '1',

  // Clienţii de la agenţii de vânzări — vezi server/clienti.js
  clientiUrl:   (process.env.MANAGER_CLIENTI_URL || '').replace(/\/$/, ''),
  clientiCheie: process.env.MANAGER_CLIENTI_CHEIE || '',

  // Cât ţine o sesiune fără activitate. 30 de zile: omul din atelier se
  // loghează o dată pe telefon şi nu se mai gândeşte la asta.
  sesiuneZile: 30,
};

module.exports = { config };
