/**
 * The day, as data. One scroll progress value (P, in "story units") drives everything.
 * cam = camera position (x,y,z) and look-at (lx,ly) for the chapter's hold.
 */
export const CHAPTERS = [
  { id: 'wake',    dur: 8,  hour: 6.5,  title: 'Up before the sun',   text: 'Alarm off, curtains open. Islamabad is quiet for a few more minutes.',
    cam: { x: 0.5, y: 14.2, z: 15, lx: 0.5, ly: 11.2, yaw: 0.14, pitch: 0.0 } },
  { id: 'ready',   dur: 8,  hour: 7.3,  title: 'Getting ready',       text: 'Shirt, bag, laptop. A day of calls with teams across time zones starts early.',
    cam: { x: 13, y: 14.4, z: 17, lx: 13, ly: 11.3, yaw: -0.1, pitch: 0.0 } },
  { id: 'commute', dur: 10, hour: 8.3,  title: 'Out the door',        text: 'The Margalla hills sit on the horizon while the city wakes up.',
    cam: { x: 33, y: 7.5, z: 31, lx: 33, ly: 4.6, yaw: -0.2, pitch: -0.05 } },
  { id: 'code',    dur: 10, hour: 9.2,  title: 'Building software',   text: 'Ten-plus years of .NET, Angular and Azure. Most mornings start with a pull request.',
    cam: { x: 73, y: 4.6, z: 14, lx: 73, ly: 2.1, yaw: 0.36, pitch: 0.0 } },
  { id: 'meet',    dur: 10, hour: 11.0, title: 'Meetings',            text: 'Architecture reviews and planning with people in the USA, Europe and the Middle East.',
    cam: { x: 90, y: 5.8, z: 19, lx: 90, ly: 3.7, yaw: 0.0, pitch: 0.0 } },
  { id: 'lunch',   dur: 8,  hour: 13.0, title: 'Lunch',               text: 'Away from the screen. Good food, better conversation.',
    cam: { x: 96, y: 5.8, z: 19, lx: 96, ly: 3.7, yaw: 0.0 },
    keys: [
      { at: 0.3, x: 101, y: 5.6, z: 16, lx: 101, ly: 3.4, yaw: -0.1 },
      { at: 0.5, x: 106, y: 15.4, z: 15, lx: 108, ly: 13.2, yaw: -0.2 },
      { at: 1.0, x: 116, y: 15.4, z: 13, lx: 116, ly: 12.9, yaw: -0.26 },
    ] },
  { id: 'build',   dur: 10, hour: 14.2, title: 'Architecture hour',   text: 'Services, queues and pipelines drawn on a whiteboard first, then shipped.',
    cam: { x: 116, y: 15.4, z: 13, lx: 116, ly: 12.9, yaw: -0.26 },
    keys: [
      { at: 0.14, x: 108, y: 15.4, z: 14, lx: 106, ly: 13.2, yaw: -0.1 },
      { at: 0.3, x: 104, y: 8, z: 16, lx: 103, ly: 6, yaw: 0.0 },
      { at: 0.44, x: 112, y: 5.6, z: 17, lx: 112, ly: 3.4, yaw: -0.2 },
      { at: 1.0, x: 125.5, y: 5.4, z: 17, lx: 125.5, ly: 3.3, yaw: -0.32 },
    ] },
  { id: 'home',    dur: 8,  hour: 17.7, title: 'Home',                text: 'Laptop closed. The drive back, the key in the door.',
    cam: { x: -18, y: 5, z: 21, lx: -18, ly: 1.7, yaw: 0.22, pitch: 0.0 } },
  { id: 'family',  dur: 10, hour: 18.7, title: 'Family time',         text: 'The best hours of the day. Toys everywhere, nobody is in a hurry.',
    cam: { x: 8, y: 5.0, z: 18.5, lx: 8, ly: 1.9, yaw: 0.26, pitch: 0.0 } },
  { id: 'hobby',   dur: 20, hour: 20.8, title: 'The VTOXI lab',      text: 'A bookshelf slides open. Behind it: soldering irons, ESP32 boards, a Tesla coil, and a lab that is mostly blinking lights.',
    cam: { x: 16, y: 5, z: 15, lx: 16, ly: 2.6 },
    keys: [
      { at: 0.22, x: 16, y: 5, z: 15, lx: 16, ly: 2.6, yaw: 0.05 },
      { at: 0.37, x: 38, y: -6.4, z: 21, lx: 38, ly: -8.8, yaw: -0.2, pitch: 0.04 },
      { at: 0.47, x: 47, y: -8.2, z: 13, lx: 47, ly: -10.3, yaw: -0.38 },
      { at: 0.62, x: 47, y: -8.2, z: 13, lx: 47, ly: -10.3, yaw: -0.18 },
      { at: 0.72, x: 71, y: -7.4, z: 17, lx: 71, ly: -9.4, yaw: 0.34 },
      { at: 0.82, x: 71, y: -7.4, z: 17, lx: 71, ly: -9.4, yaw: 0.12 },
      { at: 0.89, x: 86, y: -7.2, z: 18, lx: 86, ly: -9.1, yaw: -0.3, pitch: 0.03 },
      { at: 0.93, x: 86, y: -7.2, z: 18, lx: 86, ly: -9.1, yaw: -0.1 },
      { at: 1.0, x: 92, y: -7.4, z: 16, lx: 92, ly: -9.1, yaw: 0.0 },
    ] },
  { id: 'sleep',   dur: 8,  hour: 23.0, title: 'Lights out',          text: 'The prototype keeps blinking. Tomorrow there will be another pull request.',
    cam: { x: -0.5, y: 14.4, z: 15, lx: -0.5, ly: 11.5, yaw: -0.16, pitch: 0.0 } },
];
export const END_HOUR = 23.9;

let acc = 0;
for (const c of CHAPTERS) { c.start = acc; acc += c.dur; c.end = acc; }
export const TOTAL = acc;

export function chapterAt(P) {
  for (let i = CHAPTERS.length - 1; i >= 0; i--) if (P >= CHAPTERS[i].start) return i;
  return 0;
}
export function hourAt(P) {
  const i = chapterAt(P), c = CHAPTERS[i];
  const next = CHAPTERS[i + 1] ? CHAPTERS[i + 1].hour : END_HOUR;
  const k = Math.min(1, Math.max(0, (P - c.start) / c.dur));
  return c.hour + (next - c.hour) * k;
}

/** shared coordinates so scenery and the actors agree */
export const L = {
  bedX: -3, wardrobeX: 9.5, mirrorX: 14, bagX: 18.5, archX: 24.5,
  carX0: 36, carX1: 62,
  deskX: 73, deskChairX: 69.2,
  meetX: 90, lunchX: 116, archDeskX: 122, archChairX: 118.2,
  carHomeX0: 139, carHomeX1: 150.4, houseX: 157,
  sofaX: 164, rugX: 174,
  labX0: 189, labX1: 262, stoolX: 209.5,
  bed2X: 276,
};
