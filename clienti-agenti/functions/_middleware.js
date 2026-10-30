import { anuntaVersiunea } from '../lib/comun.js';

// Prima cerere a fiecărei instanţe noi (după o publicare sunt toate noi) anunţă versiunea paginii
// — vezi anuntaVersiunea în lib/comun.js. O dată pe instanţă, fără să întârzie răspunsul.
let anuntat = false;
export async function onRequest(context) {
  if (!anuntat) { anuntat = true; context.waitUntil(anuntaVersiunea(context.env)); }
  return context.next();
}
