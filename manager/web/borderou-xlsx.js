// ═══════════════════════════════════════════════════════════════════════════
//  BORDEROUL DE LIVRARE CA EXCEL (.xlsx) — userul, 2026-11-03: „acelaşi fişier, dar în format Excel".
//  Fără biblioteci: un .xlsx e un zip cu câteva XML-uri; zip-ul îl scriem necomprimat (metoda 0, cu CRC-32).
//  Acelaşi conţinut ca borderoul de tipar (web/livrari, borderouHtml): titlul, FIRMA / delegat-telefon-observaţii /
//  localitate-stradă / Preţ / Bon / Factură + chitanţă / OP / colete, totalurile, „Total numerar de încasat".
//  Diferenţa: comenzile aceluiaşi client stau pe rânduri separate (FIRMA, contactul şi adresa unite pe verticală),
//  ca preţurile să rămână NUMERE în Excel (pe tipar sunt una sub alta în aceeaşi celulă).
//  UMD: pagina îl ia ca <script>, testele (scripts/test.js) cu require().
// ═══════════════════════════════════════════════════════════════════════════
(function (radacina, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else radacina.BorderouXlsx = fabrica();
}(typeof self !== 'undefined' ? self : this, function () {
  const faraDiacritice = t => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const pret = c => Number(c.de_incasat) || 0;
  const unice = xs => [...new Set(xs.filter(Boolean))];

  // Livrarea { data, comenzi } → ce scrie pe borderou. `grupeaza` = gruparea pe client a paginii (aceeaşi ca la tipar).
  function model(l, grupeaza, previzualizare = false) {
    const judete = unice(l.comenzi.map(c => c.judet)).map(j => faraDiacritice(j).toUpperCase());
    const [a, ll, z] = l.data.split('-');
    const sume = { pret: 0, bon: 0, factura: 0, op: 0 };
    const randuri = grupeaza(l.comenzi).map(g => {
      for (const c of g) { sume.pret += pret(c); if (c.coloana_borderou) sume[c.coloana_borderou] += pret(c); }
      return {
        firma: g[0].client_nume + (g.some(c => c.demo) ? ' (DEMO)' : ''),
        contact: [...unice(g.map(c => c.client_telefon)), ...unice(g.map(c => c.observatii_livrare))],
        adresa: unice(g.map(c => c.client_adresa)),
        preturi: g.filter(c => c.de_incasat != null).map(c => ({ pret: pret(c), coloana: c.coloana_borderou ?? null })),
      };
    });
    return {
      titlu: `${previzualizare ? 'PREVIZUALIZARE — NU E FINAL · ' : ''}Transport${judete.length ? ` Jud ${judete.join('-')}` : ''} ${z}.${ll}.${a}`,
      fisier: `Borderou ${judete.length ? judete.join('-') + ' ' : ''}${z}.${ll}.${a}${previzualizare ? ' (NU E FINAL)' : ''}.xlsx`,
      randuri, sume, numerar: sume.bon + sume.factura,
    };
  }

  // ── foaia ──
  const COLOANE = ['FIRMA', 'NUME DELEGAT-NR TELEFON-OBSERVATII', 'LOCALITATE/ STRADA', 'Preţ', 'Bon', 'Factura + chitanta', 'OP', 'colete'];
  const LATIMI = [34, 28, 24, 14, 13, 16, 14, 9];          // caractere — aceleaşi proporţii ca pe tipar
  const LITERE = 'ABCDEFGH';
  const xml = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
    // caractere de control (în afară de tab / rând nou) nu au voie în XML
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
  // stilurile (styles.xml, cellXfs): 0 simplu, 1 titlu, 2 cap de tabel, 3 text, 4 lei, 5 lei îngroşat (numerar), 6 etichetă îngroşată
  const S = { titlu: 1, cap: 2, text: 3, lei: 4, leiGros: 5, eticheta: 6 };
  const text = (ref, v, s = S.text) => `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
  const numar = (ref, v, s = S.lei) => `<c r="${ref}" s="${s}"><v>${Math.round(v * 100) / 100}</v></c>`;
  const gol = (ref, s = S.text) => `<c r="${ref}" s="${s}"/>`;
  // câte rânduri de text ocupă o celulă (rânduri noi + cele rupte de lăţimea coloanei)
  const linii = (v, k) => String(v ?? '').split('\n').reduce((n, r) => n + Math.max(1, Math.ceil(r.length / (LATIMI[k] * 1.1))), 0);

  function foaie(m) {
    const rows = [], unite = ['A1:H1'];
    rows.push(`<row r="1" ht="24" customHeight="1">${text('A1', m.titlu, S.titlu)}${LITERE.slice(1).split('').map(c => gol(c + '1', S.titlu)).join('')}</row>`);
    rows.push(`<row r="2" ht="32" customHeight="1">${COLOANE.map((t, k) => text(LITERE[k] + '2', t, S.cap)).join('')}</row>`);
    let r = 3;
    for (const g of m.randuri) {
      const n = Math.max(1, g.preturi.length);
      const contact = g.contact.join('\n'), adresa = g.adresa.join('\n');
      // înălţimea: cât cere textul clientului, împărţită pe rândurile lui
      const ht = Math.max(15, Math.ceil(Math.max(linii(g.firma, 0), linii(contact, 1), linii(adresa, 2)) * 15 / n));
      for (let i = 0; i < n; i++, r++) {
        const p = g.preturi[i];
        const c = [i ? gol('A' + r) : text('A' + r, g.firma), i ? gol('B' + r) : text('B' + r, contact), i ? gol('C' + r) : text('C' + r, adresa),
          p ? numar('D' + r, p.pret) : gol('D' + r)];
        for (const [k, col] of [['bon', 'E'], ['factura', 'F'], ['op', 'G']]) {
          c.push(p && p.coloana === k ? numar(col + r, p.pret, k === 'factura' ? S.leiGros : S.lei) : gol(col + r));
        }
        c.push(gol('H' + r));
        rows.push(`<row r="${r}" ht="${ht}" customHeight="1">${c.join('')}</row>`);
      }
      if (n > 1) for (const col of 'ABC') unite.push(`${col}${r - n}:${col}${r - 1}`);
    }
    // totalurile, sub coloanele lor
    rows.push(`<row r="${r}" ht="18" customHeight="1">${gol('A' + r)}${gol('B' + r)}${gol('C' + r)}${numar('D' + r, m.sume.pret, S.leiGros)}${
      numar('E' + r, m.sume.bon, S.leiGros)}${numar('F' + r, m.sume.factura, S.leiGros)}${numar('G' + r, m.sume.op, S.leiGros)}${gol('H' + r)}</row>`);
    unite.push(`A${r}:C${r}`);
    r += 2;
    rows.push(`<row r="${r}" ht="20" customHeight="1">${text('C' + r, 'Total numerar de încasat:', S.eticheta)}${numar('D' + r, m.numerar, S.leiGros)}</row>`);
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
<sheetViews><sheetView workbookViewId="0"><pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${LATIMI.map((w, k) => `<col min="${k + 1}" max="${k + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>
<sheetData>${rows.join('')}</sheetData>
<mergeCells count="${unite.length}">${unite.map(u => `<mergeCell ref="${u}"/>`).join('')}</mergeCells>
<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>
<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>
</worksheet>`;
  }

  const STILURI = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00&quot; lei&quot;"/></numFmts>
<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="7">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="164" fontId="1" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  function fisiere(m) {
    return {
      '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`,
      '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
      'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="Borderou" sheetId="1" r:id="rId1"/></sheets>
<definedNames><definedName name="_xlnm.Print_Titles" localSheetId="0">Borderou!$1:$2</definedName></definedNames>
</workbook>`,
      'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
      'xl/styles.xml': STILURI,
      'xl/worksheets/sheet1.xml': foaie(m),
    };
  }

  // ── zip necomprimat (metoda 0) ──
  const TABEL_CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = b => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = TABEL_CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  function zip(fis) {
    const enc = new TextEncoder(), parti = [], central = [];
    let poz = 0;
    for (const [nume, continut] of Object.entries(fis)) {
      const n = enc.encode(nume), d = enc.encode(continut), crc = crc32(d);
      const local = new DataView(new ArrayBuffer(30));
      [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, 0, 2], [12, 0x21, 2], [14, crc, 4], [18, d.length, 4], [22, d.length, 4], [26, n.length, 2], [28, 0, 2]]
        .forEach(([o, v, l]) => (l === 4 ? local.setUint32(o, v, true) : local.setUint16(o, v, true)));
      const cd = new DataView(new ArrayBuffer(46));
      [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, 0, 2], [14, 0x21, 2], [16, crc, 4], [20, d.length, 4], [24, d.length, 4],
        [28, n.length, 2], [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, poz, 4]]
        .forEach(([o, v, l]) => (l === 4 ? cd.setUint32(o, v, true) : cd.setUint16(o, v, true)));
      parti.push(new Uint8Array(local.buffer), n, d);
      central.push(new Uint8Array(cd.buffer), n);
      poz += 30 + n.length + d.length;
    }
    const lungCentral = central.reduce((s, b) => s + b.length, 0), nr = Object.keys(fis).length;
    const sf = new DataView(new ArrayBuffer(22));
    [[0, 0x06054b50, 4], [4, 0, 2], [6, 0, 2], [8, nr, 2], [10, nr, 2], [12, lungCentral, 4], [16, poz, 4], [20, 0, 2]]
      .forEach(([o, v, l]) => (l === 4 ? sf.setUint32(o, v, true) : sf.setUint16(o, v, true)));
    const tot = [...parti, ...central, new Uint8Array(sf.buffer)];
    const out = new Uint8Array(tot.reduce((s, b) => s + b.length, 0));
    let o = 0; for (const b of tot) { out.set(b, o); o += b.length; }
    return out;
  }

  const xlsx = m => zip(fisiere(m));

  // în pagină: fişierul se descarcă
  function descarca(l, grupeaza, previzualizare = false) {
    const m = model(l, grupeaza, previzualizare);
    const url = URL.createObjectURL(new Blob([xlsx(m)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: m.fisier });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return m;
  }

  return { model, xlsx, descarca, crc32 };
}));
