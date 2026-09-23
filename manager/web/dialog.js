// Ferestre de mesaj / confirmare pe MIJLOCUL ecranului, în stilul paginii —
// în locul alert() / confirm() ale browserului, pe care el le pune sus şi nu
// se pot muta. <dialog> nativ (showModal): blochează pagina până răspunzi.
//   await alerta('text')            → OK
//   if (await confirma('text')) …   → Da = true, Renunţă / Esc = false
function fereastraMesaj(text, butoane) {
  return new Promise(rezolva => {
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
      b.onclick = () => { rezolva(valoare); d.close(); };
      bara.append(b);
    }
    d.append(p, bara);
    d.addEventListener('cancel', () => rezolva(butoane.find(b => !b[2])?.[1]));   // Esc = varianta „nu"
    d.addEventListener('close', () => d.remove());
    document.body.append(d);
    d.showModal();
    bara.querySelector('.primar')?.focus();
  });
}

const alerta   = text => fereastraMesaj(text, [['OK', undefined, true]]);
const confirma = (text, da = 'Da') => fereastraMesaj(text, [['Renunţă', false], [da, true, true]]);
