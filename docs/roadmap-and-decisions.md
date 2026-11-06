# Roadmap and decisions

## Current financial rules — 2026-10-08
This supersedes earlier loan and forecast designs below, which are retained as historical notes.
- Available funds = cash minus the next $120 rent payment; label it as rent reserved. No income forecast.
- Equipment purchases and repairs cannot spend the rent reserve. Rent is charged once at day end; the display then reserves the following day's rent.
- Zero disposable funds can still earn admission before rent is due. Actual cash at zero or below ends the game, pauses simulation, and requires a restart. No recovery loans or repayments.
- Old loan state is discarded when loading, preserving historical cash and equipment. Bankruptcy persists through saving; selling equipment cannot revive a bankrupt gym.


Status: planning baseline approved. Implementation authorized and started. The first playable prototype is under validation.

## Agreed decisions
- Single-player desktop browser game.
- Overhead gym management.
- Crude low-poly aesthetic and gym-bro satire.
- Competing member preferences with generally forgiving finances.
- Include challenges, risks, and setbacks.
- Defer levels and equipment-unlock progression to the backlog.
- Use TypeScript + Three.js.
- Pay-per-visit admission with a player-controlled entrance price.
- Daily rent is the only initial recurring operating expense, alongside repairs and incident costs.
- MVP supports pause and normal speed, including building while paused.

- Maintenance starts with visible equipment condition and a manual paid repair action.
- Preventable risks should have warnings and opportunities to act.

- Initial member types: Heavy Disciple, Cardio Pilgrim, January Optimist.
- Absurd humor is welcome; behavior should communicate understandable needs and consequences.

- Start with one small gym and limited funds.
- Goal: financial sustainability and reasonable satisfaction across all three member types.
- Offer a recovery loan with a downside when funds run out; terms remain open.

- Grid-based equipment placement with rotation inside a fixed starting room.

- Initial equipment: squat rack and exercise bike; January Optimists can use either.

- Cardio Pilgrims initially need working bikes and short queues; cleaning is deferred.
- First incident: neglected bike injury with advance condition warnings and a financial consequence.
- Additional challenges/incidents follow validation of that incident.

- Actual low-poly 3D with a fixed angled camera, pan, and zoom.

## Consolidated MVP baseline — approved
The scope and defaults below are approved as the planning baseline. Balance parameters remain adjustable. Implementation was explicitly authorized by the user.

### Playable scope
One fixed room, two purchasable equipment types, three member types, pay-per-visit pricing, daily rent, visible feedback, manual repairs, one preventable injury incident, pause/normal speed, and local save/load. No staff, cleaning, expansions, levels, memberships, or fast-forward.

### Approved defaults
- **Session:** start paused in an empty gym with sufficient funds for one rack, one bike, and several days of rent. A simulated day takes about five real minutes at normal speed. No offline progression.
- **Visitors:** a small mixed stream of all three types, capped at 20 simultaneous members initially. Visitors assess the posted price before entering and pay once on admission. No recurring membership state.
- **Member loop:** arrive → assess price → enter/pay or leave → choose equipment → walk/queue → exercise → leave with feedback. An excessive queue or lack of suitable reachable equipment can cause an early exit. Concrete feedback explains price, waiting, noise, and equipment condition.
- **Layout:** 12 × 12 usable grid cells with a fixed entrance; rack footprint 2 × 2, bike 1 × 2, one user per item. Mark interaction/access cells. Reject overlap, occupied-cell placement, or layouts that block the entrance or access to placed equipment. Provide a reason when placement fails.
- **Editing:** rotate before purchase; moving existing equipment is free, and selling refunds 50% of purchase price. Only idle, unreserved equipment can be moved/sold. Placement preview shows footprint, access, validity, and price; cancel spends nothing.
- **Maintenance:** use reduces condition; below 30% shows a warning, below 10% allows injury risk, and 0% disables equipment. Repairs restore full condition for a displayed price and are allowed only when equipment is idle and unreserved. An injury disables the bike until repaired and charges one disclosed cost; no legal minigame. Prevent repeated injuries from the same unrepaired bike.
- **Noise:** Heavy Disciples generate a local noise penalty while lifting. Nearby January Optimists react; spacing equipment provides a countermeasure. Cardio Pilgrims focus on working bikes and queues.
- **Success:** three consecutive days of nonnegative operating profit and at least 60/100 average satisfaction for each member type. Require at least three completed visits per type during that window. Operating profit includes admissions minus rent, repairs, incidents, and loan payments; equipment purchases/sales and loan principal are reported separately. Continue playing after success.
- **Recovery:** when funds reach zero or below, pause and offer one optional loan. It should cover roughly three days of rent and one repair; charge disclosed daily repayments over ten days, totaling 120% of the principal. Declining or exhausting recovery offers restart. No infinite borrowing.
- **Saving:** one browser-local save, manual save/load, and autosave at day end. Restore paused. Warn if storage is unavailable; restarting requires confirmation. Saves include the simulation clock, active members/queues, finances, equipment, incident state, and random-generator state.
- **Controls:** mouse selection, WASD/arrows to pan, wheel zoom, R to rotate placement, Escape to cancel, Space to pause unless typing in a field. Visible buttons provide alternatives. Support keyboard-operable management panels and text labels for warnings.
- **UI:** top bar for money/day/pause; equipment shop; price control; equipment/member inspection; compact finances and satisfaction summaries; notification log. Display rent and repair costs before commitment.
- **Browser target:** current desktop Chrome and Firefox first; check Safari before claiming support. Proposed target: responsive UI and 30 FPS with 20 visitors on a representative integrated-GPU laptop; name the test machine during implementation.

