# An Ordinary Day: Rawalpindi + Islamabad

A first-person open world of the twin cities on real OpenStreetMap data (road widths, names, speed limits, lanes, buildings, parks, water, land use). Your day from `js/story.js` is spread across real places: wake up in Satellite Town, drive to Blue Area, meetings at Centaurus, lunch at The Monal, family time at Fatima Jinnah Park, the VTOXI lab in Saddar. Drive between stops; at each stop press `E` to step inside the original interior walkthrough (the linear day site, `index.html`), which plays that chapter and hands you back.

## Run it

ES modules need http, not file://. Double-click `start.bat` (opens http://localhost:5173/city.html), or `npx http-server -p 5173 -c-1 .`

## Controls (city)

`WASD` / arrows move, `Shift` run, `Space` jump / handbrake, `F` car in/out, `V` chase view, `E` step inside a stop, `T` phone (day plan, maps/GPS, chats, calls, "My Car"), `M` big map, `N` mute, `[` `]` time speed, `Esc` pause.

## The data pipeline (tools/)

1. Download https://download.geofabrik.de/asia/pakistan-latest.osm.pbf
2. `pip install osmium` then `python tools/pbf_extract.py pakistan-latest.osm.pbf` (writes tools/raw/t_pbf.json, ~2 min)
3. `python tools/bake_osm.py` writes `world/` (1 km chunks + global.json). OSM has few buildings here, so the bake lines side roads with generated low-rise blocks (tall near Blue Area); real OSM buildings are kept as is.

`tools/fetch_osm.py` is an Overpass alternative (slow and flaky for dense tiles).

## Code map

- `js/city.js` the whole open world: chunk streaming, roads/buildings, car + foot physics, Pakistani traffic (hatchbacks, sedans, Bolans, Hilux, bikes, rickshaws, trucks, donkey carts; left-hand traffic), pedestrians, synthesised audio, phone, day events
- `city.html` HUD and phone UI
- Everything below is the original interior walkthrough (index.html), still used for the inside scenes:


An interactive 3D walk through a day: wake up, get ready, commute, build software, meetings, lunch, architecture hour, home, family time, the VTOXI soldering hour, sleep. The page never scrolls. Wheel, swipe or arrow keys scrub a timeline.

## Run it

ES modules need http, not file://. Pick one:

- Double-click `start.bat` (uses `npx serve`)
- `python -m http.server 8123` then open http://localhost:8123

## Controls

- Scroll, swipe, arrow keys, Space / PageDown
- Drag (mouse) or horizontal swipe (touch) or A/D/W/S: look around while the day plays; double-click or R resets the angle
- `P` or the Autoplay button plays the whole day (about 90 seconds)
- Dots on the day arc jump to a chapter
- In Family time, move the cursor over the toys to knock them around

## How it works

- `js/story.js`  chapters, timings, clock, shared coordinates. Edit text and order here.
- `js/main.js`   renderer, GSAP camera rail scrubbed by scroll, HUD, input
- `js/scenes.js` every room, the street, the workshop electronics, Matter.js toys
- `js/actor.js`  where you are and what you are doing at each moment
- `js/figures.js` the capsule people rig
- `js/sky.js`    sun, moon, stars, sky colour by hour
- `js/props.js`  furniture, ESP32/Pi/Arduino models, screen textures
- `vendor/`      three.js 0.186, GSAP 3, Matter.js (bundled, works offline)

Deploy: copy the folder to GitHub Pages (or any static host). No build step.
