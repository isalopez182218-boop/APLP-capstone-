import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const fig = document.getElementById('model');
const canvas = fig.querySelector('canvas');
const poster = fig.querySelector('.poster');
const ui = fig.querySelector('.controls');
const pname = fig.querySelector('.pname');
const pdesc = fig.querySelector('.pdesc');
const ringIn = document.getElementById('ring');
const ringOut = document.getElementById('ringOut');
const orbitBtn = document.getElementById('orbit');
const plateBtn = document.getElementById('plate');
const resetBtn = document.getElementById('reset');

// What each part is, by name prefix in the CAD export.
const PARTS = [
  ['P1_', 'Back plate and frame', 'Printed 150 × 150 mm plate that carries the ring rollers, the gearmotor and the ball-screw stage.'],
  ['P2_', 'Open ring gear', 'Module 1.5, 72-tooth form with a 58 mm mouth so the machine drops onto the cable from the side.'],
  ['P3_', 'Front plate', 'Holds the front row of ring rollers. Use “Hide front plate” to see the ring.'],
  ['P4_', 'Pinion, 14 teeth', 'Two pinions 91° apart, linked by a belt, so one is always in mesh while the mouth passes the other.'],
  ['P5b', 'Bracket spacer', 'Lifts the tool bracket off the ring so its screws stay reachable.'],
  ['P5_', 'Tool bracket', 'Bolted to the ring. Carries the swing-arm pivot and the depth-screw anchor.'],
  ['P6_', 'Swing arm', 'Carries the spindle motor and cutting wheel. It pivots on an M4 shoulder screw to set depth.'],
  ['P7_', 'Depth eye', 'Connects the depth screw to the swing arm.'],
  ['P8_', 'Follower wheel', 'Rides on the cable surface. Cut depth is measured from here, not from the arm position.'],
  ['P9_', 'Roller bushing', 'Spaces a V-groove roller off the plate.'],
  ['P10', 'Motor bracket', 'Holds the orbit gearmotor behind the back plate.'],
  ['P11', 'Bearing block', 'Bolt-on block for the linear bearings, so the back plate prints without supports.'],
  ['P12', 'Ball-screw nut adapter', 'Joins the SFU1204 nut to the back plate.'],
  ['C_spindle', 'Spindle motor', '2212 brushless outrunner on 24 V, driving the wheel through a 1 : 1 belt.'],
  ['C_wheel', 'Cutting wheel', 'Ø38 mm wheel. The final design uses a Ø4 mm burr on a right-angle spindle.'],
  ['C_arbor', 'Wheel arbor', 'Mandrel and pulley that carry the cutting wheel.'],
  ['C_motor_pulley', 'Motor pulley', 'GT2 16-tooth pulley on the spindle motor.'],
  ['C_belt_GT2_110', 'Spindle belt', 'GT2 belt from motor to wheel arbor.'],
  ['C_belt_GT2_216', 'Pinion belt', 'Keeps both pinions turning together.'],
  ['C_roller', 'V-groove roller', 'Ten rollers, five per plate, hold the ring on its V-rib.'],
  ['C_JGA25', 'Orbit gearmotor', 'JGA25-370, 24 V, with encoder. Drives the left pinion.'],
  ['C_ballscrew', 'Ball screw', 'SFU1204, 4 mm lead. Moves the ring along the cable.'],
  ['C_SFU1204', 'Ball-screw nut', 'SFU1204 nut on the axial stage.'],
  ['C_LM10UU', 'Linear bearing', 'LM10UU on a Ø10 mm guide rod.'],
  ['C_rod10', 'Guide rod', 'Ø10 mm rod for the axial stage.'],
  ['C_hall', 'Home sensor', 'A3144 Hall sensor. It finds the ring position with the mouth lined up for loading.'],
  ['C_magnet', 'Home magnet', 'Magnet on the ring for the home sensor.'],
  ['C_685', 'Pinion bearing', '685 ball bearing.'],
  ['C_pulley', 'Pinion pulley', 'Belt pulley on the pinion shaft.'],
  ['C_shaft', 'Pinion shaft', ''],
  ['C_coupler', 'Shaft coupler', 'Joins the gearmotor to the pinion shaft.'],
  ['C_bearing', 'Arbor bearing', 'R2-5 bearing in the swing arm.'],
  ['C_pivot', 'Pivot screw', 'M4 shoulder screw the swing arm turns on.'],
  ['C_depth_rod', 'Depth screw', 'M5 screw that sets the swing-arm angle, about 13 turns for full stroke.'],
  ['C_', 'Hardware', ''],
  ['cable', 'Cable, 2 in', 'Worst-case cable from the statement of work.'],
];
const info = name => PARTS.find(([p]) => name.startsWith(p)) || ['', name, ''];