### Balance versus open design
Exact currency amounts, arrival rates, exercise duration, satisfaction weights, wear rates, noise radius, and injury probability are tuning parameters. The illustrative $10,000 lawsuit is not a committed cost. Keep parameters centralized and tune for forgiving finances with meaningful choices.

The defaults above resolve the earlier open design questions for the MVP. Changes to this baseline should be recorded here.

## Proposed milestones and acceptance
1. **Planning baseline approved:** implementation authorized and started.
2. **Browser foundation:** verify scene, camera, UI, pause, and save/reload in target browsers.
3. **Playable management loop:** buy/place/move/sell equipment, admit paying visitors, animate reachable usage and queues, collect rent, show intelligible feedback.
4. **Consequences and scenario:** validate preference conflicts, warnings, repairs, one injury, recovery, and success tracking.
5. **Review and polish:** playtest whether players understand complaints and can respond; verify saving, accessibility basics, and the proposed performance budget.

Meaningful checks: paused time causes no timed charges/wear; placement preserves access; each admission charges once; occupied equipment has no double booking; injury warnings precede eligibility; save/load preserves state; success requires evidence for all three member types. Balance playtests should demonstrate that both pricing and layout decisions matter.

## Backlog
- **Sweat pools and cleanup crew:** after each heavy exercise, give sweat pools a percentage chance to appear on the floor. Connect this to the future cleaning system, with a cleanup crew that costs money to hire and requires monthly pay. Spawn probability, cleanliness effects, cleanup behavior, and how monthly pay fits the current daily economy remain undecided.
- **Extend visitor needs:** add cleanliness and crowding metrics once their supporting systems exist. Queue, noise, equipment variety, condition, and contextual thoughts are implemented; retain stars/trend without a diagnostic panel.
- **Longer visitor workouts:** allow visitors to stay for more activities, especially as more equipment types become available. Vary routine length between visitors; balance visit duration, queues, and equipment variety.
- **Visitor count in the cash bar:** show the number of visitors currently inside the gym in the “Your cash” floating bar.
- **Drinking stations:** buy and place water refill stations in the gym, earning money per drink purchased by visitors. Possible extensions: other beverages and food stations. Prices, costs, visitor demand, and effects on workouts remain undecided.
- **Workout heckling:** visitors occasionally comment on nearby visitors exercising, using floating comment toasts. Examples: “Wow, this guy can’t lift” and “Not getting to Tour de France at that pace.” Keep comments tied to the activity and infrequent; gameplay effects are undecided.
- Additional equipment ideas (not implemented): kettlebells, leg extensions, and yoga mats. Yoga mats must hang on a wall; wall placement rules remain to be designed.
- Further animation polish: smooth mounting/dismounting and transitions between walking and workouts.
- Clickable entrance door showing open/closed admissions.
- Fast-forward, using the same simulation clock and rules.
- Monthly memberships.
- Cleaning system and cleanliness preferences.
- Additional challenges and incidents.
- Additional equipment after validation of the core loop.
- **Buy extra floor space:** pay an upfront expansion cost to increase usable gym space and ongoing daily rent. Show purchase cost and new rent before confirmation. Expansion sizes, pricing, and layout rules remain undecided.
- Tripod Influencer: publicity versus blocked equipment.
- **Hire a mechanic:** pay $100 per day to automate equipment repairs so the player no longer has to manage them manually. Repair timing, handling occupied equipment, and whether repair costs are included in the daily wage remain undecided.
- Levels and progression unlocks.
- Platforms beyond desktop/mobile browsers and multiplayer are outside the current scope.

