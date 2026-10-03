const fs = require("node:fs");
const vm = require("node:vm");

const listeners = {};
const storage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
};
const app = { innerHTML: "", querySelector: () => null };
const toastTemplate = { content: { firstElementChild: { cloneNode: () => ({ textContent: "", remove() {} }) } } };
const elements = new Map();
const document = {
  hidden: false,
  body: { append(node) { sandbox.toasts.push(node.textContent); } },
  querySelector(selector) {
    if (selector === "#app") return app;
    if (selector === "#toast-template") return toastTemplate;
    return elements.get(selector) ?? null;
  },
  querySelectorAll(selector) { return selector === "[data-player]" ? (elements.get("players") ?? []) : []; },
  addEventListener(type, callback) { (listeners[type] ??= []).push(callback); }
};
const window = { scrollTo() {}, requestAnimationFrame(callback) { callback(); }, addEventListener() {}, confirm: () => true };
const sandbox = {
  console, document, window, navigator: {}, localStorage: storage(), sessionStorage: storage(),
  setInterval: () => 1, clearInterval() {}, setTimeout: callback => { sandbox.pendingTimeout = callback; return 1; }, clearTimeout() {},
  Date, Math, toasts: [], pendingTimeout: null
};
vm.createContext(sandbox);
const source = fs.readFileSync("app.js", "utf8") + `\nglobalThis.game = { state, names, duplicateNameIndex, shuffle, chooseStarter, discussionOrder, finishElimination, submitWhiteGuess, result, roleCounter, render, pauseTimer, saveSessionGame };`;
vm.runInContext(source, sandbox);
const game = sandbox.game;

function assert(condition, message) { if (!condition) throw new Error(message); }
function clickTarget({ action, roleType, delta }) {
  const target = { closest(selector) {
    if (selector === "[data-role-type]" && roleType) return { dataset: { roleType, delta: String(delta) } };
    if (selector === "[data-action]" && action) return { dataset: { action } };
    return null;
  } };
  listeners.click[0]({ target });
}
function resetRoles(roles) {
  game.state.players = roles.map((_, index) => `P${index + 1}`);
  game.state.roles = roles.map(([type, active]) => ({ type, active, word: type === "white" ? null : type === "civilian" ? "Moon" : "Sun" }));
  game.state.pair = ["Moon", "Sun"];
  game.state.roundNumber = 1; game.state.clueCycle = 1; game.state.duration = 30; game.state.remaining = 30;
  game.state.timerRunning = false; game.state.timerDeadline = null; game.state.selectedVote = null; game.state.eliminatedIndex = null;
  game.state.winner = null; game.state.whiteGuesses = {}; game.state.screen = "round"; game.state.starter = 0; game.state.turnPosition = 0;
}

