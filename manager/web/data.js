// Data şi ora, peste tot în manager, în formatul zz/ll/aaaa hh:mm — ORA ROMÂNIEI
// (Europe/Bucharest), oricare ar fi fusul orar pus pe calculatorul colegului.
// Primeşte o dată din SQLite — UTC, „2026-09-16 05:52:14" — sau un Date. Fără dată → „—".
const ORA_RO = new Intl.DateTimeFormat('ro-RO', { timeZone: 'Europe/Bucharest', day: '2-digit', month: '2-digit',
  year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
function dataOra(s) {
  if (!s) return '—';
  const d = s instanceof Date ? s : new Date(String(s).replace(' ', 'T') + 'Z');
  const p = Object.fromEntries(ORA_RO.formatToParts(d).map(x => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}