## Implementation progress
- Initial playable prototype: Three.js world, camera, placement/move/sell, visitors and reservations, admission/rent, feedback, condition/repairs/injury, one loan, success checks, local saves.
- Regression tests added at the user's request before further development.
- Build and browser smoke checks performed; see README.md for current limitations.

## Verification — 2026-10-07
- 14 regression tests pass. Production build passes.
- In-app browser checks: low-poly scene renders; placement charges immediately while paused; visitors move and pay admission; feedback reflects missing equipment; save/load restores funds and active visitors with the clock paused.
- Added a report drawer at narrow widths and adjusted camera framing.
- Chrome/Firefox/Safari coverage, hardware performance measurement, and balance playtests remain outstanding.

## Next iteration — approved design (2026-10-08)
User playtest: low demand, high happiness, and adding machines eliminated pressure. This iteration tests whether space and throughput create meaningful decisions.
1. Physical queues: connected player-drawn lanes, FIFO reservations, unique standing cells, route validation, full-line alternatives and abandonment.
2. Multi-activity routines: release equipment, rest off queues/access cells, rejoin at the back; score completed and abandoned visits.
3. Popularity: gradual internal scoring with visible stars/trend only; bounded visitor demand.
4. Balance: 120-second days, predictable rush, faster wear; compare contrasting layouts and price choices.
Tests accompany each step: no queue overlaps, FIFO despite travel timing, capacity limits, release on abandonment, routine completion, gradual ratings, duplicate-neutral variety, deterministic saving, legacy migration, and pause. Existing finance/maintenance tests remain.
Acceptance: a compact low-capacity layout should show more abandonment and lower visit satisfaction than a spaced layout with adequate lanes/capacity under the same seeded demand. A higher admission price should reduce popularity/demand. These checks supplement player playtesting; they do not prove final balance.

## Next iteration verification — 2026-10-08
- Implemented drawn physical queue lanes, FIFO reservations, bounded queue capacity and full-line alternatives, two-activity routines/rest, gradual waiting penalties, visible stars/trend, popularity-scaled arrivals, middle-of-day rush, 120-second days, and faster wear.
- 25 regression tests pass. Type checking and production build pass. Build reports a roughly 508 kB uncompressed application bundle; no loading-performance claim has been made.
- Browser smoke check: place/select equipment, draw two connected queue tiles, apply lane, open gym, and verify the two-minute/rush and stars/trend display.
- Controlled comparison: identical scripted arrivals over two minutes, starting cash normalized to isolate layout/capacity effects. Two machines without waiting lanes: 6 completed routines, 36% average satisfaction. Four machines with two queue tiles each: 15 completed routines, 45% average satisfaction. These are not final balance targets; even the stronger layout still has dissatisfied members.
- Financial balance remains forgiving; further player playtesting should determine whether rent, prices, demand, queue patience, and wear create sufficient pressure. Do not claim the economy is solved by this iteration.
- General walkers can still pass through one another. Cross-browser and hardware performance validation remain outstanding. Visual equipment deterioration has since been implemented (see maintenance feedback below).

## Separate exits and placement flow — 2026-10-08
Approved: separate machine exits and public exit routes; new equipment placement immediately prompts queue drawing instead of repeat purchase. Verify exit rotation, occupancy validation, sealed public routes, mandatory departure waypoint, rest/save continuity, and automatic queue-editor flow in the browser.

Verification: 30 regression tests pass; production build passes. Browser check confirms a new purchase immediately opens queue drawing, applying the lane ends the purchase tool, and a subsequent empty-floor click does not buy another item. Entry/exit markers appear in placement and inspection.

## Daily money outlook — 2026-10-08
Added daily financial outlook after user clarified day, not month: cash plus estimated day-end balance, upcoming bill and visible cash-short/projected-loss warnings. Eight financial regression tests cover rent/repayment arithmetic, day rollover, estimate warm-up, and purchases; all 38 tests pass.

