// Întrebările configuratorului în ferestrele managerului (/dialog.js): pe mijlocul ecranului, în stilul
// paginii, la fel peste tot (userul, 2026-10-26) — nu alert() / confirm() ale browserului, care apar sus.
// Configuratorul deschis singur (fără manager, ex. Cloudflare Pages) n-are /dialog.js: atunci ale browserului.
export const confirma = (text, da) => window.confirma ? window.confirma(text, da) : Promise.resolve(confirm(text));
export const alerta = text => window.alerta ? window.alerta(text) : Promise.resolve(alert(text));
