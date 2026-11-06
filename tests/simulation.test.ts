import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initial,
  cleanPuddle,
  leaveSweat,
  expand,
  rent,
  buy,
  tick,
  repair,
  toggleEquipment,
  sell,
  availableFunds,
  deserialize,
  CONFIG,
  access,
  exit,
  pathTo,
  setLane,
  choose,
  admit,
  ratingTarget,
  visitorThought,
  needPenalty,
  equipmentAppeal,
  arrivalInterval,
  type State,
  type Member,
} from "../src/simulation.ts";
function gym() {
  const s = initial();
  assert.equal(buy(s, "rack", 1, 1, 0), "");
  assert.equal(buy(s, "bike", 7, 1, 0), "");
  return s;
}
function member(s: State, overrides: Partial<Member> = {}): Member {
  const m: Member = {
    id: s.nextId++,
    type: 1,
    name: "Test Member",
    appearance: 7919,
    x: 7,
    z: 3,
    target: null,
    state: "walking",
    path: [],
    timer: 0,
    wait: 0,
    score: 90,
    feedback: "",
    routine: ["bike", "bike"],
    activity: 0,
    restCell: null,
    ...overrides,
  };
  s.members.push(m);
  return m;
}
function run(s: State, seconds: number) {
  s.paused = false;
  for (let i = 0; i < seconds * 20; i++) tick(s, 0.05);
}
test("pause freezes all timed state while purchases still work", () => {
  const s = initial();
  assert.equal(buy(s, "bike", 2, 2, 0), "");
  const before = JSON.stringify(s);
  tick(s, 300);
  assert.equal(JSON.stringify(s), before);
  assert.equal(s.money, 1550);
});
test("invalid placement is atomic, preserves funds and entrance", () => {
  const s = initial();
  assert.match(buy(s, "rack", 5, 10, 0), /entrance/);
  assert.equal(s.money, 1800);
  assert.equal(s.items.length, 0);
  buy(s, "rack", 2, 2, 0);
  assert.match(buy(s, "bike", 2, 2, 0), /overlap/);
  assert.equal(s.items.length, 1);
});
test("access cell cannot be blocked by equipment", () => {
  const s = initial();
  buy(s, "bike", 2, 2, 0);
  assert.match(buy(s, "rack", 2, 4, 0), /walking route/);
  assert.ok(pathTo(s.items, { x: 5, z: 11 }, access(s.items[0])));
});
test("busy equipment cannot move, repair, sell, or edit its lane", () => {
  const s = gym();
  const i = s.items[1],
    m = member(s);
  choose(s, m);
  const money = s.money;
  assert.match(buy(s, "bike", 6, 2, 0, i.id), /idle/);
  assert.match(repair(s, i.id), /idle/);
  assert.match(sell(s, i.id), /idle/);
  assert.match(setLane(s, i.id, []), /idle/);
  assert.equal(s.money, money);
});
test("admission charges only once across a multi-activity visit", () => {
  const s = gym();
  s.spawn = 9999;
  const cash = s.money;
  const m = admit(s, 1)!;
  m.routine = ["bike", "bike"]; // Keep this payment regression independent of randomized length.
  run(s, 100);
  assert.equal(s.money, cash + 15);
  assert.equal(s.profit, 15);
  assert.ok(!s.members.includes(m));
  assert.equal(s.visits.length, 1);
  assert.equal(s.visits[0].completed, true);
});
test("rent is charged once at each day boundary", () => {
  const s = initial();
  s.paused = false;
  s.time = CONFIG.day - 0.01;
  s.spawn = 999;
  tick(s, 0.02);
  assert.equal(s.money, 1680);
  assert.equal(s.days[0].profit, -120);
  assert.equal(availableFunds(s), 1560);
});