## Full-screen UI rework — agreed plan (2026-10-08)
Not implemented yet.
1. Update layout: viewport canvas, compact HUD, menus, floating contextual toolbar, catalogue/admission/report overlays.
2. Centralize UI modes and transitions; move existing equipment/member actions into the contextual toolbar. Preserve automatic queue drawing and visible Done.
3. Separate admissions Open/Close from Pause/Resume, with persisted state and legacy-save defaults.
4. Verify both simulation rules and complete interaction flows in the browser.

Acceptance checks:
- Canvas fills viewport; no permanent sidebar or header. Every mode's actions fit without scrolling to find Done/Cancel.
- Purchase → queue drawing → Done; cancel before/after purchase; existing lane edit cancel; repair/sell/move; member inspection; admission adjustment; reports and save/load/restart.
- Toolbar clicks never affect the floor beneath. Escape and keyboard focus work. Camera framing remains usable at narrow desktop widths.
- Closed gym admits nobody while existing visitors finish and rent/time continue. Paused gym advances nothing regardless of admissions state. Reopening produces no accumulated arrival burst.
- Admissions state survives save/load; legacy saves migrate paused. Existing queue/routine/economy regression tests continue to pass.

## Full-screen UI delivered — 2026-10-08
Canvas fills viewport; floating HUD, contextual bottom toolbar, admission slider, office menu, dismissible reports, and day/rush progress indicator implemented. Admissions persist independently of pause; new games start closed and paused; older saves default open and load paused. Added four admissions/save regression tests (40 total). Build and browser smoke checks pass.

## Visitor and control refinement delivered
Implemented animated cash and change indicators, first-opening auto-resume, red close confirmation, Lucide control icons, individual names/appearance, and seeded 1–3 activity routines. All 44 regression tests pass, including preference distributions, identity/save migration, and first-opening semantics. Existing layout comparisons still pass; finances need human playtesting after this change. Backlog: clickable entrance door, equipment-specific workout animations, and previously listed equipment additions.

## Maintenance feedback delivered
Visual deterioration moved out of backlog: grime below 50%, damage and clickable maintenance badges below 25%, Out of order labels at failure. One notification per repair cycle; warning threshold changed from 30% to 25%, wear unchanged. All 45 tests and build pass. Browser fixture verified clean/grimy/damaged/failed equipment and repair removing its badge.

## Workout animations delivered
Jointed visitor rigs squat with a moving barbell and sit/pedal on bikes with rotating pedals and flywheel. Animation uses simulation time, freezes paused, and supports rotated equipment. Visual workout placement sits inside the machine; simulation reservations/service/exit routing remain authoritative and unchanged. Browser checked both orientations and identical paused frames; build and all 45 simulation tests pass.

## Free weights delivered
Free weights cost $180, occupy one equipment tile, and cost $35 to repair. They use the same numbered queue, separate exit, wear, and save rules. Workouts last 11–16 seconds, with alternating dumbbell curls. The catalogue uses the actual model thumbnail; failure removes one dumbbell. Heavy Disciples choose rack/free weights/bike at 55/35/10%, Cardio Pilgrims at 10/5/85%, and Optimists at 30/35/35%. Existing saved routines remain unchanged. Variety is normalized across all three equipment kinds.

The capacity comparison now gives both layouts a free-weight station: cramped 14 completed visits / 44% happiness; spacious 17 / 57%. The comparison requires higher completions and at least five extra happiness points, rather than the former two-kind doubling threshold. Economy still needs human playtesting.


## Balance and repair access — 2026-10-10
Implemented the approved first tuning pass: wear per second is bike 0.25, squat rack 0.18, dumbbell rack 0.08; claim cost $150; queue penalties begin after five seconds and cost 0.4 happiness per second; noise costs 0.35 per second. Purchase prices, rent, and rating formula unchanged.
Equipment can be turned off from inspection. This clears reservations, redirects waiting visitors to alternatives or departure, and sends the current user to rest before retrying their unfinished activity. Repairing does not turn the equipment back on. The setting persists; old saves default on.
54 regression tests and production build pass. Browser verified Turn off → idle/unreserved → Repair → condition 100%, remaining off. Workout departure now explicitly passes through the separate exit. At this point, reported mid-exercise disappearance was not reproduced in the controlled browser check. The user subsequently confirmed it was the same issue resolved by the queue deadlock fix on 2026-10-11.


