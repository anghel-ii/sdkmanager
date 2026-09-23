import { initScene }   from './scene.js';
import { initBuilder }  from './builder.js';
import { initUI }       from './ui.js';
import { initBara }     from './bara.js';

const holder = document.getElementById('canvas-holder');
const { controls, doorGroup } = initScene(holder);

initBuilder(doorGroup, controls);
initUI();   // face şi primul buildConfig() + readout
initBara(); // bara laterală redimensionabilă
