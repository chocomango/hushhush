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

const app = document.querySelector("#app");
const state = {
  screen: "home", players: ["", "", "", ""], imposterCount: 1, whiteCount: 1,
  category: "Everyday", customPairs: JSON.parse(localStorage.getItem("hush-custom-pairs") || "[]"),
  roles: [], revealIndex: 0, pair: null, starter: 0, roundNumber: 1, duration: 180, remaining: 180,
  timerId: null, timerRunning: false, selectedVote: null, eliminatedIndex: null, winner: null
};

const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const shuffle = (items) => [...items].sort(() => Math.random() - .5);
const initials = (name) => name.trim().slice(0, 1).toUpperCase() || "?";

function names() { return state.players.map((n, i) => n.trim() || `Player ${i + 1}`); }
function syncSetupInputs() {
  document.querySelectorAll("[data-player]").forEach(el => state.players[+el.dataset.player] = el.value);
  if (document.querySelector("#category")) state.category = document.querySelector("#category").value;
  if (document.querySelector("#duration")) state.duration = +document.querySelector("#duration").value;
}
function activeIndices() { return state.roles.map((role, i) => role.active ? i : -1).filter(i => i >= 0); }
function roleName(type) { return type === "civilian" ? "a Civilian" : type === "imposter" ? "an Imposter" : "Mr. White"; }
function countOptions(selected, isWhite = false) {
  const other = isWhite ? state.imposterCount : state.whiteCount;
  const minimum = other === 0 ? 1 : 0;
  const maximum = Math.max(minimum, state.players.length - 2 - other);
  return Array.from({ length: maximum - minimum + 1 }, (_, i) => i + minimum)
    .map(count => `<option value="${count}" ${count === selected ? "selected" : ""}>${count}</option>`).join("");
}
function render() {
  clearInterval(state.timerId);
  state.timerId = null;
  const views = { home, setup, handoff, role, round, vote, elimination, whiteGuess, result };
  app.innerHTML = views[state.screen]();
  window.scrollTo({ top: 0, behavior: "instant" });
  if (state.screen === "round" && state.timerRunning) startTimer();
}

function home() { return `
  <section class="screen hero">
    <p class="eyebrow">PASS • PLAY • SUSPECT</p>
    <h1>Someone here is lying.</h1>
    <p class="lede">A pocket-sized game of Civilians, Imposters, and Mr. White. No accounts, no internet—just pass the phone and keep a straight face.</p>
    <div class="button-row"><button class="button primary" data-action="new-game">Start a game</button><button class="button secondary" data-action="open-help">How it works</button></div>
    <div class="hero-art" aria-hidden="true"><div class="scribble"></div><div class="eye"></div></div>
    <p class="tiny">Works with 3–12 players • Saved on this device</p>
  </section>`; }

