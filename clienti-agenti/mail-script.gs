// Se lipeşte în script.google.com, pe contul Gmail al portalului (vezi CITESTE.md, „Mailul pentru
// NeoManager"). Nu se publică pe Cloudflare (stă în afara lui public/): de aici se copiază, iar
// CHEIE şi DESTINATAR se completează doar acolo. CHEIE = aceeaşi valoare ca secretul MAIL_CHEIE.
const CHEIE = 'COMPLETEAZA';
const DESTINATAR = 'COMPLETEAZA';

function doPost(e) {
  const raspuns = o => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
  try {
    const { cheie, subiect, text } = JSON.parse(e.postData.contents);
    if (cheie !== CHEIE) return raspuns({ ok: false, eroare: 'Cheie greşită.' });
    MailApp.sendEmail(DESTINATAR, String(subiect).slice(0, 200), String(text).slice(0, 5000));
    return raspuns({ ok: true });
  } catch (err) {
    return raspuns({ ok: false, eroare: String(err) });
  }
}

// Rulează o dată din editor (Run): cere autorizarea şi trimite un mail de probă.
function proba() {
  MailApp.sendEmail(DESTINATAR, 'Probă portal', 'Dacă ai primit asta, scriptul poate trimite mailuri.');
}
