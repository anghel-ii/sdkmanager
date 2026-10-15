// ── Meniul din stânga (manager) / bara compactă (configurator) ───────────────
// Manager, comanda de sticlă, clienţi, utilizatori, configurator şi oferta cu
// amănuntul arătau ca patru programe diferite (userul, 2026-10-05). Fiecare
// pagină are <div id="bara"> + acest script, încărcat SINCRON imediat după el,
// ca #cine, #iesire, #nrSticla etc. să existe când rulează scriptul paginii.
//
// Redesign 2026-10-12 (ideea userului: tablou de bord închis, meniu în stânga):
//   • paginile managerului — MENIUL din stânga (#meniu: ofertă nouă, stările
//     comenzilor cu numărul lor, sticlă, livrări, clienţi, utilizatori, starea
//     legăturii live, contul), restrângibil la iconiţe (ţinut minte în browser).
//     FĂRĂ bară sus („bara de sus nu mai are ce căuta" — userul): <div id="bara">
//     se scoate; căutarea comenzilor e deasupra listei, în pagina principală (Ctrl K);
//   • configuratorul (/configurator/…) — o bară COMPACTĂ sus, fără meniu lateral,
//     ca 3D-ul să-şi păstreze lăţimea. Ce pune pagina în bară cu
//     class="bara-context" (ex. „Ofertă nouă › Confort") rămâne, lângă marcă.
// Configuratorul fără manager (Cloudflare, de pe disc) nu găseşte scriptul şi
// îşi păstrează bara lui.

// ── Update fără oprirea lucrului (userul, 2026-10-13) ─────────────────────────
// La „Actualizează" serverul se opreşte câteva secunde cât reporneşte. Pagina deschisă
// rămâne în browser şi merge mai departe; o cerere spre /api care NU ajunge la server
// (refuzată — serverul porneşte) nu mai dă eroare: aşteaptă şi se retrimite singură până
// revine serverul (max. 2 minute), cu o bandă „Serverul se actualizează…". O cerere
// ajunsă la server nu se repetă — la oprire serverul termină întâi cererile în curs.
(() => {
  const trimite = window.fetch.bind(window);
  let inAsteptare = 0, banda = null;
  const arata = da => {
    inAsteptare += da ? 1 : -1;
    if (!banda) {
      banda = document.createElement('div');
      banda.style.cssText = 'position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:2000;padding:8px 16px;'
        + 'border-radius:999px;background:#4a3a12;border:1px solid #d4a24c;color:#f0c65a;font:600 13px Inter,system-ui,sans-serif;'
        + 'box-shadow:0 4px 18px rgba(0,0,0,.45)';
      banda.textContent = '⟳ Serverul se actualizează — aştept să revină; ce ai completat rămâne aici.';
    }
    if (inAsteptare > 0 && !banda.isConnected) document.body.appendChild(banda);
    if (inAsteptare <= 0) banda.remove();
  };
  window.fetch = async (cerere, optiuni) => {
    const adresa = new URL(typeof cerere === 'string' ? cerere : cerere.url, location.href);
    if (adresa.origin !== location.origin || !adresa.pathname.startsWith('/api/')) return trimite(cerere, optiuni);
    const pana = Date.now() + 120e3;
    for (let asteapta = false; ;) {
      try {
        const r = await trimite(cerere, optiuni);
        if (asteapta) arata(false);
        return r;
      } catch (e) {
        if (e.name === 'AbortError' || Date.now() > pana) { if (asteapta) arata(false); throw e; }
        if (!asteapta) { asteapta = true; arata(true); }
        await new Promise(gata => setTimeout(gata, 2000));
      }
    }
  };
})();