function setup() { return `
  <section class="screen">
    <p class="eyebrow">GAME SETUP</p><h2>Gather your suspects.</h2>
    <div class="setup-columns">
      <div>
        <div class="stepper"><div><b>Players</b><div class="tiny">3 to 12 people</div></div><div class="stepper-controls"><button data-action="players-down" aria-label="Fewer players">−</button><span>${state.players.length}</span><button data-action="players-up" aria-label="More players">+</button></div></div>
        <div class="player-list">${state.players.map((name, i) => `<input aria-label="Player ${i+1} name" data-player="${i}" value="${escapeHtml(name)}" placeholder="Player ${i+1}">`).join("")}</div>
      </div>
      <div>
        <div class="section"><div class="section-heading"><h3>Hidden roles</h3><small>${state.players.length - state.imposterCount - state.whiteCount} Civilians</small></div>
          <div class="role-count-grid">
            <label><span class="field-label">IMPOSTERS</span><select id="imposter-count">${countOptions(state.imposterCount)}</select></label>
            <label><span class="field-label">MR. WHITE</span><select id="white-count">${countOptions(state.whiteCount, true)}</select></label>
          </div><p class="tiny">At least two players remain Civilians. Imposters and Civilians only see their secret word—not their role.</p>
        </div>
        <label class="field-label" for="category">WORD PACK</label>
        <select id="category">${[...Object.keys(DEFAULT_PAIRS), ...(state.customPairs.length ? ["My words"] : [])].map(c => `<option ${c === state.category ? "selected" : ""}>${c}</option>`).join("")}</select>
        <label class="field-label" for="duration">ROUND TIME</label>
        <select id="duration"><option value="120">2 minutes</option><option value="180" ${state.duration === 180 ? "selected" : ""}>3 minutes</option><option value="300" ${state.duration === 300 ? "selected" : ""}>5 minutes</option></select>
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
  return `<section class="screen"><p class="eyebrow">YOUR SECRET</p><div class="role-card ${isWhite ? "imposter" : ""}"><div><span class="role-label">${isWhite ? "YOU ARE MR. WHITE" : "YOUR WORD IS"}</span><h2 class="secret-word">${isWhite ? "No word." : escapeHtml(role.word)}</h2></div><p class="role-note">${isWhite ? "Listen carefully and bluff. If voted out, you get one chance to guess the Civilians' word." : "You might be a Civilian or an Imposter. Your word alone does not reveal which—listen carefully to the clues."}</p></div><button class="button primary wide" data-action="hide-role" style="margin-top:18px">I've got it — hide my secret</button></section>`;
}

function round() {
  const pct = `${(state.remaining / state.duration) * 100}%`;
  return `<section class="screen"><div class="game-header"><div><p class="eyebrow">DISCUSSION</p><h2>Choose your words wisely.</h2></div><span class="round-pill">ROUND ${state.roundNumber}</span></div><div class="timer" style="--timer:${pct}"><div class="timer-inner"><div class="timer-time">${formatTime(state.remaining)}</div><small>${state.timerRunning ? "REMAINING" : "READY"}</small></div></div><p class="starter"><b>${escapeHtml(names()[state.starter])}</b> gives the first clue. <span class="tiny">${activeIndices().length} players remain.</span></p><div class="button-row"><button class="button primary wide" data-action="toggle-timer">${state.timerRunning ? "Pause timer" : state.remaining < state.duration ? "Resume timer" : "Start timer"}</button><button class="button secondary wide" data-action="vote">Vote now</button></div></section>`;
}

function vote() { return `<section class="screen"><p class="eyebrow">ROUND ${state.roundNumber} • THE VOTE</p><h2>Who seems suspicious?</h2><p class="muted">Only surviving players can be eliminated. Choose the group's final vote.</p><div class="vote-list">${activeIndices().map(i => `<button class="vote ${state.selectedVote === i ? "selected" : ""}" data-vote="${i}"><span>${escapeHtml(names()[i])}</span><span>${state.selectedVote === i ? "SELECTED" : "TAP TO VOTE"}</span></button>`).join("")}</div><div class="button-row"><button class="button danger wide" data-action="eliminate" ${state.selectedVote === null ? "disabled" : ""}>Eliminate player</button><button class="button secondary" data-action="back-round">Back</button></div></section>`; }

function elimination() {
  const i = state.eliminatedIndex, role = state.roles[i];
  return `<section class="screen reveal-result"><p class="eyebrow">PLAYER ELIMINATED</p><div class="result-icon">${role.type === "civilian" ? "😬" : role.type === "imposter" ? "🕵️" : "⬜"}</div><h2>${escapeHtml(names()[i])} was ${roleName(role.type)}.</h2><p class="lede" style="margin-inline:auto">${role.type === "white" ? "Mr. White now gets one final chance to steal the game." : role.type === "imposter" ? "One Imposter is out. Are there more hiding?" : "An innocent Civilian has been eliminated."}</p><button class="button primary wide" data-action="after-elimination">${role.type === "white" ? "Make the final guess" : "Check the game"}</button></section>`;
}

