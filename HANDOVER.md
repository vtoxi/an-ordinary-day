# VTOXI "A Day" - handover

Interactive 3D "day in the life" site (Three.js). The page never scrolls: wheel / swipe / keys scrub one timeline. Owner: Faisal (GitHub: vtoxi). Keep git history credited to him only - no AI co-author or attribution lines in commits.

## Run
- Double-click `start.bat` (serves with caching OFF on http://localhost:5173 via `npx http-server -c-1`). A plain static server is required (ES modules + import map); do not open index.html from disk.
- Stale-cache symptom: `does not provide an export named X` -> hard refresh (Ctrl+F5) / use start.bat.
- Debug URLs: `?q=0..3` lock quality, `?p=0.5` start progress (0..1), `?yaw=0.7` start orbit. Console hook: `window.__story` (`setP`, `P`, `world`, `cam`, `gfx`, `view`).
- No build step. Vendored: `vendor/three.module.js` + `three.core.js` (r186), `vendor/jsm/*` (only the 17 addon files actually used), `gsap.min.js`, `matter.min.js`.

## Controls
Scroll/swipe/arrows/Space = time. Drag (or A/D/W/S) = orbit camera. Double-click or R = reset angle. P = autoplay. V = first-person; in FPS: WASD walk, Shift run, T/Esc back to story. C = drive camera (fpv / chase / bird / side). N = radio station. M = sound mute. Click: cat, CCTV monitor, wall tablet.

## Architecture (js/)
| file | role |
|---|---|
| `main.js` | renderer loop, GSAP camera rail scrubbed by progress, orbit/FPS/free-roam input, drive window logic, HUD |
| `story.js` | `CHAPTERS` (ids, durations, camera `cam` + optional `keys` sub-tweens, hours), shared layout constants `L` |
| `actor.js` | `meState(P)` = the main character's choreography in "story coordinates"; exports `UP1/UP2/LIFT_X/STAIR_*` |
| `scenes.js` | builds all zones, maps story coords -> world coords in `poseMe`, collisions, lighting per floor |
| `props.js` | furniture/electronics/room(), curtains, blinds, stairs, car (`makeCar`) |
| `lab.js` | basement VTOXI lab (own file; built into a group offset by (-165,-13)) |
| `smarthome.js` | front-door smart lock, CCTV, Pi server rack, openHAB tablet |
| `physics.js` | Matter.js rigid bodies (toys, office items, lab parts), 120 Hz substeps, per-floor zones |
| `game.js` | WebAudio (all synthesised), rain, radio stations, NPCs + cat, click picking, task list panel |
| `drive.js` | GPX road drive: ribbon road, traffic, lights, cockpit, chase/bird cams |
| `route.js` | home->office route (metres, simplified from the GPX) |
| `gfx.js` | EffectComposer (MSAA, GTAO, bloom, ACES) + frame-time quality governor |
| `sky.js` | Sky shader, PMREM env, sun/moon/stars, fog; `update(hour, camX, labK, camY)` |
| `materials.js` / `util.js` / `figures.js` | procedural PBR textures; helpers + `batch()` static merging + `SOLIDS`; articulated figure rig |

## Coordinate system (important)
- 1 unit ~ 1 ft (character ~6.5 tall). x = along the strip, y = up, z = toward camera. Rooms: back wall z=-4.4, open front.
- `actor.js` and most scene code still use the ORIGINAL linear "story" x (bedroom -8..25, street 24..63, office 62..136, home street 135..158, living room 157..189, lab 189..262). `scenes.js` re-places things in the world as a loop:
  - bedroom group raised by `UP1=9.6` (upstairs); outside stairs x 25.5..33.5 down to the street; car start `L.carX0=36`.
  - living room group shifted x-165 (under the bedroom); home street built at x -30..-7; lab group at (-165,-13) = basement.
  - office ground floor + glass meeting room (x 80..100); glass lift at `LIFT_X=102.5`; cafeteria group raised `UP2=11` (lunch table at `L.lunchX=116`).
  - `poseMe` converts story->world (`x>=138 -> x-165`, `x>=189 -> y-13`), exempts seated/lab/stairs states, and pushes the body out of `SOLIDS` (world boxes recorded in `util.batch`).
  - Night: sleep chapter reuses the SAME bed in the bedroom.
- Drive world (`drive.js`) is in metres, offset x+5000, shown only inside `driveWin(P)`: commute lp 0.22..1 (forward) and home lp 0..0.5 (route reversed).

## Where things were verified vs not
Verified by screenshots earlier: v2 renderer, office, living room + physics toys, lab (tesla, tank, hologram, console), finale overview, orbit.
NOT visually verified since the loop re-layout: bedroom upstairs, outside stairs, lift ride, cafeteria, smart-home props, door swing, free-roam, drive world/cockpit, rain, NPCs. Only "page loads without console errors" at one point mid-commute was checked. Expect layout/z-fighting/placement bugs; run the app and walk the whole timeline (`?p=` values 0..1).

## Known gaps / TODO
1. Office->home GPX not supplied; evening drive is the reversed morning route.
2. Rebuild the apartment from the supplied floor plan (rooms in feet: drawing/dining 17x18, lounge 11x16, kitchen 10x13, servant qtr 10x10, bedrooms 15x12 and 11x13, baths 8x6 / 5x5 / 5x5, store 5x5). Needs: single floor? where is the main door? Current home is a 2-room cutaway.
3. Day bar is still linear (planned: ring + minimap).
4. Drive: no windshield/mirror reflections, simple buildings, no pedestrians; cockpit is generic (no brand marks - keep it that way). Radio is generated music; user audio files could be added.
5. Overview/finale camera framing for the wider world unchecked; desk wood texture looked blotchy; floor/slab z-fighting possible at storey slab.
6. Performance only judged in software rendering (SwiftShader); check on a real GPU, tune `gfx.js` levels, instance counts in `drive.js`.
7. Real dining/NPC routines, quest completion by action (tasks panel currently follows chapters only).

## Conventions / preferences
- No AI attribution in commits; user wants low token use: understand once, avoid extra test rounds unless asked.
- Don't reproduce copyrighted characters/music (the lab is an original "kid-genius lab", not a franchise one).


## City mode (added later)
- `city.html` + `js/city.js` = open-world Rawalpindi/Islamabad on OSM data (see README). Metres, x east, z south, origin 33.65N 73.06E.
- The day (`CHAPTERS`) is placed on real places in `PLACES`/`SITE_OF`; coordinates were set from memory, verify them on the map. Arriving shows `E`; the chapter plays in an iframe of `index.html?p=` (autoplays via its `#play` button) then returns.
- Phone (`T`): scripted chats/calls in `SC`/`CT`/`INC` in city.js are the seam for real Slack, calendar, GPS and home-automation data later.
- Known gaps: GPS is a straight-line arrow (no turn-by-turn routing); buildings are mostly generated; terrain is flat; Margalla hills are backdrop only; no touch controls; interiors take ~30 s to load in the iframe.
