const assert = require('assert');

const BAZA = 'http://127.0.0.1:7880';

async function request(method, path, body, cookie) {
  const start = Date.now();
  const res = await fetch(BAZA + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {})
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: 'manual'
  });
  const duration = Date.now() - start;
  const setCookie = res.headers.getSetCookie?.()[0]?.split(';')[0];
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('json') ? await res.json().catch(() => null) : await res.text().catch(() => null);
  return { status: res.status, data, duration, setCookie };
}

async function login(user, parola) {
  const r = await request('POST', '/api/login', { user, parola });
  if (r.status !== 200) throw new Error(`Login failed for ${user}: ${r.status}`);
  return r.setCookie;
}

async function main() {
  console.log('=== PORNIRE STRESS & DEEP LOGIC TESTARE ===');
  const tStart = Date.now();

  const cookieAdmin = await login('admin', 'parola-admin-1');
  const cookieMaria = await login('maria', 'parola-maria-1');
  const cookieIon = await login('ion', 'parola-ion-123');
  const cookieAna = await login('ana', 'parola-ana-1');

  let checksPassed = 0;
  let checksFailed = 0;
  const failures = [];
  const latencies = [];

  function check(name, condition, extraInfo) {
    if (condition) {
      checksPassed++;
    } else {
      checksFailed++;
      failures.push({ name, extraInfo });
      console.error(`  ❌ FAIL: ${name} -> ${JSON.stringify(extraInfo)}`);
    }
  }

  // 1. INVARIANTI & VALIDARI DE SECURITATE
  console.log('\n--- 1. Validari de Securitate & Input ---');
  {
    const rAnon = await request('GET', '/api/comenzi');
    check('Neautentificat GET /api/comenzi -> 401', rAnon.status === 401, rAnon.status);

    const rTraversal = await request('GET', '/..%2fserver%2fdb.js', undefined, cookieAdmin);
    check('Directory Traversal -> 404', rTraversal.status === 404, rTraversal.status);

    const rPasswd = await request('GET', '/../../../../etc/passwd', undefined, cookieAdmin);
    check('Path Traversal /etc/passwd -> 404', rPasswd.status === 404, rPasswd.status);

    const rEmptyClient = await request('POST', '/api/comenzi', { client: {}, pozitii: [{ sistem: 'confortVerona' }] }, cookieAdmin);
    check('Client fara nume -> 400', rEmptyClient.status === 400, rEmptyClient.status);

    const rNoPozitii = await request('POST', '/api/comenzi', { client: { nume: 'Client Fara Pozitii' }, pozitii: [] }, cookieAdmin);
    check('Comanda fara pozitii -> 400', rNoPozitii.status === 400, rNoPozitii.status);

    const rNegDim = await request('POST', '/api/comenzi', {
      client: { nume: 'Client Dimensiune Negativa' },
      pozitii: [{ sistem: 'confortVerona', eticheta: 'CV', latime: -500, inaltime: 2000, nrUsi: 2 }]
    }, cookieAdmin);
    check('Dimensiune negativa -> 400', rNegDim.status === 400, rNegDim.status);
  }

  // 2. CONCURENTA MASIVA - 10 WORKERI PARALELI
  console.log('\n--- 2. Testare Concurenta Masiva (10 utilizatori virtuali) ---');
  const NUM_WORKERS = 10;
  const ORDERS_PER_WORKER = 5;

  const workerPromises = Array.from({ length: NUM_WORKERS }).map(async (_, wIdx) => {
    const userCookie = [cookieAdmin, cookieMaria, cookieIon, cookieAna][wIdx % 4];
    const workerCreatedIds = [];

    for (let oIdx = 0; oIdx < ORDERS_PER_WORKER; oIdx++) {
      const clientNume = `Client Stress W${wIdx}-O${oIdx}`;
      const rCreate = await request('POST', '/api/comenzi', {
        client: {
          nume: clientNume,
          telefon: `0720${wIdx}${oIdx}0000`.slice(0, 10),
          email: `stress_w${wIdx}_o${oIdx}@test.local`,
          adresa: `Str. Testului Nr. ${wIdx * 10 + oIdx}, Sector 1, Bucuresti`
        },
        ofertaNr: `OF-STRESS-${wIdx}-${oIdx}`,
        detalii: {
          livrare: 'Cu masina noastra',
          agent: wIdx % 2 === 0 ? 'Ion' : 'Maria',
          plata: 'fiscala'
        },
        observatii: `Observatie test concurenta de la worker ${wIdx}`,
        pozitii: [{
          sistem: 'confortGamma',
          eticheta: `Sistem CG ${wIdx}-${oIdx}`,
          latime: 2000 + (wIdx * 50),
          inaltime: 2100,
          nrUsi: 2,
          config: { system: 'confortGamma', width: 2000, height: 2100, doors: 2 },
          linii: {
            facturare: [
              { cod: `P-${wIdx}`, denumire: `Profil ${wIdx}`, um: 'ml', cantitate: 5 },
              { cod: 'STICLA-SEC', denumire: 'Sticla Securizata 4mm', um: 'mp', cantitate: 3.2 }
            ],
            atelier: [{ cod: 'M1', denumire: 'M1', um: 'buc', cantitate: 1 }],
            client: [{ cod: 'P1', denumire: 'Produs', um: 'buc', cantitate: 1 }]
          }
        }]
      }, userCookie);

      latencies.push(rCreate.duration);
      check(`Worker ${wIdx} Create Order ${oIdx} -> 201`, rCreate.status === 201, rCreate.status);

      if (rCreate.status === 201 && rCreate.data?.comanda?.id) {
        const cId = rCreate.data.comanda.id;
        workerCreatedIds.push(cId);

        // Accept order
        const rAccept = await request('POST', `/api/comenzi/${cId}/accepta`, {
          plata: 'fiscala',
          telefon: '0722123456',
          adresa: 'Adresa confirmata'
        }, userCookie);
        latencies.push(rAccept.duration);
        check(`Worker ${wIdx} Accept Order ${cId} -> 200`, rAccept.status === 200, rAccept.status);

        // Finalize order
        const rFin = await request('POST', `/api/comenzi/${cId}/finalizeaza`, undefined, userCookie);
        latencies.push(rFin.duration);
        check(`Worker ${wIdx} Finalize Order ${cId} -> 200`, rFin.status === 200, rFin.status);

        // Invoice order
        const rInv = await request('POST', `/api/comenzi/${cId}/factura`, {
          numar: `FACT-STR-${wIdx}-${oIdx}`
        }, userCookie);
        latencies.push(rInv.duration);
        check(`Worker ${wIdx} Invoice Order ${cId} -> 200`, rInv.status === 200, rInv.status);
      }
    }
    return workerCreatedIds;
  });

  const allWorkerOrders = await Promise.all(workerPromises);
  const totalOrdersCreated = allWorkerOrders.flat().length;
  console.log(`  Comenzi create si trecute prin ciclu complet de ${NUM_WORKERS} workeri paraleli: ${totalOrdersCreated}`);

  // 3. RACE CONDITION TEST (Doi utilizatori incearca sa accepte simultan aceeasi oferta)
  console.log('\n--- 3. Test Concurenta pe Aceeasi Comanda (Race Condition) ---');
  {
    const rOf = await request('POST', '/api/comenzi', {
      client: { nume: 'Client Cursa Concurenta', telefon: '0722000111', adresa: 'Str. Cursei' },
      ofertaNr: 'OF-RACE-1',
      detalii: { plata: 'fiscala' },
      pozitii: [{
        sistem: 'lux820', eticheta: 'Lux Race', latime: 1500, inaltime: 2100, nrUsi: 2,
        config: { system: 'lux820', width: 1500, height: 2100, doors: 2 },
        linii: { facturare: [{ cod: 'L1', denumire: 'L1', um: 'buc', cantitate: 1 }] }
      }]
    }, cookieAdmin);

    const raceId = rOf.data.comanda.id;
    // Launch 2 simultaneous accept requests
    const [accA, accB] = await Promise.all([
      request('POST', `/api/comenzi/${raceId}/accepta`, { plata: 'fiscala', telefon: '0722000111', adresa: 'Str. Cursei' }, cookieMaria),
      request('POST', `/api/comenzi/${raceId}/accepta`, { plata: 'bon', telefon: '0722000111', adresa: 'Str. Cursei' }, cookieIon)
    ]);

    const statuses = [accA.status, accB.status].sort();
    check('Race condition: exact una reuseste (200) si cealalta este blocata (409)', statuses[0] === 200 && statuses[1] === 409, { accA: accA.status, accB: accB.status });
  }

  // 4. TESTARE FLUX TICHETE / CERERI DE ANULARE & ROLURI
  console.log('\n--- 4. Testare Cereri de Anulare & Restrictii Rol ---');
  {
    // Create an order for cancellation test
    const rNew = await request('POST', '/api/comenzi', {
      client: { nume: 'Client Anulare Test', telefon: '0722333444', adresa: 'Str. Anularii' },
      ofertaNr: 'OF-CANCEL-1',
      pozitii: [{ sistem: 'confortVerona', eticheta: 'CV', finisaj: 'AL', latime: 1200, inaltime: 2000, nrUsi: 2, config: { system: 'confortVerona', width: 1200, height: 2000, doors: 2 }, linii: { facturare: [{ cod: 'C', denumire: 'C', um: 'buc', cantitate: 1 }] } }]
    }, cookieMaria);
    check('Creare comanda pentru anulare -> 201', rNew.status === 201, rNew.data);
    const cId = rNew.data?.comanda?.id;

    // Biroul cere anularea
    const rReqCancel = await request('POST', `/api/comenzi/${cId}/anulare`, { motiv: 'Clientul a refuzat proiectul din motive financiare' }, cookieMaria);
    check('Birou cere anulare -> 201', rReqCancel.status === 201, rReqCancel.status);

    const cerereId = rReqCancel.data.cerere?.id || rReqCancel.data.id;

    // Biroul NU poate aproba anularea (trebuie sa fie blocat cu 403)
    const rBirouApprove = await request('POST', `/api/cereri/${cerereId}/aproba`, {}, cookieMaria);
    check('Birou NU poate aproba cererea -> 403', rBirouApprove.status === 403, rBirouApprove.status);

    // Conducerea (ion) aproba anularea
    const rIonApprove = await request('POST', `/api/cereri/${cerereId}/aproba`, {}, cookieIon);
    check('Conducerea aproba cererea -> 200', rIonApprove.status === 200, rIonApprove.status);

    // Comanda este acum anulata
    const rCheckCanceled = await request('GET', `/api/comenzi/${cId}`, undefined, cookieAdmin);
    check('Comanda are status anulat -> tip: anulata', rCheckCanceled.data?.comanda?.anulat === 1, rCheckCanceled.data?.tip);
  }

  // 5. TESTARE TASKURI & REMINDERE
  console.log('\n--- 5. Testare Taskuri & Remindere ---');
  {
    const rTaskNew = await request('POST', '/api/taskuri', {
      text: 'Task urgent testat de QA automat',
      pentru: 2,
      scadenta: '2026-10-14T10:00'
    }, cookieAdmin);
    check('Creare task nou -> 201', rTaskNew.status === 201, rTaskNew.status);
    const taskId = rTaskNew.data?.task?.id || rTaskNew.data?.id;

    // Maria marcheaza taskul ca facut
    const rTaskDone = await request('PATCH', `/api/taskuri/${taskId}`, { facut: true }, cookieMaria);
    check('Bifat task facut de catre destinatar -> 200', rTaskDone.status === 200, rTaskDone.status);

    // Adminul il sterge
    const rTaskDel = await request('DELETE', `/api/taskuri/${taskId}`, undefined, cookieAdmin);
    check('Stergere task -> 200', rTaskDel.status === 200, rTaskDel.status);
  }

  // 6. TESTARE STICLA
  console.log('\n--- 6. Testare Modul Sticla ---');
  {
    const rSticla = await request('GET', '/api/sticla', undefined, cookieAdmin);
    check('GET /api/sticla -> 200 cu lista linii', rSticla.status === 200 && Array.isArray(rSticla.data?.linii || rSticla.data), rSticla.status);
  }

  // 7. CONSISTENTA SUMAR VS DATE REALE
  console.log('\n--- 7. Verificare Consistenta Sumar UI ---');
  {
    const rSumar = await request('GET', '/api/sumar', undefined, cookieAdmin);
    const rOferte = await request('GET', '/api/comenzi?tip=oferta', undefined, cookieAdmin);
    const rComenzi = await request('GET', '/api/comenzi?tip=comanda', undefined, cookieAdmin);
    const rFinalizate = await request('GET', '/api/comenzi?tip=finalizata', undefined, cookieAdmin);
    const rPlata = await request('GET', '/api/comenzi?tip=plata', undefined, cookieAdmin);

    check('Sumar returneaza obiect valid', rSumar.status === 200 && typeof rSumar.data === 'object', rSumar.status);
    const countOferte = rOferte.data?.comenzi?.length ?? 0;
    const countComenzi = rComenzi.data?.comenzi?.length ?? 0;
    const countFinalizate = rFinalizate.data?.comenzi?.length ?? 0;
    const countPlata = rPlata.data?.comenzi?.length ?? 0;

    check(`Sumar oferte (${rSumar.data?.oferte}) >= nr oferte active (${countOferte})`, Number(rSumar.data?.oferte) >= countOferte, { sumar: rSumar.data?.oferte, gasite: countOferte });
    check(`Sumar comenzi (${rSumar.data?.comenzi}) == nr comenzi in lucru (${countComenzi})`, Number(rSumar.data?.comenzi) === countComenzi, { sumar: rSumar.data?.comenzi, gasite: countComenzi });
    check(`Sumar finalizate (${rSumar.data?.finalizate}) == nr comenzi finalizate (${countFinalizate})`, Number(rSumar.data?.finalizate) === countFinalizate, { sumar: rSumar.data?.finalizate, gasite: countFinalizate });
    check(`Sumar plata (${rSumar.data?.plata}) == nr comenzi asteapta plata (${countPlata})`, Number(rSumar.data?.plata) === countPlata, { sumar: rSumar.data?.plata, gasite: countPlata });
  }

  const tEnd = Date.now();
  const totalDuration = (tEnd - tStart) / 1000;
  const avgLatency = latencies.length ? (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(1) : 0;
  const maxLatency = latencies.length ? Math.max(...latencies) : 0;

  console.log('\n=============================================');
  console.log(`RAPORT FINAL TESTARE INTENSIVA:`);
  console.log(`Verificari totale: ${checksPassed + checksFailed}`);
  console.log(`✅ Trecute: ${checksPassed}`);
  console.log(`❌ Esuate: ${checksFailed}`);
  console.log(`Timp total: ${totalDuration.toFixed(2)} secunde`);
  console.log(`Latență medie operațiuni: ${avgLatency} ms (Max: ${maxLatency} ms)`);
  console.log('=============================================');

  if (failures.length > 0) {
    console.log('\nLista erori detectate:');
    failures.forEach((f, idx) => {
      console.log(`${idx + 1}. ${f.name} => ${JSON.stringify(f.extraInfo)}`);
    });
  }
}

main().catch(err => {
  console.error('Fatal error in stress test:', err);
  process.exit(1);
});
