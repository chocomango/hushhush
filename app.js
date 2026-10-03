const DEFAULT_PAIRS = {
  "Everyday": [
    ["Coffee", "Tea"], ["Fork", "Spoon"], ["Shower", "Bath"], ["Shoes", "Slippers"],
    ["Pillow", "Blanket"], ["Phone", "Laptop"], ["Door", "Window"], ["Pen", "Pencil"]
  ],
  "Food": [
    ["Pizza", "Burger"], ["Sushi", "Dumpling"], ["Pancake", "Waffle"], ["Ketchup", "Mustard"],
    ["Lemon", "Lime"], ["Cake", "Pie"], ["Rice", "Noodles"], ["Apple", "Pear"]
  ],
  "Places": [
    ["Beach", "Pool"], ["School", "Office"], ["Airport", "Station"], ["Cinema", "Theatre"],
    ["Museum", "Library"], ["Hotel", "Hospital"], ["Zoo", "Aquarium"], ["Forest", "Jungle"]
  ],
  "Animals": [
    ["Cat", "Dog"], ["Lion", "Tiger"], ["Shark", "Dolphin"], ["Frog", "Toad"],
    ["Bee", "Wasp"], ["Rabbit", "Hamster"], ["Eagle", "Owl"], ["Crocodile", "Alligator"]
  ],
  "Wild card": [
    ["Moon", "Sun"], ["Wedding", "Funeral"], ["Dream", "Nightmare"], ["Hero", "Villain"],
    ["Rich", "Famous"], ["Ghost", "Zombie"], ["Past", "Future"], ["Truth", "Dare"]
  ]
};

function loadStoredJson(key, fallback) {
  try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; }
  catch { return fallback; }
}
function saveStoredJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch { /* The game still works when storage is unavailable. */ }
}
function loadSessionGame() {
  try {
    const saved = JSON.parse(sessionStorage.getItem("hush-active-game"));
    const value = saved?.state;
    const screens = ["handoff", "round", "vote", "elimination", "whiteGuess"];
    if (saved?.version !== 2 || !value || !screens.includes(value.screen) || !Array.isArray(value.players) || !Array.isArray(value.roles) || value.players.length < 3 || value.players.length > 12 || value.roles.length !== value.players.length || !Array.isArray(value.pair) || value.pair.length !== 2 || !value.pair.every(word => typeof word === "string")) return null;
    if (!value.players.every(name => typeof name === "string") || !value.roles.every(role => role && ["civilian", "imposter", "white"].includes(role.type) && typeof role.active === "boolean" && (role.word === null || typeof role.word === "string"))) return null;
    if (!Number.isSafeInteger(value.revealIndex) || value.revealIndex < 0 || value.revealIndex >= value.players.length) return null;
    const validIndex = index => index === null || Number.isSafeInteger(index) && index >= 0 && index < value.players.length;
    if (!validIndex(value.selectedVote) || !validIndex(value.eliminatedIndex)) return null;
    if (["elimination", "whiteGuess"].includes(value.screen) && value.eliminatedIndex === null) return null;
    const roles = value.roles.map(role => ({ type: role.type, active: role.active, word: typeof role.word === "string" ? role.word.slice(0, 40) : null, ...(Number.isSafeInteger(role.eliminatedRound) ? { eliminatedRound: Math.min(100, Math.max(1, role.eliminatedRound)) } : {}) }));
    if (["elimination", "whiteGuess"].includes(value.screen) && roles[value.eliminatedIndex].active) return null;
    if (value.screen === "whiteGuess" && roles[value.eliminatedIndex].type !== "white") return null;
    const duration = Math.min(180, Math.max(10, Number(value.duration) || 30));
    const whiteGuesses = {};
    if (value.whiteGuesses && typeof value.whiteGuesses === "object") Object.entries(value.whiteGuesses).forEach(([index, guess]) => { if (Number.isSafeInteger(+index) && +index >= 0 && +index < roles.length && typeof guess === "string") whiteGuesses[index] = guess.slice(0, 40); });
    return {
      screen: value.screen, players: value.players.map(name => name.slice(0, 24)), roles, pair: value.pair.map(word => word.slice(0, 40)),
      revealIndex: value.revealIndex, starter: Number.isSafeInteger(value.starter) && value.starter >= 0 && value.starter < roles.length ? value.starter : 0,
      turnPosition: Math.min(roles.length - 1, Math.max(0, Number.isSafeInteger(value.turnPosition) ? value.turnPosition : 0)), clueCycle: Math.min(100, Math.max(1, Number.isSafeInteger(value.clueCycle) ? value.clueCycle : 1)),
      roundNumber: Math.min(100, Math.max(1, Number.isSafeInteger(value.roundNumber) ? value.roundNumber : 1)), duration, remaining: Math.min(duration, Math.max(0, Number(value.remaining) || 0)),
      selectedVote: value.selectedVote, eliminatedIndex: value.eliminatedIndex, winner: null, whiteGuesses, whiteGuessed: false,
      imposterCount: roles.filter(role => role.type === "imposter").length, whiteCount: roles.filter(role => role.type === "white").length,
      timerRunning: false, timerDeadline: null, timerId: null
    };
  } catch { return null; }
}
function clearSessionGame() {
  try { sessionStorage.removeItem("hush-active-game"); } catch { /* Ignore unavailable storage. */ }
}
function normalizeCustomPairs(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(pair => Array.isArray(pair) && pair.length === 2 && pair.every(word => typeof word === "string" && word.trim()))
    .map(pair => pair.map(word => word.trim().slice(0, 40))).slice(0, 100);
}
const savedSetup = loadStoredJson("hush-setup", {});
const savedPlayers = Array.isArray(savedSetup.players) && savedSetup.players.length >= 3 && savedSetup.players.length <= 12 ? savedSetup.players.map(name => String(name).slice(0, 24)) : ["", "", "", ""];
const app = document.querySelector("#app");
const state = {
  screen: "home", players: savedPlayers, imposterCount: Number.isSafeInteger(savedSetup.imposterCount) ? savedSetup.imposterCount : 1, whiteCount: Number.isSafeInteger(savedSetup.whiteCount) ? savedSetup.whiteCount : 1,
  category: DEFAULT_PAIRS[savedSetup.category] ? savedSetup.category : "Everyday", customPairs: normalizeCustomPairs(loadStoredJson("hush-custom-pairs", [])),
  roles: [], revealIndex: 0, pair: null, starter: 0, turnPosition: 0, clueCycle: 1, roundNumber: 1, duration: 30, remaining: 30,
  timerId: null, timerRunning: false, timerDeadline: null, selectedVote: null, eliminatedIndex: null, winner: null, whiteGuesses: {}, offlineStatus: "checking"
};
let resumableGame = loadSessionGame();
if (savedSetup.category === "My words" && state.customPairs.length) state.category = "My words";
state.imposterCount = Math.min(state.players.length - 2, Math.max(0, state.imposterCount));
state.whiteCount = Math.min(state.players.length - 2 - state.imposterCount, Math.max(0, state.whiteCount));
if (state.imposterCount + state.whiteCount === 0) state.imposterCount = 1;

