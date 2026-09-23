// Actualizare live pt. paginile managerului — vezi server/evenimente.js.
// urmareste(laSchimbare, laPersonal): o conexiune WebSocket la /api/live; serverul
// trimite singur mesaj când se schimbă ceva (nu întrebăm noi):
//   laSchimbare() — s-a schimbat ceva (orice utilizator)
//   laPersonal()  — pin / sortare schimbate de tine din alt tab / dispozitiv
// Dacă legătura cade (server repornit, reţea), se reface singură după 3 s şi
// pagina se re-randează o dată — putem fi pierdut schimbări între timp.
function urmareste(laSchimbare, laPersonal = laSchimbare) {
  let reconectare = false;
  function conecteaza() {
    const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/api/live');
    ws.onopen = () => { if (reconectare) laSchimbare(); reconectare = false; };
    ws.onmessage = e => {
      let m = {};
      try { m = JSON.parse(e.data); } catch {}
      if (m.tip === 'personal') laPersonal();
      else if (m.tip === 'schimbare') laSchimbare();
    };
    ws.onclose = () => { reconectare = true; setTimeout(conecteaza, 3000); };
  }
  if (window.WebSocket) conecteaza();
}
