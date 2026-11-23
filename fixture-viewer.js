import {
  AmbientLight, Box3, Color, DirectionalLight, MeshStandardMaterial, PerspectiveCamera,
  Raycaster, Scene, SRGBColorSpace, Vector2, Vector3, WebGLRenderer
} from "three";
import { OrbitControls } from "./vendor/three/controls/OrbitControls.js";
import { GLTFLoader } from "./vendor/three/loaders/GLTFLoader.js";

const components = {
  "Baseplate": ["6061 aluminum. Common mounting plane with two clamp mounting patterns.", [0, 0, 0]],
  "Front support rail": ["Acetal. Supports the board underside at the front.", [0, .024, .023]],
  "Rear support rail": ["Acetal. Provides the second support line under the board.", [0, .024, -.024]],
  "X datum stop": ["6061 aluminum. Locates the left edge of either PCB configuration.", [-.036, .023, 0]],
  "Y datum stop": ["6061 aluminum. Locates the front edge of either PCB configuration.", [0, .023, .038]],
  "Reference PCB": ["FR-4 envelope. Both configurations use a nominal 1.6 mm thickness.", [0, .049, 0]],
  "Sliding clamp": ["6061 aluminum. Two slots allow adjustment about each nominal board width.", [.042, .022, 0]],
  "Compliant tip": ["Prototype TPU tip. Applies preload toward the X datum and protects the board edge.", [.025, .046, 0]],
  "Camera mast": ["6061 aluminum. Carries the cantilever from the rear of the base.", [0, .017, -.031]],
  "Camera arm": ["6061 aluminum. Reaches over the board from the mast.", [0, .044, -.028]],
  "Slotted camera plate": ["6061 aluminum. Provisional mount that will be sized for the selected camera.", [0, .031, .053]]
};

export async function openFixture() {
  const canvasHost = document.querySelector("#fixture-canvas");
  const poster = document.querySelector("#fixture-poster");
  const toolbar = document.querySelector("#fixture-controls");
  const status = document.querySelector("#fixture-status");
  const config = document.querySelector("#fixture-config");
  const explode = document.querySelector("#fixture-explode");
  const partSelect = document.querySelector("#fixture-part");
  const partNote = document.querySelector("#fixture-part-note");

  const renderer = new WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.domElement.setAttribute("aria-label", "Interactive three-dimensional PCB inspection fixture");
  const scene = new Scene();
  scene.background = new Color("#e8e9e4");
  const camera = new PerspectiveCamera(37, 1, .005, 2);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.minDistance = .14;
  controls.maxDistance = .94;
  controls.maxPolarAngle = Math.PI * .96;
  controls.zoomToCursor = true;
  scene.add(new AmbientLight("#fff9eb", 2.0));
  const mainLight = new DirectionalLight("#fff4e4", 3.4);
  mainLight.position.set(-.4, .8, .45);
  scene.add(mainLight);
  const fill = new DirectionalLight("#e6eefc", 1.25);
  fill.position.set(.5, .4, -.55);
  scene.add(fill);

  const loader = new GLTFLoader();
  const cache = new Map();
  let active;
  let meshes = [];
  const pointer = new Vector2();
  const ray = new Raycaster();

  function render() {
    renderer.render(scene, camera);
  }

  function fit() {
    const { width, height } = canvasHost.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    render();
  }

  function view(top = false) {
    controls.target.set(0, .044, 0);
    camera.position.set(...(top ? [0, .38, .0001] : [.25, .22, .26]));
    controls.update();
    render();
  }

  function setExploded() {
    const factor = Number(explode.value) / 100;
    explode.setAttribute("aria-valuetext", `${explode.value} percent exploded`);
    for (const mesh of meshes) {
      const [, offset] = components[mesh.userData.name];
      mesh.position.copy(mesh.userData.original);
      mesh.position.addScaledVector(new Vector3(...offset), factor);
    }
    render();
  }

  function selectPart(name) {
    partSelect.value = name;
    partNote.textContent = components[name]?.[0] ?? "Select a part from the list or click it on the model.";
    for (const mesh of meshes) {
      const selected = mesh.userData.name === name;
      mesh.material.emissive.set(selected ? "#fdb757" : "#000000");
      mesh.material.emissiveIntensity = selected ? .52 : 0;
    }
    render();
  }

  async function getModel(name) {
    if (cache.has(name)) return cache.get(name);
    const result = await loader.loadAsync(`assets/inspection-fixture-${name}.glb`);
    const parts = [];
    result.scene.traverse(object => {
      if (!object.isMesh || !components[object.userData.name]) return;
      if (!object.geometry.getAttribute("normal")) object.geometry.computeVertexNormals();
      object.material = new MeshStandardMaterial({
        vertexColors: true, metalness: .18, roughness: .61
      });
      object.userData.original = object.position.clone();
      parts.push(object);
    });
    const bbox = new Box3().setFromObject(result.scene);
    if (parts.length !== Object.keys(components).length || Math.abs(bbox.max.x - bbox.min.x - .170) > .0001) {
      throw new Error("Unexpected CAD assembly dimensions.");
    }
    const model = { root: result.scene, parts };
    cache.set(name, model);
    return model;
  }

  async function setConfiguration(name) {
    const previous = active;
    const model = await getModel(name);
    if (active) scene.remove(active.root);
    active = model;
    meshes = model.parts;
    scene.add(model.root);
    if (!previous) {
      partSelect.replaceChildren(new Option("All components", ""));
      for (const component of Object.keys(components)) partSelect.add(new Option(component, component));
    }
    setExploded();
    selectPart(partSelect.value);
  }

  try {
    await setConfiguration(config.value);
  } catch (error) {
    renderer.dispose();
    controls.dispose();
    throw error;
  }
  canvasHost.append(renderer.domElement);
  canvasHost.hidden = false;
  poster.hidden = true;
  toolbar.hidden = false;
  partSelect.disabled = false;
  controls.addEventListener("change", render);
  new ResizeObserver(fit).observe(canvasHost);
  status.textContent = "Drag to rotate. Scroll or pinch to zoom. Right-drag to pan.";
  explode.addEventListener("input", setExploded);
  partSelect.addEventListener("change", () => selectPart(partSelect.value));
  document.querySelector("#fixture-top").addEventListener("click", () => view(true));
  document.querySelector("#fixture-reset").addEventListener("click", () => view());
  config.addEventListener("change", async () => {
    const previousValue = config.value === "small" ? "large" : "small";
    config.disabled = true;
    status.textContent = "Loading configuration…";
    try {
      await setConfiguration(config.value);
      status.textContent = "Drag to rotate. Scroll or pinch to zoom. Right-drag to pan.";
    } catch {
      config.value = previousValue;
      status.textContent = "Could not load that configuration. Try again.";
    } finally {
      config.disabled = false;
    }
  });

  let down;
  renderer.domElement.addEventListener("pointerdown", event => {
    down = event.isPrimary && event.button === 0 ? [event.clientX, event.clientY] : null;
  });
  renderer.domElement.addEventListener("pointerup", event => {
    if (!down || Math.hypot(event.clientX - down[0], event.clientY - down[1]) > 5) return;
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1,
                1 - (event.clientY - bounds.top) / bounds.height * 2);
    ray.setFromCamera(pointer, camera);
    selectPart(ray.intersectObjects(meshes, false)[0]?.object.userData.name ?? "");
  });
  view();
  fit();
}
