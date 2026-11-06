import {PROPERTIES, EXPANSIONS, doorwayReserved, roomContains, type PropertyId} from "./properties";
import {
  EQUIPMENT,
  ENTRANCE,
  SIZE,
  MIN_X,
  access,
  exit,
  blockedCells,
  cells,
  dimensions,
  findPath,
  inside,
  key,
  neighbors,
  pathTo,
  route,
  same,
  validateLayout,
  type Kind,
  type Cell,
} from "./spatial";
export {
  EQUIPMENT,
  access,
  exit,
  cells,
  dimensions,
  pathTo,
  type Kind,
  type Cell,
} from "./spatial";
export const CONFIG = {
  size: SIZE,
  day: 120,
  rent: 120,
  injury: 150,
  arrival: 7,
  maxMembers: 20,
  waitPenalty: 0.4,
  waitGrace: 5,
  patience: 35,
  rest: 5,
  retryRest: 10,
  ratingWindow: 40,
  ratingSeconds: 45,
};
export const TYPES = ["Heavy Disciple", "Cardio Pilgrim", "January Optimist"];
export interface Item extends Cell {
  id: number;
  kind: Kind;
  rotation: number;
  condition: number;
  broken: boolean;
  warned: boolean;
  enabled?: boolean;
  lane: Cell[];
  line: number[];
}
export type Need = "queues" | "noise" | "condition" | "variety" | "cleanliness";
export interface NeedMetrics {
  cleanliness?: number;
  queues: number;
  noise: number;
  condition: number;
  variety: number;
}
export interface Member extends Cell {
  id: number;
  type: number;
  name?: string;
  appearance?: number;
  state: "walking" | "waiting" | "using" | "resting" | "leaving";
  target: number | null;
  path: Cell[];
  timer: number;
  wait: number;
  score: number;
  feedback: string;
  routine: Kind[];
  activity: number;
  restCell: Cell | null;
  exitVia?: Cell;
  departureLane?: Cell[];
  needs?: NeedMetrics;
  noiseSeconds?: number;
  dirtSeconds?: number;
  retriedActivity?: number;
  thought?: { topic: string; text: string; at: number };
  thoughtTopics?: string[];
}
export interface Visit {
  type: number;
  score: number;
  completed?: boolean;
}
export interface Day {
  profit: number;
  visits: Visit[];
}
export interface State {
  puddles?: Cell[];
  property?: PropertyId;
  expanded?: boolean;
  version: 2;
  queueVersion: 2;
  dumbbellRackVersion: 2;
  money: number;
  price: number;
  time: number;
  paused: boolean;
  seed: number;
  nextId: number;
  spawn: number;
  items: Item[];
  members: Member[];
  logs: string[];
  profit: number;
  capital: number;
  visits: Visit[];
  days: Day[];
  bankrupt: boolean;
  won: boolean;
  rating: number;
  ratingTrend: number;
  ratingAnchor: number;
  ratingAnchorTime: number;
  ratingSamples: number[];
}
export function rent(s: State) {return s.property ? PROPERTIES[s.property].rent + (s.expanded ? EXPANSIONS[s.property].rent : 0) : CONFIG.rent;}
export function initial(property?: PropertyId): State {
  return {
    puddles: [],
    version: 2,
    queueVersion: 2,
    dumbbellRackVersion: 2,
    ...(property ? {property} : {}),
    money: 1800 - (property ? PROPERTIES[property].lease : 0),
    price: 15,
    time: 0,
    paused: true,
    seed: 1337,
    nextId: 1,
    spawn: 2,
    items: [],
    members: [],
    logs: ["Place equipment, draw queue lanes, then resume time."],
    profit: 0,
    capital: 0,
    visits: [],
    days: [],
    bankrupt: false,
    won: false,
    rating: 2.5,
    ratingTrend: 0,
    ratingAnchor: 2.5,
    ratingAnchorTime: 0,
    ratingSamples: [],
  };
}
export function log(s: State, msg: string) {
  s.logs.unshift(msg);
  s.logs = s.logs.slice(0, 40);
}
export function random(s: State) {
  s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0;
  return s.seed / 4294967296;
}
export function reserved(s: State, id: number) {
  return s.members.some((m) => m.target === id && m.state !== "leaving");
}
export function placement(s: State, item: Item, ignore?: number) {
  const all = [...s.items.filter((i) => i.id !== ignore), item];
  const reason = validateLayout(all,s.property,s.expanded);
  if (reason) return reason;
  const footprint = [...cells(item), access(item), ...item.lane];
  if (
    s.members.some((m) =>
      footprint.some(
        (c) => Math.abs(m.x - c.x) < 0.7 && Math.abs(m.z - c.z) < 0.7,
      ),
    )
  )
    return "A member is standing there.";
  return "";
}
function refreshRoutes(s: State) {
  for (const m of s.members) {
    if (m.state === "leaving") m.path = departurePath(s, m, ENTRANCE) ?? [];
    else if (m.state === "resting" && m.restCell)
      m.path = departurePath(s, m, m.restCell) ?? [];
    else if (m.state === "walking" || m.state === "waiting") {
      const i = s.items.find((i) => i.id === m.target);
      if (i) routeMember(s, m, i);
    }
  }
}
export function buy(
  s: State,
  kind: Kind,
  x: number,
  z: number,
  rotation: number,
  moveId?: number,
) {
  if (s.bankrupt || s.money <= 0)
    return "Gym is bankrupt. Restart to play again.";
  const old = s.items.find((i) => i.id === moveId);
  if (old && reserved(s, old.id))
    return "Wait until equipment is idle and unreserved.";
  const item: Item = old
    ? { ...old, x, z, rotation, lane: [] }
    : {
        id: s.nextId,
        kind,
        x,
        z,
        rotation,
        condition: 100,
        broken: false,
        warned: false,
        enabled: true,
        lane: [],
        line: [],
      };
  const reason = placement(s, item, moveId);
  if (reason) return reason;
  if (!old && availableFunds(s) < EQUIPMENT[kind].price)
    return "Not enough funds after reserving rent.";
  if (old) Object.assign(old, item);
  else {
    s.nextId++;
    s.items.push(item);
    s.money -= EQUIPMENT[kind].price;
    s.capital -= EQUIPMENT[kind].price;
  }
  refreshRoutes(s);
  return "";
}
export function setLane(s: State, id: number, lane: Cell[]) {
  const i = s.items.find((i) => i.id === id);
  if (!i) return "Equipment not found.";
  if (reserved(s, id)) return "Wait until equipment is idle and unreserved.";
  const copy = { ...i, lane: lane.map((c) => ({ ...c })) };
  const reason = validateLayout(s.items.map((n) => (n.id === id ? copy : n)),s.property,s.expanded);
  if (reason) return reason;
  const occupied = [access(i), ...lane];
  if (
    s.members.some((m) =>
      occupied.some(
        (c) => Math.abs(m.x - c.x) < 0.7 && Math.abs(m.z - c.z) < 0.7,
      ),
    )
  )
    return "A member is standing there.";
  i.lane = copy.lane;
  refreshRoutes(s);
  return "";
}
export function toggleEquipment(s: State, id: number) {
  const item = s.items.find((i) => i.id === id);
  if (!item) return "Equipment not found.";
  if (s.bankrupt) return "Gym is bankrupt. Restart to play again.";
  item.enabled = item.enabled === false;
  if (!item.enabled) {
    const affected = s.members.filter((m) => m.target === id);
    for (const m of affected) {
      if (m.state === "using") {
        if (!rest(s, m)) leave(s, m, "Equipment switched off.");
      }
      else {
        release(s, m);
        choose(s, m);
      }
    }
    item.line = [];
  }
  log(s, `${EQUIPMENT[item.kind].name} turned ${item.enabled ? "on" : "off"}.`);
  return "";
}
export function repair(s: State, id: number) {
  if (s.bankrupt || s.money <= 0)
    return "Gym is bankrupt. Restart to play again.";
  const i = s.items.find((i) => i.id === id);
  if (!i) return "Equipment not found.";
  if (reserved(s, id)) return "Wait until equipment is idle and unreserved.";
  const cost = EQUIPMENT[i.kind].repair;
  if (availableFunds(s) < cost) return "Not enough funds after reserving rent.";
  if (i.condition === 100 && !i.broken) return "Already in perfect condition.";
  s.money -= cost;
  s.profit -= cost;
  i.condition = 100;
  i.broken = false;
  i.warned = false;
  log(s, "Equipment repaired. Your insurance company exhales.");
  return "";
}
export function sell(s: State, id: number) {
  if (s.bankrupt || s.money <= 0)
    return "Gym is bankrupt. Restart to play again.";
  if (reserved(s, id)) return "Wait until equipment is idle and unreserved.";
  const i = s.items.find((i) => i.id === id);
  if (!i) return "";
  const cash = EQUIPMENT[i.kind].price * 0.5;
  s.money += cash;
  s.capital += cash;
  s.items = s.items.filter((i) => i.id !== id);
  refreshRoutes(s);
  return "";
}
export function availableFunds(s: State) {
  return s.money - rent(s);
}
function checkBankruptcy(s: State) {
  if (s.money <= 0 && !s.bankrupt) {
    s.bankrupt = true;
    s.paused = true;
    log(s, "BANKRUPT: funds exhausted. Restart to try again.");
  }
}