// Parts that ride on the ring and turn with it.
const ON_RING = /^(P2_|P5|P6_|P7_|P8_|C_spindle|C_motor_pulley|C_arbor|C_belt_GT2_110|C_bearing|C_wheel|C_pin_|C_pivot|C_depth_rod|C_nut_M5|C_magnet)/;
const PINION_L = /^(P4_pinion_L|C_pulley_L|C_shaft_L)/;
const PINION_R = /^(P4_pinion_R|C_pulley_R|C_shaft_R)/;

const css = getComputedStyle(document.documentElement);
const INK = new THREE.Color(css.getPropertyValue('--ink').trim() || '#111');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
} catch (e) {
  console.warn('WebGL unavailable, keeping the static render.', e);
}

if (renderer) init();

function init() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.005, 5);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 0.18;
  controls.maxDistance = 1.2;

  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a8a, 2.2));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(0.6, 1, 0.8);
  scene.add(key);

  const tones = { printed: 0xf2f2f2, ring: 0xdedede, metal: 0x9a9a9a, dark: 0x3a3a3a };
  const toneFor = n =>
    /^P2_/.test(n) ? tones.ring :
    /^P/.test(n) ? tones.printed :
    /(spindle|JGA25|belt)/.test(n) ? tones.dark : tones.metal;

  const edgeMat = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.85 });
  const pickables = [];
  let dirty = true;
  let hovered = null, plateMode = 0; // 0 see-through, 1 hidden
  const plateMeshes = [];

  new GLTFLoader().load(fig.dataset.model || 'assets/aplp-rotary.glb', gltf => {
    const root = gltf.scene;
    root.updateMatrixWorld(true);

    // Find the ring axis: the thinnest dimension of the ring's bounding box.
    const ringObj = root.getObjectByName('P2_ring_gear');
    const rb = new THREE.Box3().setFromObject(ringObj);
    const size = rb.getSize(new THREE.Vector3());
    const axisIdx = [size.x, size.y, size.z].indexOf(Math.min(size.x, size.y, size.z));
    const axis = new THREE.Vector3().setComponent(axisIdx, 1);

    const ringPivot = new THREE.Group();
    const pinL = new THREE.Group(), pinR = new THREE.Group();
    scene.add(root, ringPivot, pinL, pinR);

    const centreOf = name => new THREE.Box3().setFromObject(root.getObjectByName(name)).getCenter(new THREE.Vector3()).setComponent(axisIdx, 0);
    pinL.position.copy(centreOf('P4_pinion_L'));
    pinR.position.copy(centreOf('P4_pinion_R'));

    const meshes = [];
    root.traverse(o => { if (o.isMesh) meshes.push(o); });
    for (const m of meshes) {
      const name = partName(m);
      m.userData.part = name;
      const mat = new THREE.MeshStandardMaterial({ color: toneFor(name), roughness: 0.85, metalness: 0, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
      m.material = mat;
      m.userData.base = mat.color.clone();
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 28), edgeMat);
      edges.raycast = () => {};
      m.add(edges);
      if (/^P3_/.test(name)) {
        mat.transparent = true; mat.opacity = 0.18; mat.depthWrite = false;
        plateMeshes.push(m);
      }
      pickables.push(m);
    }
    for (const m of meshes) {
      const n = m.userData.part;
      if (ON_RING.test(n)) ringPivot.attach(m);
      else if (PINION_L.test(n)) pinL.attach(m);
      else if (PINION_R.test(n)) pinR.attach(m);
    }

    // The cable, a 2 in worst case, along the ring axis.
    const rb2 = new THREE.Box3().setFromObject(root);
    const len = 0.2;
    const cable = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0254, 0.0254, len, 72, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xbdbdbd, roughness: 1, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide })
    );
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.0127, 0.0127, len, 48), new THREE.MeshStandardMaterial({ color: 0x6b6b6b, roughness: 0.6 }));
    const cableGroup = new THREE.Group();
    cableGroup.add(cable, core);
    cable.userData.part = 'cable'; core.userData.part = 'cable';
    // Cylinder is built along Y; turn it onto the ring axis.
    cableGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis);
    const mid = (rb2.min.getComponent(axisIdx) + rb2.max.getComponent(axisIdx)) / 2;
    cableGroup.position.setComponent(axisIdx, mid + 0.025);
    scene.add(cableGroup);
    pickables.push(cable);

    // Camera: three-quarter view from the front, mouth at the bottom.
    const sphere = rb2.getBoundingSphere(new THREE.Sphere());
    sphere.center.copy(rb.getCenter(new THREE.Vector3()).setComponent(axisIdx === 0 ? 1 : 0, 0));
    sphere.center.setComponent(axisIdx, (rb.min.getComponent(axisIdx) + rb.max.getComponent(axisIdx)) / 2);
    const up = new THREE.Vector3(0, 1, 0);
    if (axisIdx === 1) up.set(0, 0, 1);
    camera.up.copy(up);
    const right = new THREE.Vector3().crossVectors(up, axis).normalize();
    const home = () => {
      const dir = axis.clone().add(right.clone().multiplyScalar(-0.75)).add(up.clone().multiplyScalar(0.5)).normalize();
      camera.position.copy(sphere.center).addScaledVector(dir, sphere.radius * 3.0);
      controls.target.copy(sphere.center);
      controls.update();
      dirty = true;
    };
    home();

    const setRing = deg => {
      const r = THREE.MathUtils.degToRad(deg);
      ringPivot.setRotationFromAxisAngle(axis, r);
      pinL.setRotationFromAxisAngle(axis, -r * 72 / 14);
      pinR.setRotationFromAxisAngle(axis, -r * 72 / 14);
      ringOut.textContent = `${Math.round(deg)}°`;
      dirty = true;
    };
    ringIn.addEventListener('input', () => { stopOrbit(); setRing(+ringIn.value); });

    let playing = false, t0 = 0, phase = 0;
    const stopOrbit = () => { playing = false; orbitBtn.setAttribute('aria-pressed', 'false'); orbitBtn.textContent = 'Run the orbit'; };
    orbitBtn.addEventListener('click', () => {
      playing = !playing;
      orbitBtn.setAttribute('aria-pressed', String(playing));
      orbitBtn.textContent = playing ? 'Stop' : 'Run the orbit';
      phase = Math.asin(THREE.MathUtils.clamp(+ringIn.value / 190, -1, 1));
      t0 = performance.now();
    });
    plateBtn.addEventListener('click', () => {
      plateMode = 1 - plateMode;
      plateMeshes.forEach(m => { m.visible = plateMode === 0; });
      plateBtn.setAttribute('aria-pressed', String(plateMode === 1));
      plateBtn.textContent = plateMode ? 'Show front plate' : 'Hide front plate';
      dirty = true;
    });
    resetBtn.addEventListener('click', () => { stopOrbit(); ringIn.value = 0; setRing(0); home(); });

    // Hover and tap to name a part.
    const ray = new THREE.Raycaster();
    const ptr = new THREE.Vector2();
    let downAt = null;
    const pick = e => {
      const r = canvas.getBoundingClientRect();
      ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ptr, camera);
      const hit = ray.intersectObjects(pickables, false).find(h => h.object.visible);
      highlight(hit ? hit.object : null);
    };
    canvas.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' && !e.buttons) pick(e); });
    canvas.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; });
    canvas.addEventListener('pointerup', e => {
      if (downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) < 5) pick(e);
      downAt = null;
    });
    canvas.addEventListener('pointerleave', () => highlight(null));

    function highlight(obj) {
      const name = obj?.userData.part || null;
      if (name === hovered) return;
      for (const m of pickables) {
        if (!m.userData.base) continue;
        m.material.color.copy(m.userData.base);
        if (name && m.userData.part === name) m.material.color.multiplyScalar(0.55);
      }
      hovered = name;
      if (name) {
        const [, title, desc] = info(name);
        pname.textContent = title;
        pdesc.textContent = desc;
      } else {
        pname.textContent = 'Point at a part';
        pdesc.textContent = 'Drag to turn the model, scroll or pinch to zoom.';
      }
      canvas.style.cursor = name ? 'pointer' : 'grab';
      dirty = true;
    }
    cable.userData.base = cable.material.color.clone();

    controls.addEventListener('change', () => { dirty = true; });
    const resize = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) {
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        dirty = true;
      }
    };
    new ResizeObserver(resize).observe(canvas);

    let visible = true;
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);

    renderer.setAnimationLoop(now => {
      if (!visible) return;
      if (playing) {
        const deg = 190 * Math.sin(phase + (now - t0) / 1000 * 0.9);
        ringIn.value = deg;
        setRing(deg);
      }
      controls.update();
      resize();
      if (dirty) { renderer.render(scene, camera); dirty = false; }
    });

    if (location.search.includes('shot')) window.__aplp = { camera, controls, setRing, home, plate: () => plateBtn.click(), THREE };
    fig.classList.add('live');
    poster.setAttribute('aria-hidden', 'true');
    ui.hidden = false;
  }, undefined, err => console.warn('Model failed to load, keeping the static render.', err));

  function partName(m) {
    for (let o = m; o; o = o.parent) {
      if (/^(P\d|C_)/.test(o.name)) return o.name;
    }
    return m.name || 'part';
  }
}