const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}
const initials = (name) => name.trim().slice(0, 1).toUpperCase() || "?";

function names() { return state.players.map((n, i) => n.trim() || `Player ${i + 1}`); }
function duplicateNameIndex(values = names()) {
  const normalized = values.map(name => name.replace(/\s+/g, " ").trim().toLocaleLowerCase());
  return normalized.findIndex((name, index) => normalized.indexOf(name) !== index);
}
function syncSetupInputs() {
  document.querySelectorAll("[data-player]").forEach(el => state.players[+el.dataset.player] = el.value);
  if (document.querySelector("#category")) state.category = document.querySelector("#category").value;
}
function saveSetup() {
  saveStoredJson("hush-setup", { players: state.players, imposterCount: state.imposterCount, whiteCount: state.whiteCount, category: state.category });
}
function saveSessionGame() {
  if (!state.roles.length || ["home", "setup", "result"].includes(state.screen)) return;
  const safeScreen = state.screen === "role" ? "handoff" : state.screen;
  const remaining = state.timerRunning && state.timerDeadline ? Math.max(0, Math.ceil((state.timerDeadline - Date.now()) / 1000)) : state.remaining;
  const snapshot = { ...state, screen: safeScreen, remaining, timerId: null, timerRunning: false, timerDeadline: null };
  resumableGame = snapshot;
  try { sessionStorage.setItem("hush-active-game", JSON.stringify({ version: 2, roles: snapshot.roles, pair: snapshot.pair, state: snapshot })); } catch { /* Continue without resume support. */ }
}
function normalizeWord(value) { return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase(); }
function activeIndices() { return state.roles.map((role, i) => role.active ? i : -1).filter(i => i >= 0); }
function roleName(type) { return type === "civilian" ? "a Civilian" : type === "imposter" ? "an Imposter" : "Mr. White"; }
function roleCounter(label, type, count) {
  const totalInfiltrators = state.imposterCount + state.whiteCount;
  const atMaximum = totalInfiltrators >= state.players.length - 2;
  const otherCount = type === "imposter" ? state.whiteCount : state.imposterCount;
  return `<div class="role-counter"><span><b>${label}</b><small>${type === "imposter" ? "Related word" : "No word"}</small></span><div class="mini-stepper"><button data-role-type="${type}" data-delta="-1" aria-label="Fewer ${label}" ${count === 0 || totalInfiltrators === 1 ? "disabled" : ""}>−</button><strong aria-live="polite">${count}</strong><button data-role-type="${type}" data-delta="1" aria-label="More ${label}" ${atMaximum && otherCount === 0 ? "disabled" : ""}>+</button></div></div>`;
}
let renderedScreen = null;
function render() {
  const screenChanged = renderedScreen !== state.screen;
  const activeData = !screenChanged && document.activeElement?.dataset ? { ...document.activeElement.dataset } : null;
  clearInterval(state.timerId);
  state.timerId = null;
  const views = { home, setup, handoff, role, round, vote, elimination, whiteGuess, result };
  app.innerHTML = views[state.screen]();
  if (!screenChanged) app.firstElementChild?.classList.add("no-enter");
  if (screenChanged) {
    window.scrollTo({ top: 0, behavior: "auto" });
    const heading = app.querySelector("h1, h2");
    if (heading) { heading.tabIndex = -1; window.requestAnimationFrame?.(() => heading.focus({ preventScroll: true })); }
  } else if (activeData) {
    const selector = activeData.action ? `[data-action="${activeData.action}"]` : activeData.vote ? `[data-vote="${activeData.vote}"]` : activeData.roleType ? `[data-role-type="${activeData.roleType}"][data-delta="${activeData.delta}"]` : null;
    if (selector) window.requestAnimationFrame?.(() => app.querySelector(selector)?.focus({ preventScroll: true }));
  }
  renderedScreen = state.screen;
  if (state.screen === "round" && state.timerRunning) startTimer();
  if (!["home", "setup", "result"].includes(state.screen)) saveSessionGame();
}

