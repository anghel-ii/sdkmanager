const { json, eroare, corpJson } = require('../http.js');
const { db, tranzactie } = require('../db.js');
const auth = require('../auth.js');

// ── API utilizatori: login, logout, cine sunt, administrare conturi ─────────

async function postLogin(ctx) {
  const { req, res } = ctx;
  const { user, parola, parolaConfirmare } = await corpJson(req);

  if (!user || !parola) return eroare(res, 400, 'Completează utilizatorul şi parola.');

  // Cont creat de admin, încă fără parolă: parola scrisă acum devine parola
  // contului, după ce e reintrodusă identic (pagina de login cere confirmarea).
  const neactivat = auth.contNeactivat(user);
  if (neactivat) {
    if (parolaConfirmare == null) {
      return json(res, 409, { activare: true, eroare: 'Contul tău n-are încă parolă. Reintrodu parola aleasă, ca s-o confirmi.' });
    }
    if (String(parola).length < 8) return eroare(res, 400, 'Parola trebuie să aibă cel puţin 8 caractere.');
    if (String(parola) !== String(parolaConfirmare)) return eroare(res, 400, 'Parolele nu coincid. Încearcă din nou.');
    auth.schimbaParola(neactivat.id, parola);
  }

  const sesiune = auth.login(user, parola);
  // Un singur mesaj pentru orice eşec: nu spunem dacă userul există sau nu.
  if (!sesiune) return eroare(res, 401, 'Utilizator sau parolă greşită.');

  json(res, 200, { utilizator: sesiune.utilizator }, { 'Set-Cookie': auth.cookieSesiune(sesiune.token) });
}

function postLogout(ctx) {
  auth.logout(auth.tokenDinCerere(ctx.req));
  json(ctx.res, 200, { ok: true }, { 'Set-Cookie': auth.cookieSters() });
}

const getEu = ctx => json(ctx.res, 200, { utilizator: ctx.utilizator });

// ── Administrare (doar rolul 'admin') ───────────────────────────────────────

// `activat` = şi-a pus parola (contul creat de admin, folosit cel puţin o dată).
const listeaza = ctx => json(ctx.res, 200, {
  utilizatori: db().prepare(
    "SELECT id, nume, user, rol, activ, creat_la, parola_hash != '' AS activat FROM utilizator ORDER BY nume"
  ).all().map(u => ({ ...u, activat: !!u.activat })),
});

// utilizator: litere mici, cifre, punct, cratimă, underscore; 2–40 caractere
const USER_VALID = /^[a-z0-9._-]{2,40}$/;

// Rolurile (userul, 2026-09-23):
//   admin     — tot
//   conducere — tot, în afară de conturi (creare / modificare)
//   birou     — ca conducere, dar un nr. de factură doar îl TRECE pe o comandă
//               nefacturată; nu-l poate schimba sau anula (vezi api/comenzi.js)
const ROLURI = ['admin', 'conducere', 'birou'];

async function creeaza(ctx) {
  const { res } = ctx;
  // De obicei doar utilizator + rol: omul îşi pune parola la primul login.
  // Numele afişat e opţional (implicit = utilizatorul); parola, opţională.
  const corp = await corpJson(ctx.req);
  const { nume, parola, rol } = corp;
  const user = String(corp.user ?? '').trim().toLowerCase();

  if (!USER_VALID.test(user))         return eroare(res, 400, 'Utilizator invalid: 2–40 caractere, doar litere mici, cifre, punct, cratimă.');
  if (parola != null && String(parola).length < 8) return eroare(res, 400, 'Parola trebuie să aibă cel puţin 8 caractere.');
  if (rol && !ROLURI.includes(rol))   return eroare(res, 400, `Rol necunoscut. Valori permise: ${ROLURI.join(', ')}.`);

  try {
    json(res, 201, { utilizator: auth.creeazaUtilizator({ nume, user, parola, rol }) });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return eroare(res, 409, `Utilizatorul „${user}" există deja.`);
    throw e;
  }
}