function whiteGuess() {
  return `<section class="screen"><p class="eyebrow">MR. WHITE'S LAST CHANCE</p><h2>Guess the Civilians' word.</h2><p class="muted"><b>${escapeHtml(names()[state.eliminatedIndex])}</b> gets one guess. Spelling and capitalization do not matter.</p><label class="field-label" for="white-guess">FINAL GUESS</label><input id="white-guess" autocomplete="off" placeholder="Type the word"><button class="button primary wide" data-action="submit-guess" style="margin-top:14px">Lock in guess</button></section>`;
}

function result() {
  const label = state.winner === "civilian" ? "Civilians win!" : state.winner === "infiltrator" ? "Infiltrators win!" : "Mr. White wins!";
  const note = state.winner === "civilian" ? "Every Imposter and Mr. White has been caught." : state.winner === "infiltrator" ? "Only one Civilian remains, so the surviving infiltrators take the game." : "Mr. White cracked the Civilians' word after being eliminated.";
  return `<section class="screen reveal-result"><p class="eyebrow">GAME OVER</p><div class="result-icon">${state.winner === "civilian" ? "🏆" : state.winner === "infiltrator" ? "🕵️" : "⬜"}</div><h2>${label}</h2><p class="lede" style="margin-inline:auto">${note}</p><div class="word-pair"><span class="word-chip">Civilian word: <b>${escapeHtml(state.pair[0])}</b></span><span class="word-chip">Imposter word: <b>${escapeHtml(state.pair[1])}</b></span></div><div class="final-roles">${state.roles.map((r,i) => `<div><span>${escapeHtml(names()[i])}</span><b>${roleName(r.type)}</b></div>`).join("")}</div><div class="button-row"><button class="button primary wide" data-action="play-again">Play again</button><button class="button secondary wide" data-action="home">Home</button></div></section>`;
}

function startGame() {
  syncSetupInputs();
  state.remaining = state.duration;
  state.imposterCount = +document.querySelector("#imposter-count").value;
  state.whiteCount = +document.querySelector("#white-count").value;
  const source = state.category === "My words" ? state.customPairs : DEFAULT_PAIRS[state.category];
  state.pair = [...source[Math.floor(Math.random() * source.length)]];
  if (Math.random() < .5) state.pair.reverse();
  const civilianCount = state.players.length - state.imposterCount - state.whiteCount;
  const types = shuffle([...Array(civilianCount).fill("civilian"), ...Array(state.imposterCount).fill("imposter"), ...Array(state.whiteCount).fill("white")]);
  state.roles = types.map(type => ({ type, word: type === "civilian" ? state.pair[0] : type === "imposter" ? state.pair[1] : null, active: true }));
  state.revealIndex = 0; state.starter = Math.floor(Math.random() * state.players.length); state.roundNumber = 1; state.selectedVote = null; state.eliminatedIndex = null; state.winner = null; state.whiteGuessed = false; state.timerRunning = false; state.screen = "handoff"; render();
}

function finishElimination() {
  const alive = state.roles.filter(role => role.active);
  const civilians = alive.filter(role => role.type === "civilian").length;
  const infiltrators = alive.filter(role => role.type !== "civilian").length;
  if (infiltrators === 0) { state.winner = "civilian"; state.screen = "result"; render(); return; }
  if (civilians <= 1) { state.winner = "infiltrator"; state.screen = "result"; render(); return; }
  state.roundNumber++;
  state.remaining = state.duration;
  state.selectedVote = null;
  state.eliminatedIndex = null;
  const alivePlayers = activeIndices();
  state.starter = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
  state.screen = "round";
  render();
}

function customWords() {
  const civilianWord = prompt("Civilian word (example: Coffee)"); if (!civilianWord?.trim()) return;
  const imposterWord = prompt("Related Imposter word (example: Tea)"); if (!imposterWord?.trim()) return;
  state.customPairs.push([civilianWord.trim(), imposterWord.trim()]); localStorage.setItem("hush-custom-pairs", JSON.stringify(state.customPairs)); state.category = "My words"; render(); toast("Word pair saved");
}

