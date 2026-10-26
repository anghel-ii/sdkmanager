// ═══════════════════════════════════════════════════════════════════════════
//  ADRESA PE BUCĂŢI (userul, 2026-10-19 — pt. FAN Courier şi livrările cu maşina
//  noastră): judeţ + localitate (din lista SIRUTA, /localitati.json) + stradă.
//
//  Peste tot în aplicaţie adresa rămâne UN text — „strada, Localitate, Judeţ" —
//  ca fişa, coşul, ciornele să meargă neschimbate. Câmpurile de mai jos îl scriu
//  mereu în forma asta, iar desface() îl citeşte înapoi (şi pe cele vechi, scrise
//  liber, cât se poate). Fişierul merge şi în Node (serverul: livrări, FAN).
//
//    Adresa.desface(text, index)  → { judet, localitate, strada, recunoscuta }
//    Adresa.compune({ judet, localitate, strada }) → text
//    Adresa.index(json)           → indexul pt. desface (din localitati.json)
//    Adresa.campuri(input)        → în browser: input-ul text devine 3 câmpuri;
//                                   input.value citeşte / scrie tot textul
//    Adresa.marcheaza(root)       → ⚠ lângă adresele afişate care nu se recunosc
// ═══════════════════════════════════════════════════════════════════════════
(function (radacina, fabrica) {
  const Adresa = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = Adresa;
  else radacina.Adresa = Adresa;
})(typeof self !== 'undefined' ? self : this, function () {
  // fără diacritice (ş/ș, ţ/ț, ă, î, â), litere mici, fără punctuaţie
  const normal = t => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9()]+/g, ' ').trim();
  const PREFIX_JUDET = /^(jud(etul)?|judet) /;
  const PREFIX_LOC = /^(mun(icipiul)?|or(as(ul)?)?|com(una)?|sat(ul)?|loc(alitatea)?|sector(ul)?) /;
  const faraParanteza = t => t.replace(/\s*\(.*\)\s*$/, '');

  // { judete: [nume], loc: Map(judet → Map(normal → nume)), baza: Map(judet → Map(normal fără paranteză → [nume])),
  //   undeE: Map(normal → Set(judet)) }
  function index(json) {
    const ix = { judete: Object.keys(json.judete), normalJudet: new Map(), loc: new Map(), baza: new Map(), undeE: new Map() };
    for (const j of ix.judete) {
      ix.normalJudet.set(normal(j), j);
      const loc = new Map(), baza = new Map();
      for (const l of json.judete[j]) {
        loc.set(normal(l), l);
        const b = normal(faraParanteza(l));
        baza.set(b, [...(baza.get(b) ?? []), l]);
        if (!ix.undeE.has(b)) ix.undeE.set(b, new Set());
        ix.undeE.get(b).add(j);
      }
      ix.loc.set(j, loc);
      ix.baza.set(j, baza);
    }
    ix.normalJudet.set('bucuresti', 'București');
    return ix;
  }

  const judetul = (ix, t) => ix.normalJudet.get(normal(t).replace(PREFIX_JUDET, ''));
  // localitatea din judeţ: numele exact, sau fără „(comuna)" dacă e una singură cu numele ăsta
  function localitatea(ix, judet, t) {
    const n = normal(t).replace(PREFIX_LOC, '');
    if (!n) return null;
    const exact = ix.loc.get(judet)?.get(n);
    if (exact) return exact;
    const b = ix.baza.get(judet)?.get(n);
    return b?.length === 1 ? b[0] : null;
  }

  function desface(text, ix) {
    const seg = String(text ?? '').split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
    let judet = null, kj = -1, localitate = null, kl = -1;
    for (let i = seg.length - 1; i >= 0 && kj < 0; i--) {
      const j = judetul(ix, seg[i]);
      if (j) { judet = j; kj = i; }
    }
    // localitatea: de la coadă spre început, înaintea judeţului
    const pana = kj < 0 ? seg.length : kj;
    if (judet) {
      for (let i = pana - 1; i >= 0 && kl < 0; i--) {
        const l = localitatea(ix, judet, seg[i]);
        if (l) { localitate = l; kl = i; }
      }
      // „…, Iași" scris o dată = oraşul din judeţul cu acelaşi nume (compune() nu-l repetă)
      if (!localitate) localitate = localitatea(ix, judet, seg[kj]);
    } else {
      // fără judeţ scris: o localitate care există într-un singur judeţ („Cluj-Napoca")
      for (let i = pana - 1; i >= 0 && kl < 0; i--) {
        const n = normal(seg[i]).replace(PREFIX_LOC, '');
        const unde = ix.undeE.get(n);
        if (unde?.size === 1) { judet = [...unde][0]; localitate = localitatea(ix, judet, seg[i]); kl = i; }
      }
    }
    // „sector 2" fără „Bucureşti" scris
    if (!judet && seg.some(x => /^sector(ul)? [1-6]$/.test(normal(x)))) { judet = 'București'; localitate = 'București'; }
    const strada = seg.filter((_, i) => i !== kj && i !== kl).join(', ');
    return { judet, localitate, strada, recunoscuta: !!(judet && localitate) };
  }

  const compune = ({ judet, localitate, strada }) =>
    [strada, localitate, judet && judet !== localitate ? judet : null].map(x => String(x ?? '').trim()).filter(Boolean).join(', ');

  // ── în browser: câmpurile ────────────────────────────────────────────────
  let _lista = null;
  const incarca = () => (_lista ??= fetch('/localitati.json').then(r => r.ok ? r.json() : Promise.reject(new Error(r.status)))
    .then(json => ({ json, ix: index(json) })).catch(e => { _lista = null; throw e; }));

  let stilPus = false;
  function stil() {
    if (stilPus) return;
    stilPus = true;
    const s = document.createElement('style');
    s.textContent = `
      .adresa-campuri { display: grid; grid-template-columns: minmax(0, 9fr) minmax(0, 11fr); gap: 6px; width: 100%; }
      .adresa-campuri .adr-strada { grid-column: 1 / -1; }
      .adresa-campuri select, .adresa-campuri input { width: 100%; min-width: 0; box-sizing: border-box; }
      .adresa-campuri select.adr-gol { color: var(--text-dim, #888); }
      .adresa-campuri input.adr-nerecunoscut { border-color: #c98a2b !important; }
      .adresa-campuri .adr-nota { grid-column: 1 / -1; font-size: 11.5px; color: #d4a24c; margin-top: -2px; }
      .adresa-campuri .adr-nota:empty { display: none; }
      .adr-avert { font-size: 11.5px; color: #d4a24c; white-space: nowrap; cursor: help; }`;
    document.head.appendChild(s);
  }

  // Input-ul text rămâne în pagină (ascuns): restul codului îi citeşte / scrie
  // .value ca până acum, iar evenimentele „input" / „change" vin tot de la el.
  function campuri(input) {
    if (!input || input._adresa) return;
    stil();
    const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    const brut = v => (v === undefined ? desc.get.call(input) : desc.set.call(input, v));
    const c = document.createElement('div');
    c.className = 'adresa-campuri';
    c.innerHTML = `<select class="adr-judet adr-gol" aria-label="Judeţ"><option value="">Judeţ</option></select>
      <input type="text" class="adr-localitate" placeholder="Localitate" autocomplete="off" aria-label="Localitate">
      <input type="text" class="adr-strada" placeholder="Stradă, nr., bloc, ap." autocomplete="off" aria-label="Stradă şi număr">
      <div class="adr-nota"></div>`;
    input.after(c);
    input.hidden = true;
    const [j, l, s, nota] = ['.adr-judet', '.adr-localitate', '.adr-strada', '.adr-nota'].map(x => c.querySelector(x));
    let ix = null, lista = null;

    // Localităţile, fără diacritice (/sugestii.js — userul, 2026-10-26: „ramnicu valcea" → „Râmnicu Vâlcea"):
    // din judeţul ales sau, fără judeţ, din toate (cu judeţul dedesubt; alegerea îl pune şi pe el). Întâi cele
    // care încep cu textul, apoi cele cu un cuvânt care începe cu el, apoi restul; cele scurte înainte.
    window.Sugestii?.leaga(l, {
      cauta: text => {
        if (!ix) return [];
        const q = normal(text).replace(PREFIX_LOC, '');
        if (!q && !j.value) return [];
        const gasite = [];
        for (const jud of j.value ? [j.value] : ix.judete) {
          for (const [n, nume] of ix.loc.get(jud) ?? []) {
            const i = q ? n.indexOf(q) : 0;
            if (i >= 0) gasite.push({ text: nume, judet: jud, sub: j.value ? '' : jud, scor: i === 0 ? 0 : n[i - 1] === ' ' ? 1 : 2 });
          }
        }
        return gasite.sort((a, b) => a.scor - b.scor || a.text.length - b.text.length || a.text.localeCompare(b.text, 'ro')).slice(0, 300);
      },
      alege: g => {
        j.value = g.judet;
        l.value = g.text;
        scrie(); anunta('input'); anunta('change');
      },
    });
    const verifica = () => {
      const bun = !l.value.trim() || !ix || (j.value && localitatea(ix, j.value, l.value));
      l.classList.toggle('adr-nerecunoscut', !bun);
      nota.textContent = bun ? '' : j.value ? `„${l.value.trim()}" nu e în lista localităţilor din ${j.value} — alege din listă (FAN n-o găseşte altfel).`
        : 'Alege judeţul.';
    };
    const scrie = () => { brut(compune({ judet: j.value, localitate: l.value.trim(), strada: s.value.trim() })); j.classList.toggle('adr-gol', !j.value); verifica(); };
    const anunta = tip => input.dispatchEvent(new Event(tip, { bubbles: true }));
    const pune = text => {
      if (!ix) { brut(text); s.value = text; return; }   // lista încă nu e încărcată: totul la stradă, se desface după
      const a = desface(text, ix);
      j.value = a.judet ?? '';
      l.value = a.localitate ?? '';
      s.value = a.strada;
      scrie();
    };

    Object.defineProperty(input, 'value', { configurable: true, get: () => brut(), set: v => pune(String(v ?? '')) });
    // „obligatoriu" trece pe câmpurile vizibile (un input ascuns şi required ar bloca formularul fără să arate unde)
    const descReq = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'required');
    const puneObligatoriu = v => { j.required = l.required = s.required = !!v; };
    puneObligatoriu(input.required);
    descReq.set.call(input, false);
    Object.defineProperty(input, 'required', { configurable: true, get: () => s.required, set: puneObligatoriu });
    input._adresa = { focus: () => (!j.value ? j : !l.value ? l : s).focus() };
    input.focus = () => input._adresa.focus();

    j.addEventListener('change', () => {
      if (l.value && ix && !localitatea(ix, j.value, l.value)) l.value = '';
      scrie(); anunta('input'); anunta('change');
    });
    l.addEventListener('input', () => { scrie(); anunta('input'); });
    l.addEventListener('change', () => {
      if (ix) {
        // localitatea scrisă fără judeţ ales: dacă e într-un singur judeţ, îl alege singur
        const unde = !j.value && ix.undeE.get(normal(l.value).replace(PREFIX_LOC, ''));
        if (unde?.size === 1) j.value = [...unde][0];
        const bun = j.value && localitatea(ix, j.value, l.value);
        if (bun) l.value = bun;   // „iasi" → „Iași"
      }
      scrie(); anunta('change');
    });
    s.addEventListener('input', () => { scrie(); anunta('input'); });
    s.addEventListener('change', () => anunta('change'));

    const deLa = brut();
    s.value = deLa;
    incarca().then(x => {
      lista = x; ix = x.ix;
      j.append(...Object.keys(x.json.judete).map(n => Object.assign(document.createElement('option'), { value: n, textContent: n })));
      pune(brut() || s.value);
    }).catch(() => {
      // fără listă (ex. configuratorul deschis de pe Cloudflare): un singur câmp, ca înainte
      const obligatoriu = s.required;
      c.remove(); input.hidden = false;
      delete input.value; delete input.focus; delete input.required; input._adresa = null;
      input.required = obligatoriu;
    });
  }

  // Adresele afişate cu data-verifica-adresa (ex. pagina comenzii): un semn dacă judeţul / localitatea
  // nu se recunosc — FAN şi harta livrărilor n-ar găsi-o.
  function marcheaza(root) {
    const de = [...(root ?? document).querySelectorAll('[data-verifica-adresa]')];
    if (!de.length) return;
    incarca().then(({ ix }) => {
      stil();
      for (const el of de) {
        const a = desface(el.textContent, ix);
        if (a.recunoscuta || el.querySelector('.adr-avert')) continue;
        el.insertAdjacentHTML('beforeend', ` <span class="adr-avert" title="Adresa trebuie să aibă judeţul şi o localitate din listă — altfel FAN Courier şi harta livrărilor n-o găsesc.">⚠ ${
          a.judet ? 'localitate nerecunoscută' : 'fără judeţ / localitate'}</span>`);
      }
    }).catch(() => {});
  }

  // câmpurile marcate cu data-adresa se fac singure (după scripturile paginii, ca etichetele din ui_nou.js să fie deja puse)
  if (typeof document !== 'undefined') {
    const toate = () => document.querySelectorAll('input[data-adresa]').forEach(campuri);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', toate); else toate();
  }

  return { normal, index, desface, compune, campuri, incarca, marcheaza };
});