function home() { return `
  <section class="screen hero">
    <p class="eyebrow">PASS • PLAY • SUSPECT</p>
    <h1>Someone here is lying.</h1>
    <p class="lede">A pocket-sized game of Civilians, Imposters, and Mr. White. No accounts, no internet—just pass the phone and keep a straight face.</p>
    <div class="button-row">${resumableGame ? `<button class="button primary" data-action="resume-game">Continue game</button><button class="button secondary" data-action="new-game">Start over</button>` : `<button class="button primary" data-action="new-game">Start a game</button>`}<button class="button secondary" data-action="open-help">How it works</button></div>
    <div class="hero-art" aria-hidden="true"><div class="orbit orbit-one">BLUFF</div><div class="orbit orbit-two">CLUE</div><div class="scribble"></div><div class="eye"></div><div class="spark spark-one">✦</div><div class="spark spark-two">✦</div></div>
    <p class="tiny offline-status">${state.offlineStatus === "ready" ? "● Offline ready" : state.offlineStatus === "unavailable" ? "Offline mode unavailable" : "Preparing offline play…"} • 3–12 players</p>
  </section>`; }

function setup() { return `
  <section class="screen">
    <p class="eyebrow">GAME SETUP</p><h2>Gather your suspects.</h2>
    <div class="setup-columns">
      <div>
        <div class="stepper"><div><b>Players</b><div class="tiny">3 to 12 people</div></div><div class="stepper-controls"><button data-action="players-down" aria-label="Fewer players" ${state.players.length <= 3 ? "disabled" : ""}>−</button><span aria-live="polite">${state.players.length}</span><button data-action="players-up" aria-label="More players" ${state.players.length >= 12 ? "disabled" : ""}>+</button></div></div>
        <div class="player-list">${state.players.map((name, i) => `<input aria-label="Player ${i+1} name" data-player="${i}" maxlength="24" value="${escapeHtml(name)}" placeholder="Player ${i+1}">`).join("")}</div>
      </div>
      <div>
        <div class="section"><div class="section-heading"><h3>Hidden roles</h3><small>${state.players.length - state.imposterCount - state.whiteCount} Civilians</small></div>
          <div class="role-count-list">${roleCounter("Imposters", "imposter", state.imposterCount)}${roleCounter("Mr. White", "white", state.whiteCount)}</div>
          <p class="tiny">At least two players remain Civilians. Imposters and Civilians only see their secret word—not their role.</p>
        </div>
        <label class="field-label" for="category">WORD PACK</label>
        <select id="category">${[...Object.keys(DEFAULT_PAIRS), ...(state.customPairs.length ? ["My words"] : [])].map(c => `<option ${c === state.category ? "selected" : ""}>${c}</option>`).join("")}</select>
        <p class="tiny word-note">↻ Word-pair sides are randomly swapped every game.</p>
      </div>
    </div>
    <div class="button-row"><button class="button primary wide" data-action="start-game">Assign secret roles</button><button class="button secondary" data-action="custom-words">Add words</button></div>
  </section>`; }

