import {PROPERTIES, EXPANSIONS, expansionContains, canStep, roomContains, roomTiles, type PropertyId} from "./properties";
import {
  createElement,
  Dumbbell,
  Banknote,
  Wrench,
  Trash2,
  ListOrdered,
  Move,
  ArrowLeft,
  X,
  Check,
  Undo2,
  Eraser,
  RotateCw,
  Play,
  Pause,
  Plus,
  Settings,
  ChartColumn,
  Save,
  FolderOpen,
  ZoomIn,
  ZoomOut,
  House,
  type IconNode,
} from "lucide";
import * as THREE from "three";
import "./style.css";
import {
  initial,
  rent,
  expand,
  tick,
  buy,
  repair,
  toggleEquipment,
  sell,
  reserved,
  placement,
  access,
  exit,
  dimensions,
  EQUIPMENT,
  TYPES,
  CONFIG,
  setLane,
  rush,
  type Cell,
  deserialize,
  availableFunds,
  arrivalInterval,
  type Member,
  type Kind,
  type Item,
} from "./simulation";
let state = initial();
let selected: number | null = null;
let selectedMember: number | null = null;
let tool: Kind | null = null;
let rotation = 0;
let moveId: number | undefined;
let hover = { x: 3, z: 3 };
let toastTimer = 0;
let queueId: number | null = null;
let queueDraft: Cell[] = [];
let pointerOnFloor = false;
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `<main class="world" aria-label="Gym floor"><div id="scene"></div><div id="speechBubbles" aria-label="Visitor comments"></div><div id="maintenanceBadges" aria-label="Equipment maintenance"></div><div class="hud floating"><div><span class="label">Your cash</span><strong id="funds"></strong><span id="cashChange" aria-live="polite"></span></div><div><span class="label">Gym rating</span><strong id="rating"></strong></div><div class="day-block"><span id="day"></span><div id="dayTrack" role="progressbar" aria-label="Day progress" aria-valuemin="0" aria-valuemax="100"><i id="dayFill"></i><span class="rush-window"></span></div></div></div><nav id="primaryTools" class="floating" aria-label="Gym controls"><button id="newEquipment" aria-label="New equipment" title="New equipment"></button><button id="settings" aria-label="Settings" title="Settings" aria-expanded="false" aria-controls="settingsMenu"></button><button id="pause" aria-label="Resume" title="Resume"></button></nav><section id="settingsMenu" class="menu floating" aria-label="Settings" hidden><button id="admission">Adjust admission</button><button id="reportToggle">▥ Reports</button><button id="save">▣ Save</button><button id="load">↥ Load</button><button id="restart">↻ Restart</button></section><button id="expansionPurchase" hidden></button><div id="toast" role="status"></div><span id="queueMode" class="queue-mode" hidden></span><section class="dock"><div id="context" class="floating" hidden></div><nav id="tools" class="floating" aria-label="Gym tools"></nav></section><div class="camera"><button id="zoomIn" aria-label="Zoom in">＋</button><button id="zoomOut" aria-label="Zoom out">−</button><button id="home" aria-label="Reset camera">⌂</button></div><section id="reports" class="floating" hidden><div class="row"><h3>Floor report</h3><button id="closeReports" aria-label="Close reports">×</button></div><h3 id="goalTitle"></h3><p>Three profitable days. Every member type at 60% happiness or better.</p><p id="goalProgress"></p><p>Operating today: <b id="profit"></b> · On the floor: <b id="count"></b></p><h3>Member happiness</h3><div id="happiness"></div><h3>Word on the floor</h3><div id="logs"></div></section></main><dialog id="restartDialog"><h3>Start a fresh gym?</h3><p>Your current gym will be replaced. Your saved game stays available until the next save.</p><button id="keep">Keep playing</button><button id="reset">Restart gym</button></dialog><dialog id="gameOver"><h3>Bankrupt. Your gym is closed.</h3><p>You ran out of money. Start over and try a different strategy.</p><button id="startOver">Start over</button></dialog>`;
type PanelMode = "default" | "catalogue" | "admission";
let panelMode: PanelMode = "default";
let toolbarKey = "";

const $ = (id: string) => document.getElementById(id)!;
const toolbarIcons: Record<string, IconNode> = {
  newEquipment: Dumbbell,
  pause: Play,
  admission: Banknote,
  repair: Wrench,
  equipmentPower: Play,
  sell: Trash2,
  queueEdit: ListOrdered,
  move: Move,
  back: ArrowLeft,
  cancel: X,
  done: Check,
  undo: Undo2,
  clear: Eraser,
  rotate: RotateCw,
};
function iconLabel(element: HTMLElement, label: string, icon: IconNode) {
  if (element.dataset.label === label) return;
  element.dataset.label = label;
  element.replaceChildren(
    createElement(icon, {
      class: "lucide",
      width: 18,
      height: 18,
      "aria-hidden": "true",
      focusable: "false",
    }),
    document.createTextNode(label),
  );
}
for (const [id, label, icon] of [
  ["reportToggle", "Reports", ChartColumn],
  ["save", "Save", Save],
  ["load", "Load", FolderOpen],
  ["restart", "Restart", RotateCw],
  ["zoomIn", "", ZoomIn],
  ["zoomOut", "", ZoomOut],
  ["home", "", House],
  ["closeReports", "", X],
] as [string, string, IconNode][])
  iconLabel($(id), label, icon);
iconLabel($("newEquipment"), "", Plus);
iconLabel($("settings"), "", Settings);
iconLabel($("admission"), "Adjust admission", Banknote);
$("newEquipment").onclick = () => { $("settingsMenu").hidden=true;$("settings").setAttribute("aria-expanded","false");cancel(); panelMode = "catalogue"; renderUI(); };
$("settings").onclick = () => {
  const menu = $("settingsMenu");menu.hidden = !menu.hidden;
  $("settings").setAttribute("aria-expanded", String(!menu.hidden));
};
$("admission").onclick = () => { cancel();panelMode = "admission";renderUI(); };
$("pause").onclick = toggle;
$("settingsMenu").addEventListener("click", (event) => {
  if ((event.target as Element).closest("button")) {
    $("settingsMenu").hidden = true;
    $("settings").setAttribute("aria-expanded", "false");
  }
});

