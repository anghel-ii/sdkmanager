// node test/mail.test.mjs — mailul „client nou de introdus în NeoManager": ce scrie în el şi că
// o problemă la trimitere devine avertisment, nu eroare (clientul e deja salvat).
import assert from 'node:assert/strict';
import { mailClientNou, anuntaClientNou } from '../lib/mail.js';

const client = {
  nume: 'Mobila Test SRL', cui: 'RO123', judet: 'CLUJ', localitate: 'Dej', adresa_sediu: 'str. A nr 1',
  adresa_livrare: 'str. B nr 2', administrator: 'Ion Pop', telefon_administrator: '0700000001',
  email: 'a@b.ro', delegat: null, telefon_delegat: '0700000002', discounturi: 'LUX 15%',
  modalitate_plata: 'OP', agent: 'Serban Dragos',
};
const { subiect, text } = mailClientNou(client, 'Conducere Test');
assert.equal(subiect, 'Client nou de introdus în NeoManager: Mobila Test SRL');
for (const rand of ['Nume: Mobila Test SRL', 'CUI: RO123', 'Agent: Serban Dragos', 'Adăugat de: Conducere Test',
  'Reduceri: LUX 15%', 'Modalitate de plată: OP', 'Adresă livrare: str. B nr 2']) assert.ok(text.includes(rand), rand);
assert.ok(text.includes('Delegat: -'), 'câmpul gol apare cu „-"');
assert.equal(mailClientNou({ ...client, nume: 'A\r\nBcc: x@y.ro' }, 'X').subiect,
  'Client nou de introdus în NeoManager: A Bcc: x@y.ro', 'subiectul rămâne pe un rând');

const env = { MAIL_URL: 'https://script.test/exec', MAIL_CHEIE: 'secret' };
const real = globalThis.fetch;
const cu = async (fals, fn) => { globalThis.fetch = fals; try { return await fn(); } finally { globalThis.fetch = real; } };

let cerere;
const reusit = await cu(async (url, o) => {
  cerere = { url, ...JSON.parse(o.body) };
  return Response.json({ ok: true });
}, () => anuntaClientNou(env, client, 'Conducere Test'));
assert.equal(reusit, undefined, 'mail plecat = fără avertisment');
assert.equal(cerere.url, env.MAIL_URL);
assert.equal(cerere.cheie, 'secret');
assert.equal(cerere.subiect, subiect);
assert.equal(cerere.text, text);

const avertisment = /Mobila Test SRL.*mailul.*nu a plecat/;
assert.match(await cu(async () => Response.json({ ok: false, eroare: 'cheie' }), () => anuntaClientNou(env, client, 'X')), avertisment, 'scriptul refuză');
assert.match(await cu(async () => new Response('<html>login</html>'), () => anuntaClientNou(env, client, 'X')), avertisment, 'răspuns care nu e JSON');
assert.match(await cu(async () => new Response('x', { status: 500 }), () => anuntaClientNou(env, client, 'X')), avertisment, 'eroare HTTP');
assert.match(await cu(async () => { throw new Error('reţea'); }, () => anuntaClientNou(env, client, 'X')), avertisment, 'fără reţea');
assert.match(await anuntaClientNou({}, client, 'X'), avertisment, 'neconfigurat');

console.log('mail.test: ok');
