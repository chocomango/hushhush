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
  screen: "home", players: ["", "", "", ""], mode: "undercover", minorityCount: 1,
  category: "Everyday", customPairs: JSON.parse(localStorage.getItem("hush-custom-pairs") || "[]"),
  roles: [], revealIndex: 0, pair: null, starter: 0, duration: 180, remaining: 180,
  timerId: null, timerRunning: false, selectedVote: null
};

const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const shuffle = (items) => [...items].sort(() => Math.random() - .5);
const initials = (name) => name.trim().slice(0, 1).toUpperCase() || "?";

function names() { return state.players.map((n, i) => n.trim() || `Player ${i + 1}`); }
function render() {
  clearInterval(state.timerId);
  state.timerId = null;
  const views = { home, setup, handoff, role, round, vote, result };
  app.innerHTML = views[state.screen]();
  window.scrollTo({ top: 0, behavior: "instant" });
  if (state.screen === "round" && state.timerRunning) startTimer();
}

function home() { return `
  <section class="screen hero">
    <p class="eyebrow">PASS • PLAY • SUSPECT</p>
    <h1>Someone here is lying.</h1>
    <p class="lede">A pocket-sized social deduction game. No accounts, no internet, no awkward setup—just pass the phone and keep a straight face.</p>
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
        <div class="section">
          <div class="section-heading"><h3>Game style</h3></div>
          <div class="mode-grid">
            <label class="choice"><input type="radio" name="mode" value="undercover" ${state.mode === "undercover" ? "checked" : ""}><span class="choice-card"><b>Undercover</b><small>Everyone gets a word, but the minority gets a similar one.</small></span></label>
            <label class="choice"><input type="radio" name="mode" value="imposter" ${state.mode === "imposter" ? "checked" : ""}><span class="choice-card"><b>Imposter</b><small>The minority gets no word and must bluff their way through.</small></span></label>
          </div>
        </div>
        <label class="field-label" for="category">WORD PACK</label>
        <select id="category">${[...Object.keys(DEFAULT_PAIRS), ...(state.customPairs.length ? ["My words"] : [])].map(c => `<option ${c === state.category ? "selected" : ""}>${c}</option>`).join("")}</select>
        <label class="field-label" for="duration">ROUND TIME</label>
        <select id="duration"><option value="120">2 minutes</option><option value="180" ${state.duration === 180 ? "selected" : ""}>3 minutes</option><option value="300" ${state.duration === 300 ? "selected" : ""}>5 minutes</option></select>
        <label class="field-label" for="minority">MINORITY PLAYERS</label>
        <select id="minority">${Array.from({length: Math.max(1, Math.floor((state.players.length - 1) / 3))}, (_,i) => `<option value="${i+1}" ${state.minorityCount === i+1 ? "selected" : ""}>${i+1}</option>`).join("")}</select>
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
  const odd = role.type === "minority";
  const noWord = odd && state.mode === "imposter";
  return `<section class="screen"><p class="eyebrow">YOUR SECRET</p><div class="role-card ${noWord ? "imposter" : ""}"><div><span class="role-label">${noWord ? "YOU ARE THE IMPOSTER" : odd ? "YOU ARE UNDERCOVER" : "YOUR WORD IS"}</span><h2 class="secret-word">${noWord ? "No word." : escapeHtml(role.word)}</h2></div><p class="role-note">${noWord ? "Listen carefully, improvise a clue, and don't get caught." : odd ? "Your word may differ from the group. Blend in without being too vague." : "Give a useful clue, but don't make the secret too obvious."}</p></div><button class="button primary wide" data-action="hide-role" style="margin-top:18px">I've got it — hide my role</button></section>`;
}

function round() {
  const pct = `${(state.remaining / state.duration) * 100}%`;
  return `<section class="screen"><div class="game-header"><div><p class="eyebrow">DISCUSSION</p><h2>Choose your words wisely.</h2></div><span class="round-pill">ROUND 1</span></div><div class="timer" style="--timer:${pct}"><div class="timer-inner"><div class="timer-time">${formatTime(state.remaining)}</div><small>${state.timerRunning ? "REMAINING" : "READY"}</small></div></div><p class="starter"><b>${escapeHtml(names()[state.starter])}</b> gives the first clue.</p><div class="button-row"><button class="button primary wide" data-action="toggle-timer">${state.timerRunning ? "Pause timer" : state.remaining < state.duration ? "Resume timer" : "Start timer"}</button><button class="button secondary wide" data-action="vote">Vote now</button></div></section>`;
}