function toast(msg: string) {
  $("toast").textContent = msg;
  $("toast").style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(
    () => ($("toast").style.display = "none"),
    3500,
  );
}
const container = $("scene"),
  world = document.querySelector<HTMLElement>(".world")!;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.append(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color("#dedfd2");
const camera = new THREE.OrthographicCamera();
const target = new THREE.Vector3(0, 0, 0);
let zoom = matchMedia("(max-width: 600px)").matches ? 21 : 17;
scene.add(new THREE.HemisphereLight(0xfff9e8, 0x7d9a86, 2.7));
const sun = new THREE.DirectionalLight(0xfff6df, 3);
sun.position.set(-8, 18, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, {
  left: -12,
  right: 12,
  top: 12,
  bottom: -12,
});
scene.add(sun);
function box(
  w: number,
  h: number,
  d: number,
  color: string,
  x = 0,
  y = 0,
  z = 0,
) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.85 }),
  );
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
function cylinder(
  r: number,
  h: number,
  color: string,
  x: number,
  y: number,
  z: number,
) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, h, 8),
    new THREE.MeshStandardMaterial({ color, roughness: 0.8 }),
  );
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}
const roomGroup = new THREE.Group();scene.add(roomGroup);
function buildRoom() {
  for(const child of [...roomGroup.children]) {roomGroup.remove(child);disposeObject(child);}
  const exists=(x:number,z:number)=>roomContains(state.property,{x,z},true);
  for(let x=-16;x<18;x++)for(let z=0;z<18;z++) {
    if(!exists(x,z))continue;
    const locked=expansionContains(state.property,{x,z})&&!state.expanded;
    const firstMesh=roomGroup.children.length;
    roomGroup.add(box(1,.25,1,locked ? "#aeb1aa":"#bbbdb1",x-5.5,-.25,z-5.5),box(.985,.06,.985,locked ? "#b6b9b1" : (x+z)%2 ? "#d0d2c2":"#d6d8c8",x-5.5,-.08,z-5.5));
    for(const [dx,dz] of [[-1,0],[0,-1],[1,0],[0,1]]) {
      const other={x:x+dx,z:z+dz};
      const seam=exists(other.x,other.z)&&expansionContains(state.property,{x,z})!==expansionContains(state.property,other);
      if((dx>0||dz>0)&&!seam)continue;
      if(seam&&(dx>0||dz>0))continue;
      if(seam&&canStep(state.property,{x,z},other)) {
        const horizontal=dz!==0,cx=x-5.5+dx*.5,cz=z-5.5+dz*.5;
        roomGroup.add(box(horizontal ? 1:.15,.18,horizontal ? .15:1,"#758b6a",cx,1.65,cz));
        for(const side of [-1,1])roomGroup.add(box(.12,1.6,.12,"#758b6a",cx+(horizontal?side*.44:0),.75,cz+(horizontal?0:side*.44)));
        roomGroup.add(box(.8,.03,.8,"#d6e99d",x-5.5,.01,z-5.5));
      } else if(!exists(other.x,other.z)||seam)roomGroup.add(box(dx!==0?.15:1,1.7,dz!==0?.15:1,locked ? "#c0c2b9":"#eee9da",x-5.5+dx*.5,.7,z-5.5+dz*.5));
    }
    if(locked)for(const child of roomGroup.children.slice(firstMesh)) {
      const mesh=child as THREE.Mesh;const material=mesh.material as THREE.MeshStandardMaterial;
      if(["758b6a","d6e99d"].includes(material.color.getHexString()))continue;
      material.transparent=true;material.opacity=.25;material.depthWrite=false;
      mesh.castShadow=false;mesh.receiveShadow=false;
    }
  }
  roomGroup.add(box(1,.05,.65,"#a9c776",-.5,.01,6));
}
buildRoom();
const objects = new THREE.Group();
scene.add(objects);
const people = new THREE.Group();
scene.add(people);
const itemMeshes = new Map<number, THREE.Group>();
const memberMeshes = new Map<number, THREE.Group>();
const maintenanceBadges = new Map<number, HTMLButtonElement>();
type VisitorSpeech = {
  feedback: string;
  pending: string;
  shownAt: number;
  bubble?: HTMLDivElement;
};
const visitorSpeech = new Map<number, VisitorSpeech>();
let speechTime = 0;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
function clearVisitorSpeech() {
  for (const entry of visitorSpeech.values()) entry.bubble?.remove();
  visitorSpeech.clear();
}
function visitorAnchor(member: Member) {
  const mesh = memberMeshes.get(member.id);
  const position = mesh
    ? mesh.position.clone()
    : new THREE.Vector3(member.x - 5.5, 0, member.z - 5.5);
  position.y +=
    member.state === "using" &&
    state.items.find((item) => item.id === member.target)?.kind === "bike"
      ? 2.05
      : 1.65;
  return position.project(camera);
}
function updateVisitorSpeech(dt: number) {
  if (!state.paused) speechTime += dt;
  for (const [id, entry] of visitorSpeech) {
    if (!state.members.some((member) => member.id === id)) {
      entry.bubble?.remove();
      visitorSpeech.delete(id);
    }
  }
  let active = [...visitorSpeech.values()].filter(
    (entry) => entry.bubble,
  ).length;
  for (const member of state.members) {
    let entry = visitorSpeech.get(member.id);
    if (!entry) {
      entry = { feedback: "", pending: "", shownAt: -20 };
      visitorSpeech.set(member.id, entry);
    }
    const thought = member.thought;
    if (thought && state.time - thought.at <= 4 && entry.feedback !== `${thought.topic}:${thought.at}`) {
      entry.feedback = `${thought.topic}:${thought.at}`;
      entry.pending = thought.text;
    }
    if (!thought || state.time - thought.at > 4) entry.pending = "";
    const age = speechTime - entry.shownAt;
    if (entry.bubble && age >= 4) {
      entry.bubble.remove();
      entry.bubble = undefined;
      active--;
    }
    if (
      !state.paused &&
      !entry.bubble &&
      entry.pending &&
      age >= 20 &&
      active < 2
    ) {
      const anchor = visitorAnchor(member);
      const screenX = ((anchor.x + 1) * world.clientWidth) / 2;
      const screenY = ((1 - anchor.y) * world.clientHeight) / 2;
      const overlaps = [...visitorSpeech.values()].some(
        (other) =>
          other.bubble &&
          Math.abs(parseFloat(other.bubble.style.left) - screenX) < 495 &&
          Math.abs(parseFloat(other.bubble.style.top) - screenY) < 100,
      );
      if (overlaps) continue;
      const bubble = document.createElement("div");
      bubble.className = "visitor-speech";
      bubble.textContent = entry.pending;
      bubble.title = member.name ?? `Member ${member.id}`;
      $("speechBubbles").append(bubble);
      entry.bubble = bubble;
      entry.pending = "";
      entry.shownAt = speechTime;
      active++;
    }
    if (entry.bubble) {
      const elapsed = speechTime - entry.shownAt;
      const position = visitorAnchor(member);
      const rise = reducedMotion.matches ? 0 : elapsed * 12;
      entry.bubble.style.left = `${((position.x + 1) * world.clientWidth) / 2}px`;
      entry.bubble.style.top = `${((1 - position.y) * world.clientHeight) / 2 - rise}px`;
      entry.bubble.style.opacity = String(
        Math.min(1, elapsed / 0.15, Math.max(0, (4 - elapsed) / 1.2)),
      );
      entry.bubble.hidden =
        Math.abs(position.x) > 1 || Math.abs(position.y) > 1;
    }
  }
}
function wearStage(item: Item) {
  return item.broken || item.condition <= 0
    ? 3
    : item.condition < 25
      ? 2
      : item.condition < 50
        ? 1
        : 0;
}
function disposeObject(group: THREE.Object3D) {
  group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material]) {
        if (material.map) material.map.dispose();
        material.dispose();
      }
    }
  });
}
function updateMaintenanceBadges() {
  for (const [id, badge] of maintenanceBadges) {
    if (!state.items.some((item) => item.id === id && wearStage(item) >= 2)) {
      badge.remove();
      maintenanceBadges.delete(id);
    }
  }
  for (const item of state.items.filter((item) => wearStage(item) >= 2)) {
    let badge = maintenanceBadges.get(item.id);
    if (!badge) {
      badge = document.createElement("button");
      badge.className = "maintenance-badge";
      badge.onclick = () => {
        cancel();
        selected = item.id;
        renderUI();
      };
      $("maintenanceBadges").append(badge);
      maintenanceBadges.set(item.id, badge);
    }
    const broken = wearStage(item) === 3;
    iconLabel(
      badge,
      broken ? "Out of order" : "Needs repair",
      broken ? X : Wrench,
    );
    badge.classList.toggle("out-of-order", broken);
    badge.setAttribute(
      "aria-label",
      `${EQUIPMENT[item.kind].name}: ${broken ? "Out of order" : "needs maintenance"}, ${Math.round(item.condition)}% condition`,
    );
    badge.title = `${EQUIPMENT[item.kind].name} · ${Math.round(item.condition)}% · Click to inspect`;
    const { w, d } = dimensions(item);
    const position = new THREE.Vector3(
      item.x - 5.5 + (w - 1) / 2,
      item.kind === "rack" ? 2.55 : 1.55,
      item.z - 5.5 + (d - 1) / 2,
    ).project(camera);
    badge.hidden =
      item.id === moveId ||
      Math.abs(position.x) > 1 ||
      Math.abs(position.y) > 1;
    badge.style.left = `${((position.x + 1) * world.clientWidth) / 2}px`;
    badge.style.top = `${((1 - position.y) * world.clientHeight) / 2}px`;
  }
}
function equipment(item: Item, modelOnly = false) {
  const g = new THREE.Group(),
    { w, d } = dimensions(item);
  g.userData.item = item.id;
  g.position.set(item.x - 5.5, 0, item.z - 5.5);
  const failed = !modelOnly && (item.broken || item.condition <= 0);
  const model = new THREE.Group();
  model.position.set((w - 1) / 2, 0, (d - 1) / 2);
  model.rotation.y = item.rotation * Math.PI / 2;
  g.add(model);
  g.userData.model = model;
  if (item.kind === "rack") {
    model.add(box(1.7, 0.12, 1.7, "#3c4944", 0, 0.08, 0));
    for (const x of [-0.65, 0.65]) {
      model.add(
        box(0.12, 2, 0.12, "#394940", x, 1, -0.4),
        box(0.12, 2, 0.12, "#394940", x, 1, 0.4),
      );
    }
    model.add(
      box(1.5, 0.12, 0.12, "#c4d293", 0, 1.95, -0.4),
      box(1.8, 0.08, 0.08, "#bcc3ba", 0, 1.25, 0),
    );
    for (const x of failed ? [-0.8] : [-0.8, 0.8]) {
      const plate = cylinder(0.28, 0.15, "#28352f", x, 1.25, 0);
      plate.rotation.z = Math.PI / 2;
      model.add(plate);
    }
    const bar = new THREE.Group();
    bar.position.y = 1.25;
    for (const part of model.children.slice(6)) {
      model.remove(part);
      part.position.y -= 1.25;
      bar.add(part);
    }
    model.add(bar);
    g.userData.bar = bar;
  } else if (item.kind === "freeweights") {
    model.add(box(0.85, 0.06, 1.8, "#52645b", 0, 0.04, 0));
    // Narrow upper shelves form a pyramid, with heavier weights at the bottom.
    for (const side of [-1, 1]) {
      const support = box(
        0.075,
        0.95,
        0.075,
        "#61756a",
        side * 0.28,
        0.53,
        -0.48,
      );
      support.rotation.z = side * 0.2;
      model.add(support);
    }
    for (const [tier, width, size] of [
      [0, 0.75, 0.24],
      [1, 0.58, 0.19],
      [2, 0.4, 0.14],
    ] as const) {
      const y = 0.22 + tier * 0.29;
      model.add(box(width, 0.06, 0.32, "#b3c2b0", 0, y, -0.48));
      for (const side of [-1, 1]) {
        if (failed && tier === 1 && side === 1) continue;
        const weight = new THREE.Group();
        weight.position.set(side * (width / 2 - 0.12), y + 0.1, -0.48);
        weight.add(box(0.2, 0.045, 0.045, "#bcc3ba"));
        for (const end of [-1, 1])
          weight.add(box(0.075, size, size, "#293a32", end * 0.11, 0, 0));
        model.add(weight);
        if (tier === 0) g.userData[`dumbbell${side}`] = weight;
      }
    }
  } else if (item.kind === "treadmill") {
    model.add(box(0.88, 0.16, 1.8, "#52645b", 0, 0.12, 0));
    model.add(box(0.65, 0.045, 1.5, "#293a32", 0, 0.22, 0));
    for (const side of [-1, 1]) {
      model.add(box(0.08, 1.1, 0.08, "#f48c58", side * 0.37, 0.7, 0.65));
      model.add(box(0.08, 0.08, 0.9, "#bbc1ad", side * 0.37, 1.05, 0.3));
    }
    const console = box(0.7, 0.12, 0.32, "#394940", 0, 1.3, 0.65);
    console.rotation.x = failed ? 0.75 : -0.2;
    model.add(console, box(0.32, 0.025, 0.17, failed ? "#8c4435" : "#c4d293", 0, 1.38, 0.65));
    const belt = new THREE.Group();
    for (let n = 0; n < 7; n++) belt.add(box(0.6, 0.012, 0.025, failed ? "#70523b" : "#65736a", 0, 0.25, -0.65 + n * 0.2));
    if (failed) belt.rotation.z = 0.12;
    model.add(belt);g.userData.belt = belt;
  } else {
    model.add(
      box(0.65, 0.13, 1.45, "#35463c", 0, 0.12, 0),
      box(0.12, 0.65, 0.12, "#f48c58", 0, 0.5, -0.35),
      box(0.38, 0.12, 0.28, "#293a32", 0, 0.88, -0.35),
      box(0.12, 0.8, 0.12, "#f48c58", 0, 0.55, 0.4),
      box(0.65, 0.08, 0.1, "#293a32", 0, 1, 0.4),
    );
    const wheel = failed
      ? new THREE.Mesh(
          new THREE.CylinderGeometry(
            0.36,
            0.36,
            0.16,
            8,
            1,
            false,
            0,
            Math.PI * 1.45,
          ),
          new THREE.MeshStandardMaterial({ color: "#70523b", roughness: 1 }),
        )
      : cylinder(0.36, 0.16, "#405747", 0, 0.45, 0.12);
    if (failed) {
      wheel.position.set(0.09, 0.33, 0.12);
      wheel.castShadow = true;
      wheel.rotation.y = 0.35;
      const fragment = cylinder(0.13, 0.1, "#70523b", -0.23, 0.19, 0.5);
      fragment.rotation.z = 0.5;
      model.add(fragment);
    }
    wheel.rotation.z = Math.PI / 2;
    wheel.rotation.order = "ZYX";
    if (!failed) wheel.add(box(0.55, 0.18, 0.035, "#b3bd88"));
    model.add(wheel);
    g.userData.wheel = wheel;
    const pedals = new THREE.Group();
    pedals.position.set(0, 0.45, 0.12);
    for (const side of [-1, 1]) {
      pedals.add(box(0.11, 0.035, 0.2, "#bbc1ad", side * 0.25, side * 0.2, 0));
    }
    model.add(pedals);
    g.userData.pedals = pedals;
  }
  if (!modelOnly && (item.condition < 50 || item.broken)) {
    const damaged = item.condition < 25 || item.broken;
    model.traverse((object) => {
      if (
        object instanceof THREE.Mesh &&
        object.material instanceof THREE.MeshStandardMaterial
      ) {
        object.material.color.lerp(
          new THREE.Color(damaged ? "#86654d" : "#7b8062"),
          damaged ? 0.7 : 0.4,
        );
      }
    });
    for (let n = 0; n < 6; n++) {
      model.add(
        box(
          0.13 + (n % 3) * 0.06,
          0.015,
          0.12,
          n % 2 ? "#6b6044" : "#857452",
          (((n * 7) % 9) - 4) * 0.15,
          0.15,
          (((n * 5) % 9) - 4) * 0.15,
        ),
      );
    }
    // Large rust patches and scratches sit on visible upright faces.
    const posts = item.kind === "rack" ? [-0.65, 0.65] : [0];
    for (const x of posts) {
      for (let n = 0; n < (damaged ? 5 : 3); n++) {
        const z = 0.47;
        const patch = box(
          item.kind === "rack" ? 0.13 : 0.15,
          0.12 + (n % 2) * 0.1,
          0.018,
          n % 2 ? "#9b542d" : "#554a30",
          x,
          0.3 + n * (item.kind === "rack" ? 0.3 : 0.12),
          z,
        );
        model.add(patch);
      }
    }
    if (failed && item.kind === "rack") {
      // The exposed bar and a dropped plate make the missing weight unmistakable.
      const fallenPlate = cylinder(0.28, 0.15, "#70523b", 0.55, 0.2, 0.55);
      model.add(fallenPlate);
      (g.userData.bar as THREE.Group).rotation.z = 0.15;
    }
    if (damaged) {
      // Lean a support and add a loose piece without changing gameplay footprints.
      const support = model.children[1];
      support.rotation.z = failed ? 0.28 : 0.16;
      model.add(box(0.42, 0.06, 0.12, "#806346", 0.2, 0.2, 0.5));
    }
  }
  if (modelOnly) return g;
  for (const [index, c] of [access(item), ...item.lane].entries()) {
    g.add(box(0.82, 0.035, 0.82, "#b9c7d1", c.x - item.x, 0.025, c.z - item.z));
    const labelCanvas = document.createElement("canvas");
    labelCanvas.width = 64;
    labelCanvas.height = 64;
    const ctx = labelCanvas.getContext("2d")!;
    ctx.fillStyle = "#48616a";
    ctx.font = "bold 44px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(String(index + 1), 32, 48);
    const number = new THREE.Mesh(
      new THREE.PlaneGeometry(0.45, 0.45),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(labelCanvas),
        transparent: true,
      }),
    );
    number.rotation.x = -Math.PI / 2;
    number.position.set(c.x - item.x, 0.055, c.z - item.z);
    g.add(number);
  }
  return g;
}
const preview = new THREE.Group();
scene.add(preview);
function queueHover(item: Item) {
  const last = queueDraft.at(-1) ?? access(item);
  if (queueDraft.length && hover.x === last.x && hover.z === last.z)
    return {
      action: "undo",
      reason: "Click to remove the last tile",
      candidate: queueDraft.slice(0, -1),
    };
  if (Math.abs(hover.x - last.x) + Math.abs(hover.z - last.z) !== 1)
    return {
      action: "invalid",
      reason: "Choose a tile beside the end of the queue",
      candidate: queueDraft,
    };
  const candidate = [...queueDraft, { ...hover }];
  const validationState = {
    ...state,
    items: state.items.map((i) => (i.id === item.id ? { ...i, lane: [] } : i)),
  };
  const reason = placement(
    validationState,
    { ...item, lane: candidate },
    item.id,
  );
  return {
    action: reason ? "invalid" : "add",
    reason: reason || "Click to add a queue tile",
    candidate,
  };
}
function updatePreview() {
  $("queueMode").hidden = queueId === null;
  world.classList.toggle("queue-placement", queueId !== null);
  renderer.domElement.style.cursor =
    queueId !== null ? "crosshair" : tool ? "crosshair" : "default";
  for (const child of preview.children) {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      const mats = Array.isArray(child.material)
        ? child.material
        : [child.material];
      mats.forEach((m) => m.dispose());
    }
  }
  preview.clear();
  if (queueId !== null) {
    const item = state.items.find((i) => i.id === queueId);
    if (item) {
      for (const c of queueDraft)
        preview.add(
          box(0.85, 0.06, 0.85, "#f5b45c", c.x - 5.5, 0.08, c.z - 5.5),
        );
      let label = "QUEUE PLACEMENT · Hover a tile to extend the lane";
      if (pointerOnFloor) {
        const result = queueHover(item);
        label = `QUEUE PLACEMENT · ${result.reason}`;
        const color =
          result.action === "add"
            ? "#91c95b"
            : result.action === "undo"
              ? "#efb654"
              : "#de705e";
        const x = hover.x - 5.5,
          z = hover.z - 5.5;
        preview.add(box(0.92, 0.045, 0.92, color, x, 0.13, z));
        // Plus, minus, or cross also communicate validity without color.
        const first = box(0.48, 0.025, 0.075, "#ffffff", x, 0.17, z);
        if (result.action === "invalid") first.rotation.y = Math.PI / 4;
        preview.add(first);
        if (result.action !== "undo") {
          const second = box(0.075, 0.025, 0.48, "#ffffff", x, 0.17, z);
          if (result.action === "invalid") second.rotation.y = Math.PI / 4;
          preview.add(second);
        }
      }
      if ($("queueMode").textContent !== label)
        $("queueMode").textContent = label;
    }
    return;
  }
  if (!tool) return;
  const item: Item = {
    id: -1,
    kind: tool,
    ...hover,
    rotation,
    condition: 100,
    broken: false,
    warned: false,
    lane: [],
    line: [],
  };
  const valid =
    !placement(state, item, moveId) &&
    (moveId !== undefined || availableFunds(state) >= EQUIPMENT[tool].price);
  const { w, d } = dimensions(item);
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w - 0.05, 0.16, d - 0.05),
    new THREE.MeshBasicMaterial({
      color: valid ? "#b4dd70" : "#dd765c",
      transparent: true,
      opacity: 0.65,
    }),
  );
  m.position.set(item.x - 5.5 + (w - 1) / 2, 0.13, item.z - 5.5 + (d - 1) / 2);
  preview.add(m);
  const a = access(item);
  preview.add(
    box(
      0.6,
      0.04,
      0.6,
      valid ? "#7fba47" : "#dd765c",
      a.x - 5.5,
      0.1,
      a.z - 5.5,
    ),
  );
}
const equipmentThumbnails = new Map<Kind, string>();
function equipmentThumbnail(kind: Kind): string {
  if (!equipmentThumbnails.size) {
    const thumbnailRenderer = new THREE.WebGLRenderer({ antialias: true });
    thumbnailRenderer.setSize(480, 300);
    thumbnailRenderer.shadowMap.enabled = true;
    thumbnailRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const thumbnailScene = new THREE.Scene();
    thumbnailScene.background = new THREE.Color("#e9eddf");
    thumbnailScene.add(new THREE.HemisphereLight(0xfff9e8, 0x7d9a86, 2.7));
    const light = new THREE.DirectionalLight(0xfff6df, 3);
    light.position.set(-3, 7, 5);
    light.castShadow = true;
    thumbnailScene.add(light);
    // Receive shadows without lighting bleaching the pale green background.
    const ground = new THREE.Mesh(
      new THREE.BoxGeometry(20, 0.08, 20),
      new THREE.ShadowMaterial({ color: "#526244", opacity: 0.18 }),
    );
    ground.position.y = -0.08;
    ground.receiveShadow = true;
    thumbnailScene.add(ground);
    const thumbnailCamera = new THREE.OrthographicCamera(
      -2.64,
      2.64,
      1.65,
      -1.65,
      0.1,
      30,
    );
    thumbnailCamera.position.set(4, 3.4, 5);
    thumbnailCamera.lookAt(0, 0.85, 0);
    for (const equipmentKind of ["rack", "bike", "freeweights", "treadmill"] as const) {
      const model = equipment(
        {
          id: -1,
          kind: equipmentKind,
          x: 0,
          z: 0,
          rotation: 0,
          condition: 100,
          broken: false,
          warned: false,
          lane: [],
          line: [],
        },
        true,
      );
      const bounds = new THREE.Box3().setFromObject(model);
      const center = bounds.getCenter(new THREE.Vector3());
      model.position.x -= center.x;
      model.position.z -= center.z;
      thumbnailScene.add(model);
      thumbnailRenderer.render(thumbnailScene, thumbnailCamera);
      equipmentThumbnails.set(
        equipmentKind,
        thumbnailRenderer.domElement.toDataURL("image/png"),
      );
      thumbnailScene.remove(model);
      model.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
    }
    ground.geometry.dispose();
    (ground.material as THREE.Material).dispose();
    light.shadow.map?.dispose();
    thumbnailRenderer.dispose();
    thumbnailRenderer.forceContextLoss();
  }
  return equipmentThumbnails.get(kind)!;
}
function person(m: Member) {
  const type = m.type;
  const variant = m.appearance ?? m.id * 7919;
  const skin = ["#f0c9a3", "#d6ad89", "#a87552", "#704b37"][variant % 4];
  const pants = ["#35473d", "#47495b", "#635047", "#242b32"][
    Math.floor(variant / 4) % 4
  ];
  const g = new THREE.Group();
  const shirt = [
    ["#647aab", "#536c92", "#8c77ad"],
    ["#ed9361", "#c9704c", "#d9a353"],
    ["#d8bb76", "#9ca871", "#b7ac89"],
  ][type][Math.floor(variant / 16) % 3];
  const upper = new THREE.Group();
  upper.name = "upper";
  g.add(upper);
  upper.add(
    box(type === 0 ? 0.5 : 0.34, 0.55, 0.28, shirt, 0, 0.8, 0),
    box(0.28, 0.28, 0.28, skin, 0, 1.22, 0),
  );
  for (const side of [-1, 1]) {
    for (const [part, color, width] of [
      ["thigh", pants, 0.15],
      ["shin", pants, 0.13],
      ["arm", skin, 0.14],
      ["forearm", skin, 0.12],
    ] as const) {
      const segment = box(width, 1, width, color);
      segment.name = `${part}${side}`;
      g.add(segment);
    }
    const shoe = box(0.17, 0.1, 0.26, "#26312b");
    shoe.name = `shoe${side}`;
    g.add(shoe);
  }
  const hairStyle = Math.floor(variant / 48) % 4;
  const hair = ["#342d25", "#b89450", "#8c4a2e", "#5e554d"][
    Math.floor(variant / 192) % 4
  ];
  if (hairStyle !== 0)
    upper.add(box(0.3, hairStyle === 2 ? 0.19 : 0.09, 0.3, hair, 0, 1.39, 0));
  if (hairStyle === 3) upper.add(box(0.23, 0.25, 0.12, hair, 0, 1.27, -0.17));
  return g;
}
const upAxis = new THREE.Vector3(0, 1, 0);
function limb(
  g: THREE.Group,
  name: string,
  start: THREE.Vector3,
  end: THREE.Vector3,
) {
  const segment = g.getObjectByName(name)!;
  segment.position.copy(start).add(end).multiplyScalar(0.5);
  const direction = end.clone().sub(start);
  segment.scale.y = direction.length();
  segment.quaternion.setFromUnitVectors(upAxis, direction.normalize());
}
function isWalking(member: Member) {
  return (
    member.path.length > 0 &&
    ["walking", "leaving", "resting"].includes(member.state)
  );
}
function animatePerson(g: THREE.Group, m: Member, item: Item | undefined) {
  const working =
    m.state === "using" && item && !item.broken && item.condition > 0;
  const cycling = working && item.kind === "bike";
  const squatting = working && item.kind === "rack";
  const curling = working && item.kind === "freeweights";
  const running = working && item.kind === "treadmill";
  const phase = state.time * (cycling ? 5 : 2.1) + m.id * 0.7;
  const squat = squatting ? (1 - Math.cos(phase)) * 0.5 : 0;
  const hipY = cycling ? 1.13 : running ? 0.79 + Math.abs(Math.sin(state.time * 9 + m.id)) * 0.04 : 0.55 - 0.28 * squat;
  const hipZ = cycling ? -0.35 : -0.06 * squat;
  const upper = g.getObjectByName("upper")!;
  upper.position.set(0, hipY - 0.55, hipZ);
  upper.rotation.x = cycling ? 0.16 : squat * 0.12;
  if (working) {
    const { w, d } = dimensions(item);
    g.position.set(item.x - 5.5 + (w - 1) / 2, 0, item.z - 5.5 + (d - 1) / 2);
    if (curling) {
      g.position.x += Math.sin(item.rotation * Math.PI / 2) * 0.45;
      g.position.z += Math.cos(item.rotation * Math.PI / 2) * 0.45;
    }
    g.rotation.y = item.rotation * Math.PI / 2;
    if (squatting)
      (itemMeshes.get(item.id)!.userData.bar as THREE.Group).position.y =
        1.25 - 0.28 * squat;
    if (running) {
      const belt = itemMeshes.get(item.id)!.userData.belt as THREE.Group;
      belt.children.forEach((stripe, n) => stripe.position.z = -0.65 + (((n * 0.2 - state.time * 1.4) % 1.4 + 1.4) % 1.4));
    }
    if (cycling) {
      const machine = itemMeshes.get(item.id)!;
      // The cylinder’s quarter-turn maps its local Y axle to negative X.
      (machine.userData.wheel as THREE.Mesh).rotation.y = -phase;
      (machine.userData.pedals as THREE.Group).rotation.x = phase;
    }
  }
  for (const side of [-1, 1]) {
    const walking = isWalking(m) || running;
    const swing = walking ? Math.sin(state.time * 8 + m.id) * 0.19 * side : 0;
    const pedalPhase = phase + (side === 1 ? 0 : Math.PI);
    const foot = new THREE.Vector3(
      side * (cycling ? 0.25 : 0.16),
      cycling ? 0.45 + Math.cos(pedalPhase) * 0.2 : running ? 0.36 + Math.max(0, Math.sin(state.time * 8 + m.id) * side) * 0.13 : 0.13,
      cycling ? 0.12 + Math.sin(pedalPhase) * 0.2 : 0.08 + swing,
    );
    const knee = new THREE.Vector3(
      side * 0.16,
      cycling ? 0.82 : running ? 0.55 : 0.34 - 0.08 * squat,
      cycling ? 0.17 : 0.04 + 0.22 * squat + swing * 0.5,
    );
    const hip = new THREE.Vector3(side * 0.12, hipY, hipZ);
    limb(g, `thigh${side}`, hip, knee);
    limb(g, `shin${side}`, knee, foot);
    g.getObjectByName(`shoe${side}`)!.position.copy(foot);
    const shoulder = new THREE.Vector3(side * 0.25, hipY + 0.48, hipZ);
    const elbow = new THREE.Vector3(
      side * (squatting ? 0.43 : 0.28),
      cycling ? 1.15 : squatting ? hipY + 0.3 : hipY + 0.25,
      cycling ? 0.14 : squatting ? -0.12 : -swing,
    );
    const hand = new THREE.Vector3(
      side * (squatting ? 0.55 : 0.27),
      cycling
        ? 1.02
        : squatting
          ? 1.25 - 0.28 * squat
          : curling
            ? 0.65 + Math.sin(phase + side * 0.6) * 0.22
            : hipY + 0.02,
      cycling ? 0.4 : squatting ? 0 : curling ? 0.2 : -swing,
    );
    if (curling) {
      const weight = itemMeshes.get(item.id)!.userData[
        `dumbbell${side}`
      ] as THREE.Group;
      weight.position.copy(hand);
      weight.position.z += 0.45;
      weight.rotation.z = side * Math.sin(phase + side * 0.6) * 0.2;
    }
    limb(g, `arm${side}`, shoulder, elbow);
    limb(g, `forearm${side}`, elbow, hand);
  }
}
function syncWorld() {
  for (const [id, g] of itemMeshes) {
    if (!state.items.some((i) => i.id === id)) {
      objects.remove(g);
      disposeObject(g);
      itemMeshes.delete(id);
    }
  }
  for (const item of state.items) {
    let g = itemMeshes.get(item.id);
    if (
      !g ||
      g.userData.signature !==
        `${item.kind},${item.x},${item.z},${item.rotation},${JSON.stringify(item.lane)},${wearStage(item)}`
    ) {
      if (g) {
        objects.remove(g);
        disposeObject(g);
      }
      g = equipment(item);
      g.userData.signature = `${item.kind},${item.x},${item.z},${item.rotation},${JSON.stringify(item.lane)},${wearStage(item)}`;
      itemMeshes.set(item.id, g);
      objects.add(g);
    }
    if (g.userData.bar) (g.userData.bar as THREE.Group).position.y = 1.25;
    if (item.kind === "freeweights") {
      for (const side of [-1, 1]) {
        const weight = g.userData[`dumbbell${side}`] as THREE.Group | undefined;
        if (weight) {
          weight.position.set(side * 0.255, 0.32, -0.48);
          weight.rotation.z = 0;
        }
      }
    }
    g.visible = item.id !== moveId;
    g.scale.y = item.id === selected ? 1.03 : 1;
  }
  for (const [id, g] of memberMeshes) {
    if (!state.members.some((m) => m.id === id)) {
      people.remove(g);
      disposeObject(g);
      memberMeshes.delete(id);
    }
  }
  for (const m of state.members) {
    let g = memberMeshes.get(m.id);
    if (
      !g ||
      g.userData.appearance !== `${m.type}:${m.appearance ?? m.id * 7919}`
    ) {
      if (g) {
        people.remove(g);
        disposeObject(g);
      }
      g = person(m);
      g.userData.appearance = `${m.type}:${m.appearance ?? m.id * 7919}`;
      memberMeshes.set(m.id, g);
      people.add(g);
    }
    g.position.set(
      m.x - 5.5,
      isWalking(m) ? Math.abs(Math.sin(state.time * 8 + m.id)) * 0.06 : 0,
      m.z - 5.5,
    );
    if (m.path.length)
      g.rotation.y = Math.atan2(m.path[0].x - m.x, m.path[0].z - m.z);
    g.rotation.z = 0;
    animatePerson(
      g,
      m,
      state.items.find((item) => item.id === m.target),
    );
  }
  updatePreview();
}
function resize() {
  const width = world.clientWidth,
    height = world.clientHeight;
  renderer.setSize(width, height);
  const aspect = width / height,
    viewHeight = zoom / Math.min(aspect, 1);
  camera.left = (-viewHeight * aspect) / 2;
  camera.right = (viewHeight * aspect) / 2;
  camera.top = viewHeight / 2;
  camera.bottom = -viewHeight / 2;
  camera.near = 0.1;
  camera.far = 100;
  camera.position.copy(target).add(new THREE.Vector3(15, 18, 19));
  camera.lookAt(target);
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(world);
const raycaster = new THREE.Raycaster(),
  pointer = new THREE.Vector2(),
  plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function point(e: PointerEvent) {
  pointerOnFloor = true;
  const r = renderer.domElement.getBoundingClientRect();
  pointer.set(
    ((e.clientX - r.left) / r.width) * 2 - 1,
    (-(e.clientY - r.top) / r.height) * 2 + 1,
  );
  raycaster.setFromCamera(pointer, camera);
  const hit = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(plane, hit))
    hover = { x: Math.round(hit.x + 5.5), z: Math.round(hit.z + 5.5) };
}
renderer.domElement.addEventListener("pointerleave", () => {
  pointerOnFloor = false;
  updatePreview();
});
renderer.domElement.addEventListener("pointermove", (e) => {
  point(e);
  updatePreview();
});
function activateFloor(e: PointerEvent) {
  point(e);
  if (queueId !== null) {
    const item = state.items.find((i) => i.id === queueId)!;
    const result = queueHover(item);
    if (result.action === "invalid") toast(result.reason);
    else queueDraft = result.candidate;
    updatePreview();
    renderUI();
    return;
  }
  if (tool) {
    const error = buy(state, tool, hover.x, hover.z, rotation, moveId);
    if (error) toast(error);
    else {
      if (moveId !== undefined) {
        cancel();
        toast("Equipment moved; old queue lane cleared.");
      } else {
        beginQueue(state.items[state.items.length - 1]);
        toast("Equipment placed. Draw its queue tiles, then choose Done.");
      }
    }
    renderUI();
    syncWorld();
    return;
  }
  const hit = raycaster.intersectObjects(
    [...objects.children, ...people.children],
    true,
  )[0];
  selected = null;
  selectedMember = null;
  panelMode = "default";
  if (hit) {
    let g = hit.object;
    while (g.parent && g.parent !== objects && g.parent !== people)
      g = g.parent;
    if (g.parent === objects) selected = g.userData.item;
    else if (g.parent === people)
      selectedMember = [...memberMeshes].find(([, p]) => p === g)?.[0] ?? null;
  }
  renderUI();
}
const touches = new Map<number, {x:number; y:number}>();
let touchStart = {x:0,y:0};
let gestureConsumed = false;
function touchCentre() {
  const points = [...touches.values()];
  return { x: points.reduce((sum,p)=>sum+p.x,0)/points.length,
    y: points.reduce((sum,p)=>sum+p.y,0)/points.length };
}
function touchDistance() {
  const [a,b]=[...touches.values()];
  return b ? Math.hypot(a.x-b.x,a.y-b.y) : 0;
}
function floorAt(x:number,y:number) {
  const r=renderer.domElement.getBoundingClientRect();
  const ndc=new THREE.Vector2((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1);
  const cast=new THREE.Raycaster();cast.setFromCamera(ndc,camera);
  return cast.ray.intersectPlane(plane,new THREE.Vector3());
}
function panTouch(before:{x:number;y:number},after:{x:number;y:number}) {
  const a=floorAt(before.x,before.y),b=floorAt(after.x,after.y);
  if(a&&b) {
    target.x=THREE.MathUtils.clamp(target.x+a.x-b.x,-20,12);
    target.z=THREE.MathUtils.clamp(target.z+a.z-b.z,-6,6);
    resize();
  }
}
renderer.domElement.addEventListener("pointerdown",e=>{
  if(e.pointerType!=="touch") { activateFloor(e);return; }
  if(e.isTrusted) renderer.domElement.setPointerCapture(e.pointerId);
  touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(touches.size===1) {touchStart={x:e.clientX,y:e.clientY};gestureConsumed=false;point(e);updatePreview();}
  else gestureConsumed=true;
});
renderer.domElement.addEventListener("pointermove",e=>{
  if(e.pointerType!=="touch" || !touches.has(e.pointerId)) return;
  const before=touchCentre(),distance=touchDistance();
  touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
  const after=touchCentre();
  if(touches.size>=2) {
    gestureConsumed=true;panTouch(before,after);
    const next=touchDistance();
    if(distance>0&&next>0) {zoom=THREE.MathUtils.clamp(zoom*distance/next,9,45);resize();}
  } else if(queueId===null&&!tool) {
    if(Math.hypot(e.clientX-touchStart.x,e.clientY-touchStart.y)>8) gestureConsumed=true;
    if(gestureConsumed) panTouch(before,after);
  }
});
renderer.domElement.addEventListener("pointerup",e=>{
  if(e.pointerType!=="touch" || !touches.has(e.pointerId)) return;
  const tap=touches.size===1&&!gestureConsumed;
  touches.delete(e.pointerId);
  if(tap) activateFloor(e);
  if(!touches.size) {pointerOnFloor=false;updatePreview();}
});
window.addEventListener("blur",()=>{touches.clear();gestureConsumed=true;});
renderer.domElement.addEventListener("pointercancel",e=>{
  touches.delete(e.pointerId);gestureConsumed=true;
  pointerOnFloor=false;updatePreview();
});

renderer.domElement.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    zoom = Math.max(9, Math.min(45, zoom + e.deltaY * 0.015));
    resize();
  },
  { passive: false },
);
function finishQueue() {
  if (queueId === null) return;
  const error = setLane(state, queueId, queueDraft);
  if (error) {
    toast(error);
    return;
  }
  cancel();
  syncWorld();
  toast("Queue saved. Placement finished.");
}

