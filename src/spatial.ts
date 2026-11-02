import {roomContains, doorwayReserved, canStep, type PropertyId} from "./properties";
export type Kind = "rack" | "bike" | "freeweights" | "treadmill";
export type Cell = { x: number; z: number };
export const SIZE = 18;
export const MIN_X = -16;
export const ENTRANCE: Cell = { x: 5, z: 11 };
export const EQUIPMENT = {
  treadmill: { name: "Treadmill", price: 350, repair: 60, wear: 0.16, w: 1, d: 2 },
  rack: { name: "Squat rack", price: 450, repair: 65, wear: 0.18, w: 2, d: 2 },
  freeweights: { name: "Dumbbell rack", price: 180, repair: 35, wear: 0.08, w: 1, d: 2 },
  bike: { name: "Exercise bike", price: 250, repair: 50, wear: 0.25, w: 1, d: 2 },
};
export interface Footprint extends Cell {
  kind: Kind;
  rotation: number;
  id: number;
  lane: Cell[];
}
export const key = (c: Cell) => `${c.x},${c.z}`;
export const same = (a: Cell, b: Cell) => key(a) === key(b);
export const inside = (c: Cell) =>
  Number.isInteger(c.x) &&
  Number.isInteger(c.z) &&
  c.x >= MIN_X &&
  c.z >= 0 &&
  c.x < SIZE &&
  c.z < SIZE;
export const neighbors = (c: Cell) =>
  [
    { x: c.x + 1, z: c.z },
    { x: c.x - 1, z: c.z },
    { x: c.x, z: c.z + 1 },
    { x: c.x, z: c.z - 1 },
  ].filter(inside);
export function dimensions(item: Pick<Footprint, "kind" | "rotation">) {
  const d = EQUIPMENT[item.kind];
  return item.rotation % 2 ? { w: d.d, d: d.w } : { w: d.w, d: d.d };
}
export function cells(item: Pick<Footprint, "kind" | "rotation" | "x" | "z">) {
  const { w, d } = dimensions(item);
  return Array.from({ length: w * d }, (_, i) => ({
    x: item.x + (i % w),
    z: item.z + Math.floor(i / w),
  }));
}
export function access(
  item: Pick<Footprint, "kind" | "rotation" | "x" | "z">,
): Cell {
  const { w, d } = dimensions(item);
  switch (item.rotation) {
    case 1: return {x:item.x+w,z:item.z};
    case 2: return {x:item.x+w-1,z:item.z-1};
    case 3: return {x:item.x-1,z:item.z+d-1};
    default: return {x:item.x,z:item.z+d};
  }
}
// Workouts return to the queue entry; no separate exit footprint.
export const exit = access;
export function blockedCells(
  items: Footprint[],
  publicOnly = false,
  own?: number,
  property?: PropertyId,
  expanded=false,
) {
  return new Set(
    [...Array.from({length:(SIZE-MIN_X)*SIZE},(_,n)=>({x:MIN_X+n%(SIZE-MIN_X),z:Math.floor(n/(SIZE-MIN_X))})).filter(c=>!roomContains(property,c,expanded)), ...items
      .flatMap((i) => [
        ...cells(i),
        ...(publicOnly && i.id !== own ? [access(i), ...i.lane] : []),
      ])]
      .map(key),
  );
}
export function findPath(
  blocked: Set<string>,
  from: Cell,
  to: Cell,
  property?: PropertyId,
): Cell[] | null {
  const start = { x: Math.round(from.x), z: Math.round(from.z) };
  if (!inside(start) || !inside(to) || blocked.has(key(to))) return null;
  const queue = [start],
    seen = new Set([key(start)]),
    parents = new Map<string, Cell>();
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i];
    if (same(c, to)) {
      const path: Cell[] = [];
      let p = c;
      while (!same(p, start)) {
        path.unshift(p);
        p = parents.get(key(p))!;
      }
      // A visitor can be mid-step when the queue advances. Rounding to the
      // destination tile is not the same as reaching its exact standing point.
      if (!path.length && Math.hypot(from.x - to.x, from.z - to.z) >= 0.01)
        return [{ ...to }];
      return path;
    }
    for (const n of neighbors(c)) {
      if (!canStep(property,c,n) || blocked.has(key(n)) || seen.has(key(n))) continue;
      seen.add(key(n));
      parents.set(key(n), c);
      queue.push(n);
    }
  }
  return null;
}
export function pathTo(
  items: Footprint[],
  from: Cell,
  to: Cell,
  property?: PropertyId,
  expanded=false,
): Cell[] | null {
  return findPath(blockedCells(items,false,undefined,property,expanded), from, to,property);
}
export function route(items: Footprint[], from: Cell, to: Cell, own?: number, property?: PropertyId, expanded=false) {
  return findPath(blockedCells(items, true, own, property,expanded), from, to,property);
}
export function validateLayout(items: Footprint[], property?: PropertyId, expanded=false): string {
  if (items.some(i => !Number.isInteger(i.rotation) || i.rotation < 0 || i.rotation > 3))
    return "Invalid equipment rotation.";
  const used = new Set<string>();
  for (const i of items) {
    for (const c of cells(i)) {
      if (!inside(c) || !roomContains(property,c,expanded)) return "Keep equipment inside the room.";
      if (doorwayReserved(property,c))return "Keep the permanent expansion doorway and approach clear.";
      if (same(c, ENTRANCE)) return "Keep the entrance clear.";
      if (used.has(key(c))) return "Equipment or queue overlap.";
      used.add(key(c));
    }
  }
  for (const i of items) {
    let previous = access(i);
    for (const c of [access(i), ...i.lane]) {
      if(doorwayReserved(property,c))return "Keep the permanent expansion doorway and approach clear.";
      if (!inside(c) || !roomContains(property,c,expanded) || same(c, ENTRANCE))
        return "Keep access and queue tiles inside the room and away from the entrance.";
      if (used.has(key(c)))
        return "Equipment, access, or queue overlap; leave a walking route.";
      if (
        !same(c, access(i)) &&
        (Math.abs(c.x - previous.x) + Math.abs(c.z - previous.z) !== 1 || !canStep(property,previous,c))
      )
        return "Queue tiles must connect edge to edge.";
      used.add(key(c));
      previous = c;
    }
  }
  // All reserved areas must have access from the public walking network.
  const publicBlocked = blockedCells(items, true, undefined, property,expanded);
  for (const i of items) {
    const tail = i.lane.at(-1) ?? access(i);
    if (
      !neighbors(tail).some(
        (n) =>
          canStep(property,tail,n) &&
          !publicBlocked.has(key(n)) &&
          findPath(publicBlocked, ENTRANCE, n,property) !== null,
      )
    )
      return "Leave a public walking route to the back of every queue.";
    if (!route(items, ENTRANCE, access(i), i.id, property,expanded))
      return "Leave a walking route to every access marker.";
  }
  return "";
}
