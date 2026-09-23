// Ferestre de mesaj / confirmare pe MIJLOCUL ecranului, în stilul paginii —
// în locul alert() / confirm() ale browserului, pe care el le pune sus şi nu
// se pot muta. <dialog> nativ (showModal): blochează pagina până răspunzi.
//   await alerta('text')            → OK
//   if (await confirma('text')) …   → Da = true, Renunţă / Esc = false
//   if (await intreabaObligatoriu('text', 'Da…', 'Nu…')) …
//        → la fel, dar NU se poate închide fără răspuns (Esc nu merge)
function fereastraMesaj(text, butoane, obligatoriu = false) {
  return new Promise(rezolva => {
    let raspuns = false;
    const d = document.createElement('dialog');
    d.className = 'mesaj-dialog';
    const p = document.createElement('p');
    p.textContent = text;
    const bara = document.createElement('div');
    bara.className = 'butoane';
    for (const [eticheta, valoare, primar] of butoane) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = eticheta;
      if (primar) b.className = 'primar';
      b.onclick = () => { raspuns = true; rezolva(valoare); d.close(); };
      bara.append(b);
    }
    d.append(p, bara);
    if (obligatoriu) {
      // Chrome lasă o pagină să oprească Esc o singură dată (a doua oară
      // închide oricum) — deci dacă se închide fără răspuns, se redeschide.
      d.addEventListener('cancel', e => e.preventDefault());
      d.addEventListener('close', () => { if (raspuns) d.remove(); else d.showModal(); });
    } else {
      d.addEventListener('cancel', () => rezolva(butoane.find(b => !b[2])?.[1]));   // Esc = varianta „nu"
      d.addEventListener('close', () => d.remove());
    }
    document.body.append(d);
    d.showModal();
    bara.querySelector('.primar')?.focus();
  });
}

const alerta   = text => fereastraMesaj(text, [['OK', undefined, true]]);
const confirma = (text, da = 'Da') => fereastraMesaj(text, [['Renunţă', false], [da, true, true]]);
const intreabaObligatoriu = (text, da, nu) => fereastraMesaj(text, [[nu, false], [da, true, true]], true);

// După „Comandă sticla": mailul s-a deschis — a plecat? (pagina Comandă sticlă
// şi pagina comenzii). true = marchează liniile comandate.
const confirmaMailTrimis = (furnizor, buc) => intreabaObligatoriu(
  `Ai trimis mailul către ${furnizor.nume}${furnizor.email ? ` (${furnizor.email})` : ''}? — ${buc} buc de sticlă.\n\n` +
  'Dacă l-ai trimis, sticla apare comandată de tine, cu ora de acum.',
  'Da, am trimis — marchează comandată', 'Nu, n-am trimis');
