const { spawn } = require('node:child_process');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');

// ── Oprirea serverului (Ctrl+C) ──────────────────────────────────────────────
// Porneşte serverul pe o bază temporară, deschide o conexiune live (ca un tab
// al managerului) + una HTTP keep-alive, trimite SIGINT şi cere ca procesul să
// iasă repede, cu cod 0, cu baza închisă curat (fără manager.sqlite-wal).
//   node scripts/test-oprire.js

const T = fs.mkdtempSync(path.join(os.tmpdir(), 'manager-oprire-'));
const DB = path.join(T, 'db.sqlite');
const PORT = 18000 + Math.floor(Math.random() * 1000);
const env = { ...process.env, MANAGER_DB: DB, MANAGER_BACKUP: path.join(T, 'b'), MANAGER_PORT: String(PORT),
  MANAGER_TLS_CERT: path.join(T, 'x'), MANAGER_TLS_KEY: path.join(T, 'x') };
delete env.MANAGER_SCANARE;

const srv = spawn(process.execPath, ['-e', `
  require('./server/index.js').porneste();
  require('./server/auth.js').creeazaUtilizator({ nume: 'A', user: 'a', parola: 'parola-lunga-1', rol: 'admin' });`],
  { cwd: path.join(__dirname, '..'), env, stdio: 'ignore' });

let caderi = 0;
const verifica = (nume, ok, d = '') => { console.log(`  ${ok ? '✓' : '✗'} ${nume}${ok || !d ? '' : ` — ${d}`}`); if (!ok) caderi++; };
const gata = () => { fs.rmSync(T, { recursive: true, force: true }); console.log(caderi ? `\n${caderi} căzute\n` : '\ntoate trecute\n'); process.exit(caderi ? 1 : 0); };

async function asteaptaServer() {
  for (let i = 0; i < 50; i++) {
    try { return await fetch(`http://127.0.0.1:${PORT}/api/login`, { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: 'a', parola: 'parola-lunga-1' }) }); }
    catch { await new Promise(r => setTimeout(r, 100)); }
  }
  throw new Error('serverul n-a pornit');
}

(async () => {
  console.log('\nOprire (Ctrl+C)\n');
  const r = await asteaptaServer();
  const cookie = r.headers.getSetCookie()[0].split(';')[0];
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/api/live`, { headers: { Cookie: cookie } });
  await new Promise((ok, nu) => { ws.onopen = ok; ws.onerror = nu; });
  verifica('conexiunea live e deschisă (ca un tab al managerului)', ws.readyState === 1);

  const t0 = Date.now();
  const limita = setTimeout(() => { verifica('serverul iese la SIGINT', false, 'blocat peste 5 s'); srv.kill('SIGKILL'); }, 5000);
  srv.on('exit', cod => {
    clearTimeout(limita);
    const ms = Date.now() - t0;
    verifica(`serverul iese la SIGINT sub 1 s (${ms} ms)`, ms < 1000);
    verifica('cu cod 0', cod === 0, `cod ${cod}`);
    verifica('baza închisă curat (fără -wal)', fs.existsSync(DB) && !fs.existsSync(DB + '-wal'));
    gata();
  });
  srv.kill('SIGINT');
})().catch(e => { console.error(e); srv.kill('SIGKILL'); caderi++; gata(); });