const tests = [
  ["unique names ignore case and repeated spaces", () => {
    assert(game.duplicateNameIndex(["Alex", " alex "]) === 1, "case duplicate missed");
    assert(game.duplicateNameIndex(["Alex Tan", "Alex   Tan"]) === 1, "space duplicate missed");
  }],
  ["opening starter excludes Mr White", () => {
    resetRoles([["white", true], ["civilian", true], ["imposter", true]]);
    const original = sandbox.Math.random; sandbox.Math.random = () => 0;
    assert(game.chooseStarter() === 1, "Mr White opened round one");
    assert(game.chooseStarter(true) === 0, "Mr White was not eligible later");
    sandbox.Math.random = original;
  }],
  ["civilian and infiltrator victory conditions", () => {
    resetRoles([["civilian", true], ["civilian", true], ["imposter", false]]); game.finishElimination();
    assert(game.state.winner === "civilian", "civilian victory failed");
    resetRoles([["civilian", true], ["civilian", false], ["imposter", true]]); game.finishElimination();
    assert(game.state.winner === "infiltrator", "one-civilian victory failed");
  }],
  ["wrong Mr White guess never leaks the word", () => {
    resetRoles([["civilian", true], ["civilian", true], ["white", false], ["imposter", true]]);
    game.state.eliminatedIndex = 2; game.state.screen = "whiteGuess"; sandbox.toasts.length = 0;
    elements.set("#white-guess", { value: "Star" }); game.submitWhiteGuess();
    assert(game.state.screen === "round", "game did not continue");
    assert(game.state.whiteGuesses[2] === "Star", "guess not recorded");
    assert(!sandbox.toasts.join(" ").includes("Moon"), "Civilian word leaked");
  }],
  ["correct Mr White guess wins immediately", () => {
    resetRoles([["civilian", true], ["civilian", true], ["white", false], ["imposter", true]]);
    game.state.eliminatedIndex = 2; game.state.screen = "whiteGuess";
    elements.set("#white-guess", { value: "  MOON  " }); game.submitWhiteGuess();
    assert(game.state.winner === "white" && game.state.screen === "result", "Mr White win failed");
    assert(game.result().includes("Correct: “MOON”"), "correct guess absent from results");
  }],
  ["three-player role type can be swapped", () => {
    game.state.players = ["A", "B", "C"]; game.state.imposterCount = 1; game.state.whiteCount = 0; game.state.screen = "setup";
    const html = game.roleCounter("Mr. White", "white", 0);
    assert(!/data-delta="1"[^>]*disabled/.test(html), "Mr White swap control disabled");
    clickTarget({ roleType: "white", delta: 1 });
    assert(game.state.imposterCount === 0 && game.state.whiteCount === 1, "atomic role swap failed");
  }],
  ["clue order rotates from chosen starter", () => {
    resetRoles([["civilian", true], ["civilian", true], ["imposter", true], ["white", true]]); game.state.starter = 2;
    assert(game.discussionOrder().join(",") === "2,3,0,1", "discussion order wrong");
  }],
  ["Fisher-Yates preserves every configured role", () => {
    const shuffled = game.shuffle(["civilian", "civilian", "imposter", "white"]);
    assert(shuffled.slice().sort().join(",") === "civilian,civilian,imposter,white", "shuffle lost a role");
  }],
  ["results distinguish winners, survivors and voted players", () => {
    resetRoles([["civilian", true], ["civilian", true], ["imposter", false]]); game.state.roles[2].eliminatedRound = 1; game.state.winner = "civilian";
    const html = game.result();
    assert(html.includes("Winner") && html.includes("Survived") && html.includes("Voted · R1"), "outcome labels missing");
  }],
  ["speaker timer resets and announces a new clue cycle", () => {
    resetRoles([["civilian", true], ["civilian", true], ["imposter", true]]); game.state.turnPosition = 2; game.state.clueCycle = 1; game.state.remaining = 7; game.state.timerRunning = false;
    clickTarget({ action: "next-speaker" });
    assert(game.state.turnPosition === 0 && game.state.clueCycle === 2 && game.state.remaining === 30, "clue cycle did not reset");
  }],
  ["active game resume snapshot hides an exposed secret", () => {
    resetRoles([["civilian", true], ["civilian", true], ["imposter", true]]); game.state.screen = "role"; game.state.revealIndex = 1;
    game.saveSessionGame();
    const saved = JSON.parse(sandbox.sessionStorage.getItem("hush-active-game"));
    assert(saved.state.screen === "handoff" && saved.state.revealIndex === 1, "resume snapshot exposed secret");
  }],
  ["backgrounding hides a revealed secret", () => {
    resetRoles([["civilian", true], ["civilian", true], ["imposter", true]]); game.state.screen = "role"; document.hidden = true;
    listeners.visibilitychange[0](); document.hidden = false;
    assert(game.state.screen === "handoff", "secret remained exposed");
  }]
];

let passed = 0;
for (const [name, test] of tests) {
  try { test(); passed++; console.log(`✓ ${name}`); }
  catch (error) { console.error(`✗ ${name}\n  ${error.message}`); process.exitCode = 1; }
}
console.log(`\n${passed}/${tests.length} tests passed`);