function handoff() {
  const name = names()[state.revealIndex];
  return `<section class="screen handoff"><div class="avatar">${escapeHtml(initials(name))}</div><p class="eyebrow">PLAYER ${state.revealIndex + 1} OF ${state.players.length}</p><h2>Pass to ${escapeHtml(name)}</h2><p class="privacy">Make sure nobody else can see the screen. Hold the button when you're ready.</p><button class="button primary wide hold-button" data-action="hold-reveal">Hold to reveal<div class="progress"><i></i></div></button></section>`;
}

function role() {
  const role = state.roles[state.revealIndex];
  const isWhite = role.type === "white";
  return `<section class="screen secret-screen"><p class="eyebrow">YOUR SECRET</p><div class="role-card ${isWhite ? "imposter" : ""}"><div class="card-stamp">TOP<br>SECRET</div><div><span class="role-label">${isWhite ? "YOU ARE MR. WHITE" : "YOUR WORD IS"}</span><h2 class="secret-word">${isWhite ? "No word." : escapeHtml(role.word)}</h2></div><p class="role-note">${isWhite ? "Listen carefully and bluff. If voted out, you get one chance to guess the Civilians' word." : "You might be a Civilian or an Imposter. Your word alone does not reveal which—listen carefully to the clues."}</p></div><button class="button primary wide" data-action="hide-role" style="margin-top:18px">I've got it — hide my secret</button></section>`;
}

function round() {
  const pct = `${(state.remaining / state.duration) * 100}%`;
  const order = discussionOrder();
  const speaker = order[state.turnPosition % order.length];
  return `<section class="screen"><div class="game-header"><div><p class="eyebrow">DISCUSSION</p><h2>Describe your word.</h2></div><span class="round-pill">ROUND ${state.roundNumber}</span></div><div class="speaker-card"><span>NOW SPEAKING · CLUE CYCLE ${state.clueCycle}</span><b>${escapeHtml(names()[speaker])}</b><small>${state.turnPosition + 1} of ${order.length}</small></div><div class="timer ${state.timerRunning ? "is-running" : ""} ${state.remaining === 0 ? "is-done" : ""}" style="--timer:${pct}"><div class="timer-inner"><div class="timer-time">${formatTime(state.remaining)}</div><small>${state.remaining === 0 ? "TIME'S UP" : state.timerRunning ? "COUNTING" : "READY"}</small></div></div><div class="timer-adjust" aria-label="Adjust speaking time"><button data-action="timer-down" aria-label="Remove five seconds" ${state.duration <= 10 ? "disabled" : ""}>−5</button><span><b>${state.duration}s</b><small>per person</small></span><button data-action="timer-up" aria-label="Add five seconds" ${state.duration >= 180 ? "disabled" : ""}>+5</button></div><div class="timer-actions"><button class="button secondary" data-action="reset-timer">Reset</button><button class="button primary" data-action="toggle-timer">${state.timerRunning ? "Pause" : state.remaining < state.duration && state.remaining > 0 ? "Resume" : "Start"}</button><button class="button secondary" data-action="next-speaker">Next player →</button></div><button class="button vote-button wide" data-action="vote">End discussion & vote</button></section>`;
}

function discussionOrder() {
  const alive = activeIndices();
  const start = Math.max(0, alive.indexOf(state.starter));
  return [...alive.slice(start), ...alive.slice(0, start)];
}

function chooseStarter(allowMrWhite = false) {
  const eligible = activeIndices().filter(index => allowMrWhite || state.roles[index].type !== "white");
  const pool = eligible.length ? eligible : activeIndices();
  return pool[Math.floor(Math.random() * pool.length)];
}

function vote() { return `<section class="screen"><p class="eyebrow">ROUND ${state.roundNumber} • THE VOTE</p><h2>Who seems suspicious?</h2><p class="muted">Only surviving players can be eliminated. If the vote is tied, discuss and vote again until one player is chosen.</p><div class="vote-list">${activeIndices().map(i => `<button class="vote ${state.selectedVote === i ? "selected" : ""}" data-vote="${i}" aria-pressed="${state.selectedVote === i}"><span>${escapeHtml(names()[i])}</span><span>${state.selectedVote === i ? "SELECTED" : "TAP TO VOTE"}</span></button>`).join("")}</div><div class="button-row"><button class="button danger wide" data-action="eliminate" ${state.selectedVote === null ? "disabled" : ""}>${state.selectedVote === null ? "Choose a player" : `Eliminate ${escapeHtml(names()[state.selectedVote])}`}</button><button class="button secondary" data-action="back-round">Back</button></div></section>`; }

