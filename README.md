# One day, start to finish

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
