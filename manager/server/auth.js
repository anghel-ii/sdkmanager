const crypto = require('node:crypto');
const { db } = require('./db.js');
const { config } = require('./config.js');

// ── Autentificare ────────────────────────────────────────────────────────────
// Parole: scrypt cu salt per utilizator. scrypt e lent şi cere memorie
// intenţionat — dacă baza ajunge vreodată pe mâini străine, parolele nu se
// sparg în bloc. Comparaţia e timing-safe.
//
// Sesiuni: token aleator de 32 de octeţi, ţinut în DB (nu în memorie), ca
// repornirea serverului să nu delogheze omul din atelier de pe telefon. În DB
// stă doar SHA-256 al tokenului (tokenul în clar e doar în cookie): cine ajunge
// la o copie a bazei sau la un backup nu poate intra în contul nimănui.

const COOKIE = 'sesiune';

// cheia sesiunii în DB — acelaşi calcul ca în migraţia v5 → v6 din db.js
const hashToken = token => crypto.createHash('sha256').update(String(token)).digest('hex');
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

function hashParola(parola, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(parola, salt, SCRYPT.keylen, SCRYPT).toString('hex');
  return { hash, salt };
}

function verificaParola(parola, hash, salt) {
  const incercare = Buffer.from(hashParola(parola, salt).hash, 'hex');
  const corect    = Buffer.from(hash, 'hex');
  return incercare.length === corect.length && crypto.timingSafeEqual(incercare, corect);
}

// ── Utilizatori ──────────────────────────────────────────────────────────────

const PUBLIC = 'id, nume, user, rol, activ, creat_la';   // niciodată hash/salt

function creeazaUtilizator({ nume, user, parola, rol = 'birou' }) {
  const { hash, salt } = hashParola(parola);
  const info = db().prepare(`
    INSERT INTO utilizator (nume, user, parola_hash, parola_salt, rol)
    VALUES (?, ?, ?, ?, ?)
  `).run(nume, String(user).trim().toLowerCase(), hash, salt, rol);
  return gasesteUtilizator(Number(info.lastInsertRowid));
}

const gasesteUtilizator = id =>
  db().prepare(`SELECT ${PUBLIC} FROM utilizator WHERE id = ?`).get(id) ?? null;

function schimbaParola(id, parola) {
  const { hash, salt } = hashParola(parola);
  db().prepare('UPDATE utilizator SET parola_hash = ?, parola_salt = ? WHERE id = ?')
      .run(hash, salt, id);
  // toate sesiunile vechi cad — schimbarea parolei trebuie să dea afară
  // eventualele sesiuni ale altcuiva
  db().prepare('DELETE FROM sesiune WHERE utilizator_id = ?').run(id);
}

// ── Login / logout ───────────────────────────────────────────────────────────

function login(user, parola) {
  const rand = db().prepare('SELECT * FROM utilizator WHERE user = ?')
                   .get(String(user || '').trim().toLowerCase());

  // Cheltuim acelaşi timp şi când utilizatorul nu există, ca durata
  // răspunsului să nu spună dacă un user e valid sau nu.
  if (!rand) { hashParola(String(parola || '')); return null; }
  if (!verificaParola(String(parola || ''), rand.parola_hash, rand.parola_salt)) return null;
  if (!rand.activ) return null;

  const token = crypto.randomBytes(32).toString('base64url');
  const expira = new Date(Date.now() + config.sesiuneZile * 864e5).toISOString().replace('T', ' ').slice(0, 19);
  db().prepare('INSERT INTO sesiune (token, utilizator_id, expira_la) VALUES (?, ?, ?)')
      .run(hashToken(token), rand.id, expira);

  return { token, utilizator: gasesteUtilizator(rand.id) };
}

const logout = token => {
  if (token) db().prepare('DELETE FROM sesiune WHERE token = ?').run(hashToken(token));
};

// Utilizatorul din spatele unui token, sau null. Împrospătează `vazut_la` şi
// prelungeşte sesiunea la fiecare cerere — cine foloseşte aplicaţia zilnic nu
// e delogat niciodată, cine dispare o lună trebuie să se logheze din nou.
function dinToken(token) {
  if (!token) return null;
  const cheie = hashToken(token);

  const s = db().prepare(`
    SELECT s.token, s.utilizator_id
      FROM sesiune s
      JOIN utilizator u ON u.id = s.utilizator_id
     WHERE s.token = ? AND s.expira_la > datetime('now') AND u.activ = 1
  `).get(cheie);
  if (!s) return null;

  const expira = new Date(Date.now() + config.sesiuneZile * 864e5).toISOString().replace('T', ' ').slice(0, 19);
  db().prepare("UPDATE sesiune SET vazut_la = datetime('now'), expira_la = ? WHERE token = ?")
      .run(expira, cheie);

  return gasesteUtilizator(s.utilizator_id);
}

const curataSesiuni = () =>
  db().prepare("DELETE FROM sesiune WHERE expira_la <= datetime('now')").run().changes;

// ── Cookie ───────────────────────────────────────────────────────────────────
// HttpOnly: JS-ul din pagină nu poate citi token-ul, deci un XSS nu-l poate fura.
// SameSite=Lax: nu pleacă la cereri venite de pe alte site-uri (protecţie CSRF).
// Secure: doar pe HTTPS — pe HTTP l-ar face inutil, iar în dezvoltare am rămâne
// fără login.

const cookieSesiune = token =>
  `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${config.sesiuneZile * 86400}` +
  (config.https ? '; Secure' : '');

const cookieSters = () =>
  `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0` + (config.https ? '; Secure' : '');

function tokenDinCerere(req) {
  const brut = req.headers.cookie;
  if (!brut) return null;
  for (const bucata of brut.split(';')) {
    const [k, ...v] = bucata.trim().split('=');
    if (k === COOKIE) return v.join('=');
  }
  return null;
}

module.exports = {
  hashParola, verificaParola,
  creeazaUtilizator, gasesteUtilizator, schimbaParola,
  login, logout, dinToken, curataSesiuni,
  cookieSesiune, cookieSters, tokenDinCerere,
};