(() => {
  // ── iconiţe: linii subţiri, culoarea textului (fără fonturi de iconiţe de pe CDN) ──
  const ICOANE = {
    logo:    '<rect x="4" y="3.5" width="7.5" height="17" rx="1"/><rect x="12.5" y="3.5" width="7.5" height="17" rx="1"/><path d="M9 12h1M14 12h1"/>',
    plus:    '<path d="M12 5v14M5 12h14"/>',
    acasa:   '<path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 9v11h13V9"/><path d="M10 20v-5.5h4V20"/>',
    oferta:  '<path d="M14 3.5H6.5a1 1 0 0 0-1 1v15a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V8z"/><path d="M14 3.5V8h4.5M9 12.5h6M9 16.5h4"/>',
    plata:   '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    lucru:   '<path d="M20.5 7.5 12 3 3.5 7.5v9L12 21l8.5-4.5z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>',
    gata:    '<circle cx="12" cy="12" r="8.5"/><path d="m8.5 12.2 2.4 2.4 4.6-5"/>',
    cereri:  '<path d="M5 4.5h14v11H9.5L5 19.5z"/><path d="M9 8.5h6M9 11.5h4"/>',
    tichete: '<path d="M9.5 18h5M10.5 21h3"/><path d="M12 3.5a5.8 5.8 0 0 0-3.4 10.5c.6.5.9 1.1.9 1.8v.2h5v-.2c0-.7.3-1.3.9-1.8A5.8 5.8 0 0 0 12 3.5z"/>',
    taskuri: '<path d="M10 6.5h10M10 12h10M10 17.5h10"/><path d="m3.5 6.5 1.4 1.4 2.3-2.6M3.5 12l1.4 1.4 2.3-2.6M3.5 17.5l1.4 1.4 2.3-2.6"/>',
    sticla:  '<rect x="4.5" y="3.5" width="15" height="17" rx="1.5"/><path d="m8 9.5 3-3M8 14.5l7.5-7.5"/>',
    livrari: '<path d="M14 16.5V6H3.5v10.5h1.8"/><path d="M14 9h3.8l2.7 3.4v4.1h-1.8M9 16.5h6.2"/><circle cx="7.2" cy="16.8" r="1.8"/><circle cx="17" cy="16.8" r="1.8"/>',
    clienti: '<circle cx="9" cy="8.5" r="3.3"/><path d="M3 19.5c.7-3.2 3.1-5 6-5s5.3 1.8 6 5"/><path d="M15.5 5.3a3.3 3.3 0 0 1 0 6.4M17.6 14.8c1.7.7 2.9 2.2 3.4 4.7"/>',
    admin:   '<path d="M12 3.5 5 6.2v5.3c0 4.3 3 7.6 7 8.9 4-1.3 7-4.6 7-8.9V6.2z"/><path d="m9.2 12 2 2 3.8-4"/>',
    iesire:  '<path d="M14.5 4.5h3a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-3"/><path d="M10 16.5 5.5 12 10 7.5M5.5 12h10"/>',
    cauta:   '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    sageata: '<path d="m9.5 6 6 6-6 6"/>',
    inapoi:  '<path d="M19 12H5.5M11 18l-6-6 6-6"/>',
    inchide: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    panou:   '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M9.5 4.5v15"/>',
    // gamele configuratorului (game.json) — butoanele „Ofertă nouă" din pagina principală
    suspendata: '<path d="M3 4.5h18"/><rect x="5" y="7" width="6.5" height="13" rx=".6"/><rect x="12.5" y="7" width="6.5" height="13" rx=".6"/><path d="M7 4.5V7M17 4.5V7"/>',
    confort: '<rect x="4" y="4" width="9" height="16" rx=".6"/><path d="M13 4h6.4a.6.6 0 0 1 .6.6v14.8a.6.6 0 0 1-.6.6H13"/><path d="M10.5 11.5v1.5M15.5 11.5v1.5"/>',
    rame:    '<rect x="4.5" y="3" width="15" height="18" rx="1"/><rect x="8" y="6.5" width="8" height="11" rx=".5"/>',
    util:    '<path d="M7 3.5v17M17 3.5v17M4.5 3.5h5M14.5 3.5h5M4.5 20.5h5M14.5 20.5h5"/>',
    lux:     '<path d="M6.5 4.5h11L21 9.5 12 20 3 9.5z"/><path d="M3 9.5h18M9.5 4.5 12 9.5l2.5-5M12 9.5V20"/>',
    amanunt: '<path d="M5.5 8.5h13l-1 11.5h-11z"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/>',
  };
  const icoana = nume => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICOANE[nume] ?? ICOANE.oferta}</svg>`;
  window.icoana = icoana;

  const cale = location.pathname.replace(/\/$/, '') || '/';
  const acasa = cale === '/' || cale === '/comenzi';           // pagina principală (listele de comenzi)
  const cuMeniu = !cale.startsWith('/configurator');          // configuratorul: doar bara compactă
  const activ = p => (cale === p ? ' activ' : '');
  const ROLURI = { admin: 'Administrator', conducere: 'Conducere', birou: 'Birou' };
  // stările comenzilor — aceleaşi patru taburi ca în pagina principală (data-tab = tabCurent de acolo)
  const STARI = [['oferta', 'oferte', '#oferte', 'oferta', 'Oferte'], ['plata', 'plata', '#plata', 'plata', 'Aşteaptă plata'],
                 ['comanda', 'comenzi', '#comenzi', 'lucru', 'În lucru'], ['finalizata', 'finalizate', '#finalizate', 'gata', 'Finalizate']];

  const stil = document.createElement('style');
  stil.textContent = `
    :root { --meniu-l: 216px; }
    html.meniu-strans { --meniu-l: 58px; }
    html.cu-meniu body { padding-left: var(--meniu-l); }
    #bara, #meniu { font-family: 'Inter', system-ui, sans-serif; font-size: 13.5px; }
    #bara .ic, #meniu .ic { width: 17px; height: 17px; flex: none; }
    #bara [hidden], #meniu [hidden] { display: none !important; }
    .insigna { display: inline-grid; place-items: center; min-width: 20px; height: 18px; padding: 0 6px; border-radius: 999px;
      background: var(--panel-2); color: var(--text-dim); font-size: 11.5px; font-weight: 600; font-variant-numeric: tabular-nums; line-height: 1; }
    .insigna:empty { display: none; }
    .insigna.cald { background: var(--accent-dim); color: #fff; }
    .insigna.rosie { background: #a3412f; color: #fff; }
    /* reminderele fără notificare Windows: casete în colţul paginii (server/taskuri.js) */
    #caseteTaskuri { position: fixed; right: 16px; bottom: 16px; z-index: 1000; display: flex; flex-direction: column; gap: 8px;
      max-width: 360px; font-family: 'Inter', system-ui, sans-serif; font-size: 14px; }
    #caseteTaskuri > div { background: var(--panel-2, #21252c); color: var(--text, #e9ebee); border: 1px solid #c9604c;
      border-radius: 10px; padding: 12px 14px; box-shadow: 0 6px 24px rgba(0,0,0,.45); }
    #caseteTaskuri .dim { color: var(--text-dim, #8b92a0); font-size: 13px; margin: 4px 0 8px; }
    #caseteTaskuri a { color: var(--accent, #4da3ff); margin-right: 12px; }
    #caseteTaskuri button { font: inherit; font-size: 13px; padding: 4px 10px; border-radius: 6px; cursor: pointer;
      border: 1px solid var(--line, #2c313a); background: var(--panel, #1b1e24); color: inherit; }
    /* legătura live (web/live.js pune data-live pe <html>): ascunsă pe paginile fără ea */
    .live { display: none; align-items: center; gap: 7px; height: 24px; padding: 0 10px; border-radius: 999px; font-size: 12px; font-weight: 500; white-space: nowrap;
      color: #7cc493; background: rgba(63,166,106,.10); border: 1px solid rgba(63,166,106,.35); }
    .live::before { content: ''; flex: none; width: 7px; height: 7px; border-radius: 50%; background: currentColor; box-shadow: 0 0 0 3px rgba(63,166,106,.18); }
    html[data-live] .live { display: inline-flex; }
    html[data-live="nu"] .live { color: #e5b45a; background: rgba(212,162,76,.10); border-color: rgba(212,162,76,.4); }
    html[data-live="nu"] .live::before { box-shadow: 0 0 0 3px rgba(212,162,76,.18); }
    html[data-live="da"] .live .nu, html[data-live="nu"] .live .da { display: none; }

    /* ── meniul din stânga (compact — userul, 2026-10-12) ── */
    #meniu { position: fixed; top: 0; bottom: 0; left: 0; width: var(--meniu-l); z-index: 20; box-sizing: border-box;
      display: flex; flex-direction: column; gap: 1px; padding: 10px 10px 10px; overflow: hidden auto;
      background: #111317; border-right: 1px solid var(--line); }
    #meniu .meniu-cap { display: flex; align-items: center; gap: 6px; padding: 0 0 10px 2px; }
    #meniu .marca { display: flex; align-items: center; gap: 9px; min-width: 0; color: var(--text); text-decoration: none; }
    #meniu .logo, #bara .logo { flex: none; width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; color: #fff;
      background: linear-gradient(140deg, #3b8ff0, #1c5fbf); box-shadow: inset 0 1px 0 rgba(255,255,255,.18); }
    #meniu .logo .ic, #bara .logo .ic { width: 16px; height: 16px; }
    #meniu .marca b { font-size: 14px; font-weight: 600; white-space: nowrap; letter-spacing: -.01em; }
    #meniu .comuta { margin-left: auto; flex: none; width: 28px; height: 28px; padding: 0; display: grid; place-items: center;
      border: none; border-radius: 7px; background: none; color: var(--text-dim); cursor: pointer; }
    #meniu .comuta:hover { background: var(--panel-2); color: var(--text); }
    #meniu #ofertaNoua { display: flex; align-items: center; justify-content: center; gap: 7px; height: 34px; padding: 0 10px; margin: 0 0 6px;
      font: inherit; font-weight: 600; color: #fff; background: var(--accent-dim); border: 1px solid var(--accent); border-radius: 8px; cursor: pointer; }
    #meniu #ofertaNoua:hover { background: #2f82e6; }
    #meniu .grup { margin: 10px 8px 3px; font-size: 10.5px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: #6f7684; white-space: nowrap; }
    #meniu .link { display: flex; align-items: center; gap: 10px; min-height: 32px; padding: 0 8px; border-radius: 7px; position: relative;
      color: #b6bcc7; text-decoration: none; white-space: nowrap; }
    #meniu .link .ic { color: #8b92a0; }
    #meniu .link:hover { background: rgba(255,255,255,.045); color: var(--text); }
    #meniu .link.activ { background: rgba(77,163,255,.13); color: #fff; font-weight: 500; }
    #meniu .link.activ .ic { color: var(--accent); }
    #meniu .link .insigna { margin-left: auto; }
    /* starea comenzii arătate acum (pagina principală) — mai discret decât pagina activă */
    #meniu .link.curent { color: #fff; }
    #meniu .link.curent::before { content: ''; position: absolute; left: -10px; top: 8px; bottom: 8px; width: 3px; border-radius: 0 3px 3px 0; background: var(--accent); }
    #meniu .link.curent .ic { color: var(--accent); }
    #meniu .spatiu { flex: 1; min-height: 12px; }
    #meniu .meniu-live { padding: 0 2px 8px; }
    #meniu .eu { display: flex; align-items: center; gap: 8px; padding: 9px 2px 0; border-top: 1px solid var(--line); min-width: 0; }
    #meniu .avatar { flex: none; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center;
      background: var(--panel-2); border: 1px solid var(--line); color: var(--text); font-size: 11px; font-weight: 600; }
    #meniu .eu .txt { min-width: 0; flex: 1; line-height: 1.25; }
    #meniu .eu b { display: block; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    #meniu .eu small { display: block; font-size: 11.5px; color: var(--text-dim); }
    #meniu #schimbaParola { display: block; padding: 0; margin-top: 2px; font: inherit; font-size: 11.5px; color: var(--accent);
      background: none; border: none; cursor: pointer; }
    #meniu #schimbaParola:hover { text-decoration: underline; }
    #meniu #iesire { flex: none; display: flex; align-items: center; gap: 5px; height: 28px; padding: 0 8px; font: inherit; font-size: 12.5px;
      color: var(--text-dim); background: none; border: 1px solid var(--line); border-radius: 7px; cursor: pointer; }
    #meniu #iesire:hover { color: #e8907f; border-color: rgba(201,96,76,.6); background: rgba(201,96,76,.08); }
    #meniu #iesire .ic { width: 15px; height: 15px; }
    /* restrâns: doar iconiţele (numele apar ca title la hover) */
    html.meniu-strans #meniu { padding-left: 8px; padding-right: 8px; }
    html.meniu-strans #meniu .txt { display: none; }
    html.meniu-strans #meniu .meniu-cap { flex-direction: column; gap: 8px; padding-left: 0; }
    html.meniu-strans #meniu .comuta { margin: 0; }
    html.meniu-strans #meniu .marca { justify-content: center; }
    html.meniu-strans #meniu #ofertaNoua { padding: 0; }
    html.meniu-strans #meniu .grup { height: 1px; margin: 8px 4px; background: var(--line); }
    html.meniu-strans #meniu .link { justify-content: center; padding: 0; }
    html.meniu-strans #meniu .link .insigna { position: absolute; top: 1px; right: 0; min-width: 16px; height: 15px; padding: 0 4px; font-size: 10px; }
    html.meniu-strans #meniu .link.curent::before { left: -8px; }
    html.meniu-strans #meniu .meniu-live { display: flex; justify-content: center; padding: 0 0 8px; }
    html.meniu-strans #meniu .live { width: 24px; padding: 0; justify-content: center; gap: 0; }
    html.meniu-strans #meniu .live > span { display: none; }
    html.meniu-strans #meniu .eu { flex-direction: column; padding-left: 0; padding-right: 0; }
    html.meniu-strans #meniu #iesire { padding: 0 6px; }

    /* ── configuratorul: bara compactă sus, fără meniu lateral ── */
    #bara.compacta { display: flex; align-items: center; gap: 8px; min-height: 52px; padding: 6px 14px; box-sizing: border-box;
      background: var(--panel); border-bottom: 1px solid var(--line); position: sticky; top: 0; z-index: 10; font-size: 14px; }
    #bara.compacta .spatiu { flex: 1; }
    #bara.compacta .marca { display: flex; align-items: center; gap: 9px; margin-right: 6px; color: var(--text); text-decoration: none; font-weight: 600; white-space: nowrap; }
    #bara.compacta .bara-context { flex: 0 1 auto; margin: 0; font-weight: 400; color: var(--text-dim); font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
    #bara.compacta .bara-context b { color: var(--text); font-weight: 500; }
    #bara.compacta .bara-context i { font-style: normal; margin: 0 5px; }
    #bara.compacta .buton, #bara.compacta button { display: inline-flex; align-items: center; gap: 7px; font: inherit; font-size: 13px; height: 34px; padding: 0 11px;
      border: 1px solid var(--line); border-radius: 8px; background: var(--panel-2); color: var(--text); text-decoration: none; cursor: pointer; white-space: nowrap; }
    #bara.compacta .buton:hover, #bara.compacta button:hover { border-color: #3a4049; background: #272c34; }
    #bara.compacta .buton .ic { color: var(--text-dim); width: 16px; height: 16px; }
    #bara.compacta .primar { background: var(--accent-dim); border-color: var(--accent); color: #fff; font-weight: 600; }
    #bara.compacta .primar:hover { background: #2f82e6; border-color: var(--accent); }
    #bara.compacta #cine { color: var(--text-dim); font-size: 13px; white-space: nowrap; margin-left: 4px; }
    #bara.compacta #iesire { padding: 0 9px; }
    @media (max-width: 1379px) { #bara.compacta .buton .txt { display: none; } #bara.compacta .buton { padding: 0 9px; } }
    @media (max-width: 1100px) { #bara.compacta #cine { display: none; } }
    @media print { #bara, #meniu, #caseteTaskuri { display: none !important; } html.cu-meniu body { padding-left: 0; } }`;
  document.head.appendChild(stil);

  // meniul restrâns se ţine minte în browser; fără alegere: restrâns la jumătate de ecran
  let strans = null;
  try { strans = localStorage.getItem('meniuStrans'); } catch {}
  if (cuMeniu) {
    document.documentElement.classList.add('cu-meniu');
    document.documentElement.classList.toggle('meniu-strans', strans === null ? innerWidth < 1200 : strans === '1');
  }

  const link = (href, ic, text, extra = '', dupa = '') =>
    `<a href="${href}" class="link${activ(href)}" title="${text}" ${extra}>${icoana(ic)}<span class="txt">${text}</span>${dupa}</a>`;

  function meniu() {
    const nav = document.createElement('nav');
    nav.id = 'meniu';
    nav.setAttribute('aria-label', 'Meniu');
    nav.innerHTML = `
      <div class="meniu-cap">
        <a href="/" class="marca" title="Manager comenzi — acasă"><span class="logo">${icoana('logo')}</span><b class="txt">Manager comenzi</b></a>
        <button type="button" class="comuta" id="comutaMeniu" title="Restrânge / extinde meniul" aria-label="Restrânge meniul">${icoana('panou')}</button>
      </div>
      <button type="button" id="ofertaNoua" title="Ofertă nouă">${icoana('plus')}<span class="txt">Ofertă nouă</span></button>
      ${link('/', 'acasa', 'Acasă')}
      <div class="grup"><span class="txt">Comenzi</span></div>
      ${STARI.map(([t, , h, ic, n]) => link('/' + h, ic, n, `data-tab="${t}"`, `<span class="insigna" data-cate-meniu="${t}"></span>`)).join('')}
      <div class="grup"><span class="txt">Operaţiuni</span></div>
      ${link('/sticla', 'sticla', 'Comandă sticlă', 'id="linkSticla"', '<span class="insigna cald" id="nrSticla"></span>')}
      ${link('/livrari', 'livrari', 'Organizează livrări', 'id="linkLivrari"')}
      ${link('/taskuri', 'taskuri', 'Taskuri', 'id="linkTaskuri"', '<span class="insigna rosie" id="nrTaskuri" title="ajunse la ora reminderului"></span>')}
      ${link('/cereri', 'cereri', 'Cereri', 'id="linkCereri"', '<span class="insigna rosie" id="nrCereri" title="cereri de anulare de decis"></span>')}
      ${link('/tichete', 'tichete', 'Tichete', 'id="linkTichete"', '<span class="insigna rosie" id="nrTichete"></span>')}
      <div class="grup" id="grupAdmin" hidden><span class="txt">Administrare</span></div>
      ${link('/clienti', 'clienti', 'Clienţi', 'id="linkClienti" hidden', '<span class="insigna cald" id="nrClienti" title="trimise de agenţi, de aprobat"></span>')}
      ${link('/admin', 'admin', 'Tablou admin', 'id="linkAdmin" hidden')}
      <div class="spatiu"></div>
      <div class="meniu-live"><span class="live" title="Actualizare live: pagina se schimbă singură când lucrează altcineva"><span class="da">Conectat</span><span class="nu">Reconectare…</span></span></div>
      <div class="eu">
        <span class="avatar" id="initiale"></span>
        <span class="txt"><b id="cine"></b><small id="rolEu"></small><button type="button" id="schimbaParola">Schimbă parola</button></span>
        <button type="button" id="iesire" title="Ieşi din cont">${icoana('iesire')}<span class="txt">Ieşi</span></button>
      </div>`;
    nav.querySelector('#comutaMeniu').addEventListener('click', () => {
      const da = document.documentElement.classList.toggle('meniu-strans');
      try { localStorage.setItem('meniuStrans', da ? '1' : '0'); } catch {}
      window.dispatchEvent(new Event('resize'));   // harta din /livrari îşi recalculează mărimea
    });
    document.body.prepend(nav);
    return nav;
  }

  function baraCompacta(el) {
    el.classList.add('compacta');
    el.innerHTML = `
      <a href="/" class="marca" title="Manager comenzi — acasă"><span class="logo">${icoana('logo')}</span>Manager comenzi</a>
      <span class="spatiu"></span>
      <a href="/" class="buton" title="Comenzi">${icoana('acasa')}<span class="txt">Comenzi</span></a>
      <a href="/sticla" class="buton" id="linkSticla" title="Comandă sticlă">${icoana('sticla')}<span class="txt">Comandă sticlă</span><span class="insigna cald" id="nrSticla"></span></a>
      <a href="/livrari" class="buton" id="linkLivrari" title="Organizează livrări">${icoana('livrari')}<span class="txt">Organizează livrări</span></a>
      <a href="/taskuri" class="buton" id="linkTaskuri" title="Taskuri; numărul = ajunse la ora reminderului">${icoana('taskuri')}<span class="txt">Taskuri</span><span class="insigna rosie" id="nrTaskuri"></span></a>
      <a href="/tichete" class="buton" id="linkTichete" title="Tichete: ce nu merge, idei — pentru administrator">${icoana('tichete')}<span class="txt">Tichete</span><span class="insigna rosie" id="nrTichete"></span></a>
      <a href="/clienti" class="buton" id="linkClienti" hidden title="Clienţi; numărul = trimise de agenţi, de aprobat">${icoana('clienti')}<span class="txt">Clienţi</span><span class="insigna cald" id="nrClienti"></span></a>
      <a href="/admin" class="buton" id="linkAdmin" hidden title="Administrare">${icoana('admin')}<span class="txt">Administrare</span></a>
      <button type="button" id="ofertaNoua" class="primar">${icoana('plus')}Ofertă nouă</button>
      <span id="cine"></span>
      <button type="button" id="iesire" title="Ieşi din cont">${icoana('iesire')}</button>`;
  }

  // numerele din meniu (sticlă, clienţi de aprobat, stările comenzilor); pagina principală
  // le ia de aici (evenimentul „sumar") pt. plăcile ei — o singură cerere /api/sumar
  window.puneSumar = s => {
    window.sumarBara = s;
    const pune = (sel, n) => document.querySelectorAll(sel).forEach(x => { x.textContent = n || ''; });
    pune('#nrSticla', s.sticla);
    pune('#nrClienti', s.deAprobat);
    pune('#nrCereri', s.cereri);   // doar la conducere / admin (biroul primeşte 0)
    pune('#nrTichete', s.tichete);   // admin: tichete noi; ceilalţi: răspunsuri la tichetele lor, nevăzute
    for (const [t, k] of STARI) pune(`[data-cate-meniu="${t}"]`, s[k]);
    window.dispatchEvent(new CustomEvent('sumar', { detail: s }));
  };
  const incarcaSumar = () => fetch('/api/sumar').then(r => (r.ok ? r.json() : null)).then(s => s && window.puneSumar(s)).catch(() => {});
  // la orice schimbare anunţată live (web/live.js), numerele se reîmprospătează singure
  let amana = null;
  window.addEventListener('live:schimbare', () => { clearTimeout(amana); amana = setTimeout(incarcaSumar, 200); });

  // Ctrl K (⌘K pe Mac) — căutarea: pe pagina principală (şi din pagina unei comenzi)
  // cea a comenzilor; altundeva căutarea paginii (#cauta, ex. clienţii), altfel duce
  // la căutarea comenzilor. În configurator nu luăm scurtătura browserului.
  if (cuMeniu) document.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'k') return;
    e.preventDefault();
    if (window.cautaComenzi) return window.cautaComenzi();
    const c = document.getElementById('cauta');
    if (c) { c.focus(); c.select(); } else location.href = '/?cauta';
  });

  // „Schimbă parola" din meniu — POST /api/eu/parola cere parola de acum; sesiunea de
  // aici rămâne deschisă, celelalte (alte calculatoare) se închid
  function schimbaParola() {
    const d = document.createElement('dialog');
    d.className = 'mesaj-dialog';
    d.innerHTML = `<form>
      <p class="camp"><b>Schimbă parola</b></p>
      <div class="camp"><label for="parolaAcum">Parola de acum</label><input id="parolaAcum" type="password" autocomplete="current-password" required></div>
      <div class="camp"><label for="parolaNoua">Parola nouă (cel puţin 8 caractere)</label><input id="parolaNoua" type="password" autocomplete="new-password" minlength="8" required></div>
      <div class="camp"><label for="parolaNoua2">Scrie din nou parola nouă</label><input id="parolaNoua2" type="password" autocomplete="new-password" required></div>
      <div class="mesaj eroare" hidden></div>
      <div class="butoane"><button type="button" class="renunta">Renunţă</button><button class="primar">Schimbă parola</button></div>
    </form>`;
    const mesaj = d.querySelector('.mesaj');
    const arata = text => { mesaj.textContent = text; mesaj.hidden = false; };
    d.querySelector('.renunta').addEventListener('click', () => d.close());
    d.addEventListener('close', () => d.remove());
    d.querySelector('form').addEventListener('submit', async e => {
      e.preventDefault();
      const [acum, noua, noua2] = ['parolaAcum', 'parolaNoua', 'parolaNoua2'].map(id => d.querySelector('#' + id).value);
      if (noua !== noua2) return arata('Parola nouă nu e la fel în cele două câmpuri.');
      const r = await fetch('/api/eu/parola', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parolaCurenta: acum, parolaNoua: noua }) }).catch(() => null);
      const date = await r?.json().catch(() => null);
      if (!r?.ok) return arata(date?.eroare || 'Serverul nu răspunde. Încearcă din nou.');
      d.close();
      const gata = 'Parola a fost schimbată. Pe alte calculatoare intri din nou, cu parola nouă.';
      typeof alerta === 'function' ? alerta(gata) : alert(gata);
    });
    document.body.append(d);
    d.showModal();
  }

  window.puneBara = el => {
    const context = [...el.querySelectorAll('.bara-context')];
    const nav = cuMeniu ? meniu() : null;
    if (nav) el.remove();   // paginile managerului: fără bară sus
    else { el.id = 'bara'; baraCompacta(el); el.querySelector('.spatiu').before(...context); }
    const radacina = nav ?? el;

    // pe pagina principală butonul deschide alegerea gamei (îl leagă pagina);
    // de oriunde altundeva duce acolo, cu alegerea deschisă
    if (!acasa) radacina.querySelector('#ofertaNoua').addEventListener('click', () => { location.href = '/?nou'; });
    radacina.querySelector('#iesire').addEventListener('click', async () => {
      await fetch('/api/logout', { method: 'POST' });
      location.href = '/login';
    });
    nav?.querySelector('#schimbaParola').addEventListener('click', schimbaParola);

    let laDistanta = false;   // prin tabloul de pe Cloudflare (server/releu.js)
    fetch('/api/eu').then(r => { laDistanta = r.headers.has('x-distanta'); return r.ok ? r.json() : null; }).then(d => {
      const eu = d?.utilizator;
      if (!eu) return;
      radacina.querySelector('#cine').textContent = eu.nume;
      // modul test (pus de admin): chenar portocaliu pe toată pagina + eticheta sus; ce face
      // omul merge pe copia bazei (server/db.js). Fără clicuri pe ele (pointer-events: none).
      if (eu.mod_test) {
        window.modTest = true;
        const chenar = document.createElement('div');
        chenar.style.cssText = 'position:fixed;inset:0;border:3px solid #ff9d2e;pointer-events:none;z-index:1900';
        chenar.innerHTML = '<span style="position:absolute;left:50%;top:0;transform:translateX(-50%);padding:2px 14px 4px;'
          + 'border-radius:0 0 9px 9px;background:#ff9d2e;color:#2a1600;font:700 12px Inter,system-ui,sans-serif;letter-spacing:.04em;white-space:nowrap">'
          + 'MOD TEST · ce faci aici nu ajunge în baza reală</span>';
        document.body.appendChild(chenar);
      }
      // ciornele (localStorage) nu trec dintr-un mod în altul — o ciornă din test s-ar salva pe bune
      try {
        const mod = eu.mod_test ? '1' : '0';
        if ((localStorage.getItem('modTestVazut') ?? mod) !== mod) localStorage.removeItem('ciorne');
        localStorage.setItem('modTestVazut', mod);
      } catch {}
      radacina.querySelector('#linkAdmin').hidden = eu.rol !== 'admin';     // conturile — doar admin
      radacina.querySelector('#linkClienti').hidden = eu.rol === 'birou';   // clienţii — nu şi biroul (userul, 2026-10-02)
      // de la distanţă se deschid doar tabloul de admin şi tichetele (releu.js le blochează pe restul) → restul meniului dispare
      if (laDistanta) radacina.querySelectorAll('#ofertaNoua, .grup:not(#grupAdmin), a[href]:not(.marca)').forEach(el => {
        if (!['/admin', '/tichete'].includes(el.getAttribute('href'))) el.hidden = true;
      });
      if (!nav) return;
      nav.querySelector('#grupAdmin').hidden = eu.rol === 'birou';          // fără clienţi şi fără conturi
      nav.querySelector('#rolEu').textContent = ROLURI[eu.rol] ?? eu.rol;
      nav.querySelector('#initiale').textContent = eu.nume.split(/\s+/).map(c => c[0]).join('').slice(0, 2).toUpperCase();
      nav.querySelector('.eu').title = `${eu.nume} · ${ROLURI[eu.rol] ?? eu.rol}`;
    }).catch(() => {});
    incarcaSumar();
    verificaTaskuri();
    setInterval(verificaTaskuri, 60 * 1000);
  };

  // ── Remindere (server/taskuri.js): din minut în minut, taskurile mele ajunse la scadenţă.
  // Fiecare (task, scadenţă) se anunţă o dată pe calculator — ţinut minte în localStorage,
  // comun tuturor taburilor; amânat = altă scadenţă = se anunţă iar. Notificare Windows
  // dacă browserul o permite (HTTPS sau excepţia din chrome://flags — vezi pagina Taskuri),
  // altfel o casetă în colţul paginii, până o închizi.
  const anuntateAici = new Set();   // dacă localStorage nu merge, măcar nu se repetă în tabul ăsta
  const anuntate = () => { try { return JSON.parse(localStorage.getItem('taskuriAnuntate') ?? '[]'); } catch { return []; } };
  const anuntaTask = t => {
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
  async function verificaTaskuri() {
    const r = await fetch('/api/taskuri/scadente').catch(() => null);
    if (!r?.ok) return;
    const { taskuri } = await r.json();
    document.querySelectorAll('#nrTaskuri').forEach(x => { x.textContent = taskuri.length || ''; });
    const vechi = anuntate();
    const chei = taskuri.map(t => `${t.id}@${t.scadenta}`);
    try { localStorage.setItem('taskuriAnuntate', JSON.stringify(chei)); } catch { /* rămâne anuntateAici */ }
    taskuri.forEach((t, k) => {
      if (vechi.includes(chei[k]) || anuntateAici.has(chei[k])) return;
      anuntateAici.add(chei[k]);
      anuntaTask(t);
    });
  }
  window.verificaTaskuri = verificaTaskuri;   // pagina Taskuri şi cardul de pe Acasă o cheamă după o schimbare

  const el = document.getElementById('bara');
  if (el) window.puneBara(el);
})();
