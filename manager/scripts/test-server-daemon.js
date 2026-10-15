const fs = require('fs');
const os = require('os');
const path = require('path');

const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mgr-e2e-'));
process.env.MANAGER_DB = path.join(TEMP, 'test.sqlite');
process.env.MANAGER_BACKUP = path.join(TEMP, 'backup');
process.env.MANAGER_PORT = '7880';
process.env.MANAGER_TLS_CERT = path.join(TEMP, 'x.pem');
process.env.MANAGER_TLS_KEY = path.join(TEMP, 'x.pem');
process.env.MANAGER_SCANARE = '1';

const { porneste } = require('../server/index.js');
const { creeazaUtilizator } = require('../server/auth.js');

const server = porneste();
server.once('listening', async () => {
  const port = server.address().port;
  console.log('TEST_SERVER_LISTENING_PORT=' + port);

  try {
    // 1. Create users
    creeazaUtilizator({ nume: 'Administrator Test', user: 'admin', parola: 'parola-admin-1', rol: 'admin' });
    creeazaUtilizator({ nume: 'Maria Birou', user: 'maria', parola: 'parola-maria-1', rol: 'birou' });
    creeazaUtilizator({ nume: 'Ion Conducere', user: 'ion', parola: 'parola-ion-123', rol: 'conducere' });
    creeazaUtilizator({ nume: 'Ana Birou 2', user: 'ana', parola: 'parola-ana-1', rol: 'birou' });
    console.log('USERS_CREATED=OK');

    const BAZA = 'http://127.0.0.1:' + port;
    let cookie = null;
    const cer = async (m, c, b) => {
      const r = await fetch(BAZA + c, {
        method: m,
        headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
        body: b ? JSON.stringify(b) : undefined,
        redirect: 'manual'
      });
      const pus = r.headers.getSetCookie?.()[0];
      if (pus) cookie = pus.split(';')[0];
      return r;
    };

    // Login as admin
    await cer('POST', '/api/login', { user: 'admin', parola: 'parola-admin-1' });

    // Seed realistic sample orders
    const sisteme = [
      { sistem: 'confortVerona', eticheta: 'Confort Verona living', latime: 2800, inaltime: 2200, nrUsi: 2, sticla: true },
      { sistem: 'confortGamma', eticheta: 'Confort Gamma dormitor', latime: 2400, inaltime: 2100, nrUsi: 3, sticla: false },
      { sistem: 'lux820', eticheta: 'Lux 820 dressing', latime: 3200, inaltime: 2400, nrUsi: 4, sticla: true },
      { sistem: 'suspendataA', eticheta: 'Suspendata A bucatarie', latime: 1600, inaltime: 2100, nrUsi: 2, sticla: true },
      { sistem: 'rama842', eticheta: 'Rama 842 birou', latime: 900, inaltime: 600, nrUsi: 1, sticla: false },
      { sistem: 'confortVerona', eticheta: 'Confort Verona hol', latime: 1500, inaltime: 2100, nrUsi: 2, sticla: false },
      { sistem: 'lux820', eticheta: 'Lux 820 hol mare', latime: 2000, inaltime: 2300, nrUsi: 2, sticla: true },
      { sistem: 'confortGamma', eticheta: 'Confort Gamma terasa', latime: 3600, inaltime: 2200, nrUsi: 4, sticla: true }
    ];

    const clienti = [
      { nume: 'Mobexpert Projects SRL', telefon: '0722111222', email: 'proiecte@mobexpert.test', adresa: 'Str. Pipera 42, Bucuresti', judet: 'București' },
      { nume: 'Arta Lemnului SRL', telefon: '0733444555', email: 'comenzi@artalemnului.test', adresa: 'Calea Chisinaului 10, Iasi', judet: 'Iași' },
      { nume: 'Design Interior Concept', telefon: '0744777888', email: 'office@designconcept.test', adresa: 'Str. Fabricii 5, Cluj-Napoca', judet: 'Cluj' },
      { nume: 'Mobilier Transilvania', telefon: '0755999000', email: 'contact@mobilier-trans.test', adresa: 'B-dul Victoriei 18, Brasov', judet: 'Brașov' },
      { nume: 'Confort Casa SRL', telefon: '0766123456', email: 'office@confortcasa.test', adresa: 'Str. Republicii 88, Timisoara', judet: 'Timiș' },
      { nume: 'Decor Modern SRL', telefon: '0777234567', email: 'comenzi@decormodern.test', adresa: 'Str. Mare 12, Ploiesti', judet: 'Prahova' },
      { nume: 'Vila Nord SRL', telefon: '0788345678', email: 'contact@vilanord.test', adresa: 'Str. Lunga 4, Suceava', judet: 'Suceava' },
      { nume: 'Spatii Noi SRL', telefon: '0799456789', email: 'info@spatiinoi.test', adresa: 'Str. Stefan cel Mare 3, Bacau', judet: 'Bacău' }
    ];

    const comenziIds = [];
    for (let i = 0; i < sisteme.length; i++) {
      const s = sisteme[i];
      const c = clienti[i];
      const liniiFacturare = [
        { cod: 'PROD-' + (i + 1), denumire: 'Sistem ' + s.eticheta, um: 'buc', cantitate: 1, debitare: null },
        { cod: 'SINE-AL', denumire: 'Ghidaj superior/inferior', um: 'ml', cantitate: (s.latime / 1000).toFixed(2), debitare: 'L=' + s.latime }
      ];
      if (s.sticla) {
        liniiFacturare.push({ cod: 'STICLA-CL', denumire: 'Sticla clara securizata 4mm', um: 'mp', cantitate: ((s.latime * s.inaltime) / 1000000).toFixed(2) });
      }

      const res = await cer('POST', '/api/comenzi', {
        client: c,
        ofertaNr: 'OF-EXT-' + (100 + i),
        detalii: {
          livrare: i % 2 === 0 ? 'Cu masina noastra' : 'Curier ramburs',
          agent: i % 2 === 0 ? 'Ion' : 'Maria',
          plata: ['fiscala', 'bon', 'proforma', 'avans'][i % 4]
        },
        observatii: 'Comanda test ' + (i + 1) + ' - atentie la finisaj',
        pozitii: [{
          sistem: s.sistem,
          eticheta: s.eticheta,
          finisaj: 'ALUMINIU ELOXAT',
          latime: s.latime,
          inaltime: s.inaltime,
          nrUsi: s.nrUsi,
          config: { system: s.sistem, width: s.latime, height: s.inaltime, doors: s.nrUsi },
          linii: {
            facturare: liniiFacturare,
            atelier: [{ cod: 'MAT-1', denumire: 'Profil rama', um: 'ml', cantitate: 12 }],
            client: [{ cod: 'PROD-' + (i + 1), denumire: s.eticheta, um: 'buc', cantitate: 1 }]
          }
        }]
      });
      const data = await res.json();
      comenziIds.push(data.comanda.id);
    }
    console.log('CREATED_ORDERS_COUNT=' + comenziIds.length);

    // Accept first 4 orders
    const plati = ['fiscala', 'bon', 'proforma', 'avans'];
    for (let i = 0; i < 4; i++) {
      await cer('POST', `/api/comenzi/${comenziIds[i]}/accepta`, {
        plata: plati[i],
        avans: i === 3 ? 1200 : undefined,
        telefon: clienti[i].telefon,
        adresa: clienti[i].adresa
      });
    }
    console.log('ACCEPTED_4_ORDERS');

    // Finalize first 2
    for (let i = 0; i < 2; i++) {
      await cer('POST', `/api/comenzi/${comenziIds[i]}/finalizeaza`);
    }
    console.log('FINALIZED_2_ORDERS');

    // Invoice first 1
    await cer('POST', `/api/comenzi/${comenziIds[0]}/factura`, { numar: 'FAC-2026-0099' });

    // Put order 5 in "Asteapta plata"
    await cer('POST', `/api/comenzi/${comenziIds[4]}/asteapta-plata`, { oferta_nr: 'OF-HOLD-55' });
    console.log('ORDER_IN_WAITING_PAYMENT');

    // Create a task
    await cer('POST', '/api/taskuri', {
      comanda_id: comenziIds[1],
      pentru: 'maria',
      text: 'Verifica adresa de livrare cu clientul Arta Lemnului',
      scadenta: new Date(Date.now() + 86400000).toISOString()
    });
    console.log('TASK_CREATED');

    console.log('SEEDING_COMPLETE_SUCCESS');
  } catch (err) {
    console.error('SEEDING_ERROR:', err);
  }
});
