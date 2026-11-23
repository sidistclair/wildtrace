// Wild Trace: sound
// Browsers stay silent until the player first clicks or presses a key.
// Press M or click the speaker button at any time to mute or unmute. The choice is remembered.

const AUDIO_DIR = "assets/audio/";

// ---------- The sound files ----------
// Files ending in _clip are trimmed copies of your sounds with the silence cut off,
// so the game never has to skip ahead inside a file (some browsers and local servers can't).
// volume: 0 to 1

let SFX = {
  // buttons
  click:       { file: "click_clip.mp3", volume: 0.6 },          // sticky-note buttons
  click2:      { file: "click_2_clip.mp3", volume: 0.6 },        // flagging, picking a photo, gear card
  uiClick:     { file: "ui click.wav", volume: 0.5 },            // trail camera keys
  uiClick2:    { file: "ui click 2.wav", volume: 0.5 },          // ? and ↺ tags
  // cameras
  camera:      { file: "camera_1_clip.mp3", volume: 0.7 },       // placing a camera, switching CAM 1/2
  cameraClick: { file: "camera_click_clip.mp3", volume: 0.7 },   // pinning a photo
  shutter:     { file: "camera_shutter_clip.mp3", volume: 0.8 }, // a camera taking its photo at night
  // good and bad
  ding:        { file: "correct_ding_clip.mp3", volume: 0.6 },   // a clean lens, a fixed camera, a right storm sort
  glitch:      { file: "electric_glitch_clip.mp3", volume: 0.6 },     // a wrong wire ("zzt!"), a wrong storm sort
  signalLost:  { file: "electricity_glitch_clip.mp3", volume: 0.5 },  // the ridge camera's last upload
  powerOn:     { file: "electricity_clip.mp3", volume: 0.6 },    // a wire plugged in
  pen:         { file: "pen writing 1.mp3", volume: 0.6 },       // ticking a claim
  walking:     { file: "walking_clip.mp3", volume: 0.5 },        // heading out to set the cameras
};

// Looping sounds
let LOOPS = {
  forest:       { file: "night forest with insects.wav", volume: 0.35 },
  leaves:       { file: "leaves rustling.mp3", volume: 0.25 },
  creek:        { file: "creek water stream.mp3", volume: 0.3 },
  construction: { file: "construction ambiance 2.wav", volume: 0.25 },
  bulldozer:    { file: "construction bulldozer 1.wav", volume: 0.25 },
  engine:       { file: "tractor_driving_clip.mp3", volume: 0.25 },
  rummage:      { file: "garbage_rummage_clip.mp3", volume: 0.35 },
  static:       { file: "electricity static.wav", volume: 0.15 },
  wipe:         { file: "wiping_clip.mp3", volume: 0.6 },
  wipe2:        { file: "wiping_2_clip.mp3", volume: 0.6 },
  writing:      { file: "pen_writing_2_clip.mp3", volume: 0.45 },
};

// What plays behind each trail camera photo on the review screen: SCENE_SOUND[place][night - 1].
// Places: 0 Old Forest, 1 Creek Crossing, 2 Wildlife Corridor, 3 Farm Edge, 4 Ridge Road.
const SCENE_SOUND = [
  ["leaves", "construction", "forest", "leaves", "forest"],             // Old Forest (the new fence on night 2, empty on 3 and 5)
  ["creek", "creek", "creek", "creek", "creek"],                        // Creek Crossing
  ["leaves", "construction", "leaves", "leaves", "forest"],             // Corridor (the fence going up on night 2)
  ["rummage", "rummage", "leaves", "rummage", "engine"],                // Farm Edge (bins, hen house, the farmer on night 5)
  ["bulldozer", "engine", "engine", "engine", "engine"],                // Ridge Road (the road crew, then the pickup)
];

// ---------- Loading and playing ----------

let muted = false;
try {
  muted = localStorage.getItem("wildtrace-muted") == "1"; // remembered from last time
} catch (e) {}
let unlocked = false; // true once the player has clicked or pressed a key

// Each one-shot is loaded once up front, so it's in the browser's cache when it's needed
for (let name in SFX) SFX[name].el = makeAudio(SFX[name].file);
for (let name in LOOPS) {
  let l = LOOPS[name];
  l.el = makeAudio(l.file);
  l.el.preload = "none"; // downloads when it first plays, so it doesn't slow down the pictures
  l.el.loop = true;
  l.level = 0;  // how loud it is right now (fades towards target)
  l.target = 0;
}

