const zlib = require('node:zlib');

// ═══════════════════════════════════════════════════════════════════════════
//  Citeşte un .xlsx fără dependenţe (zip cu XML-uri, prin node:zlib) — acelaşi
//  cititor ca clienti-agenti/xlsx.mjs, care nu ajunge în pachetul de pe server.
// ═══════════════════════════════════════════════════════════════════════════

// fişierele din zip → { nume: Buffer }
function dezarhiveaza(buf) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error('Nu e un fişier .xlsx.');
  const fisiere = {};
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = buf.readUInt16LE(eocd + 10); i--;) {
    const metoda = buf.readUInt16LE(p + 10), marime = buf.readUInt32LE(p + 20);
    const lnume = buf.readUInt16LE(p + 28), lextra = buf.readUInt16LE(p + 30), lcom = buf.readUInt16LE(p + 32);
    const nume = buf.toString('utf8', p + 46, p + 46 + lnume);
    const local = buf.readUInt32LE(p + 42);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const date = buf.subarray(start, start + marime);
    fisiere[nume] = metoda === 8 ? zlib.inflateRawSync(date) : date;
    p += 46 + lnume + lextra + lcom;
  }
  return fisiere;
}

const entitati = t => t.replace(/&(lt|gt|quot|apos|amp|#\d+|#x[0-9a-f]+);/gi, (_, e) =>
  ({ lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' }[e] ?? String.fromCodePoint(+('0' + e.slice(1)))));
const texte = xml => [...xml.matchAll(/<t(?:\s[^>]*)?>([^<]*)<\/t>/g)].map(m => entitati(m[1])).join('');
const coloana = ref => [...ref.replace(/\d+/, '')].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;

// primul sheet → rânduri (array de texte)
function citesteXlsx(buf) {
  const z = dezarhiveaza(buf);
  const comune = [...(z['xl/sharedStrings.xml']?.toString() ?? '').matchAll(/<si(?:\/>|>([\s\S]*?)<\/si>)/g)].map(m => texte(m[1] ?? ''));
  const foaie = z['xl/worksheets/sheet1.xml'];
  if (!foaie) throw new Error('Fişierul nu are nicio foaie.');
  return [...foaie.toString().matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map(r => {
    const rand = [];
    for (const c of r[1].matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const tip = c[2].match(/t="(\w+)"/)?.[1], corp = c[3] ?? '';
      const v = corp.match(/<v>([^<]*)<\/v>/)?.[1];
      rand[coloana(c[1])] = tip === 's' ? comune[+v] : tip === 'inlineStr' ? texte(corp) : v != null ? entitati(v) : '';
    }
    return rand;
  });
}

module.exports = { citesteXlsx };
