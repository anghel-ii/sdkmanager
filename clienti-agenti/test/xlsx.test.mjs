// node test/xlsx.test.mjs — cititorul de Excel pe un fişier mic, făcut cu openpyxl:
// coloane în altă ordine decât în Excel-ul real, diacritice, & şi <>, „-", rând gol.
import assert from 'node:assert/strict';
import { clientiDinXlsx } from '../xlsx.mjs';

const c = clientiDinXlsx(new URL('test-clienti.xlsx', import.meta.url).pathname);
assert.equal(c.length, 2, 'rândul gol se sare');
assert.deepEqual(c[0], {
  nume: 'Şurub & Co <SRL>', cui: 'RO123', agent: 'Agent Test', judet: 'CLUJ', localitate: 'Cluj-Napoca',
  adresa_sediu: 'str. A nr 1', adresa_livrare: null, administrator: 'Ion Ţepeş', telefon_administrator: '0700000001',
  email: 'a@b.ro', delegat: 'Delegat X', telefon_delegat: '0700000002', discounturi: 'LUX 15%',
});
assert.equal(c[1].judet, null, '„-" la judeţ → gol');
assert.equal(c[1].cui, 'Persoana Fizica');
console.log('xlsx: ok');