test("save round trip preserves state and RNG but restores paused", () => {
  const s = gym();
  s.paused = false;
  tick(s, 3);
  assert.deepEqual(deserialize(JSON.stringify(s)), { ...s, paused: true });
  assert.throws(() => deserialize('{"version":9}'));
});
test("repairs and capital transactions have distinct accounting", () => {
  const s = gym(),
    i = s.items[1];
  assert.equal(s.profit, 0);
  i.condition = 5;
  i.broken = true;
  repair(s, i.id);
  assert.equal(i.condition, 100);
  assert.equal(i.broken, false);
  assert.equal(s.profit, -50);
  sell(s, i.id);
  assert.equal(s.profit, -50);
});
test("deterministic active queues and routines survive save/resume", () => {
  const a = gym();
  setLane(a, a.items[1].id, [
    { x: 7, z: 4 },
    { x: 7, z: 5 },
  ]);
  run(a, 60);
  const b = deserialize(JSON.stringify(a));
  b.paused = false;
  run(a, 30);
  run(b, 30);
  assert.deepEqual(a, b);
});
test("warnings precede dangerous equipment use", () => {
  const s = gym(),
    i = s.items[1];
  s.spawn = 999;
  i.condition = 25.01;
  member(s, { target: i.id, state: "using", timer: 500 });
  run(s, 5);
  assert.equal(i.broken, false);
  assert.equal(i.warned, true);
  assert.ok(s.logs.some((l) => l.includes("MAINTENANCE WARNING")));
});
test("success requires all archetypes and three profitable days", () => {
  const s = initial();
  s.days = [
    { profit: 10, visits: [] },
    { profit: 10, visits: [] },
  ];
  s.profit = 200;
  s.time = CONFIG.day - 0.01;
  s.spawn = 999;
  s.paused = false;
  tick(s, 0.02);
  assert.equal(s.won, false);
  s.days = [
    {
      profit: 10,
      visits: [0, 1, 2].flatMap((type) =>
        Array.from({ length: 3 }, () => ({ type, score: 80 })),
      ),
    },
    { profit: 10, visits: [] },
  ];
  s.profit = 200;
  s.time = CONFIG.day * 2 - 0.01;
  tick(s, 0.02);
  assert.equal(s.won, true);
});
test("injury disables equipment without repeated charges", () => {
  const s = gym(),
    i = s.items[1];
  s.spawn = 99999;
  i.condition = 5;
  i.warned = true;
  s.seed = 1972;
  member(s, { target: i.id, state: "using", timer: 9999 });
  s.paused = false;
  for (let n = 0; n < 10000 && !i.broken; n++) tick(s, 0.05);
  assert.equal(i.broken, true);
  assert.equal(s.logs.filter((l) => l.startsWith("INJURY:")).length, 1);
  const money = s.money;
  run(s, 5);
  assert.equal(s.money, money);
});
test("queue lanes must be connected, unique, and non-overlapping", () => {
  const s = gym(),
    i = s.items[1];
  assert.match(setLane(s, i.id, [{ x: 7, z: 5 }]), /connect/);
  assert.equal(
    setLane(s, i.id, [
      { x: 7, z: 4 },
      { x: 7, z: 5 },
    ]),
    "",
  );
  const before = JSON.stringify(i.lane);
  assert.match(
    setLane(s, i.id, [
      { x: 7, z: 4 },
      { x: 7, z: 3 },
    ]),
    /overlap/,
  );
  assert.equal(JSON.stringify(i.lane), before);
  assert.match(buy(s, "bike", 7, 4, 0), /overlap/);
});
test("a queue cannot seal public access to another lane", () => {
  const s = initial();
  buy(s, "bike", 0, 0, 0);
  buy(s, "bike", 8, 0, 0);
  const i = s.items[0];
  const wall = Array.from({ length: 12 }, (_, x) => ({ x, z: 3 }));
  assert.match(
    setLane(s, i.id, [{ x: 0, z: 3 }, ...wall.slice(1)]),
    /walking route/,
  );
});
test("FIFO respects reservation order even when a later member arrives first", () => {
  const s = gym(),
    i = s.items[1];
  setLane(s, i.id, [
    { x: 7, z: 4 },
    { x: 7, z: 5 },
  ]);
  s.spawn = 999;
  const first = member(s, { x: 5, z: 11 }),
    second = member(s, { x: 7, z: 4 });
  choose(s, first);
  choose(s, second);
  run(s, 1);
  assert.notEqual(second.state, "using");
  assert.deepEqual(i.line, [first.id, second.id]);
  run(s, 10);
  assert.equal(first.state, "using");
  assert.notEqual(second.state, "using");
  assert.equal(second.state, "waiting");
  assert.deepEqual({ x: second.x, z: second.z }, access(i));
});
test("full queues allow a breather without overflow and alternatives are preferred", () => {
  const s = gym(),
    i = s.items[1];
  const a = member(s);
  choose(s, a);
  const b = member(s);
  assert.equal(choose(s, b), false);
  assert.equal(b.state, "resting");
  assert.equal(b.retriedActivity, 0);
  assert.equal(b.timer, CONFIG.retryRest);
  assert.equal(i.line.length, 1);
  buy(s, "bike", 9, 1, 0);
  const c = member(s);
  assert.equal(choose(s, c), true);
  assert.equal(c.target, s.items[2].id);
});
test("waiting gradually lowers happiness and abandonment releases the slot", () => {
  const s = gym(),
    i = s.items[1];
  setLane(s, i.id, [{ x: 7, z: 4 }]);
  s.spawn = 999;
  member(s, { state: "using", target: i.id, timer: 100 });
  const m = member(s, { x: 7, z: 4 });
  choose(s, m);
  const score = m.score;
  run(s, 10);
  assert.ok(m.score < score);
  run(s, 30);
  assert.equal(i.line.includes(m.id), false);
  assert.ok(!s.members.includes(m) || m.state === "leaving");
});
test("routine rest releases equipment and occupies a general walking tile", () => {
  const s = gym(),
    i = s.items[1];
  s.spawn = 999;
  const m = member(s, { state: "using", target: i.id, timer: 0.01 });
  run(s, 0.1);
  assert.equal(m.state, "resting");
  assert.equal(m.target, null);
  assert.equal(m.activity, 1);
  assert.ok(m.restCell);
  assert.notDeepEqual(m.restCell, access(i));
  assert.ok(
    !s.items
      .flatMap((i) => i.lane)
      .some((c) => c.x === m.restCell!.x && c.z === m.restCell!.z),
  );
});
test("returning for a second activity joins behind existing reservations", () => {
  const s = gym(),
    i = s.items[1];
  setLane(s, i.id, [
    { x: 7, z: 4 },
    { x: 7, z: 5 },
  ]);
  const first = member(s, { state: "using", target: i.id, timer: 0.01 });
  const second = member(s, { x: 5, z: 11 });
  choose(s, second);
  s.spawn = 999;
  run(s, 8);
  assert.ok(second.state === "using" || i.line[0] === second.id);
  assert.notEqual(first.state, "using");
  if (second.state !== "using")
    assert.ok(i.line.indexOf(second.id) < i.line.indexOf(first.id));
});
test("rating is bounded, gradual, and variety is duplicate-neutral", () => {
  const s = gym();
  s.spawn = 999;
  s.ratingSamples = [20, 20];
  const appeal = equipmentAppeal(s);
  buy(s, "bike", 9, 1, 0);
  assert.equal(equipmentAppeal(s), appeal);
  const previous = s.rating;
  run(s, 1);
  assert.ok(Math.abs(s.rating - previous) < 0.1);
  assert.ok(s.rating >= 0 && s.rating <= 5);
  const cheap = ratingTarget(s);
  s.price = 30;
  assert.ok(ratingTarget(s) < cheap);
});
test("popularity and rush increase bounded demand", () => {
  const s = initial();
  s.rating = 1;
  const quiet = arrivalInterval(s);
  s.time = 60;
  assert.ok(arrivalInterval(s) < quiet);
  const low = arrivalInterval(s);
  s.rating = 5;
  assert.ok(arrivalInterval(s) < low);
  run(s, 80);
  assert.ok(s.members.length <= CONFIG.maxMembers);
});
test("legacy saves migrate money/equipment/day phase and explicitly reset active visits", () => {
  const s = gym();
  const legacy = {
    ...s,
    version: 1,
    time: 450,
    items: s.items.map(({ lane, line, ...i }) => i),
  };
  const upgraded = deserialize(JSON.stringify(legacy));
  assert.equal(upgraded.version, 2);
  assert.equal(upgraded.time, 180);
  assert.equal(upgraded.money, s.money);
  assert.deepEqual(
    upgraded.items.map((i) => i.lane),
    [[], []],
  );
  assert.equal(upgraded.paused, true);
  assert.ok(upgraded.logs[0].includes("Old save upgraded"));
});
test("damaged queues and routine saves are rejected", () => {
  const s = gym();
  s.items[1].line = [999];
  assert.throws(() => deserialize(JSON.stringify(s)));
  s.items[1].line = [];
  member(s, { routine: [] });
  assert.throws(() => deserialize(JSON.stringify(s)));
});
test("adequate capacity and queue space outperform a cramped layout under identical arrivals", () => {
  function scenario(expanded: boolean) {
    const s = initial();
    buy(s, "rack", 1, 1, 0);
    buy(s, "bike", 8, 1, 0);
    if (expanded) {
      buy(s, "rack", 4, 1, 0);
      buy(s, "bike", 10, 1, 0);
      for (const i of s.items)
        assert.equal(
          setLane(s, i.id, [
            { x: i.x, z: 4 },
            { x: i.x, z: 5 },
          ]),
          "",
        );
    }
    assert.equal(buy(s, "freeweights", 6, 7, 0), "");
    assert.equal(setLane(s, s.items.at(-1)!.id, [{ x: 6, z: 10 }]), "");
    s.money = 1800;
    s.paused = false;
    s.spawn = 99999;
    for (let n = 0; n < 4800; n++) {
      if (n % 140 === 0) admit(s, Math.floor(n / 140) % 3);
      tick(s, 0.05);
      for (const i of s.items) {
        assert.ok(
          s.members.filter((m) => m.target === i.id && m.state === "using")
            .length <= 1,
        );
        const standing = s.members.filter(
          (m) => m.target === i.id && m.state === "waiting",
        );
        assert.equal(
          new Set(standing.map((m) => `${m.x},${m.z}`)).size,
          standing.length,
        );
      }
    }
    const visits = [...s.days.flatMap((d) => d.visits), ...s.visits];
    return {
      completed: visits.filter((v) => v.completed).length,
      score: visits.reduce((a, v) => a + v.score, 0) / visits.length,
    };
  }
  const cramped = scenario(false),
    spacious = scenario(true);
  // Both layouts now offer fast free-weight sessions, narrowing the old two-kind completion gap.
  assert.ok(spacious.completed > cramped.completed);
  assert.ok(spacious.score > cramped.score + 5);
});
test("unaffordable prices damage popularity and reduce arrivals over time", () => {
  function scenario(price: number) {
    const s = gym();
    s.price = price;
    run(s, 120);
    return s;
  }
  const affordable = scenario(15),
    expensive = scenario(30);
  assert.ok(expensive.rating < affordable.rating);
  assert.ok(
    [...expensive.days.flatMap((d) => d.visits), ...expensive.visits].length <
      [...affordable.days.flatMap((d) => d.visits), ...affordable.visits]
        .length,
  );
});