async function modifica(ctx) {
  const { res } = ctx;
  const id = Number(ctx.params.id);
  if (!auth.gasesteUtilizator(id)) return eroare(res, 404, 'Utilizator inexistent.');

  const { nume, rol, activ, parola, reseteazaParola } = await corpJson(ctx.req);
  // Toate validările ÎNAINTE de orice scriere — altfel o parolă prea scurtă
  // dădea 400, dar numele/rolul de dinainte rămâneau deja salvate.
  if (rol && !ROLURI.includes(rol)) return eroare(res, 400, `Rol necunoscut. Valori permise: ${ROLURI.join(', ')}.`);
  if (parola != null && String(parola).length < 8) return eroare(res, 400, 'Parola trebuie să aibă cel puţin 8 caractere.');

  if (reseteazaParola && id === ctx.utilizator.id) {
    return eroare(res, 400, 'Nu îţi poţi reseta singur parola — schimb-o din contul tău.');
  }

  // Nu te poţi dezactiva sau retrograda singur — altfel rămâne firma fără admin.
  // „Dezactivare" = orice valoare falsă (0, false, ""), cum o şi salvează mai jos.
  const dezactivare = activ != null && !activ;
  if (id === ctx.utilizator.id && (dezactivare || (rol && rol !== 'admin'))) {
    return eroare(res, 400, 'Nu îţi poţi retrage singur propriul acces de administrator.');
  }

  tranzactie(d => {
    if (nume  != null) d.prepare('UPDATE utilizator SET nume  = ? WHERE id = ?').run(nume, id);
    if (rol   != null) d.prepare('UPDATE utilizator SET rol   = ? WHERE id = ?').run(rol, id);
    if (activ != null) d.prepare('UPDATE utilizator SET activ = ? WHERE id = ?').run(activ ? 1 : 0, id);
    if (parola != null) auth.schimbaParola(id, parola);
    if (reseteazaParola) auth.reseteazaParola(id);
  });

  json(res, 200, { utilizator: auth.gasesteUtilizator(id) });
}

// Schimbarea propriei parole — orice rol, dar cere parola curentă.
async function schimbaParolaProprie(ctx) {
  const { res } = ctx;
  const { parolaCurenta, parolaNoua } = await corpJson(ctx.req);

  if (!parolaCurenta || !parolaNoua)   return eroare(res, 400, 'Completează parola curentă şi pe cea nouă.');
  if (String(parolaNoua).length < 8)   return eroare(res, 400, 'Parola nouă trebuie să aibă cel puţin 8 caractere.');
  if (!auth.login(ctx.utilizator.user, parolaCurenta)) return eroare(res, 403, 'Parola curentă e greşită.');

  // schimbaParola şterge toate sesiunile, inclusiv pe cea de acum — deci
  // deschidem imediat una nouă, ca omul să nu fie dat afară din propria pagină.
  auth.schimbaParola(ctx.utilizator.id, parolaNoua);
  const sesiune = auth.login(ctx.utilizator.user, parolaNoua);

  json(res, 200, { ok: true }, { 'Set-Cookie': auth.cookieSesiune(sesiune.token) });
}

module.exports = {
  rute: [
    ['POST', '/api/login',          { public: true, handler: postLogin }],
    ['POST', '/api/logout',         { public: true, handler: postLogout }],
    ['GET',  '/api/eu',             { handler: getEu }],
    ['POST', '/api/eu/parola',      { handler: schimbaParolaProprie }],

    ['GET',  '/api/utilizatori',     { rol: 'admin', handler: listeaza }],
    ['POST', '/api/utilizatori',     { rol: 'admin', handler: creeaza }],
    ['PATCH','/api/utilizatori/:id', { rol: 'admin', handler: modifica }],
  ],
};
