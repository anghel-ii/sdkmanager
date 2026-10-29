// Rulează SQL pe baza D1 de pe Cloudflare (prin wrangler) — pt. agent.mjs şi importa.mjs.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const aici = fileURLToPath(new URL('.', import.meta.url));

// valoare → literal SQL
export const q = v => v == null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`;

// D1_LOCAL=<folder> (--persist-to al lui `wrangler pages dev`) → baza locală de probă, nu cea de pe Cloudflare
const unde = process.env.D1_LOCAL ? ['--local', `--persist-to=${process.env.D1_LOCAL}`] : ['--remote'];

// SQL (comandă) → rândurile primei interogări
export function d1(sql, { fisier } = {}) {
  const args = ['wrangler', 'd1', 'execute', 'clienti-agenti', ...unde, '--json', '-y', fisier ? `--file=${fisier}` : `--command=${sql}`];
  const iesire = execFileSync('npx', args, { cwd: aici, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 1 << 26 });
  // cu --file, wrangler scrie şi progresul în stdout (nu doar JSON) — acolo nu citim rezultate
  return fisier ? [] : JSON.parse(iesire)[0]?.results ?? [];
}