test("former exit tiles can become queue tiles or equipment", () => {
 const s=gym(),i=s.items[1];
 assert.equal(setLane(s,i.id,[{x:8,z:3}]),"");
 const other=gym();assert.equal(buy(other,"bike",8,3,0),"");
});
test("completed visitors leave through waiting tiles without getting stuck", () => {
  const s = gym(),
    i = s.items[1];
  setLane(s, i.id, [
    { x: 7, z: 4 },
    { x: 7, z: 5 },
  ]);
  s.spawn = 999;
  const m = member(s, {
    target: i.id,
    state: "using",
    timer: 0.01,
    activity: 1,
  });
  run(s, 0.05);
  assert.equal(m.state, "leaving");
  assert.deepEqual(m.path[0], exit(i));
  assert.deepEqual(m.path.slice(0,3),[access(i),...i.lane]);
  run(s,30);assert.ok(!s.members.some(n=>n.id===m.id));
});
test("between-activity rest uses the queue and saves its pending transition", () => {
  const s = gym(),
    i = s.items[1];
  setLane(s, i.id, [{ x: 7, z: 4 }]);
  s.spawn = 999;
  const m = member(s, { target: i.id, state: "using", timer: 0.01 });
  run(s, 0.05);
  assert.equal(m.state, "resting");
  assert.deepEqual(m.path[0], exit(i));
  assert.deepEqual(m.exitVia, i.lane.at(-1));
  assert.deepEqual(deserialize(JSON.stringify(s)), { ...s, paused: true });
  run(s, 2);
  assert.equal(m.exitVia, undefined);
});