function cancel() {
  panelMode = "default";
  selected = null;
  selectedMember = null;
  queueId = null;
  queueDraft = [];
  tool = null;
  moveId = undefined;
  updatePreview();
  renderUI();
}
function beginQueue(item: Item) {
  state.paused = true;
  tool = null;
  moveId = undefined;
  selected = item.id;
  selectedMember = null;
  queueId = item.id;
  queueDraft = item.lane.map((c) => ({ ...c }));

  renderUI();
  updatePreview();
}
function pick(kind: Kind) {
  queueId = null;
  queueDraft = [];
  tool = kind;
  rotation = 0;
  moveId = undefined;
  selected = null;
  renderUI();
  updatePreview();
}
function toggle() {
  if(document.getElementById("rentals"))return;
  if (queueId !== null) {
    toast("Apply or cancel your queue before resuming time.");
    return;
  }
  if (state.bankrupt || state.money <= 0) {
    showGameOver();
    return;
  }
  state.paused = !state.paused;
  renderUI();
}
function save(silent = false) {
  try {
    localStorage.setItem("rep-city-rentals-v1", JSON.stringify(state));
    if (!silent) toast("Gym saved on this browser.");
  } catch {
    toast("Storage unavailable. Your gym could not be saved.");
  }
}
function load() {
  try {
    const raw = localStorage.getItem("rep-city-rentals-v1");
    if (!raw) {
      toast("No saved gym yet.");
      return;
    }
    state = deserialize(raw);
    buildRoom();
    resetCamera();
    clearVisitorSpeech();
    displayedCash = previousCash = availableFunds(state);
    cashChangeUntil = 0;
    selected = null;
    selectedMember = null;
    cancel();
    syncWorld();
    toast(
      "Gym loaded and paused. Choose Resume to continue.",
    );
  } catch (error) {
    toast(
      error instanceof Error
        ? `${error.message} Current gym kept.`
        : "Could not load this save. Current gym kept.",
    );
  }
}
function showGameOver() {
  state.paused = true;
  const dialog = $("gameOver") as HTMLDialogElement;
  if (!dialog.open) dialog.showModal();
}
$("gameOver").addEventListener("cancel", (e) => e.preventDefault());
$("reportToggle").onclick = () => {
  $("reports").hidden = !$("reports").hidden;
};
$("closeReports").onclick = () => {
  $("reports").hidden = true;
};
$("save").onclick = () => save();
$("load").onclick = load;
$("restart").onclick = () =>
  ($("restartDialog") as HTMLDialogElement).showModal();
