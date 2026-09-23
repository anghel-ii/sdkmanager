const { json, eroare, corpJson } = require('../http.js');
const { db, tranzactie } = require('../db.js');
const auth = require('../auth.js');

// ── API utilizatori: login, logout, cine sunt, administrare conturi ─────────

async function postLogin(ctx) {
  const { req, res } = ctx;
  const { user, parola } = await corpJson(req);

  if (!user || !parola) return eroare(res, 400, 'Completează utilizatorul şi parola.');

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

const listeaza = ctx => json(ctx.res, 200, {
  utilizatori: db().prepare(
    'SELECT id, nume, user, rol, activ, creat_la FROM utilizator ORDER BY nume'
  ).all(),
});

// Rolurile (userul, 2026-09-23):
//   admin     — tot
//   conducere — tot, în afară de conturi (creare / modificare)
//   birou     — ca conducere, dar un nr. de factură doar îl TRECE pe o comandă
//               nefacturată; nu-l poate schimba sau anula (vezi api/comenzi.js)
const ROLURI = ['admin', 'conducere', 'birou'];

async function creeaza(ctx) {
  const { res } = ctx;
  const { nume, user, parola, rol } = await corpJson(ctx.req);

  if (!nume || !user || !parola)      return eroare(res, 400, 'Nume, utilizator şi parolă sunt obligatorii.');
  if (String(parola).length < 8)      return eroare(res, 400, 'Parola trebuie să aibă cel puţin 8 caractere.');
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

  const { nume, rol, activ, parola } = await corpJson(ctx.req);
  // Toate validările ÎNAINTE de orice scriere — altfel o parolă prea scurtă
  // dădea 400, dar numele/rolul de dinainte rămâneau deja salvate.
  if (rol && !ROLURI.includes(rol)) return eroare(res, 400, `Rol necunoscut. Valori permise: ${ROLURI.join(', ')}.`);
  if (parola != null && String(parola).length < 8) return eroare(res, 400, 'Parola trebuie să aibă cel puţin 8 caractere.');

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