test("available funds reserve the next rent immediately without a forecast", () => {
  const s = initial();
  assert.equal(availableFunds(s), 1680);
  buy(s, "bike", 2, 2, 0);
  assert.equal(availableFunds(s), 1430);
});
test("purchases and repairs cannot consume reserved rent", () => {
  const s = gym();
  s.money = CONFIG.rent + 249;
  const before = s.money;
  assert.match(buy(s, "bike", 9, 1, 0), /reserving rent/);
  assert.equal(s.money, before);
  s.items[1].condition = 20;
  s.money = CONFIG.rent + 49;
  assert.match(repair(s, s.items[1].id), /reserving rent/);
  assert.equal(s.items[1].condition, 20);
});
test("zero disposable funds can still operate and earn admission before rent is due", () => {
  const s = gym();
  s.money = CONFIG.rent;
  s.paused = false;
  s.spawn = 0;
  tick(s, 0.05);
  assert.equal(s.money, CONFIG.rent + 15);
  assert.equal(s.bankrupt, false);
});
test("rent exhaustion causes permanent game over and no financial actions can revive it", () => {
  const s = gym();
  s.money = CONFIG.rent;
  s.time = CONFIG.day - 0.01;
  s.spawn = 999;
  s.paused = false;
  tick(s, 0.02);
  assert.equal(s.money, 0);
  assert.equal(s.bankrupt, true);
  assert.equal(s.paused, true);
  assert.match(sell(s, s.items[0].id), /bankrupt/);
  assert.match(buy(s, "bike", 9, 1, 0), /bankrupt/);
  const time = s.time;
  s.paused = false;
  tick(s, 1);
  assert.equal(s.time, time);
});
test("old recovery loan fields are discarded on load without changing cash", () => {
  const s = gym();
  const loaded = deserialize(
    JSON.stringify({
      ...s,
      loanUsed: true,
      loanDays: 10,
      days: [{ profit: 100, visits: [], loanPayment: 54 }],
    }),
  );
  assert.equal(loaded.money, s.money);
  assert.ok(!("loanDays" in loaded));
  assert.ok(!("loanUsed" in loaded));
  assert.ok(!("loanPayment" in loaded.days[0]));
  assert.equal(loaded.bankrupt, false);
});
test("bankrupt saves stay bankrupt when reloaded", () => {
  const s = gym();
  s.money = 0;
  const loaded = deserialize(JSON.stringify(s));
  assert.equal(loaded.bankrupt, true);
  assert.equal(loaded.paused, true);
});

test("resuming immediately enables admissions without a second control",()=>{
 const s=initial();buy(s,"bike",2,2,0);s.paused=false;
 for(let n=0;n<41;n++)tick(s,0.05);assert.ok(s.money>1550);assert.ok(s.spawn>0);
});
test("paused arrivals do not accumulate a burst",()=>{
 const s=gym();const spawn=s.spawn;tick(s,120);assert.equal(s.spawn,spawn);
 s.paused=false;tick(s,0.05);assert.equal(s.members.length,0);
});
test("old open/closed state is discarded and saves always restore paused",()=>{
 const s=gym();const raw={...s,admissionsOpen:false,hasOpened:false};
 const loaded=deserialize(JSON.stringify(raw));
 assert.equal(loaded.paused,true);assert.equal("admissionsOpen" in loaded,false);assert.equal("hasOpened" in loaded,false);
 loaded.paused=false;loaded.spawn=0;tick(loaded,0.05);assert.ok(loaded.members.length>0);
});
test("visitor identities and varied routines are seeded and persist", () => {
  const a = gym(),
    b = gym();
  const lengths = new Set<number>(),
    names = new Set<string>(),
    appearances = new Set<number>();
  for (let i = 0; i < 60; i++) {
    const x = admit(a, i % 3)!,
      y = admit(b, i % 3)!;
    assert.deepEqual(x, y);
    assert.ok(x.name);
    assert.ok(Number.isInteger(x.appearance));
    lengths.add(x.routine.length);
    names.add(x.name!);
    appearances.add(x.appearance!);
    assert.ok(x.routine.length >= 1 && x.routine.length <= 3);
  }
  assert.equal(lengths.size, 3);
  assert.ok(names.size > 20);
  assert.ok(appearances.size > 40);
  assert.deepEqual(deserialize(JSON.stringify(a)).members, a.members);
});
test("routine choices retain archetype preferences without being identical", () => {
  const s = gym();
  const counts = Array.from({ length: 3 }, () => ({
    rack: 0,
    bike: 0,
    freeweights: 0,
  }));
  for (let i = 0; i < 300; i++) {
    const type = i % 3;
    const m = admit(s, type)!;
    for (const kind of m.routine) counts[type][kind]++;
  }
  assert.ok(counts[0].rack > counts[0].bike * 3);
  assert.ok(counts[0].bike > 0);
  assert.ok(counts[1].bike > counts[1].rack * 3);
  assert.ok(counts[1].rack > 0);
  assert.ok(counts[2].rack > 0 && counts[2].bike > 0);
  assert.ok(counts[0].freeweights > 0 && counts[2].freeweights > 0);
});
test("older visitor saves acquire stable identity without consuming RNG", () => {
  const s = gym();
  const m = member(s, { state: "resting", timer: 4, restCell: { x: 7, z: 3 } });
  const old: any = JSON.parse(JSON.stringify(s));
  delete old.members[0].name;
  delete old.members[0].appearance;
  const restored = deserialize(JSON.stringify(old));
  assert.equal(restored.seed, s.seed);
  assert.equal(restored.members[0].name, `Member ${m.id}`);
});

test("maintenance warning happens once below 25 percent and resets after repair", () => {
  const s = gym(),
    item = s.items[0];
  s.spawn = 9999;
  item.condition = 25.1;
  const m = member(s, { type: 0, target: item.id, state: "using", timer: 500 });
  s.paused = false;
  tick(s, 0.1);
  assert.equal(item.warned, false);
  tick(s, 0.6);
  assert.equal(item.warned, true);
  const warnings = () =>
    s.logs.filter((l) => l.includes("MAINTENANCE WARNING")).length;
  assert.equal(warnings(), 1);
  tick(s, 1);
  assert.equal(warnings(), 1);
  s.members = [];
  assert.equal(repair(s, item.id), "");
  assert.equal(item.warned, false);
  assert.equal(item.condition, 100);
  item.condition = 24.9;
  s.members = [m];
  tick(s, 0.1);
  assert.equal(warnings(), 2);
  const loaded = deserialize(JSON.stringify({ ...s, members: [] }));
  assert.equal(loaded.items[0].warned, true);
});