function elimination() {
  const i = state.eliminatedIndex, role = state.roles[i];
  return `<section class="screen reveal-result elimination-reveal"><div class="reveal-rays" aria-hidden="true"></div><p class="eyebrow">PLAYER ELIMINATED</p><div class="result-icon">${role.type === "civilian" ? "😬" : role.type === "imposter" ? "🕵️" : "⬜"}</div><h2>${escapeHtml(names()[i])} was ${roleName(role.type)}.</h2><p class="lede" style="margin-inline:auto">${role.type === "white" ? "Mr. White now gets one final chance to steal the game." : role.type === "imposter" ? "One Imposter is out. Are there more hiding?" : "An innocent Civilian has been eliminated."}</p><button class="button primary wide" data-action="after-elimination">${role.type === "white" ? "Make the final guess" : "Check the game"}</button></section>`;
}

function whiteGuess() {
  return `<section class="screen"><p class="eyebrow">MR. WHITE'S LAST CHANCE</p><h2>Guess the Civilians' word.</h2><p class="muted"><b>${escapeHtml(names()[state.eliminatedIndex])}</b> gets one exact guess. Capitalization and surrounding spaces do not matter.</p><form id="white-guess-form"><label class="field-label" for="white-guess">FINAL GUESS</label><input id="white-guess" maxlength="40" autocomplete="off" enterkeyhint="done" placeholder="Type the word"><button class="button primary wide" type="submit" style="margin-top:14px">Lock in guess</button></form></section>`;
}

function result() {
  const label = state.winner === "civilian" ? "Civilians win!" : state.winner === "infiltrator" ? "Infiltrators win!" : "Mr. White wins!";
  const note = state.winner === "civilian" ? "Every Imposter and Mr. White has been caught." : state.winner === "infiltrator" ? "Only one Civilian remains, so the infiltrator faction takes the game." : "Mr. White cracked the Civilians' word after being eliminated.";
  const particles = Array.from({length: 30}, (_, i) => `<i style="--x:${(i * 43) % 101 - 50};--r:${(i * 67) % 360};--d:${(i % 7) * .08}s"></i>`).join("");
  const playerRows = state.roles.map((role, index) => {
    const won = state.winner === "civilian" && role.type === "civilian" || state.winner === "infiltrator" && role.type !== "civilian" || state.winner === "white" && index === state.eliminatedIndex;
    const guessWon = state.winner === "white" && index === state.eliminatedIndex;
    const guess = role.type === "white" && state.whiteGuesses[index] ? `<em class="${guessWon ? "guess-correct" : "guess-wrong"}">${guessWon ? "Correct" : "Incorrect"}: “${escapeHtml(state.whiteGuesses[index])}”</em>` : "";
    return `<div class="player-outcome ${won ? "won" : "lost"}"><span class="outcome-name">${escapeHtml(names()[index])}<small>${roleName(role.type)}${guess}</small></span><span class="outcome-tags">${won ? `<b class="status winner-status">Winner</b>` : ""}<b class="status ${role.active ? "alive-status" : "out-status"}">${role.active ? "Survived" : `Voted · R${role.eliminatedRound || "?"}`}</b></span></div>`;
  }).join("");
  return `<section class="screen reveal-result celebration winner-${state.winner}"><div class="confetti" aria-hidden="true">${particles}</div><div class="victory-halo" aria-hidden="true"></div><p class="eyebrow">GAME OVER</p><div class="result-icon">${state.winner === "civilian" ? "🏆" : state.winner === "infiltrator" ? "🕵️" : "⬜"}</div><h2>${label}</h2><p class="lede" style="margin-inline:auto">${note}</p><div class="word-pair"><span class="word-chip">Civilian word: <b>${escapeHtml(state.pair[0])}</b></span><span class="word-chip">Imposter word: <b>${escapeHtml(state.pair[1])}</b></span></div><div class="final-roles">${playerRows}</div><div class="button-row"><button class="button primary wide" data-action="play-again">Play again</button><button class="button secondary wide" data-action="home">Home</button></div></section>`;
}

