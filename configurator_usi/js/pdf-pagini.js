// PDF → pozele paginilor (JPEG data URL), pt. schiţele de găurire ale ramelor (userul, 2026-10-23):
// fişa se tipăreşte din HTML, deci un PDF intră pe ea ca poze, câte una pe pagină.
// pdf.js se încarcă doar acum (e mare), din dist/pdfjs/ — build.js îl copiază din node_modules/pdfjs-dist.

const baza = () => new URL('pdfjs/', document.baseURI).href;

/** @param {File} f @param {number} max — câte pagini cel mult @returns {Promise<{ poze: string[], total: number }>} */
export async function paginiPdf(f, max) {
  const pdfjs = await import(/* @vite-ignore */ baza() + 'pdf.min.js');
  pdfjs.GlobalWorkerOptions.workerSrc = baza() + 'pdf.worker.min.js';
  const incarcare = pdfjs.getDocument({
    data: new Uint8Array(await f.arrayBuffer()),
    standardFontDataUrl: baza() + 'standard_fonts/', wasmUrl: baza() + 'wasm/',
  });
  const doc = await incarcare.promise;
  const poze = [];
  try {
    for (let k = 1; k <= Math.min(doc.numPages, max); k++) {
      const pag = await doc.getPage(k);
      // latura mare ~2000 px, ca pozele încărcate (ui_rame.js, pozaSchita)
      const v1 = pag.getViewport({ scale: 1 });
      const v = pag.getViewport({ scale: Math.min(4, 2000 / Math.max(v1.width, v1.height)) });
      const c = document.createElement('canvas');
      c.width = Math.round(v.width); c.height = Math.round(v.height);
      const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);   // fundal alb, nu transparent
      await pag.render({ canvas: c, canvasContext: g, viewport: v }).promise;
      poze.push(c.toDataURL('image/jpeg', 0.85));
    }
    return { poze, total: doc.numPages };
  } finally {
    await incarcare.destroy();   // eliberează workerul (în pdf.js 6 documentul n-are destroy)
  }
}
