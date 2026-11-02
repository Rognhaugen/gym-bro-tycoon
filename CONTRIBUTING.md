# Contributing

1. Clone this repository and run `npm ci`.
2. Create a branch for your change: `git switch -c your-change`.
3. Run `npm run dev` to playtest.
4. Run `npm test` and `npm run build` before submitting a pull request.
5. Describe what changed and how you checked it. Include screenshots for visual changes.

Keep simulation rules deterministic: use the seeded simulation random generator rather than `Math.random()`. Preserve pause behavior and queue/pathfinding rules. Add regression coverage for simulation bugs and new mechanics; visual edits should be playtested on desktop and phone sizes.

Keep credentials, browser saves, temporary files, dependencies, and build output out of Git. Discuss new game systems before implementing them. Balance values are provisional.
