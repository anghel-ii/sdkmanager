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

  const clienti = [
    { nume: 'Delta Studio Design SRL', telefon: '0721111000', email: 'proiecte@deltastudio.test', adresa: 'Str. Progresului 12, Sector 5, București', judet: 'București' },
    { nume: 'Lemn & Fier Art SRL', telefon: '0732222111', email: 'comenzi@lemnfier.test', adresa: 'B-dul Chimiei 4, Iași', judet: 'Iași' },
    { nume: 'Nordic Concept SRL', telefon: '0743333222', email: 'office@nordicconcept.test', adresa: 'Str. Observatorului 109, Cluj-Napoca', judet: 'Cluj' },
    { nume: 'Mobilă Bucovina SRL', telefon: '0754444333', email: 'atelier@mobilabucovina.test', adresa: 'Calea Unirii 25, Suceava', judet: 'Suceava' },
    { nume: 'Atelier Lemnarul SRL', telefon: '0765555444', email: 'contact@atelierlemn.test', adresa: 'Str. Aurel Vlaicu 50, Timișoara', judet: 'Timiș' },
    { nume: 'Trend Interior SRL', telefon: '0776666555', email: 'trend@interior.test', adresa: 'Str. Mureșului 3, Brașov', judet: 'Brașov' },
    { nume: 'Urban Deco SRL', telefon: '0787777666', email: 'comenzi@urbandeco.test', adresa: 'B-dul Independenței 77, Ploiești', judet: 'Prahova' },
    { nume: 'Stil & Confort SRL', telefon: '0798888777', email: 'contact@stilconfort.test', adresa: 'Str. Gării 14, Bacău', judet: 'Bacău' },
    { nume: 'Smart Furniture SRL', telefon: '0729999888', email: 'proiecte@smartfurn.test', adresa: 'Str. Memorandumului 8, Sibiu', judet: 'Sibiu' },
    { nume: 'Vila Imperial SRL', telefon: '0731000999', email: 'office@vilaimperial.test', adresa: 'Str. Traian 33, Constanța', judet: 'Constanța' }
  ];

  const comenziDef = [
    // 1. Suspendata
    {
      clientIdx: 0,
      ofertaNr: 'OF-2026-SUSP1',
      detalii: { livrare: 'Cu masina noastra', agent: 'Ion', plata: 'fiscala' },
      pozitii: [{
        sistem: 'suspendataA', eticheta: 'Uși Suspendate Configurație A (Living)',
        finisaj: 'NEGRU MAT', latime: 2600, inaltime: 2400, nrUsi: 2,
        config: { system: 'suspendataA', width: 2600, height: 2400, doors: 2 },
        linii: {
          facturare: [
            { cod: 'SUSP-SINA-2600', denumire: 'Șină superioară suspendată 2600mm', um: 'buc', cantitate: 1 },
            { cod: 'SUSP-KIT-A', denumire: 'Kit role suspendate amortizare dublă Config A', um: 'set', cantitate: 2 },
            { cod: 'STICLA-FUMURIE', denumire: 'Sticlă securizată fumurie 6mm', um: 'mp', cantitate: 5.6 }
          ]
        }
      }],
      actiune: 'accepta'
    },
    // 2. Confort Verona
    {
      clientIdx: 1,
      ofertaNr: 'OF-2026-CONF1',
      detalii: { livrare: 'Cu masina noastra', agent: 'Maria', plata: 'bon' },
      pozitii: [{
        sistem: 'confortVerona', eticheta: 'Confort Verona 3 uși (Dormitor matrimonial)',
        finisaj: 'ALUMINIU ELOXAT', latime: 2700, inaltime: 2250, nrUsi: 3,
        config: { system: 'confortVerona', width: 2700, height: 2250, doors: 3 },
        linii: {
          facturare: [
            { cod: 'CONF-VER-2700', denumire: 'Sistem Confort Verona 2700mm 3 uși', um: 'set', cantitate: 1 },
            { cod: 'OGLINDA-4MM', denumire: 'Oglindă cristal clară 4mm cu folie protecție', um: 'mp', cantitate: 5.4 }
          ]
        }
      }],
      actiune: 'finalizeaza'
    },
    // 3. Confort Gamma
    {
      clientIdx: 2,
      ofertaNr: 'OF-2026-CONF2',
      detalii: { livrare: 'Curier ramburs', agent: 'Ion', plata: 'proforma' },
      pozitii: [{
        sistem: 'confortGamma', eticheta: 'Confort Gamma 4 uși (Dressing hol)',
        finisaj: 'ALB MAT', latime: 3600, inaltime: 2500, nrUsi: 4,
        config: { system: 'confortGamma', width: 3600, height: 2500, doors: 4 },
        linii: {
          facturare: [
            { cod: 'CONF-GAM-3600', denumire: 'Garnitură Confort Gamma 4 uși', um: 'set', cantitate: 1 },
            { cod: 'PAL-18MM', denumire: 'Panou PAL Egger Stejar Halifax', um: 'mp', cantitate: 8.2 }
          ]
        }
      }],
      actiune: 'plata'
    },
    // 4. Rame Aluminiu 820
    {
      clientIdx: 3,
      ofertaNr: 'OF-2026-RAME1',
      detalii: { livrare: 'Cu masina noastra', agent: 'Maria', plata: 'fiscala' },
      pozitii: [{
        sistem: 'rama820', eticheta: 'Rame mobilier bucătărie 820 (Corpuri superioare)',
        finisaj: 'NEGRU MAT', latime: 600, inaltime: 900, nrUsi: 4,
        config: { system: 'rama820', width: 600, height: 900, doors: 4 },
        linii: {
          facturare: [
            { cod: 'RAMA-820-SET', denumire: 'Profil ramă aluminiu 820 + accesorii colț', um: 'set', cantitate: 4 },
            { cod: 'STICLA-CL-4', denumire: 'Sticlă clară 4mm cantuită perimetral', um: 'mp', cantitate: 2.16 }
          ]
        }
      }],
      actiune: 'factura'
    },
    // 5. Rame Aluminiu 842
    {
      clientIdx: 4,
      ofertaNr: 'OF-2026-RAME2',
      detalii: { livrare: 'Ridicare personala', agent: 'Ion', plata: 'bon' },
      pozitii: [{
        sistem: 'rama842', eticheta: 'Rame 842 vitrină living',
        finisaj: 'AURIU ELOXAT', latime: 450, inaltime: 1200, nrUsi: 2,
        config: { system: 'rama842', width: 450, height: 1200, doors: 2 },
        linii: {
          facturare: [
            { cod: 'RAMA-842-SET', denumire: 'Profil ramă 842 subțire + amortizoare', um: 'set', cantitate: 2 },
            { cod: 'STICLA-FLUTE', denumire: 'Sticlă striată Flutes 4mm', um: 'mp', cantitate: 1.08 }
          ]
        }
      }],
      actiune: 'oferta'
    },
    // 6. UTIL Atena
    {
      clientIdx: 5,
      ofertaNr: 'OF-2026-UTIL1',
      detalii: { livrare: 'Cu masina noastra', agent: 'Maria', plata: 'avans' },
      pozitii: [{
        sistem: 'utilAtena', eticheta: 'Uși culisante UTIL Atena (Debara)',
        finisaj: 'SAMPANIE', latime: 1800, inaltime: 2100, nrUsi: 2,
        config: { system: 'utilAtena', width: 1800, height: 2100, doors: 2 },
        linii: {
          facturare: [
            { cod: 'UTIL-ATENA-1800', denumire: 'Set profile UTIL Atena 1800mm', um: 'set', cantitate: 1 }
          ]
        }
      }],
      actiune: 'accepta'
    },
    // 7. UTIL Roma
    {
      clientIdx: 6,
      ofertaNr: 'OF-2026-UTIL2',
      detalii: { livrare: 'Curier ramburs', agent: 'Ion', plata: 'fiscala' },
      pozitii: [{
        sistem: 'utilRoma', eticheta: 'Sistem UTIL Roma cu mâner integrat',
        finisaj: 'ALUMINIU', latime: 2200, inaltime: 2200, nrUsi: 2,
        config: { system: 'utilRoma', width: 2200, height: 2200, doors: 2 },
        linii: {
          facturare: [
            { cod: 'UTIL-ROMA-2200', denumire: 'Garnitură UTIL Roma 2 uși', um: 'set', cantitate: 1 }
          ]
        }
      }],
      actiune: 'oferta'
    },
    // 8. Lux Vent
    {
      clientIdx: 7,
      ofertaNr: 'OF-2026-LUX1',
      detalii: { livrare: 'Cu masina noastra', agent: 'Maria', plata: 'fiscala' },
      pozitii: [{
        sistem: 'luxVent', eticheta: 'Lux Vent Premium (Dressing Vilă)',
        finisaj: 'NEGRU MAT PERIAT', latime: 3200, inaltime: 2600, nrUsi: 3,
        config: { system: 'luxVent', width: 3200, height: 2600, doors: 3 },
        linii: {
          facturare: [
            { cod: 'LUX-VENT-3200', denumire: 'Sistem glisant Lux Vent cu amortizare invizibilă', um: 'set', cantitate: 1 },
            { cod: 'STICLA-BRONZ', denumire: 'Sticlă securizată bronz 4mm', um: 'mp', cantitate: 7.8 }
          ]
        }
      }],
      actiune: 'accepta'
    },
    // 9. Lux Breda
    {
      clientIdx: 8,
      ofertaNr: 'OF-2026-LUX2',
      detalii: { livrare: 'Cu masina noastra', agent: 'Ion', plata: 'proforma' },
      pozitii: [{
        sistem: 'luxBreda', eticheta: 'Lux Breda cu diviziuni orizontale',
        finisaj: 'ANTRACIT', latime: 2800, inaltime: 2400, nrUsi: 2,
        config: { system: 'luxBreda', width: 2800, height: 2400, doors: 2 },
        linii: {
          facturare: [
            { cod: 'LUX-BREDA-2800', denumire: 'Sistem glisant Lux Breda 2800mm', um: 'set', cantitate: 1 }
          ]
        }
      }],
      actiune: 'finalizeaza'
    },
    // 10. Ofertă cu amănuntul (Accesorii)
    {
      clientIdx: 9,
      ofertaNr: 'OF-2026-AMAN1',
      detalii: { livrare: 'Curier ramburs', agent: 'Maria', plata: 'bon' },
      pozitii: [{
        sistem: 'amanunt', eticheta: 'Ofertă cu amănuntul - Feronerie mobilier',
        finisaj: null, latime: null, inaltime: null, nrUsi: null,
        config: { system: 'amanunt', linii: [] },
        linii: {
          facturare: [
            { cod: 'SM127', denumire: 'Cuplaj sertar tandembox', um: 'set', cantitate: 12 },
            { cod: 'MAN-AL-160', denumire: 'Mâner profil aluminiu 160mm negru', um: 'buc', cantitate: 24 },
            { cod: 'AMORT-BLUM', denumire: 'Amortizor ușă aplicată Blumotion', um: 'buc', cantitate: 16 }
          ]
        }
      }],
      actiune: 'accepta'
    }
  ];

  console.log('Populăm cu ' + comenziDef.length + ' comenzi noi realiste...');

  for (let i = 0; i < comenziDef.length; i++) {
    const cDef = comenziDef[i];
    const client = clienti[cDef.clientIdx];
    const rCreeaza = await cer('POST', '/api/comenzi', {
      client,
      ofertaNr: cDef.ofertaNr,
      detalii: cDef.detalii,
      observatii: `Creat automat pentru instruire: ${cDef.pozitii[0].eticheta}`,
      pozitii: cDef.pozitii
    }, cookie);

    if (rCreeaza.status !== 201) {
      console.error(`Eroare la crearea comenzii ${i}:`, rCreeaza.data);
      continue;
    }

    const cId = rCreeaza.data.comanda.id;
    console.log(`[+] Comandă ID ${cId} (${cDef.ofertaNr}) creată.`);

    if (cDef.actiune === 'plata') {
      await cer('POST', `/api/comenzi/${cId}/asteapta-plata`, { plata: 'proforma', numar: `PF-${cDef.ofertaNr}` }, cookie);
      console.log(`    ↳ trecută în 'Așteaptă plata'`);
    } else if (['accepta', 'finalizeaza', 'factura'].includes(cDef.actiune)) {
      await cer('POST', `/api/comenzi/${cId}/accepta`, { incasare: 'card',
        plata: cDef.detalii.plata,
        avans: cDef.detalii.plata === 'avans' ? 1500 : undefined,
        telefon: client.telefon,
        adresa: client.adresa
      }, cookie);
      console.log(`    ↳ acceptată în lucru`);

      if (['finalizeaza', 'factura'].includes(cDef.actiune)) {
        await cer('POST', `/api/comenzi/${cId}/finalizeaza`, undefined, cookie);
        console.log(`    ↳ finalizată`);

        if (cDef.actiune === 'factura') {
          await cer('POST', `/api/comenzi/${cId}/factura`, { numar: `FAC-2026-0${100 + i}` }, cookie);
          console.log(`    ↳ facturată cu seria FAC-2026-0${100 + i}`);
        }
      }
    }
  }

  console.log('POPULARE FINALIZATA CU SUCCES!');
}

main().catch(console.error);