test("first waiter uses entry tile while the current visitor exercises inside", () => {
  const s = gym(),
    item = s.items[1];
  setLane(s, item.id, [
    { x: 7, z: 4 },
    { x: 7, z: 5 },
  ]);
  s.spawn = 9999;
  member(s, { target: item.id, state: "using", timer: 100 });
  const first = member(s, { x: 7, z: 3 }),
    second = member(s, { x: 7, z: 4 }),
    third = member(s, { x: 7, z: 5 });
  assert.equal(choose(s, first), true);
  assert.equal(choose(s, second), true);
  assert.equal(choose(s, third), true);
  const fourth = member(s);
  assert.equal(choose(s, fourth), false);
  run(s, 0.1);
  assert.deepEqual({ x: first.x, z: first.z }, access(item));
  assert.deepEqual({ x: second.x, z: second.z }, item.lane[0]);
  assert.deepEqual({ x: third.x, z: third.z }, item.lane[1]);
  assert.equal(first.state, "waiting");
  assert.deepEqual(iIds(item), [first.id, second.id, third.id]);
  function iIds(i: typeof item) {
    return i.line;
  }
  assert.equal(deserialize(JSON.stringify(s)).items[1].line.length, 3);
});

test("older queue saves reroute the first waiter to entry", () => {
  const s = gym(),
    item = s.items[1];
  setLane(s, item.id, [{ x: 7, z: 4 }]);
  member(s, { state: "using", target: item.id, timer: 100 });
  const waiter = member(s, { x: 7, z: 4 });
  choose(s, waiter);
  waiter.state = "waiting";
  waiter.path = [];
  const old: any = JSON.parse(JSON.stringify(s));
  delete old.queueVersion;
  const loaded = deserialize(JSON.stringify(old));
  const restored = loaded.members.find((m) => m.id === waiter.id)!;
  assert.deepEqual(restored.path.at(-1), access(item));
  assert.equal(restored.state, "walking");
  assert.equal(loaded.paused, true);
});

test("dumbbell racks occupy two tiles, reserve a queue, and survive saving", () => {
  const s = initial();
  assert.equal(buy(s, "freeweights", 3, 3, 1), "");
  assert.equal(s.money, 1620);
  const i = s.items[0];
  assert.equal(setLane(s, i.id, [{ x: 6, z: 3 }]), "");
  assert.deepEqual(deserialize(JSON.stringify(s)).items, s.items);
  const bad = JSON.parse(JSON.stringify(s));
  bad.items[0].kind = "unknown";
  assert.throws(() => deserialize(JSON.stringify(bad)));
});

test("free weights offer a short workout and release their queue slot", () => {
  const s = initial();
  buy(s, "freeweights", 3, 3, 0);
  const i = s.items[0];
  const m = member(s, { ...access(i), type: 0, routine: ["freeweights"] });
  choose(s, m);
  s.paused = false;
  tick(s, 0.05);
  assert.equal(m.state, "using");
  assert.ok(m.timer >= 11 && m.timer < 16);
  assert.equal(i.line.length, 0);
  for (let n = 0; n < 350; n++) tick(s, 0.05);
  assert.notEqual(m.state, "using");
  assert.ok(i.condition < 100);
  i.condition = 20;
  assert.equal(repair(s, i.id), "");
  assert.equal(i.condition, 100);
});

test("legacy 1x1 dumbbell racks shift queues once and preserve funds", () => {
  const s = initial();
  buy(s, "freeweights", 3, 3, 0);
  const old: any = JSON.parse(JSON.stringify(s));
  delete old.dumbbellRackVersion;
  old.items[0].lane = [{ x: 3, z: 5 }];
  const loaded = deserialize(JSON.stringify(old));
  assert.deepEqual(loaded.items[0].lane, [{ x: 3, z: 6 }]);
  assert.equal(loaded.money, s.money);
  assert.deepEqual(deserialize(JSON.stringify(loaded)).items, loaded.items);
  const blocked = JSON.parse(JSON.stringify(old));
  blocked.items.push({
    ...old.items[0],
    id: 999,
    kind: "bike",
    x: 3,
    z: 4,
    lane: [],
  });
  assert.throws(() => deserialize(JSON.stringify(blocked)), /1 × 2/);
});


test("switching equipment off releases users and queues and permits repair", () => {
  const s = gym(), item = s.items[1];
  item.condition = 40;
  const active = member(s, { target: item.id, state: "using", x: 7, z: 3, timer: 50 });
  const waiting = member(s, { target: item.id, state: "waiting" });
  item.line = [waiting.id];
  assert.equal(toggleEquipment(s, item.id), "");
  assert.equal(item.enabled, false);
  assert.equal(item.line.length, 0);
  assert.notEqual(active.target, item.id);
  assert.notEqual(waiting.target, item.id);
  assert.equal(repair(s, item.id), "");
  const newcomer = member(s);
  assert.equal(choose(s, newcomer), false);
  const restored = deserialize(JSON.stringify(s));
  assert.equal(restored.items[1].enabled, false);
  assert.equal(toggleEquipment(s, item.id), "");
  assert.equal(choose(s, member(s)), true);
});

test("equipment wears at different rates only while used", () => {
  const results: number[] = [];
  for (const kind of ["bike", "rack", "freeweights"] as const) {
    const s = initial();
    buy(s, kind, 2, 2, 0);
    const item = s.items[0];
    member(s, { target: item.id, state: "using", timer: 100, routine: [kind] });
    s.paused = false;
    tick(s, 10);
    results.push(item.condition);
  }
  assert.deepEqual(results, [97.5, 98.2, 99.2]);
});

test("queue grace applies once per wait and only excess time is penalized", () => {
  const s = gym(), item = s.items[1];
  member(s, { target: item.id, state: "using", timer: 100 });
  const waiter = member(s, { target: item.id, state: "waiting", score: 90 });
  item.line = [waiter.id];
  s.paused = false;
  tick(s, 4);
  assert.equal(waiter.score, 90);
  tick(s, 3);
  assert.equal(waiter.score, 89.2);
});