function startGame() {
  syncSetupInputs();
  const effectiveNames = names();
  const duplicate = duplicateNameIndex(effectiveNames);
  if (duplicate >= 0) {
    const normalizedDuplicate = effectiveNames[duplicate].replace(/\s+/g, " ").trim().toLocaleLowerCase();
    const first = effectiveNames.findIndex(name => name.replace(/\s+/g, " ").trim().toLocaleLowerCase() === normalizedDuplicate);
    const inputs = document.querySelectorAll("[data-player]");
    inputs[first]?.setAttribute("aria-invalid", "true");
    inputs[duplicate]?.setAttribute("aria-invalid", "true");
    inputs[duplicate]?.focus();
    toast("Each player needs a unique name");
    return;
  }
  state.remaining = state.duration;
  const source = state.category === "My words" ? state.customPairs : DEFAULT_PAIRS[state.category];
  state.pair = [...source[Math.floor(Math.random() * source.length)]];
  if (Math.random() < .5) state.pair.reverse();
  const civilianCount = state.players.length - state.imposterCount - state.whiteCount;
  const types = shuffle([...Array(civilianCount).fill("civilian"), ...Array(state.imposterCount).fill("imposter"), ...Array(state.whiteCount).fill("white")]);
  state.roles = types.map(type => ({ type, word: type === "civilian" ? state.pair[0] : type === "imposter" ? state.pair[1] : null, active: true }));
  clearSessionGame(); resumableGame = null;
  state.revealIndex = 0; state.starter = chooseStarter(); state.turnPosition = 0; state.clueCycle = 1; state.roundNumber = 1; state.selectedVote = null; state.eliminatedIndex = null; state.winner = null; state.whiteGuessed = false; state.whiteGuesses = {}; state.timerRunning = false; state.screen = "handoff"; render();
}

function finishElimination() {
  const alive = state.roles.filter(role => role.active);
  const civilians = alive.filter(role => role.type === "civilian").length;
  const infiltrators = alive.filter(role => role.type !== "civilian").length;
  if (infiltrators === 0) { state.winner = "civilian"; state.screen = "result"; clearSessionGame(); resumableGame = null; render(); return; }
  if (civilians <= 1) { state.winner = "infiltrator"; state.screen = "result"; clearSessionGame(); resumableGame = null; render(); return; }
  state.roundNumber++;
  state.remaining = state.duration;
  state.turnPosition = 0;
  state.clueCycle = 1;
  state.selectedVote = null;
  state.eliminatedIndex = null;
  state.starter = chooseStarter(true);
  state.screen = "round";
  render();
}

function openCustomWords() {
  syncSetupInputs();
  saveSetup();
  renderCustomPairs();
  document.querySelector("#words-dialog").showModal();
  document.querySelector("#custom-word-one").focus();
}

function renderCustomPairs() {
  const list = document.querySelector("#custom-pairs");
  if (!list) return;
  list.innerHTML = state.customPairs.length ? `<p class="field-label">SAVED PAIRS</p>${state.customPairs.map((pair, index) => `<div class="custom-pair"><span><b>${escapeHtml(pair[0])}</b><small>↔</small><b>${escapeHtml(pair[1])}</b></span><button data-delete-pair="${index}" aria-label="Delete ${escapeHtml(pair[0])} and ${escapeHtml(pair[1])}">×</button></div>`).join("")}` : `<p class="empty-state">No custom pairs yet.</p>`;
}

function saveCustomPair() {
  const firstInput = document.querySelector("#custom-word-one");
  const secondInput = document.querySelector("#custom-word-two");
  const first = firstInput.value.trim();
  const second = secondInput.value.trim();
  firstInput.removeAttribute("aria-invalid"); secondInput.removeAttribute("aria-invalid");
  if (!first || !second) { (!first ? firstInput : secondInput).setAttribute("aria-invalid", "true"); toast("Enter both words"); return; }
  if (normalizeWord(first) === normalizeWord(second)) { secondInput.setAttribute("aria-invalid", "true"); toast("Use two different words"); return; }
  const duplicate = state.customPairs.some(pair => pair.map(normalizeWord).sort().join("|") === [normalizeWord(first), normalizeWord(second)].sort().join("|"));
  if (duplicate) { toast("That pair is already saved"); return; }
  if (state.customPairs.length >= 100) { toast("Custom word library is full"); return; }
  state.customPairs.push([first, second]);
  saveStoredJson("hush-custom-pairs", state.customPairs);
  state.category = "My words"; saveSetup();
  firstInput.value = ""; secondInput.value = ""; renderCustomPairs(); firstInput.focus(); toast("Word pair saved");
}

function submitWhiteGuess() {
  const enteredGuess = document.querySelector("#white-guess")?.value.trim();
  if (!enteredGuess) { toast("Enter one final guess"); return; }
  state.whiteGuesses[state.eliminatedIndex] = enteredGuess;
  if (normalizeWord(enteredGuess) === normalizeWord(state.pair[0])) {
    state.whiteGuessed = true; state.winner = "white"; state.screen = "result"; clearSessionGame(); resumableGame = null; render();
  } else {
    toast("Incorrect guess"); finishElimination();
  }
}