function user(s: State, i: Item) {
  return s.members.find((m) => m.target === i.id && m.state === "using");
}
function destination(s: State, m: Member, i: Item): Cell | undefined {
  const index = i.line.indexOf(m.id);
  if (index < 0) return;
  // The entry tile is queue position one, independent of the active user.
  return index === 0 ? access(i) : i.lane[index - 1];
}
function routeMember(s: State, m: Member, i: Item) {
  const dest = destination(s, m, i);
  if (!dest) return;
  if (
    same({ x: Math.round(m.x), z: Math.round(m.z) }, dest) &&
    Math.hypot(m.x - dest.x, m.z - dest.z) < 0.01
  ) {
    m.path = [];
    m.state = "waiting";
    return;
  }
  const path = route(s.items, m, dest, i.id,s.property,s.expanded);
  if (path) {
    m.path = path;
    m.state = "walking";
  }
}
function advanceLine(s: State, i: Item) {
  i.line = i.line.filter((id) =>
    s.members.some(
      (m) =>
        m.id === id &&
        m.target === i.id &&
        m.state !== "using" &&
        m.state !== "leaving",
    ),
  );
  for (const id of i.line) {
    const m = s.members.find((m) => m.id === id)!;
    routeMember(s, m, i);
  }
}
function release(s: State, m: Member) {
  const i = s.items.find((i) => i.id === m.target);
  m.target = null;
  if (i) {
    i.line = i.line.filter((id) => id !== m.id);
    advanceLine(s, i);
  }
}
function departurePath(
  s: State,
  m: Member,
  to: Cell,
  own?: number,
): Cell[] | null {
  if (m.exitVia) {
    const onward = route(s.items, m.exitVia, to,undefined,s.property,s.expanded);
    return onward ? [...(m.departureLane ?? []), ...onward] : null;
  }
  // A member abandoning a queue may retreat along that lane.
  return route(s.items, m, to, own,s.property,s.expanded);
}
function markExit(s: State, m: Member) {
  if (m.state === "using") {
    const item = s.items.find((i) => i.id === m.target);
    if (item) {
      m.departureLane = [access(item), ...item.lane].map(c=>({...c}));
      m.exitVia = {...m.departureLane.at(-1)!};
    }
  }
}
function leave(s: State, m: Member, msg?: string) {
  markExit(s, m);
  const previous = m.target ?? undefined;
  release(s, m);
  m.state = "leaving";
  m.restCell = null;
  m.path = departurePath(s, m, ENTRANCE, previous) ?? [];
  if (msg) m.feedback = msg;
}
export function choose(s: State, m: Member) {
  const kind = m.routine[m.activity];
  const suitable = s.items.filter(
    (i) => i.kind === kind && i.enabled !== false && !i.broken && i.condition > 0,
  );
  const available = suitable
    .filter((i) => i.line.length < i.lane.length + 1)
    .sort(
      (a, b) =>
        a.line.length +
        (user(s, a) ? 1 : 0) -
        (b.line.length + (user(s, b) ? 1 : 0)),
    );
  for (const i of available) {
    const dest = i.line.length === 0 ? access(i) : i.lane[i.line.length - 1];
    if (dest && route(s.items, m, dest, i.id,s.property,s.expanded)) {
      m.target = i.id;
      m.wait = 0;
      m.restCell = null;
      i.line.push(m.id);
      routeMember(s, m, i);
      m.feedback = "Heading for " + EQUIPMENT[i.kind].name.toLowerCase();
      return true;
    }
  }
  if (suitable.length && m.retriedActivity !== m.activity) {
    m.retriedActivity = m.activity;
    if (rest(s, m, CONFIG.retryRest)) {
      m.feedback = "Queues are full. Taking a breather before trying again.";
      return false;
    }
  }
  m.score -= 10;
  visitorThought(s, m, suitable.length ? "full" : "unavailable");
  leave(
    s,
    m,
    suitable.length
      ? "Every suitable queue is full. My gains are on backorder."
      : "No working equipment for my routine. My gains are theoretical.",
  );
  return false;
}
function rest(s: State, m: Member, duration = CONFIG.rest): boolean {
  markExit(s, m);
  const previous = m.target ?? undefined;
  release(s, m);
  const blocked = blockedCells(s.items, true,undefined,s.property,s.expanded);
  const reservedRest = new Set(
    s.members
      .filter((n) => n.id !== m.id && n.restCell)
      .map((n) => key(n.restCell!)),
  );
  const current = { x: Math.round(m.x), z: Math.round(m.z) };
  const candidates: Cell[] = [];
  for (let x = MIN_X; x < SIZE; x++)
    for (let z = 0; z < SIZE; z++) {
      const c = { x, z };
      if (
        !same(c, ENTRANCE) &&
        !doorwayReserved(s.property,c) &&
        !blocked.has(key(c)) &&
        !reservedRest.has(key(c)) &&
        !s.members.some(
          (n) => n.id !== m.id && Math.hypot(n.x - x, n.z - z) < 0.7,
        )
      )
        candidates.push(c);
    }
  candidates.sort(
    (a, b) =>
      Math.hypot(a.x - current.x, a.z - current.z) -
      Math.hypot(b.x - current.x, b.z - current.z),
  );
  for (const c of candidates) {
    const path = departurePath(s, m, c, previous);
    if (path) {
      m.state = "resting";
      m.restCell = c;
      m.path = path;
      m.timer = duration;
      m.feedback = "Resting. Gains need time to process.";
      return true;
    }
  }
  return false;
}
function move(m: Member, dt: number) {
  if (!m.path.length) return true;
  const p = m.path[0],
    dx = p.x - m.x,
    dz = p.z - m.z,
    dist = Math.hypot(dx, dz),
    step = dt * 2;
  if (dist <= step) {
    m.x = p.x;
    m.z = p.z;
    m.path.shift();
    if(m.departureLane?.length && same(p,m.departureLane[0]))m.departureLane.shift();
    if (m.exitVia && same(m, m.exitVia)) {delete m.exitVia;delete m.departureLane;}
  } else {
    m.x += (dx / dist) * step;
    m.z += (dz / dist) * step;
  }
  return m.path.length === 0;
}
const NEED_CAPS: Record<Need,number> = { queues: 30, noise: 15, condition: 15, variety: 15, cleanliness: 10 };
export function needPenalty(m: Member, need: Need, amount: number) {
  m.needs ??= { queues: 0, noise: 0, condition: 0, variety: 0 };
  const before = m.needs[need] ?? 0;
  m.needs[need] = Math.min(NEED_CAPS[need], before + Math.max(0, amount));
  m.score -= m.needs[need] - before;
}
const THOUGHTS: Record<string, string[]> = {
  cleanliness: ["Is that sweat or a new indoor pool?", "Someone skipped towel day.", "This floor needs a cleaning workout."],
  queues: ["I've warmed up. And cooled down. Still waiting.", "This queue is my endurance workout.", "This line is longer than my workout."],
  noise: ["Could we lift without the sound effects?", "My ears weren't on today's workout plan.", "That scream needs its own room."],
  condition: ["That wobble isn't part of the exercise.", "This machine needs a repair day.", "I'd like my equipment in one piece."],
  variety: ["My workout needs more than this selection.", "Same equipment, different day. Again.", "A little more variety would go a long way."],
  unavailable: ["Nothing here works for my next exercise.", "My workout has hit an equipment shortage."],
  full: ["Every queue is full. I'll exercise elsewhere.", "No room in line for my gains."],
  good: ["Finished my workout without living in a queue.", "Good equipment. Actual gains. I'll be back.", "A whole workout, with my ears intact."],
};
export function visitorThought(s: State, m: Member, topic: string) {
  if (s.paused || m.thoughtTopics?.includes(topic) ||
      (m.thought && s.time - m.thought.at < 20)) return;
  const options = THOUGHTS[topic];
  if (!options) return;
  m.thought = { topic, text: options[m.id % options.length], at: s.time };
  (m.thoughtTopics ??= []).push(topic);
}
function varietyPenalty(s: State, m: Member) {
  const preferences: Kind[][] = [["rack", "freeweights"], ["bike"], ["rack", "bike", "freeweights"]];
  const wanted = preferences[m.type];
  const offered = new Set(s.items.filter(i => i.enabled !== false && !i.broken && i.condition > 0).map(i => i.kind));
  const missing = wanted.filter(kind => kind === "bike" ? !offered.has("bike") && !offered.has("treadmill") : !offered.has(kind)).length;
  needPenalty(m, "variety", 15 * missing / wanted.length);
  if (missing) visitorThought(s, m, "variety");
}
function workoutPosition(s: State, m: Member) {
  const item = s.items.find(i => i.id === m.target);
  if (m.state !== "using" || !item) return m;
  const {w,d} = dimensions(item);
  return {x:item.x+(w-1)/2,z:item.z+(d-1)/2};
}
function sample(s: State, score: number) {
  s.ratingSamples.push(Math.max(0, Math.min(100, score)));
  s.ratingSamples = s.ratingSamples.slice(-CONFIG.ratingWindow);
}
function finishVisit(s: State, m: Member) {
  const completed = m.activity >= m.routine.length;
  const score = Math.max(0, Math.min(100, m.score - (completed ? 0 : 15)));
  s.visits.push({ type: m.type, score, completed });
  sample(s, score);
  log(s, `${TYPES[m.type]}: ${m.feedback}`);
  s.members = s.members.filter((n) => n.id !== m.id);
}
export function equipmentAppeal(s: State) {
  return (
    (new Set(
      s.items.filter((i) => i.enabled !== false && !i.broken && i.condition > 0).map((i) => i.kind),
    ).size /
      Object.keys(EQUIPMENT).length) *
    100
  );
}
export function ratingTarget(s: State) {
  const experience = s.ratingSamples.length
    ? s.ratingSamples.reduce((a, b) => a + b, 0) / s.ratingSamples.length
    : 50;
  // Value is independent of experience, which already contains observed needs.
  const value = Math.max(0, Math.min(100, 100 - s.price * 2));
  return Math.max(
    0,
    Math.min(
      5,
      (experience * 0.8 + value * 0.2) / 20,
    ),
  );
}
export function rush(s: State) {
  const phase = (s.time % CONFIG.day) / CONFIG.day;
  return phase >= 0.3 && phase < 0.7;
}
export function arrivalInterval(s: State) {
  return CONFIG.arrival / ((0.5 + s.rating / 5) * (rush(s) ? 2.5 : 0.65));
}
export function admit(s: State, type: number) {
  const max = [28, 22, 18][type];
  if (s.price > max) {
    log(s, `${TYPES[type]}: $${s.price}? My wallet skips leg day.`);
    sample(s, 15);
    return null;
  }
  const length = 1 + Math.floor(random(s) * 3);
  const routine: Kind[] = Array.from({ length }, () => {
    const choice = random(s);
    const [rackChance, weightsChance] = [
      [0.55, 0.35],
      [0.1, 0.05],
      [0.3, 0.35],
    ][type];
    return choice < rackChance
      ? "rack"
      : choice < rackChance + weightsChance
        ? "freeweights"
        : s.items.some(i => i.kind === "treadmill" && i.enabled !== false && !i.broken && i.condition > 0) && (!s.items.some(i => i.kind === "bike" && i.enabled !== false && !i.broken && i.condition > 0) || random(s) < 0.5) ? "treadmill" : "bike";
  });
  const firstNames = [
    "Jack",
    "Alex",
    "Sam",
    "Kim",
    "Robin",
    "Taylor",
    "Morgan",
    "Jamie",
    "Casey",
    "Charlie",
    "Drew",
    "Max",
  ];
  const lastNames = [
    "Brooks",
    "Stone",
    "Reed",
    "Park",
    "Hill",
    "Fox",
    "Lane",
    "West",
    "Cole",
    "Gray",
    "Vale",
    "Woods",
  ];
  const name = `${firstNames[Math.floor(random(s) * firstNames.length)]} ${lastNames[Math.floor(random(s) * lastNames.length)]}`;
  const appearance = Math.floor(random(s) * 1000000);
  const m: Member = {
    id: s.nextId++,
    name,
    appearance,
    type,
    ...ENTRANCE,
    state: "walking",
    target: null,
    path: [],
    timer: 0,
    wait: 0,
    score: 95,
    feedback: "A fresh start.",
    routine,
    activity: 0,
    restCell: null,
  };
  s.money += s.price;
  s.profit += s.price;
  s.members.push(m);
  varietyPenalty(s, m);
  choose(s, m);
  return m;
}
function dayEnd(s: State, oldDay: number) {
  s.money -= rent(s);
  s.profit -= rent(s);
  s.days.push({ profit: s.profit, visits: s.visits });
  s.days = s.days.slice(-3);
  log(
    s,
    `Day ${oldDay + 1} closed: operating ${s.profit >= 0 ? "+" : ""}$${s.profit.toFixed(0)}. Rent $${rent(s)}.`,
  );
  s.profit = 0;
  s.visits = [];
  if (
    s.days.length === 3 &&
    s.days.every((d) => d.profit >= 0) &&
    [0, 1, 2].every((t) => {
      const visits = s.days
        .flatMap((d) => d.visits)
        .filter((v) => v.type === t);
      return (
        visits.length >= 3 &&
        visits.reduce((a, v) => a + v.score, 0) / visits.length >= 60
      );
    })
  ) {
    if (!s.won)
      log(s, "SUCCESS: three sustainable days. Functional absurdity achieved.");
    s.won = true;
  }
}
export function tick(s: State, dt: number) {
  checkBankruptcy(s);
  if (s.paused || s.bankrupt) return;
  if (!Number.isFinite(dt) || dt <= 0) return;
  const oldDay = Math.floor(s.time / CONFIG.day);
  s.time += dt;
  s.rating +=
    (ratingTarget(s) - s.rating) * (1 - Math.exp(-dt / CONFIG.ratingSeconds));
  if (s.time - s.ratingAnchorTime >= 15) {
    s.ratingTrend = s.rating - s.ratingAnchor;
    s.ratingAnchor = s.rating;
    s.ratingAnchorTime = s.time;
  }
  s.spawn -= dt;
  if (s.spawn <= 0) {
    s.spawn = arrivalInterval(s);
    if (s.members.length < CONFIG.maxMembers)
      admit(s, Math.floor(random(s) * 3));
  }
  for (const m of [...s.members]) {
    if(m.state !== "leaving") {
      const position=workoutPosition(s,m);
      const nearby=(s.puddles ?? []).filter(p=>Math.hypot(p.x-position.x,p.z-position.z)<1.8).length;
      if(nearby) {
        needPenalty(m,"cleanliness",dt*.18*Math.min(nearby,3));
        m.dirtSeconds=(m.dirtSeconds ?? 0)+dt;
        if(m.dirtSeconds>=5){visitorThought(s,m,"cleanliness");m.feedback="Someone skipped towel day. This floor needs cleaning.";}
      }
    }
    if (m.state === "leaving") {
      if (move(m, dt)) finishVisit(s, m);
      continue;
    }
    if (m.state === "resting") {
      if (move(m, dt)) {
        m.timer -= dt;
        if (m.timer <= 0) choose(s, m);
      }
      continue;
    }
    const i = s.items.find((i) => i.id === m.target);
    if (!i || i.broken || i.condition <= 0) {
      m.score -= 20;
      leave(s, m, "Broken equipment. Betrayed by my workout.");
      continue;
    }
    if (m.state === "walking" || m.state === "waiting") {
      const position = i.line.indexOf(m.id);
      if (position < 0) {
        choose(s, m);
        continue;
      }
      if (position > 0 || user(s, i)) {
        const previousWait = m.wait;
        m.wait += dt;
        needPenalty(m, "queues", (Math.max(0, m.wait - CONFIG.waitGrace) -
          Math.max(0, previousWait - CONFIG.waitGrace)) * CONFIG.waitPenalty);
        if (m.wait >= 15) visitorThought(s, m, "queues");
        m.feedback = "Waiting. My warm-up is now my whole workout.";
        if (m.wait > CONFIG.patience) {
          leave(s, m);
          continue;
        }
      }
      const waitingPoint = destination(s, m, i);
      if (!m.path.length && waitingPoint &&
          Math.hypot(m.x - waitingPoint.x, m.z - waitingPoint.z) >= 0.01)
        routeMember(s, m, i);
      if (m.state === "walking") move(m, dt);
      const dest = destination(s, m, i);
      if (dest && Math.hypot(m.x - dest.x, m.z - dest.z) < 0.01) {
        m.state = "waiting";
        if (i.line[0] === m.id && !user(s, i) && same(dest, access(i))) {
          i.line.shift();
          m.x = dest.x;
          m.z = dest.z;
          m.path = [];
          m.state = "using";
          m.timer =
            i.kind === "freeweights"
              ? 11 + random(s) * 5
              : m.type === 1
                ? 25 + random(s) * 8
                : 16 + random(s) * 6;
          m.feedback =
            m.type === 0
              ? "Preparing a deeply unnecessary scream."
              : "Actually exercising. Incredible.";
          advanceLine(s, i);
        }
      }
      continue;
    }
    m.timer -= dt;
    const before = i.condition;
    i.condition = Math.max(0, i.condition - dt * EQUIPMENT[i.kind].wear);
    if (i.condition < 25 && !i.warned) {
      i.warned = true;
      log(
        s,
        "MAINTENANCE WARNING: " +
          EQUIPMENT[i.kind].name +
          " needs maintenance (below 25%). Repair before it becomes dangerous.",
      );
    }
    if (i.condition < 30) {
      needPenalty(m, "condition", dt * 0.18 * [0.8, 1.3, 1][m.type]);
      if (i.condition < 25) visitorThought(s, m, "condition");
    }
    if (
      m.type === 2 &&
      s.members.some(
        (n) =>
          n.type === 0 &&
          n.state === "using" &&
          s.items.find(item => item.id === n.target)?.kind !== "bike" &&
          s.items.find(item => item.id === n.target)?.kind !== "treadmill" &&
          Math.hypot(workoutPosition(s,n).x - workoutPosition(s,m).x,
            workoutPosition(s,n).z - workoutPosition(s,m).z) < 4,
      )
    ) {
      needPenalty(m, "noise", dt * 0.35);
      m.noiseSeconds = (m.noiseSeconds ?? 0) + dt;
      if (m.noiseSeconds >= 5) visitorThought(s, m, "noise");
      m.feedback =
        "The screaming is entering my soul. Move the racks farther away.";
    }
    if (i.kind === "bike" && before < 10 && random(s) < dt * 0.012) {
      i.broken = true;
      i.condition = 0;
      s.money -= CONFIG.injury;
      s.profit -= CONFIG.injury;
      m.score = 0;
      log(
        s,
        `INJURY: Jack versus the neglected bike. Bike disabled; $${CONFIG.injury} claim paid.`,
      );
      leave(s, m, "My lawyer never skips leg day.");
    } else if (i.condition <= 0) {
      m.score -= 20;
      leave(s, m, "Equipment quit before I did.");
    } else if (m.timer <= 0) {
      leaveSweat(s,i,m.type);
      m.activity++;
      if (m.activity >= m.routine.length) {
        if (m.score >= 85) visitorThought(s, m, "good");
        leave(
          s,
          m,
          m.score >= 70
            ? "Finished my whole routine. Gains secured."
            : m.feedback,
        );
      } else if (!rest(s, m)) choose(s, m);
    }
  }
  if (Math.floor(s.time / CONFIG.day) !== oldDay) dayEnd(s, oldDay);
  checkBankruptcy(s);
}
export function deserialize(raw: string): State {
  let s = JSON.parse(raw);
  if (
    !s ||
    ![1, 2].includes(s.version) ||
    !Number.isFinite(s.money) ||
    !Number.isFinite(s.time) ||
    s.time < 0 ||
    !Array.isArray(s.items) ||
    !Array.isArray(s.members) ||
    !Array.isArray(s.logs) ||
    !Array.isArray(s.days)
  )
    throw Error("Unsupported or damaged save.");
  s.puddles ??= [];
  if(!Array.isArray(s.puddles)||s.puddles.length>612||s.puddles.some((p:Cell)=>!p||!Number.isInteger(p.x)||!Number.isInteger(p.z)||!roomContains(s.property,p,Boolean(s.expanded))) || new Set(s.puddles.map(key)).size!==s.puddles.length)throw Error("Damaged floor cleanliness.");
  // Retain historical cash, but discard the removed recovery-loan state.
  delete s.loanUsed;
  delete s.loanDays;
  for (const day of s.days) delete day.loanPayment;
  s.bankrupt = Boolean(s.bankrupt) || s.money <= 0;
  delete s.admissionsOpen;
  delete s.hasOpened;
  for (const m of s.members) {
    if (m.name === undefined) m.name = `Member ${m.id}`;
    if (m.appearance === undefined) m.appearance = m.id * 7919;
    if (
      typeof m.name !== "string" ||
      m.name.length > 80 ||
      !Number.isSafeInteger(m.appearance) ||
      m.appearance < 0
    )
      throw Error("Invalid visitor identity.");
  }
  if(s.property !== undefined && !Object.hasOwn(PROPERTIES,s.property))throw Error("Invalid rental property.");
  const legacy = s.version === 1;
  if (legacy) {
    s = {
      ...initial(),
      ...s,
      version: 2,
      time: (s.time / 300) * CONFIG.day,
      spawn: 2,
      items: s.items.map((i: Item) => ({ ...i, lane: [], line: [] })),
      members: [],
      rating: 2.5,
      ratingTrend: 0,
      ratingAnchor: 2.5,
      ratingAnchorTime: (s.time / 300) * CONFIG.day,
      ratingSamples: [],
    };
    log(
      s,
      "Old save upgraded: funds/equipment retained; in-progress visits cleared for the new routine and queue rules.",
    );
  }
  if (
    !Number.isFinite(s.price) ||
    !Number.isFinite(s.seed) ||
    !Number.isFinite(s.nextId) ||
    !Number.isFinite(s.rating) ||
    s.rating < 0 ||
    s.rating > 5 ||
    !Array.isArray(s.ratingSamples) ||
    s.ratingSamples.some(
      (n: unknown) => typeof n !== "number" || !Number.isFinite(n),
    )
  )
    throw Error("Damaged rating state.");
  for (const i of s.items) {
    if (
      !Object.hasOwn(EQUIPMENT, i.kind) ||
      !Number.isFinite(i.condition) ||
      !Array.isArray(i.lane) ||
      !Array.isArray(i.line) ||
      !i.lane.every(inside)
    )
      throw Error("Damaged equipment state.");
  }
  if (s.dumbbellRackVersion === undefined) {
    const racks = s.items.filter((item: Item) => item.kind === "freeweights");
    if (racks.length) {
      for (const item of racks)
        item.lane = item.lane.map((cell: Cell) => ({
          x: cell.x + (item.rotation % 2 ? 1 : 0),
          z: cell.z + (item.rotation % 2 ? 0 : 1),
        }));
      if (validateLayout(s.items,s.property,s.expanded))
        throw Error(
          "Dumbbell racks now need 1 × 2 tiles. Clear space around them in the previous version before loading. Saved data unchanged.",
        );
      s.members = [];
      for (const item of s.items) item.line = [];
      log(
        s,
        "Dumbbell racks upgraded to 1 × 2: queue tiles shifted, funds/equipment retained, in-progress visits cleared.",
      );
    }
    s.dumbbellRackVersion = 2;
  } else if (s.dumbbellRackVersion !== 2)
    throw Error("Unsupported dumbbell rack version.");
  if (validateLayout(s.items,s.property,s.expanded))
    throw Error(
      "Saved layout needs clear equipment and public queue access. Current gym kept; saved data unchanged.",
    );
  const ids = new Set(s.members.map((m: Member) => m.id));
  if (ids.size !== s.members.length) throw Error("Duplicate member IDs.");
  for (const m of s.members) {
    if (m.retriedActivity !== undefined && (!Number.isInteger(m.retriedActivity) || m.retriedActivity < 0 || m.retriedActivity > m.activity))
      throw Error("Damaged visitor retry state.");
    if (m.needs && Object.entries(NEED_CAPS).some(([key, cap]) =>
      !Number.isFinite(m.needs[key] ?? (key === "cleanliness" ? 0 : NaN)) || (m.needs[key] ?? 0) < 0 || (m.needs[key] ?? 0) > cap))
      throw Error("Damaged visitor needs.");
    if (m.thought && (!Object.hasOwn(THOUGHTS, m.thought.topic) ||
      typeof m.thought.text !== "string" || m.thought.text.length > 160 ||
      !Number.isFinite(m.thought.at))) throw Error("Damaged visitor thought.");
    if (m.thoughtTopics && (!Array.isArray(m.thoughtTopics) ||
      m.thoughtTopics.some((topic: unknown) => typeof topic !== "string" || !Object.hasOwn(THOUGHTS, topic))))
      throw Error("Damaged visitor thought history.");
    if(m.dirtSeconds !== undefined && (!Number.isFinite(m.dirtSeconds)||m.dirtSeconds<0))throw Error("Damaged dirt exposure.");
    if (m.noiseSeconds !== undefined && (!Number.isFinite(m.noiseSeconds) || m.noiseSeconds < 0))
      throw Error("Damaged noise exposure.");
    if (
      !Array.isArray(m.routine) ||
      !m.routine.length ||
      !m.routine.every((k: Kind) => Object.hasOwn(EQUIPMENT, k)) ||
      !Number.isInteger(m.activity) ||
      m.activity < 0 ||
      m.activity > m.routine.length ||
      !Array.isArray(m.path) ||
      !["walking", "waiting", "using", "resting", "leaving"].includes(
        m.state,
      ) ||
      !Number.isFinite(m.x) ||
      !Number.isFinite(m.z)
    )
      throw Error("Damaged routine state.");
    if (
      ["walking", "waiting", "using"].includes(m.state) &&
      !s.items.some((i: Item) => i.id === m.target)
    )
      throw Error("Missing reserved equipment.");
  }
  for (const i of s.items) {
    if (
      new Set(i.line).size !== i.line.length ||
      i.line.some(
        (id: number) =>
          !s.members.some(
            (m: Member) =>
              m.id === id &&
              m.target === i.id &&
              ["walking", "waiting"].includes(m.state),
          ),
      )
    )
      throw Error("Damaged queue reservations.");
    const users = s.members.filter(
      (m: Member) => m.target === i.id && m.state === "using",
    );
    if (users.length > 1 || i.line.length > i.lane.length + 1)
      throw Error("Queue over capacity.");
    for (const m of s.members.filter(
      (m: Member) =>
        m.target === i.id && ["walking", "waiting"].includes(m.state),
    ))
      if (!i.line.includes(m.id)) throw Error("Missing queue reservation.");
  }
  if (s.queueVersion === undefined) {
    for (const item of s.items) advanceLine(s, item);
    s.queueVersion = 2;
    log(s, "Queue positions upgraded: green entry is waiting position 1.");
  } else if (s.queueVersion !== 2) throw Error("Unsupported queue version.");
  s.paused = true;
  return s;
}