$("keep").onclick = () => ($("restartDialog") as HTMLDialogElement).close();
function reset() {
  state = initial();
  buildRoom();
  showRentals();
  clearVisitorSpeech();
  displayedCash = previousCash = availableFunds(state);
  cashChangeUntil = 0;
  selected = null;
  selectedMember = null;
  cancel();
  syncWorld();
  renderUI();
}
$("reset").onclick = () => {
  ($("restartDialog") as HTMLDialogElement).close();
  reset();
};
$("startOver").onclick = () => {
  ($("gameOver") as HTMLDialogElement).close();
  reset();
};
$("zoomIn").onclick = () => {
  zoom = Math.max(9, zoom - 2);
  resize();
};
$("zoomOut").onclick = () => {
  zoom = Math.min(45, zoom + 2);
  resize();
};
function resetCamera() {
  target.set(state.property === "corner" ? -5 : 3,0,0);
  zoom=matchMedia("(max-width:600px)").matches ? (state.property === "corner" ? 35 : 27) : (state.property === "corner" ? 24 : 21);
  resize();
}
$("home").onclick=resetCamera;
const keys = new Set<string>();
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !document.querySelector("dialog[open]")) {
    $("reports").hidden = true;
    cancel();
    return;
  }
  if (
    (e.target as HTMLElement).matches("input,textarea,button") ||
    document.querySelector("dialog[open]")
  )
    return;
  if ([" ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key))
    e.preventDefault();
  keys.add(e.key.toLowerCase());
  if (e.repeat) return;
  if (e.key === " ") toggle();
  if (e.key.toLowerCase() === "r") {
    rotation = (rotation + 1) % 4;
    updatePreview();
  }
  if (e.key === "Escape") cancel();
});
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener("blur", () => keys.clear());
document.addEventListener("visibilitychange", () => {
  if (document.hidden) keys.clear();
  last = performance.now();
  accumulator = 0;
});
function renderUI() {
  const funds = availableFunds(state);
  $("funds").classList.toggle("money-danger", funds <= 0);
  $("funds").title =
    `Cash $${state.money.toFixed(0)} minus $${rent(state)} reserved for the next rent payment.`;
  $("profit").textContent =
    (state.profit >= 0 ? "+" : "") + "$" + state.profit.toFixed(0);
  $("rating").textContent =
    `${state.rating.toFixed(1)} ★ ${state.ratingTrend > 0.03 ? "↗" : state.ratingTrend < -0.03 ? "↘" : "→"}`;
  $("count").textContent = `${state.members.length} / 20`;
  $("day").textContent =
    `DAY ${Math.floor(state.time / CONFIG.day) + 1} · ${state.paused ? "PAUSED" : rush(state) ? "RUSH HOUR" : "QUIET HOURS"}`;
  const progress = (state.time % CONFIG.day) / CONFIG.day;
  $("day").title = state.paused ? "Game paused" : "Game running";
  $("dayFill").style.width = `${progress * 100}%`;
  $("dayTrack").setAttribute(
    "aria-valuenow",
    String(Math.round(progress * 100)),
  );
  $("dayTrack").title =
    `${Math.ceil(CONFIG.day * (1 - progress))} seconds left · $${rent(state)} rent due at day end · shaded middle: rush hour`;
  $("goalTitle").textContent = state.won
    ? "Sustainable gains achieved!"
    : state.property ? PROPERTIES[state.property].name : "Small gym. Big energy.";
  $("goalProgress").textContent =
    `${state.days.filter((d) => d.profit >= 0).length} / 3 profitable recorded days`;
  const allVisits = [...state.days.flatMap((d) => d.visits), ...state.visits];
  $("happiness").replaceChildren();
  TYPES.forEach((name, t) => {
    const visits = allVisits.filter((v) => v.type === t),
      average = visits.length
        ? Math.round(visits.reduce((a, v) => a + v.score, 0) / visits.length)
        : null;
    const div = document.createElement("div");
    div.innerHTML = `<div class="row"><span class="muted">${name}</span><b style="font-size:12px">${average === null ? "—" : average + "%"}</b></div><div class="meter"><i style="width:${average ?? 0}%"></i></div>`;
    $("happiness").append(div);
  });
  $("logs").replaceChildren(
    ...state.logs.slice(0, 7).map((msg) => {
      const d = document.createElement("div");
      d.className = "log";
      d.textContent = msg;
      return d;
    }),
  );
  renderTools();
}
function renderTools() {
  const item = state.items.find((i) => i.id === selected);
  const member = state.members.find((m) => m.id === selectedMember);
  const mode =
    queueId !== null
      ? "queue"
      : tool
        ? "placement"
        : item
          ? "equipment"
          : member
            ? "member"
            : panelMode;
  const key = `${mode}:${selected}:${selectedMember}:${tool}:${moveId}`;
  const context = $("context");
  const actions: [string, string, () => void][] = [];
  const back = () => cancel();
  if (mode === "queue") {
    actions.push(
      [
        "undo",
        "Undo",
        () => {
          queueDraft.pop();
          updatePreview();
          renderUI();
        },
      ],
      [
        "clear",
        "Clear",
        () => {
          queueDraft = [];
          updatePreview();
          renderUI();
        },
      ],
      ["cancel", "Cancel", back],
      ["done", "Done", finishQueue],
    );
  } else if (mode === "placement") {
    actions.push(
      [
        "rotate",
        "Rotate",
        () => {
          rotation = (rotation + 1) % 4;
          updatePreview();
        },
      ],
      ["cancel", "Cancel", back],
    );
  } else if (mode === "equipment" && item) {
    actions.push(
      ["equipmentPower", item.enabled === false ? "Turn on" : "Turn off", () => {
        toast(toggleEquipment(state, item.id) || (item.enabled === false ? "Equipment off. Ready to repair." : "Equipment on."));
        toolbarKey = "";
        syncWorld();
        renderUI();
      }],
      [
        "repair",
        `Repair $${EQUIPMENT[item.kind].repair}`,
        () => {
          toast(repair(state, item.id) || "Repaired.");
          renderUI();
        },
      ],
      [
        "sell",
        `Sell $${EQUIPMENT[item.kind].price / 2}`,
        () => {
          const error = sell(state, item.id);
          if (error) toast(error);
          else cancel();
          syncWorld();
          renderUI();
        },
      ],
      ["queueEdit", "Edit queue", () => beginQueue(item)],
      [
        "move",
        "Move",
        () => {
          tool = item.kind;
          rotation = item.rotation;
          moveId = item.id;
          renderUI();
          updatePreview();
        },
      ],
      ["back", "Back", back],
    );
  } else if (mode === "catalogue") {
    actions.push(["back", "Back", back]);
  } else if (mode === "admission") {
    actions.push(["done", "Done", back]);
  } else if (mode === "member") {
    actions.push(["back", "Back", back]);
  }
  if (key !== toolbarKey) {
    toolbarKey = key;
    $("tools").replaceChildren(
      ...actions.map(([id, label, handler]) => {
        const button = document.createElement("button");
        button.id = id;
        if (toolbarIcons[id]) iconLabel(button, label, toolbarIcons[id]);
        else button.textContent = label;
        button.onclick = handler;
        return button;
      }),
    );
    context.replaceChildren();
    context.classList.toggle("catalogue", mode === "catalogue");
    if (mode === "catalogue") {
      const heading = document.createElement("h3");
      heading.textContent = "Choose your next investment";
      context.append(heading);
      const cards = document.createElement("div");
      cards.className = "equipment-cards";
      for (const kind of ["rack", "bike", "freeweights", "treadmill"] as const) {
        const card = document.createElement("button");
        card.id = kind;
        card.className = "equipment-card";
        card.innerHTML = `<img class="equipment-thumbnail" src="${equipmentThumbnail(kind)}" alt="${EQUIPMENT[kind].name} 3D model"><span class="equipment-heading"><strong>${EQUIPMENT[kind].name}</strong><b>$${EQUIPMENT[kind].price}</b></span><span class="equipment-description">${kind === "rack" ? "The altar of gains. Heavy lifting, loud grunting, and questionable form." : kind === "bike" ? "All the effort of cycling. Absolutely none of the scenery." : kind === "treadmill" ? "Run for miles. Go absolutely nowhere. Steadier maintenance than bikes." : "Affordable curls. Small footprint. Enormous mirror confidence."}</span><span class="equipment-footprint">${EQUIPMENT[kind].w} × ${EQUIPMENT[kind].d} floor tiles · Leave room for a queue</span><span class="equipment-pick">Choose equipment →</span>`;
        card.onclick = () => pick(kind);
        cards.append(card);
      }
      context.append(cards);
    }
    if (mode === "admission") {
      context.innerHTML = `<label for="price">Admission per visit · <b id="priceText"></b></label><input id="price" type="range" min="0" max="35">`;
      const input = $("price") as HTMLInputElement;
      input.value = String(state.price);
      input.oninput = () => {
        state.price = Number(input.value);
        $("priceText").textContent = `$${state.price}`;
      };
    }
  }
  context.hidden = mode === "default";
  if (mode === "admission") $("priceText").textContent = `$${state.price}`;
  else if (mode === "queue")
    context.textContent = `Queue · ${queueDraft.length + 1} waiting places. Start at tile 1; extend beside it. Leave walking access to the back of the queue.`;
  else if (mode === "placement" && tool)
    context.textContent = `${moveId ? "Move" : "Place"} ${EQUIPMENT[tool].name}${moveId ? "" : ` · $${EQUIPMENT[tool].price}`} · ${rotation * 90}° · Click floor to place${moveId ? " · Moving clears the old queue" : " · Green queue entry"}`;
  else if (mode === "equipment" && item) {
    context.textContent = `${EQUIPMENT[item.kind].name} · ${item.enabled === false ? "OFF · " : ""}${item.broken ? "DISABLED · " : ""}Condition ${Math.round(item.condition)}% · ${reserved(state, item.id) ? "In use / reserved" : "Idle"} · ${item.line.length} waiting · ${item.lane.length + 1} waiting places`;
    for (const id of ["repair", "sell", "move", "queueEdit"])
      ($(id) as HTMLButtonElement).disabled = reserved(state, item.id);
  } else if (mode === "member" && member)
    context.textContent = `${member.name ?? `Member ${member.id}`} · ${TYPES[member.type]} · ${member.state} · Activity ${Math.min(member.activity + 1, member.routine.length)}/${member.routine.length} · ${member.routine.map((k) => EQUIPMENT[k].name).join(" → ")} · Happiness ${Math.max(0, Math.round(member.score))}% · ${member.feedback}`;
  $("tools").hidden = mode === "default";
  $("pause").replaceChildren(createElement(state.paused ? Play : Pause, {class:"lucide", "aria-hidden":"true", width:20,height:20}));
  $("pause").setAttribute("aria-label",state.paused ? "Resume" : "Pause");
  $("pause").title = state.paused ? "Resume" : "Pause";

}
let displayedCash = availableFunds(state);
let previousCash = displayedCash;
let cashChangeUntil = 0;
function updateCash(dt: number, now: number) {
  const cash = availableFunds(state);
  if (cash !== previousCash) {
    const delta = cash - previousCash;
    $("cashChange").textContent =
      `${delta > 0 ? "+" : "−"}$${Math.abs(delta).toFixed(0)}`;
    $("cashChange").className = delta > 0 ? "cash-gain" : "cash-loss";
    cashChangeUntil = now + 1800;
    previousCash = cash;
  }
  displayedCash += (cash - displayedCash) * (1 - Math.exp(-dt * 7));
  if (Math.abs(cash - displayedCash) < 0.5) displayedCash = cash;
  $("funds").textContent =
    `${displayedCash < 0 ? "−" : ""}$${Math.abs(displayedCash).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  $("cashChange").hidden = now > cashChangeUntil;
}
let last = performance.now(),
  accumulator = 0,
  uiElapsed = 0;
function frame(now: number) {
  const dt = Math.min(0.2, (now - last) / 1000);
  last = now;
  if (!state.paused) {
    accumulator += dt;
    while (accumulator >= 0.05) {
      const day = Math.floor(state.time / CONFIG.day);
      const warnedBefore = new Set(
        state.items.filter((item) => item.warned).map((item) => item.id),
      );
      tick(state, 0.05);
      const newlyWarned = state.items.filter(
        (item) => item.warned && !warnedBefore.has(item.id),
      );
      if (newlyWarned.length)
        toast(
          newlyWarned
            .map((item) => `${EQUIPMENT[item.kind].name} needs maintenance`)
            .join(" · "),
        );
      accumulator -= 0.05;
      if (Math.floor(state.time / CONFIG.day) !== day) save(true);
    }
  } else accumulator = 0;
  let dx = 0,
    dz = 0;
  if (keys.has("w") || keys.has("arrowup")) dz -= dt * 5;
  if (keys.has("s") || keys.has("arrowdown")) dz += dt * 5;
  if (keys.has("a") || keys.has("arrowleft")) dx -= dt * 5;
  if (keys.has("d") || keys.has("arrowright")) dx += dt * 5;
  if (dx || dz) {
    target.x = THREE.MathUtils.clamp(target.x + dx, -20, 12);
    target.z = THREE.MathUtils.clamp(target.z + dz, -6, 6);
    resize();
  }
  updateCash(dt, now);
  syncWorld();
  uiElapsed += dt;
  if (uiElapsed > 0.4) {
    renderUI();
    uiElapsed = 0;
    if (state.bankrupt || state.money <= 0) showGameOver();
  }
  updateVisitorSpeech(dt);
  updateMaintenanceBadges();
  updateExpansionButton();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
resize();
renderUI();
requestAnimationFrame(frame);

function storefront(id: PropertyId) {
 const p=PROPERTIES[id];
 return `<svg viewBox="0 0 360 190" role="img" aria-label="${p.name} storefront"><rect width="360" height="190" fill="#e4e4d6"/><path d="M12 163H348" stroke="#a8afa0" stroke-width="8"/><rect x="35" y="40" width="290" height="120" fill="${p.color}"/><rect x="45" y="47" width="270" height="30" fill="#28372e"/><text x="180" y="68" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="17" fill="#d6e99d">${p.name.toUpperCase()}</text>${id==='warehouse' ? '<rect x="55" y="89" width="185" height="71" fill="#acb4ae"/><path d="M55 100H240M55 113H240M55 126H240M55 139H240M55 152H240" stroke="#778980" stroke-width="3"/>' : '<rect x="53" y="90" width="87" height="64" fill="#b4cfca"/><rect x="152" y="90" width="70" height="64" fill="#b4cfca"/><path d="M53 90L95 154M152 90L185 154" stroke="#d8e6d8" stroke-width="9"/>'}<rect x="253" y="90" width="46" height="70" fill="#293a32"/><rect x="260" y="98" width="32" height="42" fill="#c2d5cd"/><circle cx="290" cy="147" r="3" fill="#d6e99d"/>${id==='corner' ? '<path d="M40 80H320L330 95H30Z" fill="#f2d9a5"/><path d="M65 80L60 95M105 80L102 95M145 80V95M185 80V95M225 80L228 95M265 80L270 95M305 80L315 95" stroke="#ad614b" stroke-width="17"/>' : id==='closet' ? '<path d="M55 103H138M55 115H138M55 127H138M55 139H138" stroke="#75887b" stroke-width="7"/>' : ''}</svg>`;
}
function showRentals() {
 state.paused=true;
 world.inert=true;
 let screen=document.getElementById("rentals");
 if(!screen){screen=document.createElement("section");screen.id="rentals";document.body.append(screen);}
 screen.innerHTML=`<header><span class="label">GYM BRO TYCOON · COMMERCIAL LETTINGS</span><h1>Your gym starts with a lease.</h1><p>$1,800 to make it happen. Spend on space, or save it for equipment.</p></header><div class="rental-list">${(Object.keys(PROPERTIES) as PropertyId[]).map(id=>{
  const p=PROPERTIES[id],tiles=roomTiles(id);
  const plan=`<svg viewBox="0 0 120 120" role="img" aria-label="${p.name} floor plan">${tiles.map(c=>`<rect x="${c.x*10}" y="${c.z*10}" width="9" height="9" fill="${p.color}"/>`).join('')}<rect x="50" y="110" width="9" height="9" fill="#d6e99d"/></svg>`;
  return `<article class="rental-card">${storefront(id)}<div class="rental-body"><h2>${p.name}</h2><p>${p.pitch}</p><div class="rental-plan">${plan}<dl><dt>Floor space</dt><dd>${tiles.length} tiles</dd><dt>Upfront lease</dt><dd>$${p.lease}</dd><dt>Daily rent</dt><dd>$${p.rent}</dd></dl></div><p class="rental-cash">$${1800-p.lease-p.rent} for equipment after reserving day-one rent</p><button data-property="${id}">Rent ${p.name}</button></div></article>`;
 }).join('')}</div><button id="rentalLoad">Load saved gym</button>`;
 screen.querySelectorAll<HTMLButtonElement>("[data-property]").forEach(button=>button.onclick=()=>{
  state=initial(button.dataset.property as PropertyId);screen!.remove();world.inert=false;buildRoom();resetCamera();
  displayedCash=previousCash=availableFunds(state);cashChangeUntil=0;selected=null;selectedMember=null;cancel();clearVisitorSpeech();syncWorld();renderUI();
 });
 try { ($("rentalLoad") as HTMLButtonElement).disabled=!localStorage.getItem("rep-city-rentals-v1"); } catch { ($("rentalLoad") as HTMLButtonElement).disabled=true; }
 $("rentalLoad").onclick=()=>{load();if(state.property){screen!.remove();world.inert=false;}};
}
showRentals();

function updateExpansionButton() {
 const button=$("expansionPurchase") as HTMLButtonElement;
 button.hidden=!state.property||Boolean(state.expanded)||Boolean(document.getElementById("rentals"));
 if(button.hidden||!state.property)return;
 const e=EXPANSIONS[state.property];
 button.textContent=`Buy ${e.name} · $${e.cost} · +$${e.rent}/day`;
 button.title=`Buy this room. Daily rent becomes $${rent(state)+e.rent}. Keep the green doorway clear.`;
 button.disabled=state.bankrupt||state.money-e.cost<rent(state)+e.rent;
 if(button.disabled)button.title=`Need $${e.cost+e.rent} in Your cash to buy the room and reserve its added rent.`;
 const point=new THREE.Vector3((e.minX+e.maxX)/2-5.5,.25,(e.minZ+e.maxZ)/2-5.5).project(camera);
 button.style.left=`${(point.x+1)*world.clientWidth/2}px`;button.style.top=`${(1-point.y)*world.clientHeight/2}px`;
 button.onclick=()=>{const error=expand(state);if(error){toast(error);return;}cancel();buildRoom();syncWorld();renderUI();toast("Room purchased. Your daily rent has increased.");save(true);};
}
