// ═══════════════════════════════════════════════════════════════════════════
//  Cardul „Expediere FAN Courier" din pagina comenzii (web/manager): AWB-urile
//  comenzii (starea livrării, printare, ştergere) şi fereastra „Generează AWB",
//  completată din comandă. Tot ce ţine de AWB e aici — pagina are doar
//  <div id="awbCard"> şi window.cardAwb(el, comanda) la fiecare randare.
//  API: server/fan.js. Foloseşte dataOra (data.js), confirma / alerta (dialog.js).
//  Ca pe site-ul FAN: doar colete + greutate; transportul îl plătim noi; rambursul
//  se scrie de mână şi doar la „Cont Colector" (userul, 2026-10-12).
// ═══════════════════════════════════════════════════════════════════════════
(() => {
  const esc = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const lei = n => `${Number(n).toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} lei`;
  const colector = s => /Cont Colector/.test(s);
  async function api(cale, optiuni = {}) {
    const r = await fetch(cale, { headers: { 'Content-Type': 'application/json' }, ...optiuni });
    if (r.status === 401) { location.href = '/login?redirect=' + encodeURIComponent(location.pathname + location.hash); return null; }
    return r;
  }
  const eroareDin = async r => (await r.json().catch(() => ({}))).eroare || 'Operaţia a eşuat.';

  document.head.insertAdjacentHTML('beforeend', `<style>
    .awb-card { margin-top: 20px; }
    .awb-cap { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
    .awb-cap h2 { flex: 1; margin: 0; }
    .awb-card td.actiuni { white-space: nowrap; text-align: right; }
    .awb-card tr.sters td { opacity: .5; }
    .awb-livrat { color: var(--ok); font-weight: 600; }
    dialog.awb-dialog { width: min(760px, calc(100% - 32px)); }
    .awb-grila { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px 14px; margin-top: 14px; }
    .awb-grila .lat { grid-column: 1 / -1; }
    .awb-grila .dublu { grid-column: span 2; }
    .awb-grila h3 { grid-column: 1 / -1; font-size: .9rem; color: var(--accent); margin: 10px 0 2px; }
    .awb-grila label[hidden] { display: none; }
  </style>`);

  // localităţile FAN ale unui judeţ (pt. completarea câmpului), o dată pe pagină
  const localitati = new Map();
  const listaLocalitati = judet => {
    if (!localitati.has(judet)) localitati.set(judet, api('/api/fan/localitati?judet=' + encodeURIComponent(judet))
      .then(async r => (r?.ok ? (await r.json()).localitati : [])).catch(() => []));
    return localitati.get(judet);
  };

  // AWB-urile pentru comenzile cu curier — acceptate (în lucru sau finalizate = gata de
  // livrare) sau care aşteaptă plata
  window.cardAwb = async (el, c) => {
    if (!el) return;
    if (!/^curier/i.test(String(c.livrare ?? '').trim()) || c.anulat || !['comanda', 'plata'].includes(c.tip)) { el.innerHTML = ''; return; }
    const r = await api(`/api/comenzi/${c.id}/awb`);
    if (!r?.ok) { el.innerHTML = ''; return; }
    const d = await r.json();
    const din = () => window.cardAwb(el, c);
    el.style.gridColumn = '1 / -1';   // pe toată lăţimea, în grila paginii comenzii
    el.innerHTML = `<div class="card awb-card">
      <div class="awb-cap"><h2>Expediere FAN Courier</h2>
        ${d.activ ? `${d.awb.some(a => !a.sters_la && !a.livrat_la) ? '<button class="mic" data-act="stare" title="Întreabă acum FAN de starea AWB-urilor (altfel o dată pe oră)">↻ Stare</button>' : ''}
          <button class="verde" data-act="genereaza">Generează AWB</button>` : ''}</div>
      ${d.activ ? '' : '<div class="dim mic">Legătura cu FAN Courier nu e configurată — administratorul o pune în pagina Utilizatori.</div>'}
      ${d.awb.length ? `<table class="date">
        <thead><tr><th>AWB</th><th>Stare</th><th>Serviciu</th><th>Ramburs</th><th>Colete</th><th>Generat</th><th></th></tr></thead>
        <tbody>${d.awb.map(a => `<tr${a.sters_la ? ' class="sters"' : ''}>
          <td class="cod">${esc(a.numar)}</td>
          <td>${a.sters_la ? `şters · ${dataOra(a.sters_la)}`
            : a.livrat_la ? `<span class="awb-livrat">✓ ${esc(a.stare_text || 'Livrat')}</span> · ${dataOra(a.livrat_la)}`
            : `${esc(a.stare_text || 'generat')}${a.stare_la ? ` · ${dataOra(a.stare_la)}` : ''}`}</td>
          <td>${esc(a.serviciu)}</td>
          <td>${a.ramburs > 0 ? lei(a.ramburs) : '—'}</td>
          <td>${a.colete} · ${String(a.greutate).replace('.', ',')} kg</td>
          <td class="dim mic">${dataOra(a.creat_la)} · ${esc(a.creat_de_nume ?? '')}</td>
          <td class="actiuni">${a.sters_la || !d.activ ? '' : `<button class="mic primar" data-tipar="${esc(a.numar)}" title="Eticheta PDF, în tab nou">🖶 Printează AWB</button>
            ${a.livrat_la ? '' : `<button class="mic rosu-contur" data-sterge="${esc(a.numar)}">Şterge AWB</button>`}`}</td>
        </tr>`).join('')}</tbody></table>` : d.activ ? '<div class="dim mic">Niciun AWB încă.</div>' : ''}
    </div>`;

    el.querySelector('[data-act="genereaza"]')?.addEventListener('click', () => fereastra(c, d, din));
    el.querySelector('[data-act="stare"]')?.addEventListener('click', async e => {
      e.target.disabled = true;
      const rr = await api('/api/awb/actualizeaza', { method: 'POST' });
      if (rr && !rr.ok) await alerta(await eroareDin(rr));
      din();
    });
    el.querySelectorAll('[data-tipar]').forEach(b => b.addEventListener('click', () =>
      window.open(`/api/awb/${encodeURIComponent(b.dataset.tipar)}/eticheta`, '_blank')));
    el.querySelectorAll('[data-sterge]').forEach(b => b.addEventListener('click', async () => {
      if (!(await confirma(`Ştergi AWB-ul ${b.dataset.sterge} la FAN Courier?\n\nSe poate doar cât coletul n-a fost ridicat de curier.`, 'Şterge AWB'))) return;
      const rr = await api('/api/awb/' + encodeURIComponent(b.dataset.sterge), { method: 'DELETE' });
      if (rr && !rr.ok) await alerta(await eroareDin(rr));
      din();
    }));
  };

  // „Generează AWB": fereastra completată din comandă; stă în <body>, deci re-randarea
  // paginii (actualizarea live) nu o închide
  function fereastra(c, d, gata) {
    const p = d.propunere, t = p.destinatar;
    const dlg = document.createElement('dialog');
    dlg.className = 'mesaj-dialog awb-dialog';
    const camp = (nume, eticheta, val, extra = '', cls = '') =>
      `<label class="${cls}">${eticheta}<input name="${nume}" value="${esc(val)}" autocomplete="off" ${extra}></label>`;
    dlg.innerHTML = `<form novalidate>
      <h2>Generează AWB — ${esc(c.oferta_nr || c.numar)}</h2>
      <div class="awb-grila">
        <h3>Destinatar</h3>
        ${camp('nume', 'Nume', t.nume)}${camp('telefon', 'Telefon', t.telefon, 'type="tel"')}${camp('email', 'E-mail (opţional)', t.email, 'type="email"')}
        <label>Judeţ<select name="judet"><option value="">Alege…</option>${d.judete.map(j =>
          `<option${j === t.judet ? ' selected' : ''}>${esc(j)}</option>`).join('')}</select></label>
        ${camp('localitate', 'Localitate (din lista FAN)', t.localitate, 'list="awbLocalitati"')}
        ${camp('codPostal', 'Cod poştal (opţional)', t.codPostal, 'inputmode="numeric"')}
        ${camp('strada', 'Stradă', t.strada, '', 'dublu')}
        ${camp('numar', 'Număr', t.numar)}
        <datalist id="awbLocalitati"></datalist>
        <h3>Expediere</h3>
        <label>Serviciu<select name="serviciu">${d.servicii.map(s =>
          `<option${s === p.serviciu ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
        ${camp('colete', 'Colete', p.colete, 'type="number" min="1" step="1"')}
        ${camp('greutate', 'Greutate totală (kg)', p.greutate ?? '', 'inputmode="decimal"')}
        ${camp('ramburs', 'Ramburs de încasat (lei)', p.ramburs ?? '', 'inputmode="decimal" placeholder="scrie suma"', 'ramburs')}
        ${camp('continut', 'Conţinut', p.continut, '', 'dublu')}
        ${camp('observatii', 'Observaţii pentru curier (opţional)', p.observatii, '', 'lat')}
      </div>
      <div class="mesaj eroare" hidden style="margin-top:12px"></div>
      <div class="butoane"><button type="button" data-act="renunta">Renunţă</button>
        <button type="submit" class="verde">Generează AWB</button></div>
    </form>`;
    document.body.append(dlg);
    const f = dlg.querySelector('form'), v = n => f.elements[n].value.trim();
    const mesaj = dlg.querySelector('.mesaj');

    const puneLocalitati = async () => {
      const lista = v('judet') ? await listaLocalitati(v('judet')) : [];
      dlg.querySelector('#awbLocalitati').innerHTML = lista.map(l => `<option value="${esc(l)}">`).join('');
      return lista;
    };
    puneLocalitati();
    f.elements.judet.addEventListener('change', () => { f.elements.localitate.value = ''; puneLocalitati(); });
    // rambursul doar la „Cont Colector"
    const arataRamburs = () => { dlg.querySelector('label.ramburs').hidden = !colector(v('serviciu')); };
    arataRamburs();
    f.elements.serviciu.addEventListener('change', arataRamburs);

    dlg.querySelector('[data-act="renunta"]').addEventListener('click', () => dlg.close());
    dlg.addEventListener('close', () => dlg.remove());
    f.addEventListener('submit', async e => {
      e.preventDefault();
      const gresit = m => { mesaj.textContent = m; mesaj.hidden = false; };
      // localitatea exact ca în nomenclatorul FAN — altfel FAN refuză AWB-ul
      const lista = await puneLocalitati();
      if (lista.length && !lista.includes(v('localitate'))) return gresit('Alege localitatea din lista FAN (începe să scrii numele).');
      const buton = f.querySelector('button[type="submit"]');
      buton.disabled = true;   // un dublu-clic ar face două AWB-uri
      buton.textContent = 'Se generează…';
      const r = await api(`/api/comenzi/${c.id}/awb`, { method: 'POST', body: JSON.stringify({
        destinatar: Object.fromEntries(['nume', 'telefon', 'email', 'judet', 'localitate', 'strada', 'numar', 'codPostal'].map(n => [n, v(n)])),
        serviciu: v('serviciu'), ramburs: v('ramburs'), colete: v('colete'), greutate: v('greutate'),
        continut: v('continut'), observatii: v('observatii'),
      }) }).catch(() => null);
      buton.disabled = false;
      buton.textContent = 'Generează AWB';
      if (!r) return gresit('Serverul nu răspunde.');
      if (!r.ok) return gresit(await eroareDin(r));
      dlg.close();
      gata();
    });
    dlg.showModal();
  }
})();
