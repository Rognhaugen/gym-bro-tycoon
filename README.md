# Gym Bro Tycoon

A silly, low-poly, single-player gym management game for desktop and phone browsers. Rent a property, place equipment and queues, set admission, maintain machines, and expand your gym.

[Play the current published game](https://rognhaugen.github.io/gym-bro-tycoon/)

## Local development

Install Node.js 22 or later (Node 24 recommended), then run:

```sh
npm ci
npm run dev
```

Open the address printed by Vite. Choose a rental, add equipment with the Plus button, finish its queue with Done, and press the yellow Play button. Settings contains admission, reports, save/load, and restart. Saves live in your browser.

## Controls

- Desktop: WASD/arrow keys pan, scroll zooms, R rotates equipment, Escape cancels, Space pauses/resumes.
- Phone: tap to select/place, drag to pan, pinch to zoom. Use two fingers to pan during placement.
- Select equipment to turn it off, repair, move, sell, or edit its queue.
- Visitors leave through their machine's queue. Keep public access to the back of each queue.
- Expansion doorways and halls must stay clear.
- Click/tap blue-green sweat puddles to clean for free. Nearby dirt can lower visitor happiness.

## Checks

```sh
npm test
npm run build
```

The build outputs `dist/`. GitHub Actions runs both checks for pushes and pull requests.

## Project structure

- `src/main.ts`: Three.js scene, equipment/visitor models, animation, input, UI.
- `src/simulation.ts`: deterministic simulation, finances, workouts, maintenance, saving.
- `src/spatial.ts`: floor placement, queue validation, pathfinding.
- `src/properties.ts`: rentals, expansions, protected doorways.
- `src/style.css`: desktop and phone interface.
- `tests/simulation.test.ts`: simulation regression tests.
- `docs/roadmap-and-decisions.md`: design history, backlog, and latest decisions. Later dated decisions supersede earlier rules.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). GitHub runs tests and builds for pushes and pull requests. Successful builds on `main` deploy automatically to GitHub Pages. Pull requests do not publish. The Pages build uses `/gym-bro-tycoon/` as its asset base path; local development keeps its normal root URL.

No project license has been selected yet.
