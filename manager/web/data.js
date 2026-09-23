// Data şi ora, peste tot în manager, în formatul zz/ll/aaaa hh:mm (ora locală).
// Primeşte o dată din SQLite — UTC, „2026-09-16 05:52:14" (din datetime('now'))
// — sau un Date. Fără dată → „—".
function dataOra(s) {
  if (!s) return '—';
  const d = s instanceof Date ? s : new Date(String(s).replace(' ', 'T') + 'Z');
  const z = n => String(n).padStart(2, '0');
  return `${z(d.getDate())}/${z(d.getMonth() + 1)}/${d.getFullYear()} ${z(d.getHours())}:${z(d.getMinutes())}`;
}