function formatTime(seconds) { return `${String(Math.floor(seconds / 60)).padStart(2,"0")}:${String(seconds % 60).padStart(2,"0")}`; }
function pauseTimer() {
  if (state.timerRunning && state.timerDeadline) state.remaining = Math.max(0, Math.ceil((state.timerDeadline - Date.now()) / 1000));
  state.timerRunning = false; state.timerDeadline = null; clearInterval(state.timerId); state.timerId = null;
}
function finishTimer() {
  clearInterval(state.timerId); state.timerId = null; state.timerRunning = false; state.timerDeadline = null; state.remaining = 0;
  navigator.vibrate?.([150,80,150]); render(); toast("Time's up — next player!");
}
function updateTimerDisplay() {
  if (!state.timerRunning || !state.timerDeadline) return;
  state.remaining = Math.max(0, Math.ceil((state.timerDeadline - Date.now()) / 1000));
  const time = document.querySelector(".timer-time"); const timer = document.querySelector(".timer");
  if (time) time.textContent = formatTime(state.remaining);
  if (timer) timer.style.setProperty("--timer", `${state.remaining/state.duration*100}%`);
  if (!state.remaining) finishTimer();
}
function startTimer() {
  clearInterval(state.timerId);
  if (!state.timerDeadline) state.timerDeadline = Date.now() + state.remaining * 1000;
  updateTimerDisplay();
  if (state.timerRunning) state.timerId = setInterval(updateTimerDisplay, 250);
}
function toast(message) { const node = document.querySelector("#toast-template").content.firstElementChild.cloneNode(); node.textContent = message; document.body.append(node); setTimeout(() => node.remove(), 2300); }

document.addEventListener("click", e => {
  const deletePairButton = e.target.closest("[data-delete-pair]");
  if (deletePairButton) {
    state.customPairs.splice(+deletePairButton.dataset.deletePair, 1);
    saveStoredJson("hush-custom-pairs", state.customPairs);
    if (!state.customPairs.length && state.category === "My words") state.category = "Everyday";
    saveSetup(); renderCustomPairs(); toast("Word pair removed"); return;
  }
  const roleButton = e.target.closest("[data-role-type]");
  if (roleButton) {
    syncSetupInputs();
    const key = roleButton.dataset.roleType === "imposter" ? "imposterCount" : "whiteCount";
    const delta = +roleButton.dataset.delta;
    const otherKey = key === "imposterCount" ? "whiteCount" : "imposterCount";
    const next = state[key] + delta;
    const nextTotal = state.imposterCount + state.whiteCount + delta;
    if (delta > 0 && nextTotal > state.players.length - 2 && state[otherKey] > 0) { state[otherKey]--; state[key]++; }
    else if (next >= 0 && nextTotal >= 1 && nextTotal <= state.players.length - 2) state[key] = next;
    saveSetup(); render();
    return;
  }
  const voteButton = e.target.closest("[data-vote]");
  if (voteButton) { state.selectedVote = +voteButton.dataset.vote; render(); return; }
  const action = e.target.closest("[data-action]")?.dataset.action; if (!action) return;
  if (action === "new-game") { if (resumableGame && !window.confirm("Start over and discard the saved game?")) return; clearSessionGame(); resumableGame = null; state.roles = []; state.screen = "setup"; render(); }
  if (action === "resume-game" && resumableGame) { Object.assign(state, resumableGame, { timerId: null, timerRunning: false, timerDeadline: null }); resumableGame = null; render(); }
  if (action === "home") { const activeGame = state.roles.length && !["home", "setup", "result"].includes(state.screen); if (activeGame && !window.confirm("Leave this game? Current progress will be lost.")) return; pauseTimer(); clearSessionGame(); resumableGame = null; state.roles = []; state.screen = "home"; render(); }
  if (action === "open-help") { if (state.timerRunning) { pauseTimer(); render(); } document.querySelector("#help-dialog").showModal(); }
  if (action === "close-help") document.querySelector("#help-dialog").close();
  if (action === "players-up" && state.players.length < 12) { syncSetupInputs(); state.players.push(""); saveSetup(); render(); }
  if (action === "players-down" && state.players.length > 3) { syncSetupInputs(); state.players.pop(); while (state.imposterCount + state.whiteCount > state.players.length - 2) { if (state.whiteCount > 0) state.whiteCount--; else state.imposterCount--; } saveSetup(); render(); }
  if (action === "start-game") startGame();
  if (action === "custom-words") openCustomWords();
  if (action === "close-words") { document.querySelector("#words-dialog").close(); if (state.screen === "setup") render(); }
  if (action === "save-custom-pair") saveCustomPair();
  if (action === "hide-role") { state.revealIndex++; if (state.revealIndex >= state.players.length) { state.revealIndex = 0; state.screen = "round"; } else state.screen = "handoff"; render(); }
  if (action === "toggle-timer") { if (state.timerRunning) pauseTimer(); else { if (state.remaining === 0) state.remaining = state.duration; state.timerRunning = true; state.timerDeadline = Date.now() + state.remaining * 1000; } render(); }
  if (action === "reset-timer") { pauseTimer(); state.remaining = state.duration; render(); }
  if (action === "timer-down" || action === "timer-up") { const delta = action === "timer-up" ? 5 : -5; if (state.timerRunning) updateTimerDisplay(); const previous = state.duration; state.duration = Math.max(10, Math.min(180, state.duration + delta)); const applied = state.duration - previous; state.remaining = Math.max(0, Math.min(state.duration, state.remaining + applied)); if (state.timerRunning) state.timerDeadline = Date.now() + state.remaining * 1000; if (state.timerRunning && state.remaining === 0) finishTimer(); else render(); }
  if (action === "next-speaker") { pauseTimer(); const count = discussionOrder().length; state.turnPosition++; if (state.turnPosition >= count) { state.turnPosition = 0; state.clueCycle++; toast("Everyone has spoken — continue or vote"); } state.remaining = state.duration; render(); }
  if (action === "vote") { pauseTimer(); state.selectedVote = null; state.screen = "vote"; render(); }
  if (action === "back-round") { state.screen = "round"; render(); }
  if (action === "eliminate" && state.selectedVote !== null) { if (!window.confirm(`Eliminate ${names()[state.selectedVote]}? This cannot be undone.`)) return; state.eliminatedIndex = state.selectedVote; state.roles[state.eliminatedIndex].active = false; state.roles[state.eliminatedIndex].eliminatedRound = state.roundNumber; state.screen = "elimination"; render(); }
  if (action === "after-elimination") { if (state.roles[state.eliminatedIndex].type === "white") { state.screen = "whiteGuess"; render(); document.querySelector("#white-guess")?.focus(); } else finishElimination(); }
  if (action === "submit-guess") submitWhiteGuess();
  if (action === "play-again") { clearSessionGame(); resumableGame = null; state.roles = []; state.screen = "setup"; render(); }
});

