const crypto = require('node:crypto');
const { deschide, db } = require('../server/db.js');
const { creeazaUtilizator } = require('../server/auth.js');
const { config } = require('../server/config.js');

// ── Iniţializare: creează baza de date şi primul cont de administrator ───────
//   node scripts/init.js                    → parolă generată, afişată o dată
//   node scripts/init.js ion "Ion Popescu"  → user şi nume alese
//
// Rulat a doua oară nu strică nimic: dacă există deja utilizatori, se opreşte.

function main() {
  const [user = 'admin', nume = 'Administrator'] = process.argv.slice(2);

  deschide();

  const { n } = db().prepare('SELECT COUNT(*) AS n FROM utilizator').get();
  if (n > 0) {
    console.log(`Baza are deja ${n} utilizator(i) — nu creez nimic.`);
    console.log('Conturile noi se adaugă din aplicaţie, cu un cont de administrator.');
    return;
  }

  // Parolă aleatoare, uşor de citit cu voce tare şi de tastat pe telefon:
  // fără caractere care se confundă (0/O, 1/l/I).
  const ALFABET = 'abcdefghijkmnpqrstuvwxyzACDEFGHJKLMNPQRSTUVWXYZ23456789';
  const parola = Array.from(crypto.randomBytes(14), b => ALFABET[b % ALFABET.length]).join('');

  creeazaUtilizator({ nume, user, parola, rol: 'admin' });

  console.log('');
  console.log('  Cont de administrator creat:');
  console.log(`    utilizator : ${user}`);
  console.log(`    parolă     : ${parola}`);
  console.log('');
  console.log('  Notează parola ACUM — nu mai poate fi afişată. O poţi schimba');
  console.log('  după primul login, din aplicaţie.');
  console.log('');
  console.log(`  Bază de date: ${config.db}`);
}

main();
