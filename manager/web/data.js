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

// Scurt, pt. liste (taskuri): „azi 15:00", „mâine 09:00", „ieri 18:30", „joi 22 oct 10:00",
// „22 oct 2027" — tot în ora României.
const ORA_RO_ZI = new Intl.DateTimeFormat('ro-RO', { timeZone: 'Europe/Bucharest', weekday: 'short', day: 'numeric',
  month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
function cand(s) {
  if (!s) return '';
  const d = s instanceof Date ? s : new Date(String(s).replace(' ', 'T') + 'Z');
  const p = Object.fromEntries(ORA_RO_ZI.formatToParts(d).map(x => [x.type, x.value.replace('.', '')]));
  const zi = x => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest' }).format(x);
  const dif = Math.round((Date.parse(zi(d)) - Date.parse(zi(new Date()))) / 864e5);
  const ora = `${p.hour}:${p.minute}`;
  if (dif === 0) return `azi ${ora}`;
  if (dif === 1) return `mâine ${ora}`;
  if (dif === -1) return `ieri ${ora}`;
  if (Math.abs(dif) < 180) return `${p.weekday} ${p.day} ${p.month} ${ora}`;
  return `${p.day} ${p.month} ${p.year}`;
}