## Queue deadlock fix — 2026-10-11
Reproduced stalled equipment with waiting reservations and no active user: a visitor mid-step rounds to the destination cell, so routing returned an empty path although their coordinates were short of the interaction point. The first waiter could then wait indefinitely on idle equipment. Paths now include the final exact waypoint; starting exercise snaps to the interaction point and clears the path. Waiting visitors with missing final steps reroute automatically, including existing saved stalls. Three regression cases cover mid-step entry, queue advancement, and save recovery. All 57 tests pass. The user confirmed the problem is solved and that the disappearing-exerciser report was the same queue issue. Both reports are resolved; the disappearing-exerciser item has been removed from the backlog.


## Visitor feedback and rating delivered — 2026-10-11
Implemented explicit, bounded visitor need penalties for queues, noise, mechanical condition, and preferred equipment variety. Thoughts are tied to actual unmet needs and good completed routines, with no generic movement/rest/workout-start toasts, once-per-topic limits and a 20-second cooldown. Rating counts experience once (80%) and admission value independently (20%). The detailed rules are in systems-and-ux.md. All 62 tests pass, including prior layout comparisons plus contextual triggers, archetype variety, capped penalties, pause/repeat limits, rating arithmetic, and saving. Production build passes. Balance remains a playtest question.


## Queue retry and four-direction rotation — 2026-10-11
Visitors who cannot join any suitable queue take one 10-second rest in a reachable public tile, then retry the same activity. They do not reserve a queue position during that rest. If no rest tile is available, or the retry fails, they leave. Missing working equipment still causes departure without retry. The unavailable/full-equipment penalty is now 10 instead of 25; the unfinished-routine penalty is 15 instead of 30. Existing queue patience, demand, prices, and rent remain unchanged. Retry state persists per activity through save/load.
Equipment placement/moving now cycles 0°, 90°, 180°, 270°. Footprints, entry/exit tiles, models, workout poses, and held weights follow the orientation. Existing orientations 0/1 and saved queues retain their layout. Existing equipment can be rotated with Move, subject to the same idle/unreserved requirement; moving clears its lane.
65 tests pass, covering full-queue alternatives, a bounded retry, save continuation, all equipment types in all four orientations, and separate departures. Browser verified rotated workout poses and Rotate cycling to 270° and back to 0°. Build passes.
Controlled six-machine five-day simulation at $15 admission: peak rating 3.91 versus the previous 3.74; average visit happiness with automatic maintenance rose from 68.0 to 76.5. This is one seeded layout with ample starting funds and automated repair, not proof of sustainable player finances or final balance.


## Phone layout and touch controls delivered — 2026-10-12
Added compact portrait HUD, accessible floating camera controls, wrapped contextual tools, scrollable catalogue/report panels, phone-sized dialogs, dynamic viewport and safe-area handling, and landscape adjustments. Phone framing starts wider and Reset camera restores it.
Touch controls: tap to select/place/draw queues; one-finger drag pans when not placing equipment or drawing queues; two fingers pan/pinch zoom in all modes. Camera gestures never commit a purchase/queue tile. Cancelled touches do not activate actions. Scrollable UI panels retain normal scrolling; gesture handling is limited to the canvas. Mouse/keyboard controls remain available.
Verification: production build and all 65 gameplay tests pass. Browser checked 390×844 and 320×568 portrait layouts and 844×390 landscape; catalogue, admission slider, and close confirmation fit. Controlled pointer-event integration checks passed pan, pinch without purchase, one tap/one purchase, queue drawing/Done, and touch cancellation. Real iOS/Android hardware, safe-area browser chrome behavior and mobile performance remain to be validated by phone playtesting.

## Simplified time control — 12 October 2026

Open/close gym is removed. The yellow bottom toolbar button toggles Resume/Pause. Running time admits visitors automatically; pausing freezes arrivals and simulation. Saves restore paused. This supersedes earlier open/close controls and the clickable entrance proposal.

## Treadmills — 13 October 2026

Implemented a 1×2 treadmill: $350 purchase, $60 repair, wear 0.16/second of use. Numbered queues, four orientations, separate exits and power controls follow existing equipment rules. Running legs/arms and moving belt freeze paused. Damaged treadmills show wear and a broken console/belt. Cardio activities select treadmill or bike when both are available, and treadmills satisfy the existing cardio variety requirement. Existing saved routines remain unchanged.

