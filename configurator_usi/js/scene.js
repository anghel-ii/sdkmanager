import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export function initScene(holderEl) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x14161a);

  const camera = new THREE.PerspectiveCamera(42, holderEl.clientWidth / holderEl.clientHeight, 0.1, 100);
  camera.position.set(3.6, 2.1, 4.6);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(holderEl.clientWidth, holderEl.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  holderEl.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping  = true;
  controls.dampingFactor  = 0.08;
  controls.minDistance    = 1.5;
  controls.maxDistance    = 12;
  controls.maxPolarAngle  = Math.PI * 0.49;
  controls.target.set(0, 1.1, 0);

  // iluminare
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));

  const key = new THREE.DirectionalLight(0xffffff, 0.9);
  key.position.set(4, 6, 3);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left   = -4; key.shadow.camera.right = 4;
  key.shadow.camera.top    =  4; key.shadow.camera.bottom = -4;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x8ab4d8, 0.35);
  fill.position.set(-5, 3, -4);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffffff, 0.25);
  rim.position.set(0, 4, -6);
  scene.add(rim);

  // podea
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.95, metalness: 0.0 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // grupul care contine usa curenta (inlocuit la fiecare buildConfig)
  const doorGroup = new THREE.Group();
  scene.add(doorGroup);

  // resize
  function onResize() {
    const w = holderEl.clientWidth, h = holderEl.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  // la fereastră ŞI la schimbarea aşezării (3D sus / în dreapta, Ascunde 3D)
  new ResizeObserver(onResize).observe(holderEl);
  onResize();

  // render loop
  (function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  })();

  return { scene, camera, renderer, controls, doorGroup };
}