function vote() { return `<section class="screen"><p class="eyebrow">THE VOTE</p><h2>Who seems suspicious?</h2><p class="muted">Discuss, then tap the player the group wants to eliminate.</p><div class="vote-list">${names().map((name,i) => `<button class="vote ${state.selectedVote === i ? "selected" : ""}" data-vote="${i}"><span>${escapeHtml(name)}</span><span>${state.selectedVote === i ? "SELECTED" : "TAP TO VOTE"}</span></button>`).join("")}</div><div class="button-row"><button class="button danger wide" data-action="reveal-result" ${state.selectedVote === null ? "disabled" : ""}>Reveal their role</button><button class="button secondary" data-action="back-round">Back</button></div></section>`; }

function result() {
  const role = state.roles[state.selectedVote]; const caught = role.type === "minority";
  const minority = state.roles.map((r,i) => r.type === "minority" ? names()[i] : null).filter(Boolean);
  return `<section class="screen reveal-result"><p class="eyebrow">THE REVEAL</p><div class="result-icon">${caught ? "🕵️" : "😬"}</div><h2>${caught ? "Caught red-handed!" : "Wrong suspect."}</h2><p class="lede" style="margin-inline:auto"><b>${escapeHtml(names()[state.selectedVote])}</b> was ${caught ? state.mode === "imposter" ? "an Imposter" : "Undercover" : "in the majority"}. ${caught ? "The group takes the round." : "The minority slips away and wins."}</p><div class="word-pair"><span class="word-chip">Majority: <b>${escapeHtml(state.pair[0])}</b></span>${state.mode === "undercover" ? `<span class="word-chip">Undercover: <b>${escapeHtml(state.pair[1])}</b></span>` : ""}</div><p class="tiny">${state.minorityCount > 1 ? `Minority players: ${minority.map(escapeHtml).join(", ")}` : `The odd player was ${escapeHtml(minority[0])}.`}</p><div class="button-row"><button class="button primary wide" data-action="play-again">Play again</button><button class="button secondary wide" data-action="home">Home</button></div></section>`;
}

function startGame() {
  document.querySelectorAll("[data-player]").forEach(el => state.players[+el.dataset.player] = el.value);
  state.mode = document.querySelector('input[name="mode"]:checked').value;
  state.category = document.querySelector("#category").value;
  state.duration = +document.querySelector("#duration").value; state.remaining = state.duration;
  state.minorityCount = +document.querySelector("#minority").value;
  const source = state.category === "My words" ? state.customPairs : DEFAULT_PAIRS[state.category];
  state.pair = source[Math.floor(Math.random() * source.length)];
  const types = shuffle([...Array(state.players.length - state.minorityCount).fill("majority"), ...Array(state.minorityCount).fill("minority")]);
  state.roles = types.map(type => ({ type, word: type === "majority" ? state.pair[0] : state.pair[1] }));
  state.revealIndex = 0; state.starter = Math.floor(Math.random() * state.players.length); state.selectedVote = null; state.timerRunning = false; state.screen = "handoff"; render();
}

function customWords() {
  const majority = prompt("Majority word (example: Coffee)"); if (!majority?.trim()) return;
  const minority = prompt("Related Undercover word (example: Tea)"); if (!minority?.trim()) return;
  state.customPairs.push([majority.trim(), minority.trim()]); localStorage.setItem("hush-custom-pairs", JSON.stringify(state.customPairs)); state.category = "My words"; render(); toast("Word pair saved");
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
  if (action === "players-up" && state.players.length < 12) { state.players.push(""); render(); }
  if (action === "players-down" && state.players.length > 3) { state.players.pop(); state.minorityCount = Math.min(state.minorityCount, Math.max(1, Math.floor((state.players.length-1)/3))); render(); }
  if (action === "start-game") startGame();
  if (action === "custom-words") customWords();
  if (action === "hide-role") { state.revealIndex++; if (state.revealIndex >= state.players.length) { state.revealIndex = 0; state.screen = "round"; } else state.screen = "handoff"; render(); }
  if (action === "toggle-timer") { state.timerRunning = !state.timerRunning; render(); }
  if (action === "vote") { state.timerRunning = false; state.screen = "vote"; render(); }
  if (action === "back-round") { state.screen = "round"; render(); }
  if (action === "reveal-result" && state.selectedVote !== null) { state.screen = "result"; render(); }
  if (action === "play-again") { state.screen = "setup"; render(); }
});

let holdTimer;
document.addEventListener("pointerdown", e => { const button = e.target.closest('[data-action="hold-reveal"]'); if (!button) return; button.classList.add("holding"); holdTimer = setTimeout(() => { navigator.vibrate?.(35); state.screen = "role"; render(); }, 700); });
document.addEventListener("pointerup", () => { clearTimeout(holdTimer); document.querySelector(".holding")?.classList.remove("holding"); });
document.addEventListener("pointercancel", () => { clearTimeout(holdTimer); document.querySelector(".holding")?.classList.remove("holding"); });
document.addEventListener("change", e => { if (e.target.name === "mode") state.mode = e.target.value; if (e.target.id === "category") state.category = e.target.value; });

if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
render();