## Rental properties — 13 October 2026

The opening screen offers three illustrated premises with floor plans and transparent lease/rent/budget figures. From $1,800: Iron Closet costs $300 upfront/$70 daily (60 tiles); Corner Gains $500/$95 (80 L-shaped tiles); Big Unit Energy $750/$130 (144 tiles). Lease spending is deducted before equipment purchases, while HUD cash reserves the selected daily rent. Layout and visitor routing obey the selected floor mask. Restart returns to rental selection. Old saves are excluded using a fresh save slot; new rental saves preserve property choice. Starter rack+bike layouts and completed visits tested in all three properties. Prices are an initial balancing pass, not validated long-term economics.

## Shared queue departures — 13 October 2026

Separate equipment exits and orange markers are removed. Exercisers walk from queue tile 1 along their own lane to its public tail, passing through waiting visitors. The next visitor can start immediately; queue capacity and FIFO remain unchanged. Placement still requires clear public access to the queue tail and stays within the rental floor. This supersedes all earlier dedicated-exit rules.

## Tab switching — 13 October 2026

Switching tabs no longer changes pause state. Resume/Pause remains manual; held movement keys clear on loss of focus. Background simulation still depends on browser animation scheduling and may slow or suspend; no offline catch-up is applied.

## Expansion rooms — 13 October 2026

Each property has one visible gray room: Iron Closet back stockroom (20 tiles, $450, +$30 daily rent), Corner Gains neighboring unit (20 tiles, $650, +$45/day), warehouse side bay (60 tiles, $900, +$70/day). A button on the room buys it; transactions reserve the increased rent and cannot repeat. Permanent green door frames connect rooms; door tiles and their approach cannot hold equipment or queues. Visitors cross shared walls only through the door. Purchased floor, rent and ownership persist in saves.

## Stockroom revision — 13 October 2026

Iron Closet now expands through a two-tile hall into a 6×8 room (48 room tiles plus 2 hall tiles), replacing the shallow strip. The door, hall and room mouth remain protected from equipment and queues. Cost remains $450 and added rent $30/day.

## Neighboring unit revision — 13 October 2026

Corner Gains keeps its original L-shaped notch. Its expansion is now a separate 12×7 room on the left, connected by a protected two-tile hallway. 84 room tiles plus 2 hall tiles. Cost remains $650 and added rent $45/day. Camera bounds and routing support the extended floor.

## Neighboring unit size — 13 October 2026

Reduced the left-side expansion to 9×7 (63 room tiles plus the existing two-tile hall). Its doorway, price and rent remain unchanged.

## Sweat and manual cleaning — 6 November 2026

Completed workouts have a seeded 35% chance for Heavy Disciples, 20% for other visitors, to leave a puddle on a nearby public floor tile. Puddles avoid equipment, queues, entrance and reserved doorways, never block movement, never duplicate a tile, persist in saves and do not evaporate. Click/tap a puddle to clean immediately for free, including while paused. Nearby visitors accumulate a cleanliness penalty (0.18 happiness/second per nearby puddle, at most three counted, capped at 10 per visit); five seconds of exposure permits a contextual thought under the normal cooldown. Cleaning stops further exposure without erasing the visit's past penalty. Rating receives cleanliness through existing visitor experience, not an additional direct deduction. Cleaner staff, water, toilets and showers remain future work.

## Sweat placement revision — 6 November 2026

Sweat now appears on queue tile 1, where the visitor steps back onto the floor after exercising. Random nearby tile selection is removed. Spawn chance is unchanged; repeated sweat on the same tile does not create duplicate puddles.

## Personal sweat buildup and wiping — 6 November 2026

Replaces random per-exercise puddles. Each visitor has a seeded threshold of 2–3.5 sweat units, retained in saves. Completed rack/treadmill/bike/dumbbell activities add 1.2/1.15/0.85/0.9 units. At or above threshold, a visitor stops on the next clear public floor tile between exercises or while leaving; queues, equipment, entrance, reserved doorways, existing puddles and another wipe's tile are excluded. A 1.3-second forehead wipe releases a visible droplet, creating exactly one puddle beneath the visitor at 0.8 seconds and reducing buildup by the threshold. Pause freezes the gesture. Pending/partially completed wipes survive saving without duplicate puddles. No cosmetic wipes below threshold.