test("finishing exercise retains the visitor while walking through the exit", () => {
  const s = initial();
  buy(s, "rack", 2, 2, 0);
  const item = s.items[0];
  assert.equal(setLane(s, item.id, [{x:2,z:5}, {x:2,z:6}]), "");
  const m = member(s, { type:0, x:2,z:4,target:item.id,state:"using",timer:0.01,routine:["rack"] });
  s.paused = false;
  tick(s, 0.02);
  assert.equal(m.state, "leaving");
  assert.deepEqual(m.path[0], exit(item));
  assert.ok(m.path.length > 1);
  tick(s, 0.02);
  assert.ok(s.members.includes(m));
});


test("a first waiter mid-step inside the entry tile finishes walking and uses the idle bike", () => {
  const s = gym(), item = s.items[1];
  const m = member(s, { x:7.3, z:3, routine:["bike"] });
  assert.equal(choose(s, m), true);
  assert.deepEqual(m.path, [access(item)]);
  s.paused = false;
  for (let n=0;n<10;n++) tick(s,0.05);
  assert.equal(m.state,"using");
  assert.equal(m.x,7);
  assert.equal(m.z,3);
  assert.equal(item.line.length,0);
});

test("queue advancement mid-step cannot leave the first waiter stuck forever", () => {
  const s = gym(), item = s.items[1];
  setLane(s,item.id,[{x:7,z:4}]);
  const active = member(s,{target:item.id,state:"using",timer:0.01,routine:["bike"]});
  const first = member(s,{x:7.3,z:3,target:item.id,state:"walking",path:[{x:7,z:3}],routine:["bike"]});
  item.line=[first.id];
  s.paused=false;
  tick(s,0.05);
  for(let n=0;n<10;n++) tick(s,0.05);
  assert.equal(first.state,"using");
  assert.notEqual(active.state,"using");
  assert.equal(item.line.length,0);
});


test("resuming a saved stalled queue repairs its missing final step", () => {
  const s = gym(), item=s.items[1];
  const m=member(s,{x:7.3,z:3,target:item.id,state:"waiting",path:[],routine:["bike"]});
  item.line=[m.id];
  const loaded=deserialize(JSON.stringify(s));
  loaded.paused=false;
  for(let n=0;n<10;n++) tick(loaded,0.05);
  assert.equal(loaded.members.find(n=>n.id===m.id)?.state,"using");
});


test("visitor needs cap cumulative harm and noisy exposure triggers a specific thought", () => {
  const s=initial();
  buy(s,"rack",1,1,0); buy(s,"bike",4,1,0);
  member(s,{type:0,target:s.items[0].id,state:"using",timer:100,x:1,z:3});
  const optimist=member(s,{type:2,target:s.items[1].id,state:"using",timer:100,x:4,z:3});
  s.paused=false;
  tick(s,6);
  assert.equal(optimist.thought?.topic,"noise");
  assert.ok((optimist.needs?.noise ?? 0)>0);
  const quiet=member(s,{type:1,target:s.items[1].id,state:"using",timer:100});
  tick(s,1);
  assert.equal(quiet.needs?.noise ?? 0,0);
  needPenalty(optimist,"noise",100);
  assert.equal(optimist.needs?.noise,15);
  const score=optimist.score;
  needPenalty(optimist,"noise",100);
  assert.equal(optimist.score,score);
});

test("thoughts observe pause, cooldown, and no repeat topics across save/load", () => {
  const s=gym(),m=member(s,{state:"resting"});
  visitorThought(s,m,"queues");
  assert.equal(m.thought,undefined);
  s.paused=false;
  visitorThought(s,m,"queues");
  const original=m.thought;
  s.time=5;
  visitorThought(s,m,"noise");
  assert.equal(m.thought,original);
  s.time=21;
  visitorThought(s,m,"noise");
  assert.equal(m.thought?.topic,"noise");
  s.time=42;
  visitorThought(s,m,"queues");
  assert.equal(m.thought?.topic,"noise");
  assert.deepEqual(deserialize(JSON.stringify(s)).members[0].thoughtTopics,["queues","noise"]);
});

test("variety matches member preferences instead of rewarding duplicate machines", () => {
  const s=initial(); buy(s,"bike",2,2,0);
  const cardio=admit(s,1)!;
  assert.equal(cardio.needs?.variety,0);
  const heavy=admit(s,0)!;
  assert.equal(heavy.needs?.variety,15);
  buy(s,"bike",6,2,0);
  assert.equal(admit(s,0)?.needs?.variety,15);
  buy(s,"freeweights",9,2,0);
  assert.equal(admit(s,0)?.needs?.variety,7.5);
});

test("rating counts experience once and value independently; condition complaints follow actual use", () => {
  const s=gym(); s.price=15; s.ratingSamples=[90];
  assert.equal(ratingTarget(s),4.3);
  s.ratingSamples=[70];
  assert.equal(ratingTarget(s),3.5);
  s.items[1].condition=24;
  const m=member(s,{target:s.items[1].id,state:"using",timer:100});
  s.paused=false; tick(s,1);
  assert.equal(m.thought?.topic,"condition");
  assert.ok((m.needs?.condition ?? 0)>0);
  const loaded=deserialize(JSON.stringify(s));
  assert.deepEqual(loaded.members[0].needs,m.needs);
  const damaged=JSON.parse(JSON.stringify(s));damaged.members[0].needs.condition=-1;
  assert.throws(()=>deserialize(JSON.stringify(damaged)),/visitor needs/);
});

test("long queue thoughts trigger once, while normal movement produces no thought", () => {
  const s=gym(),i=s.items[1];
  member(s,{target:i.id,state:"using",timer:100});
  const m=member(s,{target:i.id,state:"waiting"}); i.line=[m.id];
  s.paused=false; tick(s,4);
  assert.equal(m.thought,undefined);
  tick(s,12);
  assert.equal(m.thought?.topic,"queues");
  const at=m.thought?.at;
  tick(s,3);
  assert.equal(m.thought?.at,at);
});