function formatTime(seconds) { return `${String(Math.floor(seconds / 60)).padStart(2,"0")}:${String(seconds % 60).padStart(2,"0")}`; }
function startTimer() {
  clearInterval(state.timerId);
  state.timerId = setInterval(() => { state.remaining = Math.max(0, state.remaining - 1); const time = document.querySelector(".timer-time"); const timer = document.querySelector(".timer"); if (time) time.textContent = formatTime(state.remaining); if (timer) timer.style.setProperty("--timer", `${state.remaining/state.duration*100}%`); if (!state.remaining) { clearInterval(state.timerId); state.timerId = null; state.timerRunning = false; navigator.vibrate?.([150,80,150]); toast("Time's up — vote!"); } }, 1000);
}
function toast(message) { const node = document.querySelector("#toast-template").content.firstElementChild.cloneNode(); node.textContent = message; document.body.append(node); setTimeout(() => node.remove(), 2300); }

document.addEventListener("click", e => {
  const voteButton = e.target.closest("[data-vote]");
  if (voteButton) { state.selectedVote = +voteButton.dataset.vote; render(); return; }
  const action = e.target.closest("[data-action]")?.dataset.action; if (!action) return;
  if (action === "new-game") { state.screen = "setup"; render(); }
  if (action === "home") { state.screen = "home"; render(); }
  if (action === "open-help") document.querySelector("#help-dialog").showModal();
  if (action === "close-help") document.querySelector("#help-dialog").close();
  if (action === "players-up" && state.players.length < 12) { syncSetupInputs(); state.players.push(""); render(); }
  if (action === "players-down" && state.players.length > 3) { syncSetupInputs(); state.players.pop(); while (state.imposterCount + state.whiteCount > state.players.length - 2) { if (state.whiteCount > 0) state.whiteCount--; else state.imposterCount--; } render(); }
  if (action === "start-game") startGame();
  if (action === "custom-words") customWords();
  if (action === "hide-role") { state.revealIndex++; if (state.revealIndex >= state.players.length) { state.revealIndex = 0; state.screen = "round"; } else state.screen = "handoff"; render(); }
  if (action === "toggle-timer") { state.timerRunning = !state.timerRunning; render(); }
  if (action === "vote") { state.timerRunning = false; state.screen = "vote"; render(); }
  if (action === "back-round") { state.screen = "round"; render(); }
  if (action === "eliminate" && state.selectedVote !== null) { state.eliminatedIndex = state.selectedVote; state.roles[state.eliminatedIndex].active = false; state.screen = "elimination"; render(); }
  if (action === "after-elimination") { if (state.roles[state.eliminatedIndex].type === "white") { state.screen = "whiteGuess"; render(); document.querySelector("#white-guess")?.focus(); } else finishElimination(); }
  if (action === "submit-guess") { const guess = document.querySelector("#white-guess").value.trim().toLocaleLowerCase(); if (!guess) { toast("Enter one final guess"); return; } if (guess === state.pair[0].trim().toLocaleLowerCase()) { state.whiteGuessed = true; state.winner = "white"; state.screen = "result"; render(); } else { toast(`The word was ${state.pair[0]}`); finishElimination(); } }
  if (action === "play-again") { state.screen = "setup"; render(); }
});

let holdTimer;
document.addEventListener("pointerdown", e => { const button = e.target.closest('[data-action="hold-reveal"]'); if (!button) return; button.classList.add("holding"); holdTimer = setTimeout(() => { navigator.vibrate?.(35); state.screen = "role"; render(); }, 700); });
document.addEventListener("pointerup", () => { clearTimeout(holdTimer); document.querySelector(".holding")?.classList.remove("holding"); });
document.addEventListener("pointercancel", () => { clearTimeout(holdTimer); document.querySelector(".holding")?.classList.remove("holding"); });
document.addEventListener("change", e => {
  if (e.target.id === "category") state.category = e.target.value;
  if (e.target.id === "imposter-count" || e.target.id === "white-count") {
    syncSetupInputs();
    if (e.target.id === "imposter-count") state.imposterCount = +e.target.value;
    else state.whiteCount = +e.target.value;
    render();
  }
  if (e.target.id === "duration") state.duration = +e.target.value;
});

if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
render();