function makeAudio(file) {
  let a = new Audio(AUDIO_DIR + encodeURIComponent(file)); // (encoded so names with spaces work)
  a.preload = "auto";
  // say so in the browser console (F12) if a file can't be found
  a.addEventListener("error", () => console.warn("Wild Trace audio: couldn't load " + AUDIO_DIR + file));
  return a;
}

// Plays a one-shot sound from SFX. Each play uses a fresh copy of the sound, so it always
// starts from the beginning and can overlap itself.
function sfx(name) {
  let s = SFX[name];
  if (!s || muted || !unlocked) return;
  let a = s.el.cloneNode();
  a.volume = s.volume;
  let p = a.play();
  if (p) p.catch((e) => console.warn("Wild Trace audio: couldn't play " + s.file, e));
}

// ---------- Hooks into sketch.js ----------
// Each one calls the original function first, unchanged.

function hook(name, after) {
  let original = window[name];
  if (typeof original != "function") return;
  window[name] = function (...args) {
    let before = snapshot();
    let result = original.apply(this, args);
    after(result, args, before);
    return result;
  };
}

// A few values read before a hooked function runs, to see what it changed
function snapshot() {
  return {
    cams: cameras.slice(),
    frame: frame[current],
    done: wires ? wires.done.slice() : null,
    wrongAt: wires ? wires.wrongAt : 0,
  };
}

// Buttons: these are called every frame and return true only on the frame they are clicked
hook("noteButton", (clicked) => { if (clicked) sfx("click"); });
hook("gearCard", (clicked) => { if (clicked) sfx("click2"); });
hook("helpButton", (clicked) => { if (clicked) sfx("uiClick2"); });
hook("deviceButton", (clicked) => { if (clicked) sfx("uiClick"); });
// (PREV, NEXT and PIN have their own sounds below, which also play for the keyboard shortcuts)
hook("deviceKey", (clicked, args) => {
  if (!clicked || ["left", "right", "pin"].includes(args[0])) return;
  sfx(args[0] == "camera" ? "camera" : "uiClick");
});

// Cameras on the map
hook("placeCamera", (r, a, before) => { if (cameras.join() != before.cams.join()) sfx("camera"); });
hook("drop", (r, a, before) => { if (cameras.join() != before.cams.join()) sfx("camera"); });
hook("deskCamera", (r, a, before) => { if (cameras.join() != before.cams.join()) sfx("camera"); }); // taking one back

// Review. Flagging always makes the same sound, right or wrong, because the game
// doesn't tell the player which flags were right until the clue board.
hook("flagPhoto", () => sfx("click2"));
hook("togglePin", () => sfx("cameraClick"));
hook("stepFrame", (r, a, before) => { if (frame[current] != before.frame) sfx("uiClick"); });

// Wires puzzle
hook("connect", (r, args, before) => {
  if (!wires || !before.done) return;
  if (wires.wrongAt != before.wrongAt) sfx("glitch");
  else if (wires.done.some((d, i) => d && !before.done[i])) {
    sfx("powerOn");
    if (wires.done.every((d) => d)) setTimeout(() => sfx("ding"), 250);
  }
});

// Storm Sweep: a ding for a right sort, a buzz for a wrong one (the screen shows ✓ or ✗ too)
hook("sortItem", () => {
  let r = storm && storm.sorted[storm.sorted.length - 1];
  if (r) sfx(r.right ? "ding" : "glitch");
});

// Case report
hook("pickPhoto", () => sfx("click2"));
hook("removeSlot", () => sfx("uiClick"));
hook("toggleLink", () => sfx("pen"));

// ---------- Every frame, just after draw() ----------

let last = { screen: "", flash: 0, cleaned: 0, signalLost: "", washed: 0, wipeLoop: "wipe" };

function audioFrame() {
  // heading out into the forest when the night starts
  if (screen == "watch" && last.screen != "watch") sfx("walking");
  // a camera taking its photo: flash jumps up to 120
  if (screen == "watch" && flash > last.flash + 50) sfx("shutter");
  last.flash = flash;

  // a dirty lens wiped clean (only on the review screen, so continuing a saved game doesn't ding)
  if (cleaned.length > last.cleaned && screen == "review") sfx("ding");
  last.cleaned = cleaned.length;

  // the ridge camera's last upload on night 2
  if (screen == "review" && current == doomed()) {
    let key = night + "-" + current;
    if (last.signalLost != key) sfx("signalLost");
    last.signalLost = key;
  } else last.signalLost = "";

  // Storm Sweep: litter that reaches the bottom of the trail washes into the creek
  let washed = storm ? storm.sorted.filter((r) => r.how == "washed" && !r.right).length : 0;
  if (washed > last.washed) sfx("glitch");
  last.washed = washed;

  // a full case on the "what happens next" screen
  if (screen == "ending" && last.screen != "ending") {
    let proven = claims.filter((cl, c) => cl.truth && results[c] && results[c].status == "proven").length;
    if (proven == 3) sfx("ding");
  }

  last.screen = screen;
  updateLoops();
}