test("a full queue retry survives saving and rejoins when capacity becomes available", () => {
 const s=gym(),item=s.items[1];s.spawn=99999;
 const first=member(s);choose(s,first);
 const retry=member(s);choose(s,retry);
 assert.equal(retry.state,"resting");
 const loaded=deserialize(JSON.stringify(s));
 loaded.members=loaded.members.filter(m=>m.id!==first.id);loaded.items[1].line=[];
 loaded.paused=false;
 for(let n=0;n<260;n++)tick(loaded,0.05);
 const m=loaded.members.find(m=>m.id===retry.id)!;
 assert.equal(m.state,"using");
 assert.equal(m.activity,0);
 assert.equal(m.retriedActivity,0);
 assert.equal(loaded.profit,0);
});

test("a full queue retries once then leaves with reduced penalties", () => {
 const s=gym(),item=s.items[1];
 member(s,{target:item.id,state:"using",timer:999});
 const queued=member(s);choose(s,queued);
 const retry=member(s);choose(s,retry);
 assert.equal(retry.state,"resting");
 assert.equal(retry.score,90);
 s.paused=false;
 for(let n=0;n<600;n++)tick(s,0.05);
 const visit=s.visits.find(v=>!v.completed);
 assert.ok(visit);
 assert.equal(visit.score,65);
 assert.ok(!s.members.some(m=>m.id===retry.id));
 assert.ok(item.line.length<=1);
});

test("all equipment orientations retain rotated entry, exit, lane, and saved workout departure", () => {
 for(const kind of ["rack","bike","freeweights"] as const)for(let rotation=0;rotation<4;rotation++) {
  const s=initial();assert.equal(buy(s,kind,4,4,rotation),"");
  const item=s.items[0],entry=access(item),out=exit(item);
  assert.deepEqual(entry,out);
  const directions=[{x:0,z:1},{x:1,z:0},{x:0,z:-1},{x:-1,z:0}];
  const dir=directions[rotation];
  assert.equal(setLane(s,item.id,[{x:entry.x+dir.x,z:entry.z+dir.z}]),"");
  const m=member(s,{...entry,routine:[kind]});assert.equal(choose(s,m),true);
  s.paused=false;tick(s,0.05);assert.equal(m.state,"using");
  const loaded=deserialize(JSON.stringify(s));assert.equal(loaded.items[0].rotation,rotation);
  loaded.paused=false;loaded.members[0].timer=0.01;tick(loaded,0.05);
  assert.equal(loaded.members[0].state,"leaving");
  assert.deepEqual(loaded.members[0].path[0],out);
 }
 const s=initial();buy(s,"bike",4,4,0);s.items[0].rotation=4;
 assert.throws(()=>deserialize(JSON.stringify(s)),/Saved layout/);
});

test("treadmills support rotation, queues, workouts, maintenance and save/load", () => {
 for(let rotation=0;rotation<4;rotation++) {
  const s=initial();s.spawn=99999;
  assert.equal(buy(s,"treadmill",4,4,rotation),"");
  const item=s.items[0];const entry=access(item);
  const m=member(s,{x:entry.x,z:entry.z,routine:["treadmill"]});
  choose(s,m);s.paused=false;tick(s,0.05);
  assert.equal(m.state,"using");tick(s,0.05);assert.ok(item.condition<100);
  const loaded=deserialize(JSON.stringify(s));
  assert.equal(loaded.items[0].kind,"treadmill");assert.equal(loaded.items[0].rotation,rotation);
  assert.deepEqual(loaded.members[0].routine,["treadmill"]);
  toggleEquipment(s,item.id);assert.notEqual(m.state,"using");
  assert.equal(repair(s,item.id),"");assert.equal(item.condition,100);
 }
});
test("treadmills satisfy cardio variety and enter visitor routines", () => {
 const s=initial();buy(s,"treadmill",4,4,0);s.paused=false;
 let cardioActivities=0;
 for(let n=0;n<40;n++) {
  const m=admit(s,1)!;
  assert.equal(m.needs?.variety ?? 0,0);
  assert.ok(!m.routine.includes("bike"));
  cardioActivities+=m.routine.filter(k=>k==="treadmill").length;
 }
 assert.ok(cardioActivities>0);
});

test("rental leases reserve the chosen daily rent and restore the floor plan",()=>{
 for(const [id,lease,daily] of [["closet",300,70],["corner",500,95],["warehouse",750,130]] as const){
  const s=initial(id);assert.equal(s.money,1800-lease);assert.equal(availableFunds(s),1800-lease-daily);
  s.spawn=99999;s.paused=false;tick(s,CONFIG.day);assert.equal(s.money,1800-lease-daily);
  assert.equal(deserialize(JSON.stringify(s)).property,id);
 }
});
test("all rental rooms fit a rack and bike while excluding their missing floor tiles",()=>{
 for(const id of ["closet","corner","warehouse"] as const){
  const s=initial(id);assert.equal(buy(s,"rack",3,3,0),"");assert.equal(buy(s,"bike",7,7,0),"");
  assert.ok(availableFunds(s)>=200);
  if(id==="closet")assert.notEqual(buy(s,"bike",0,0,0),"");
  if(id==="corner")assert.notEqual(buy(s,"bike",8,3,0),"");
  s.spawn=99999;s.paused=false;
  const m=member(s,{x:5,z:11,routine:["rack","bike"]});choose(s,m);
  for(let n=0;n<2300;n++)tick(s,.05);
  assert.ok(s.visits.some(v=>v.completed));
 }
});


test("an exerciser passes through a busy queue while the next visitor starts",()=>{
 const s=initial("closet");buy(s,"bike",4,4,0);const item=s.items[0];setLane(s,item.id,[{x:4,z:7},{x:4,z:8}]);s.spawn=99999;
 const done=member(s,{...access(item),target:item.id,state:"using",timer:.01,routine:["bike"],activity:0});
 const next=member(s,{...access(item),routine:["bike"]});choose(s,next);
 const last=member(s,{x:4,z:7,routine:["bike"]});choose(s,last);
 s.paused=false;tick(s,.05);assert.equal(done.state,"leaving");
 assert.deepEqual(done.path.slice(0,3),[access(item),...item.lane]);
 for(let n=0;n<240;n++)tick(s,.05);
 assert.equal(next.state,"using");assert.ok(!s.members.some(m=>m.id===done.id));
 assert.ok(item.line.includes(last.id));
});