let holdTimer = null;
function beginRevealHold(button) {
  if (holdTimer || state.screen !== "handoff") return;
  button.classList.add("holding");
  holdTimer = setTimeout(() => { holdTimer = null; navigator.vibrate?.(35); state.screen = "role"; render(); }, 700);
}
function cancelRevealHold() {
  clearTimeout(holdTimer); holdTimer = null; document.querySelector(".holding")?.classList.remove("holding");
}
document.addEventListener("pointerdown", e => { const button = e.target.closest('[data-action="hold-reveal"]'); if (button) beginRevealHold(button); });
document.addEventListener("pointerup", cancelRevealHold);
document.addEventListener("pointercancel", cancelRevealHold);
document.addEventListener("pointerleave", e => { if (e.target.closest?.('[data-action="hold-reveal"]')) cancelRevealHold(); }, true);
document.addEventListener("keydown", e => { const button = e.target.closest?.('[data-action="hold-reveal"]'); if (!button || !["Enter", " "].includes(e.key)) return; e.preventDefault(); beginRevealHold(button); });
document.addEventListener("keyup", e => { if (["Enter", " "].includes(e.key)) cancelRevealHold(); });
document.addEventListener("change", e => {
  if (e.target.id === "category") { state.category = e.target.value; saveSetup(); }
});
document.addEventListener("submit", e => {
  if (e.target.id === "white-guess-form") { e.preventDefault(); submitWhiteGuess(); }
  if (e.target.id === "custom-word-form") { e.preventDefault(); saveCustomPair(); }
});
document.addEventListener("input", e => {
  if (!e.target.matches("[data-player]")) return;
  e.target.removeAttribute("aria-invalid");
  state.players[+e.target.dataset.player] = e.target.value;
  saveSetup();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { cancelRevealHold(); saveSessionGame(); if (state.screen === "role") { state.screen = "handoff"; render(); } }
  if (!document.hidden && state.timerRunning) updateTimerDisplay();
});
window.addEventListener("pagehide", saveSessionGame);

if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").then(() => navigator.serviceWorker.ready).then(() => { state.offlineStatus = "ready"; if (state.screen === "home") render(); }).catch(() => { state.offlineStatus = "unavailable"; if (state.screen === "home") render(); }));
else state.offlineStatus = "unavailable";
render();
