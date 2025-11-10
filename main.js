import * as THREE from './three.module.js';
import { GLTFLoader } from './GLTFLoader.js';
import { USDZLoader } from './USDZLoader.js';
import { db, auth, ref, set, onValue, signInWithEmailAndPassword, onAuthStateChanged } from './firebase-config.js';

const MODELS = [
  { id: "escultura", url: "https://github.com/maurodelimajunior/environment-xr/tree/main/exemplo.glb", animated:true },
  { id: "quadro", url: "https://github.com/maurodelimajunior/environment-xr/tree/main/exemplo.glb", animated:false }
];

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera();
const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1));

let isAdmin = false;
let modelsLoaded = {};
let mixers = {};
let anchorsResolved = false;
let session;
let clock = new THREE.Clock();

// --- LOGIN ADMIN
document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = prompt("Email do administrador:");
  const password = prompt("Senha:");
  try {
    await signInWithEmailAndPassword(auth, email, password);
    alert("Login bem-sucedido! Você pode criar/editar a galeria.");
  } catch {
    alert("Falha no login.");
  }
});
onAuthStateChanged(auth, (user) => { isAdmin = !!user; });

// --- Carregar modelos
async function loadModel(url, animated=false) {
  const loader = url.endsWith(".usdz") ? new USDZLoader() : new GLTFLoader();
  const gltf = await loader.loadAsync(url);
  const model = url.endsWith(".usdz") ? gltf : gltf.scene;
  let mixer = null;
  if(animated && gltf.animations && gltf.animations.length>0){
    mixer = new THREE.AnimationMixer(model);
    gltf.animations.forEach(clip => mixer.clipAction(clip).play());
  }
  return { model, mixer };
}

// --- Start AR
async function startAR() {
  session = await navigator.xr.requestSession("immersive-ar", {
    requiredFeatures: ["local", "anchors", "image-tracking"]
  });
  renderer.xr.setReferenceSpaceType("local");
  await renderer.xr.setSession(session);

  // Carregar modelos invisíveis
  await Promise.all(MODELS.map(async m => {
    const { model, mixer } = await loadModel(m.url, m.animated);
    model.visible = false;
    scene.add(model);
    modelsLoaded[m.id] = model;
    if(mixer) mixers[m.id] = mixer;
  }));

  // Adicionar quadro como target
  const quadroBlob = await fetch('./quadro.jpg').then(r=>r.blob());
  const quadroBitmap = await createImageBitmap(quadroBlob);
  session.updateTargetImages([{ image: quadroBitmap, widthInMeters: 1.0 }]);

  // Observar animação em tempo real no Firebase
  onValue(ref(db, 'animationState'), snapshot => {
    const data = snapshot.val();
    if(data){
      Object.keys(data).forEach(id => {
        const mixer = mixers[id];
        if(mixer) mixer.setTime(data[id].time);
      });
    }
  });

  session.requestAnimationFrame(onXRFrame);
}

// --- Loop XR
function onXRFrame(time, frame) {
  const delta = clock.getDelta();

  // Atualizar mixers locais
  Object.values(mixers).forEach(m => m.update(delta));

  // Image Tracking → verifica quadro
  const results = frame.getImageTrackingResults();
  for (const result of results){
    if(result.trackingState==="tracked" && !anchorsResolved){
      resolveCloudAnchor();
    }
  }

  renderer.render(scene, camera);
  session.requestAnimationFrame(onXRFrame);
}

// --- Resolver Cloud Anchor
async function resolveCloudAnchor() {
  const snapshot = await ref(db, "cloudAnchor").get();
  const data = snapshot.val();
  if(!data || !data.id) return;

  const resolvedPose = await resolveCloudAnchorNative(data.id); // função nativa
  Object.keys(modelsLoaded).forEach(id => {
    const model = modelsLoaded[id];
    const mdata = data.models[id];
    model.position.set(
      resolvedPose.position.x + mdata.position.x,
      resolvedPose.position.y + mdata.position.y,
      resolvedPose.position.z + mdata.position.z
    );
    model.quaternion.set(
      resolvedPose.orientation.x * mdata.rotation.x,
      resolvedPose.orientation.y * mdata.rotation.y,
      resolvedPose.orientation.z * mdata.rotation.z,
      resolvedPose.orientation.w * mdata.rotation.w
    );
    model.scale.set(mdata.scale.x, mdata.scale.y, mdata.scale.z);
    model.visible = true;
  });
  anchorsResolved = true;
}

// --- Admin: criar / atualizar Cloud Anchor
window.addEventListener("click", async () => {
  if(!isAdmin) return;
  const newAnchorId = await createCloudAnchorNative(session); // função nativa
  const modelsData = {};
  Object.keys(modelsLoaded).forEach(id => {
    const model = modelsLoaded[id];
    modelsData[id] = {
      position: {x:model.position.x, y:model.position.y, z:model.position.z},
      rotation: {x:model.quaternion.x, y:model.quaternion.y, z:model.quaternion.z, w:model.quaternion.w},
      scale: {x:model.scale.x, y:model.scale.y, z:model.scale.z},
      url: MODELS.find(m=>m.id===id).url
    };
  });
  await set(ref(db, "cloudAnchor"), { id: newAnchorId, models: modelsData });
  alert("Cloud Anchor criada/reposicionada!");
});

// --- Simulação de funções nativas (ARCore/ARKit)
async function createCloudAnchorNative(session){ return "ABC123"; }
async function resolveCloudAnchorNative(id){ return { position:{x:0,y:0,z:0}, orientation:{x:0,y:0,z:0,w:1} }; }

// --- Atualizar tempo da animação em Firebase (Admin)
setInterval(()=>{
  if(!isAdmin) return;
  Object.keys(mixers).forEach(id=>{
    const mixer = mixers[id];
    if(mixer){
      set(ref(db,'animationState/'+id), { time: mixer.time });
    }
  });
}, 100); // atualiza a cada 100ms

document.getElementById("startAR").addEventListener("click", startAR);
