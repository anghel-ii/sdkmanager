import { initScene }   from './scene.js';
import { initBuilder }  from './builder.js';
import { initUI }       from './ui.js';
import { initNou }      from './ui_nou.js';

(async () => {
  // interfaţa e cea pe paşi (js/ui_nou.js, css/nou.css) — clasa înainte de scenă,
  // ca 3D-ul să pornească direct în locul lui
  document.body.classList.add('ui-nou');

  const holder = document.getElementById('canvas-holder');
  const { controls, doorGroup } = initScene(holder);

  initBuilder(doorGroup, controls);
  await initUI();   // face şi primul buildConfig() + readout
  initNou();        // aşază grupurile randate de ui.js pe paşi
})();
