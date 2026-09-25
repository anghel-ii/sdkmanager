// Copie consistentă a bazei managerului, chiar cu serverul pornit (VACUUM INTO).
//   node backup-baza.js <baza.sqlite> <copie.sqlite>
// Folosit de actualizeaza.ps1 înainte de fiecare update.
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const [sursa, dest] = process.argv.slice(2);
if (!sursa || !dest) { console.error('folosire: node backup-baza.js <baza> <copie>'); process.exit(2); }
if (!fs.existsSync(sursa)) { console.error(`nu există baza: ${sursa}`); process.exit(1); }
const db = new DatabaseSync(sursa);
db.prepare('VACUUM INTO ?').run(dest);
db.close();
console.log(`backup: ${dest}`);