export function expand(s:State):string {
 if(!s.property)return "Choose a rental first.";
 if(s.expanded)return "This room is already yours.";
 if(s.bankrupt)return "Start a fresh gym.";
 const e=EXPANSIONS[s.property];
 if(s.money-e.cost < rent(s)+e.rent)return "Not enough cash after reserving the increased daily rent.";
 s.money-=e.cost;s.capital-=e.cost;s.expanded=true;
 log(s,`${e.name} purchased for $${e.cost}. Daily rent is now $${rent(s)}.`);
 return "";
}


export function leaveSweat(s:State,item:Item,type:number):boolean {
  if(s.paused||s.bankrupt||random(s)> (type===0 ? .35 : .2))return false;
  // Exercisers step back onto queue tile 1 when finishing. Leave sweat
  // there, where their feet reach the floor, rather than scattering it nearby.
  const tile=access(item);
  if(!roomContains(s.property,tile,Boolean(s.expanded))||same(tile,ENTRANCE)||doorwayReserved(s.property,tile)||(s.puddles??[]).some(p=>same(p,tile)))return false;
  (s.puddles??=[]).push({...tile});
  return true;
}
export function cleanPuddle(s:State,c:Cell):boolean {
  const index=(s.puddles??[]).findIndex(p=>same(p,c));
  if(index<0)return false;
  s.puddles!.splice(index,1);return true;
}