test("expansion purchases are atomic, reserve higher rent and persist",()=>{
 for(const id of ["closet","corner","warehouse"] as const){
  const s=initial(id);s.money=4000;const before=s.money,oldRent=rent(s);
  assert.equal(expand(s),"");assert.ok(rent(s)>oldRent);assert.ok(s.money<before);
  const spent=s.money;assert.notEqual(expand(s),"");assert.equal(s.money,spent);
  const loaded=deserialize(JSON.stringify(s));assert.equal(loaded.expanded,true);assert.equal(rent(loaded),rent(s));
  const poor=initial(id);poor.money=100;assert.notEqual(expand(poor),"");assert.equal(poor.money,100);assert.ok(!poor.expanded);
 }
});
test("expansion rooms unlock floor space but permanent door approaches stay clear",()=>{
 const setups=[{id:"closet",x:12,z:2,r:0,door:{x:8,z:4}},{id:"corner",x:-10,z:4,r:0,door:{x:1,z:6}},{id:"warehouse",x:13,z:3,r:0,door:{x:11,z:6}}] as const;
 for(const setup of setups){
  const s=initial(setup.id);s.money=4000;s.spawn=99999;
  assert.notEqual(buy(s,"bike",setup.x,setup.z,setup.r),"");assert.equal(expand(s),"");
  assert.equal(buy(s,"bike",setup.x,setup.z,setup.r),"");
  assert.match(buy(s,"bike",setup.door.x,setup.door.z,0),/doorway/);
  const m=member(s,{x:5,z:11,routine:["bike"]});choose(s,m);
  assert.ok(m.path.some(c=>c.x===setup.door.x&&c.z===setup.door.z));
  s.paused=false;for(let n=0;n<2300;n++)tick(s,.05);
  assert.ok(s.visits.some(v=>v.completed));
 }
});


test("stockroom has a 6 by 8 room and a protected two-tile hall",()=>{
 const s=initial("closet");s.money=4000;expand(s);
 assert.equal(buy(s,"rack",12,2,0),"");
 assert.match(buy(s,"bike",9,4,1),/doorway/);
 assert.match(buy(s,"bike",10,4,1),/doorway/);
 assert.notEqual(buy(s,"bike",10,2,0),"");
 const m=member(s,{x:5,z:11,routine:["rack"]});choose(s,m);
 for(const x of [8,9,10,11])assert.ok(m.path.some(c=>c.x===x&&c.z===4));
});


test("corner expansion preserves the L-shaped notch and has a protected left hall",()=>{
 const s=initial("corner");s.money=4000;expand(s);
 assert.notEqual(buy(s,"bike",8,3,0),"");
 assert.equal(buy(s,"rack",-10,4,0),"");
 for(const x of [-2,-1,0,1])assert.match(buy(s,"bike",x,6,0),/doorway|inside/);
 const m=member(s,{x:5,z:11,routine:["rack"]});choose(s,m);
 for(const x of [-2,-1,0,1])assert.ok(m.path.some(c=>c.x===x&&c.z===6));
 assert.equal(deserialize(JSON.stringify(s)).items[0].x,-10);
});


test("completed workouts can leave seeded sweat once, without blocking floor use",()=>{
 const s=initial("closet");buy(s,"rack",3,3,0);s.spawn=99999;s.seed=1;
 const item=s.items[0];member(s,{...access(item),type:0,state:"using",target:item.id,timer:.01,routine:["rack"]});
 s.paused=false;tick(s,.05);assert.equal(s.puddles!.length,1);
 const puddle=s.puddles![0];assert.ok(pathTo(s.items,{x:5,z:11},puddle,s.property,s.expanded));
 tick(s,.05);assert.equal(s.puddles!.length,1);
 const saved=deserialize(JSON.stringify(s));assert.deepEqual(saved.puddles,s.puddles);
 const old={...s} as any;delete old.puddles;assert.deepEqual(deserialize(JSON.stringify(old)).puddles,[]);
 assert.throws(()=>deserialize(JSON.stringify({...s,puddles:[{x:99,z:99}]})),/cleanliness/);
});
test("paused games create no sweat; active sweat is deterministic and never duplicates tiles",()=>{
 const a=gym(),b=gym();const seed=a.seed;
 assert.equal(leaveSweat(a,a.items[0],0),false);assert.equal(a.seed,seed);
 a.paused=b.paused=false;
 for(let n=0;n<100;n++){leaveSweat(a,a.items[0],0);leaveSweat(b,b.items[0],0);}
 assert.deepEqual(a.puddles,b.puddles);assert.equal(new Set(a.puddles!.map(p=>`${p.x},${p.z}`)).size,a.puddles!.length);
 assert.ok(a.puddles!.length>0);
});
test("nearby sweat prompts a thought, cleaning stops exposure and does not cost money",()=>{
 const s=initial();s.spawn=99999;s.puddles=[{x:5,z:8}];
 const near=member(s,{x:5,z:8,state:"resting",timer:999});
 const far=member(s,{x:1,z:1,state:"resting",timer:999});
 tick(s,10);assert.equal(near.score,90);
 s.paused=false;for(let n=0;n<110;n++)tick(s,.05);
 assert.equal(near.thought?.topic,"cleanliness");assert.ok(near.score<90);assert.equal(far.score,90);
 const score=near.score,cash=s.money;s.paused=true;
 assert.equal(cleanPuddle(s,{x:5,z:8}),true);assert.equal(cleanPuddle(s,{x:5,z:8}),false);
 assert.equal(s.money,cash);s.paused=false;for(let n=0;n<100;n++)tick(s,.05);assert.equal(near.score,score);
});