// Decides which loops should be playing and how loud, then fades them there
function updateLoops() {
  let want = {}; // loop name -> how loud, as a fraction of its volume
  let overlay = help || askRestart;

  if (["title", "watch", "end", "ending"].includes(screen)) want.forest = 1;
  // the storm: the creek running high, and the wind in the leaves
  if (screen == "storm") {
    want.creek = storm && storm.done ? 0.4 : 1.3;
    want.leaves = storm && storm.done ? 0 : 1.5;
  }
  if (screen == "review" && cameras[current] != null) {
    let place = cameras[current];
    want.forest = 0.4;
    want[SCENE_SOUND[place][night - 1]] = 1;
    // rubbing a dirty lens
    // (only when the press started on the screen, the same as drawLens() in sketch.js)
    let pressedHere = pressX > LENS_X && pressX < LENS_X + 640 && pressY > LENS_Y && pressY < LENS_Y + 400;
    if (isDirty() && mouseIsPressed && pressedHere && !overlay && inside(LENS_X, LENS_Y, 640, 400)) {
      want[last.wipeLoop] = 1;
    } else if (LOOPS[last.wipeLoop].level < 0.05) {
      last.wipeLoop = Math.random() < 0.5 ? "wipe" : "wipe2"; // switch between the two wiping sounds
    }
  }
  if (screen == "wires" && wires && !wires.done.every((d) => d)) want.static = 1;
  if (isWriting()) want.writing = 1;

  for (let name in LOOPS) {
    let l = LOOPS[name];
    l.target = muted || !unlocked || document.hidden ? 0 : (want[name] || 0) * (overlay ? 0.4 : 1);
    // quick fade in and out, about a quarter of a second
    l.level += audioClamp(l.target - l.level, -0.07, 0.07);
    if (l.level <= 0.001) {
      l.level = 0;
      if (!l.el.paused) l.el.pause();
      continue;
    }
    l.el.volume = audioClamp(l.level * l.volume, 0, 1);
    if (l.el.paused) {
      let p = l.el.play();
      if (p) p.catch(() => {});
    }
  }
}

function audioClamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

// True while the handwriting animation is still writing on the report or the results
// (uses the same speeds as drawReport() and drawResults())
function isWriting() {
  if (writeStart < 0 || help || askRestart) return false;
  if (screen == "report") {
    let total = order.reduce((sum, c) => sum + claims[c].text.length, 0);
    return (frameCount - writeStart) * 1.5 < total;
  }
  if (screen == "results" && results.length) {
    let total = 0;
    for (let c of order) total += results[c].text.length + (claims[c].truth ? claims[c].explain : claims[c].why).length;
    let proven = claims.filter((cl, c) => cl.truth && results[c].status == "proven").length;
    total += ending(proven).length;
    return (frameCount - writeStart) * 3 < total;
  }
  return false;
}

// Run audioFrame() about 60 times a second on its own timer, so it works with any p5 version.
// If something goes wrong, it says so once in the browser console instead of stopping.
let audioFailed = false;
function audioLoop() {
  try {
    // wait until the game has started and finished loading its pictures
    if (typeof screen == "string" && typeof frameCount == "number" && ready === true) audioFrame();
  } catch (e) {
    if (!audioFailed) console.warn("Wild Trace audio:", e);
    audioFailed = true;
  }
  requestAnimationFrame(audioLoop);
}
requestAnimationFrame(audioLoop);

// ---------- Unlocking and muting ----------

function unlock() {
  if (unlocked) return;
  unlocked = true;
}
window.addEventListener("pointerdown", unlock, true);
window.addEventListener("keydown", (e) => {
  unlock();
  if (e.key == "m" || e.key == "M") toggleMute();
}, true);

// Turns the sound on or off (the M key and the speaker button in sketch.js) and remembers it
function toggleMute() {
  muted = !muted;
  try {
    localStorage.setItem("wildtrace-muted", muted ? "1" : "0");
  } catch (e) {} // storage blocked (e.g. a private window): it just isn't remembered
  if (!muted) sfx("uiClick2");
}