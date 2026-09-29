const path = require('node:path');
const fs   = require('node:fs');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { json, eroare } = require('./http.js');
const { config } = require('./config.js');

// ── Actualizarea aplicaţiei din pagina /admin ───────────────────────────────
// Pe serverul Windows, update-ul (deploy/windows/actualizeaza.ps1) are nevoie
// de drepturi de administrator. Instalarea înregistrează pentru el o sarcină
// programată separată, „SDK Actualizare", care rulează ca SYSTEM. Serverul
// (tot SYSTEM) doar o porneşte — deci adminul aplicaţiei poate face update din
// browser fără să fie administrator pe Windows. Sarcina e separată de
// „SDK Manager" ca să supravieţuiască opririi serverului în timpul update-ului.

const SARCINA = 'SDK Actualizare';
const COD = path.resolve(config.radacina, '..');                          // clona git
const JURNAL = path.join(path.dirname(config.db), 'actualizari.log');     // scris de actualizeaza.ps1
const peWindows = process.platform === 'win32';

const ruleaza = async (exe, args) => (await promisify(execFile)(exe, args, { windowsHide: true })).stdout.trim();
const git = (...args) => ruleaza('git', ['-C', COD, ...args]);

async function sarcinaRuleaza() {
  if (!peWindows) return false;
  // /fo csv: "TaskName","Next Run Time","Status" — Status e tradus pe Windows în altă limbă,
  // deci ne uităm doar după „Running" / „În execuţie"
  const csv = await ruleaza('schtasks', ['/query', '/tn', SARCINA, '/fo', 'csv', '/nh']).catch(() => '');
  return /running|execu/i.test(csv);
}

// Coada jurnalului. PowerShell 5.1 poate scrie transcriptul în UTF-16.
function coadaJurnal(linii = 60) {
  let buf;
  try { buf = fs.readFileSync(JURNAL); } catch { return ''; }
  const text = buf[0] === 0xff && buf[1] === 0xfe ? buf.toString('utf16le') : buf.toString('utf8');
  return text.split(/\r?\n/).slice(-linii).join('\n');
}

async function stare(ctx) {
  json(ctx.res, 200, {
    disponibil: peWindows,
    versiune: await git('log', '-1', '--format=%h — %s (%cd)', '--date=format:%d.%m.%Y %H:%M').catch(() => ''),
    ruleaza: await sarcinaRuleaza(),
    jurnal: coadaJurnal(),
  });
}

// Ce e nou pe GitHub faţă de versiunea care rulează.
async function verifica(ctx) {
  try {
    await git('fetch', '--quiet', 'origin', 'main');
    const log = await git('log', '--format=%h — %s', 'HEAD..origin/main');
    json(ctx.res, 200, { noutati: log ? log.split('\n') : [] });
  } catch (e) {
    eroare(ctx.res, 502, `Nu am putut întreba GitHub: ${e.message}`);
  }
}

async function porneste(ctx) {
  if (!peWindows) return eroare(ctx.res, 400, 'Actualizarea din pagină merge doar pe serverul Windows.');
  if (await sarcinaRuleaza()) return eroare(ctx.res, 409, 'O actualizare e deja în curs.');
  try {
    await ruleaza('schtasks', ['/run', '/tn', SARCINA]);
    json(ctx.res, 202, { ok: true });
  } catch (e) {
    eroare(ctx.res, 500, `Nu am putut porni sarcina „${SARCINA}" (rulează din nou instalarea): ${e.message}`);
  }
}

module.exports = {
  rute: [
    ['GET',  '/api/actualizare',          { rol: 'admin', handler: stare }],
    ['POST', '/api/actualizare/verifica', { rol: 'admin', handler: verifica }],
    ['POST', '/api/actualizare',          { rol: 'admin', handler: porneste }],
  ],
};
