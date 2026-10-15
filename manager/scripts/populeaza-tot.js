const BAZA = 'http://127.0.0.1:7880';

async function cer(method, path, body, cookie) {
  const res = await fetch(BAZA + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'manual'
  });
  const setCookie = res.headers.getSetCookie?.()[0]?.split(';')[0];
  const data = await res.json().catch(() => null);
  return { status: res.status, data, setCookie };
}

async function main() {
  const rLogin = await cer('POST', '/api/login', { user: 'admin', parola: 'parola-admin-1' });
  const cookie = rLogin.setCookie;
  if (!cookie) {
    console.error('Login failed');
    process.exit(1);
  }

  console.log('--- 1. Populare Comenzi cu Sticla Reala ---');
  const comenziSticla = [
    {
      client: { nume: 'Kuxa Studio SRL', telefon: '0722888999', email: 'office@kuxa.test', adresa: 'B-dul Pipera 1, București' },
      ofertaNr: 'OF-2026-GG-01',
      detalii: { livrare: 'Cu masina noastra', agent: 'Ion', plata: 'fiscala' },
      observatii: 'Sticla clara securizata pt vitrine mari',
      pozitii: [{
        sistem: 'confortVerona', eticheta: 'Confort Verona Vitrină Living', finisaj: 'NEGRU MAT',
        latime: 2800, inaltime: 2400, nrUsi: 2,
        config: { system: 'confortVerona', width: 2800, height: 2400, doors: 2 },
        linii: {
          facturare: [{ cod: 'PROD-1', denumire: 'Sistem Confort Verona 2 uși', um: 'set', cantitate: 1 }],
          sticla: [
            { cod: 'GG001', denumire: 'Sticlă clară securizată 4mm', um: 'mp', cantitate: 2, debitare: '2320 × 1380 mm' }
          ]
        }
      }]
    },
    {
      client: { nume: 'Rovera Mobili SRL', telefon: '0733555666', email: 'comenzi@rovera.test', adresa: 'Calea Chișinăului 22, Iași' },
      ofertaNr: 'OF-2026-OVI-02',
      detalii: { livrare: 'Cu masina noastra', agent: 'Maria', plata: 'bon' },
      observatii: 'Oglinzi cristal dormitoare',
      pozitii: [{
        sistem: 'confortGamma', eticheta: 'Confort Gamma 3 uși oglindă', finisaj: 'ALUMINIU ELOXAT',
        latime: 2400, inaltime: 2150, nrUsi: 3,
        config: { system: 'confortGamma', width: 2400, height: 2150, doors: 3 },
        linii: {
          facturare: [{ cod: 'PROD-2', denumire: 'Sistem Confort Gamma 3 uși', um: 'set', cantitate: 1 }],
          sticla: [
            { cod: 'OVI012', denumire: 'Oglindă cristal 4mm cu folie securitate', um: 'mp', cantitate: 3, debitare: '2080 × 785 mm' }
          ]
        }
      }]
    },
    {
      client: { nume: 'Class Mobilier SRL', telefon: '0744111222', email: 'proiecte@classmob.test', adresa: 'Str. Fabricii 18, Cluj-Napoca, Cluj' },
      ofertaNr: 'OF-2026-CS-03',
      detalii: { livrare: 'Cu masina noastra', agent: 'Ion', plata: 'proforma' },
      observatii: 'Sticla fumurie periat',
      pozitii: [{
        sistem: 'rama820', eticheta: 'Rame 820 Bucătărie', finisaj: 'NEGRU MAT',
        latime: 600, inaltime: 900, nrUsi: 4,
        config: { system: 'rama820', width: 600, height: 900, doors: 4 },
        linii: {
          facturare: [{ cod: 'PROD-3', denumire: 'Ramă 820', um: 'set', cantitate: 4 }],
          sticla: [
            { cod: 'CT063', denumire: 'Sticlă fumurie călită 4mm', um: 'mp', cantitate: 4, debitare: '864 × 564 mm' }
          ]
        }
      }]
    }
  ];

  const sticlaIds = [];
  for (const cs of comenziSticla) {
    const r = await cer('POST', '/api/comenzi', cs, cookie);
    if (r.status === 201) {
      const id = r.data.comanda.id;
      sticlaIds.push(id);
      // Accept it so it becomes comanda activa si intra in sticla
      await cer('POST', `/api/comenzi/${id}/accepta`, {
        plata: cs.detalii.plata, telefon: cs.client.telefon, adresa: cs.client.adresa
      }, cookie);
      console.log(`[+] Comandă sticlă acceptată: ${id} (${cs.ofertaNr})`);
    }
  }

  // Marcam una ca si comandata la furnizor (OviBest)
  if (sticlaIds[1]) {
    const rDet = await cer('GET', `/api/comenzi/${sticlaIds[1]}`, undefined, cookie);
    const linieId = rDet.data?.sticlaLinii?.[0]?.id;
    if (linieId) {
      await cer('POST', `/api/sticla/${linieId}/comandat`, { comandat: true }, cookie);
      console.log(`[+] Linie sticla ID ${linieId} marcată 'Comandată'`);
    }
  }

  console.log('\n--- 2. Populare Livrari & Programare Traseu ---');
  // Modificam de_incasat pe cateva comenzi ca sa arate frumos in borderou
  for (let i = 0; i < sticlaIds.length; i++) {
    await cer('PATCH', `/api/livrari/comenzi/${sticlaIds[i]}`, {
      de_incasat: (i + 1) * 1450
    }, cookie);
  }

  // Programam o livrare pe Bucuresti cu prima comanda
  const rProg = await cer('POST', '/api/livrari', {
    data: '2026-10-15',
    comenzi: [sticlaIds[0]],
    observatii: 'Traseu dimineață București - Nord'
  }, cookie);
  console.log('[+] Livrare programată status:', rProg.status, rProg.data);

  console.log('\n--- 3. Populare Cereri / Tichete de Anulare ---');
  // Comanda 1: cerere deschisa (de decis de conducere)
  const rOfCancel1 = await cer('POST', '/api/comenzi', {
    client: { nume: 'Imobiliare Pro Concept SRL', telefon: '0755333444', adresa: 'Str. Victoriei 100, Brașov' },
    ofertaNr: 'OF-2026-ANUL1',
    detalii: { livrare: 'Curier ramburs', plata: 'fiscala' },
    pozitii: [{
      sistem: 'confortVerona', eticheta: 'Dressing Proiect', finisaj: 'ALUMINIU', latime: 2000, inaltime: 2100, nrUsi: 2,
      config: { system: 'confortVerona', width: 2000, height: 2100, doors: 2 },
      linii: { facturare: [{ cod: 'P1', denumire: 'Sistem', um: 'set', cantitate: 1 }] }
    }]
  }, cookie);
  const idCancel1 = rOfCancel1.data?.comanda?.id;
  await cer('POST', `/api/comenzi/${idCancel1}/accepta`, { plata: 'fiscala', telefon: '0755333444', adresa: 'Str. Victoriei 100, Brașov' }, cookie);
  
  // Maria trimite cererea de anulare
  const rLoginMaria = await cer('POST', '/api/login', { user: 'maria', parola: 'parola-maria-1' });
  const cookieMaria = rLoginMaria.setCookie;
  await cer('POST', `/api/comenzi/${idCancel1}/anulare`, {
    motiv: 'Clientul a reziliat contractul de închiriere și dorește rambursarea avansului.'
  }, cookieMaria);
  console.log(`[+] Cerere anulare deschisă pentru comanda ${idCancel1}`);

  // Comanda 2: cerere deja aprobata de conducere
  const rOfCancel2 = await cer('POST', '/api/comenzi', {
    client: { nume: 'Design Habitat SRL', telefon: '0766444555', adresa: 'Str. Mihai Viteazul 12, Ploiești, Prahova' },
    ofertaNr: 'OF-2026-ANUL2',
    detalii: { livrare: 'Cu masina noastra', plata: 'bon' },
    pozitii: [{
      sistem: 'rama820', eticheta: 'Rame Vitrină', finisaj: 'NEGRU', latime: 500, inaltime: 800, nrUsi: 2,
      config: { system: 'rama820', width: 500, height: 800, doors: 2 },
      linii: { facturare: [{ cod: 'P2', denumire: 'Rame', um: 'set', cantitate: 2 }] }
    }]
  }, cookie);
  const idCancel2 = rOfCancel2.data?.comanda?.id;
  await cer('POST', `/api/comenzi/${idCancel2}/accepta`, { plata: 'bon', telefon: '0766444555', adresa: 'Str. Mihai Viteazul 12, Ploiești, Prahova' }, cookie);
  const rReq2 = await cer('POST', `/api/comenzi/${idCancel2}/anulare`, {
    motiv: 'S-au modificat cotele de gol cu mai mult de 400mm; se reface comanda de la zero.'
  }, cookieMaria);
  const cerereId2 = rReq2.data?.id;

  // Ion (conducere) o aproba
  const rLoginIon = await cer('POST', '/api/login', { user: 'ion', parola: 'parola-ion-123' });
  const cookieIon = rLoginIon.setCookie;
  await cer('POST', `/api/cereri/${cerereId2}/aproba`, {
    raspuns: 'Aprobat conform discuției telefonice. Avansul rămâne în credit pentru noua ofertă.'
  }, cookieIon);
  console.log(`[+] Cerere anulare ID ${cerereId2} aprobată de conducere`);

  console.log('\n--- 4. Populare Taskuri & Remindere ---');
  await cer('POST', '/api/taskuri', {
    text: 'Sună clientul Kuxa Studio pentru confirmare acces șantier livrare',
    pentru: 2, // maria
    scadenta: '2026-10-14T09:30',
    comanda_id: sticlaIds[0]
  }, cookie);

  await cer('POST', '/api/taskuri', {
    text: 'Transmite cotele speciale de debitare către atelierul de sticlă GoldenGlass',
    pentru: 3, // ion
    scadenta: '2026-10-14T11:00'
  }, cookie);

  console.log('--- TOATE DATELE AU FOST POPULATE CU SUCCES! ---');
}

main().catch(console.error);
