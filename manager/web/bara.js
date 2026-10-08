// ── Bara de sus, aceeaşi pe toate paginile ───────────────────────────────────
// Manager, comanda de sticlă, clienţi, utilizatori, configurator şi oferta cu
// amănuntul arătau ca patru programe diferite (userul, 2026-10-05). Fiecare
// pagină are <div id="bara"> + acest script, încărcat SINCRON imediat după el,
// ca #cine, #iesire, #nrSticla etc. să existe când rulează scriptul paginii.
// Ce pune pagina în bară cu class="bara-context" (ex. „Ofertă nouă › Confort")
// rămâne, lângă linkuri. Configuratorul (fără manager, pe Cloudflare) nu
// găseşte scriptul şi îşi păstrează bara lui.
(() => {
  const stil = document.createElement('style');
  stil.textContent = `
    #bara { display: flex; align-items: center; gap: 10px; padding: 8px 16px; min-height: 52px; box-sizing: border-box;
      background: var(--panel); border-bottom: 1px solid var(--line); position: sticky; top: 0; z-index: 10;
      font-family: 'Inter', system-ui, sans-serif; font-size: 14px; }
    #bara .nume { font-weight: 600; color: var(--text); text-decoration: none; margin-right: 6px; white-space: nowrap; }
    #bara .spatiu { flex: 1; }
    #bara .buton, #bara button { font: inherit; font-size: 13px; padding: 7px 12px; border: 1px solid var(--line); border-radius: 6px;
      background: var(--panel-2); color: var(--text); text-decoration: none; cursor: pointer; white-space: nowrap; line-height: 1.4; }
    #bara .buton:hover, #bara button:hover { border-color: var(--accent); }
    #bara .buton.activ { border-color: var(--accent); color: var(--accent); }
    #bara .primar { background: var(--accent-dim); border-color: var(--accent); color: #fff; font-weight: 600; }
    #bara [hidden] { display: none; }
    #bara .insigna { display: inline-block; min-width: 1.5em; padding: 0 6px; margin-left: 4px; border-radius: 10px;
      background: var(--accent-dim); color: #fff; font-size: .75rem; text-align: center; }
    #bara .insigna:empty { display: none; }
    #bara .insigna.rosie { background: #a3412f; }
    #caseteTaskuri { position: fixed; right: 16px; bottom: 16px; z-index: 1000; display: flex; flex-direction: column; gap: 8px;
      max-width: 360px; font-family: 'Inter', system-ui, sans-serif; font-size: 14px; }
    #caseteTaskuri > div { background: var(--panel-2, #21252c); color: var(--text, #e9ebee); border: 1px solid #c9604c;
      border-radius: 10px; padding: 12px 14px; box-shadow: 0 6px 24px rgba(0,0,0,.45); }
    #caseteTaskuri .dim { color: var(--text-dim, #8b92a0); font-size: 13px; margin: 4px 0 8px; }
    #caseteTaskuri a { color: var(--accent, #4da3ff); margin-right: 12px; }
    #caseteTaskuri button { font: inherit; font-size: 13px; padding: 4px 10px; border-radius: 6px; cursor: pointer;
      border: 1px solid var(--line, #2c313a); background: var(--panel, #1b1e24); color: inherit; }
    @media print { #caseteTaskuri { display: none !important; } }
    #bara .bara-context { flex: 0 1 auto; margin: 0; font-weight: 400; color: var(--text-dim); font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
    #bara .bara-context b { color: var(--text); font-weight: 500; }
    #bara .bara-context i { font-style: normal; margin: 0 5px; }
    #bara #cine { color: var(--text-dim); font-size: 13px; white-space: nowrap; }
    @media (max-width: 1100px) { #bara #cine { display: none; } }
    @media print { #bara { display: none !important; } }`;
  document.head.appendChild(stil);

  const cale = location.pathname.replace(/\/$/, '') || '/';
  const activ = p => (cale === p ? ' activ' : '');

  window.puneBara = el => {
    const context = [...el.querySelectorAll('.bara-context')];
    el.id = 'bara';
    el.innerHTML = `
      <a href="/" class="nume">Manager comenzi</a>
      <button type="button" id="ofertaNoua" class="primar">+ OFERTĂ NOUĂ</button>
      <a href="/sticla" class="buton${activ('/sticla')}" id="linkSticla">Comandă sticlă <span class="insigna" id="nrSticla"></span></a>
      <a href="/livrari" class="buton${activ('/livrari')}" id="linkLivrari">Organizează livrări</a>
      <a href="/taskuri" class="buton${activ('/taskuri')}" id="linkTaskuri" title="Taskurile tale; numărul = ajunse la ora reminderului">Taskuri <span class="insigna rosie" id="nrTaskuri"></span></a>
      <a href="/clienti" class="buton${activ('/clienti')}" id="linkClienti" hidden title="Clienţii; numărul = trimise de agenţi, de aprobat">Clienţi <span class="insigna" id="nrClienti"></span></a>
      <a href="/admin" class="buton${activ('/admin')}" id="linkAdmin" hidden>Utilizatori</a>
      <span class="spatiu"></span>
      <span id="cine"></span>
      <button type="button" id="iesire">Ieşi</button>`;
    el.querySelector('.spatiu').before(...context);

    // pe pagina principală butonul deschide alegerea gamei (îl leagă pagina);
    // de oriunde altundeva duce acolo, cu alegerea deschisă
    if (cale !== '/') el.querySelector('#ofertaNoua').addEventListener('click', () => { location.href = '/?nou'; });
    el.querySelector('#iesire').addEventListener('click', async () => {
      await fetch('/api/logout', { method: 'POST' });
      location.href = '/login';
    });

    fetch('/api/eu').then(r => r.ok ? r.json() : null).then(d => {
      const eu = d?.utilizator;
      if (!eu) return;
      el.querySelector('#cine').textContent = eu.nume;
      el.querySelector('#linkAdmin').hidden = eu.rol !== 'admin';     // conturile — doar admin
      el.querySelector('#linkClienti').hidden = eu.rol === 'birou';   // clienţii — nu şi biroul (userul, 2026-10-02)
    });
    fetch('/api/sumar').then(r => r.ok ? r.json() : null).then(s => {
      if (!s) return;
      el.querySelector('#nrSticla').textContent = s.sticla || '';
      el.querySelector('#nrClienti').textContent = s.deAprobat || '';
    });

    // ── Remindere (server/taskuri.js): din minut în minut, taskurile mele ajunse la scadenţă.
    // Fiecare (task, scadenţă) se anunţă o dată pe calculator — ţinut minte în localStorage,
    // comun tuturor taburilor; amânat = altă scadenţă = se anunţă iar. Notificare Windows
    // dacă browserul o permite (HTTPS sau excepţia din chrome://flags — vezi pagina Taskuri),
    // altfel o casetă în colţul paginii, până o închizi.
    const anuntateAici = new Set();   // dacă localStorage nu merge, măcar nu se repetă în tabul ăsta
    const anuntate = () => { try { return JSON.parse(localStorage.getItem('taskuriAnuntate') ?? '[]'); } catch { return []; } };
    const anunta = t => {
      const titlu = `⏰ ${t.text}`;
      const detaliu = [t.comanda_nr && `${t.comanda_nr} · ${t.client_nume}`, t.creat_de !== t.pentru && `de la ${t.creat_de_nume}`]
        .filter(Boolean).join(' — ');
      if (window.Notification?.permission === 'granted') {
        const n = new Notification(titlu, { body: detaliu, tag: `task-${t.id}`, requireInteraction: true });
        n.onclick = () => { window.open('/taskuri', 'taskuri'); n.close(); };
        return;
      }
      let cutie = document.getElementById('caseteTaskuri');
      if (!cutie) { cutie = document.createElement('div'); cutie.id = 'caseteTaskuri'; document.body.appendChild(cutie); }
      const c = document.createElement('div');
      c.innerHTML = '<b></b><div class="dim"></div><a href="/taskuri" target="taskuri">Deschide taskurile</a><button type="button">Închide</button>';
      c.querySelector('b').textContent = titlu;
      c.querySelector('.dim').textContent = detaliu;
      c.querySelector('button').addEventListener('click', () => c.remove());
      cutie.appendChild(c);
    };
    const verificaTaskuri = async () => {
      const r = await fetch('/api/taskuri/scadente').catch(() => null);
      if (!r?.ok) return;
      const { taskuri } = await r.json();
      el.querySelector('#nrTaskuri').textContent = taskuri.length || '';
      const vechi = anuntate();
      const chei = taskuri.map(t => `${t.id}@${t.scadenta}`);
      try { localStorage.setItem('taskuriAnuntate', JSON.stringify(chei)); } catch { /* rămâne anuntateAici */ }
      taskuri.forEach((t, k) => {
        if (vechi.includes(chei[k]) || anuntateAici.has(chei[k])) return;
        anuntateAici.add(chei[k]);
        anunta(t);
      });
    };
    window.verificaTaskuri = verificaTaskuri;   // pagina Taskuri o cheamă după o schimbare
    verificaTaskuri();
    setInterval(verificaTaskuri, 60 * 1000);
  };

  const el = document.getElementById('bara');
  if (el) window.puneBara(el);
})();
