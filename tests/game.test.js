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
  documentElement: { lang: "en" },
  body: { append(node) { sandbox.toasts.push(node.textContent); } },
  querySelector(selector) {
    if (selector === "#app") return app;
    if (selector === "#toast-template") return toastTemplate;
    return elements.get(selector) ?? null;
  },
  querySelectorAll(selector) { return selector === "[data-player]" ? (elements.get("players") ?? []) : (elements.get(selector) ?? []); },
  addEventListener(type, callback) { (listeners[type] ??= []).push(callback); }
};
const window = { scrollTo() {}, requestAnimationFrame(callback) { callback(); }, addEventListener() {}, confirm: () => true };
const sandbox = {
  console, document, window, navigator: {}, localStorage: storage(), sessionStorage: storage(),
  setInterval: () => 1, clearInterval() {}, setTimeout: callback => { sandbox.pendingTimeout = callback; return 1; }, clearTimeout() {},
  Date, Math, toasts: [], pendingTimeout: null
};
vm.createContext(sandbox);
const source = fs.readFileSync("app.js", "utf8") + `\nglobalThis.game = { state, names, duplicateNameIndex, shuffle, chooseStarter, discussionOrder, finishElimination, submitWhiteGuess, result, roleCounter, render, pauseTimer, saveSessionGame, saveSetup, loadSessionGame, normalizeAvatars, startGame, DEFAULT_PAIRS, CHINESE_PAIRS, home, setup, handoff, role, round, vote, elimination, whiteGuess, renderCustomPairs, localizeShell };`;
vm.runInContext(fs.readFileSync("words.js", "utf8"), sandbox);
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
  ["start-screen toggle translates the whole app and returns to English", () => {
    const shellText = { textContent: "HOW TO PLAY", dataset: { i18nZh: "游戏玩法" } };
    const shellButton = { dataset: { i18nAriaZh: "关闭" }, label: "Close", getAttribute() { return this.label; }, setAttribute(key, value) { this.label = value; } };
    elements.set("[data-i18n-zh]", [shellText]); elements.set("[data-i18n-aria-zh]", [shellButton]);
    game.state.screen = "home"; clickTarget({ action: "language-zh" });
    assert(app.innerHTML.includes('data-action="language-zh"') && app.innerHTML.includes("开始游戏"), "home toggle or translation missing");
    assert(document.documentElement.lang === "zh-Hans" && shellText.textContent === "游戏玩法" && shellButton.label === "关闭", "shell not translated");
    resetRoles([["civilian", true], ["civilian", true], ["white", false], ["imposter", true]]);
    game.state.players[0] = "Start a game"; game.state.roles[0].word = "Secret <word>";
    game.state.avatars = game.normalizeAvatars([], 4); game.state.eliminatedIndex = 2; game.state.winner = "civilian";
    const views = [[game.setup, "分配秘密身份"], [game.handoff, "长按查看"], [game.role, "隐藏我的秘密"], [game.round, "结束讨论并投票"], [game.vote, "选择一位玩家"], [game.elimination, "最后猜词"], [game.whiteGuess, "确认答案"], [game.result, "再玩一局"]];
    for (const [view, label] of views) assert(view().includes(label), "missing Chinese screen: " + label);
    assert(game.setup().includes('value="Start a game"') && game.role().includes("Secret &lt;word&gt;"), "translation altered player content");
    const list = { innerHTML: "" }; elements.set("#custom-pairs", list); game.state.customPairs = []; game.renderCustomPairs();
    assert(list.innerHTML.includes("还没有自定义词语对"), "custom-word UI not translated");
    game.state.screen = "home"; clickTarget({ action: "language-en" });
    assert(app.innerHTML.includes("Start a game") && shellText.textContent === "HOW TO PLAY" && shellButton.label === "Close", "English restoration failed");
    assert(!game.setup().includes('data-action="language-zh"'), "toggle still in setup");
    elements.delete("#custom-pairs"); elements.delete("[data-i18n-zh]"); elements.delete("[data-i18n-aria-zh]");
  }],
  ["resuming respects the app language and preserves assigned words", () => {
    resetRoles([["civilian", true], ["civilian", true], ["imposter", true]]);
    game.state.language = "en"; game.saveSessionGame();
    game.state.screen = "home"; clickTarget({ action: "language-zh" }); clickTarget({ action: "resume-game" });
    assert(game.state.language === "zh" && game.state.pair.join(",") === "Moon,Sun", "resume changed app preference or assigned words");
    game.state.screen = "home"; clickTarget({ action: "language-en" }); clickTarget({ action: "new-game" });
  }],
  ["Chinese toggle uses independent packs and custom storage", () => {
    game.state.screen = "home"; game.state.category = "Everyday";
    game.state.players = ["A", "B", "C"]; game.state.imposterCount = 1; game.state.whiteCount = 0;
    sandbox.localStorage.setItem("hush-custom-pairs", JSON.stringify([["Coffee", "Tea"]]));
    sandbox.localStorage.setItem("hush-custom-pairs-zh", JSON.stringify([["包子", "馒头"]]));
    clickTarget({ action: "language-zh" });
    assert(game.state.language === "zh" && game.state.customPairs[0][0] === "包子", "Chinese custom library not selected");
    assert(JSON.parse(sandbox.localStorage.getItem("hush-setup")).language === "zh", "language preference not saved");
    const seen = new Set();
    for (const [category, pairs] of Object.entries(game.CHINESE_PAIRS)) {
      for (const pair of pairs) {
        assert(pair.length === 2 && pair.every(word => typeof word === "string" && word.length <= 40 && /[\u3400-\u9fff]/.test(word)) && pair[0] !== pair[1], "invalid Chinese pair");
        const key = pair.slice().sort().join("|");
        assert(!seen.has(key), "duplicate Chinese pair"); seen.add(key);
      }
      game.state.category = category; game.startGame();
      assert(pairs.some(pair => pair.slice().sort().join("|") === game.state.pair.slice().sort().join("|")), "Chinese game used wrong library");
      game.saveSessionGame();
      assert(game.loadSessionGame().language === "zh", "resume lost language");
    }
    assert(seen.size === 96, "Chinese pack count changed");
    game.state.screen = "home"; game.state.category = "My words";
    clickTarget({ action: "language-en" });
    assert(game.state.customPairs[0][0] === "Coffee", "English custom library lost");
    game.state.category = "Everyday";
  }],
  ["built-in library has valid distinct word pairs without duplicates", () => {
    const seen = new Set();
    for (const [category, pairs] of Object.entries(game.DEFAULT_PAIRS)) {
      assert(category !== "My words" && pairs.length > 0, "invalid or empty pack");
      for (const pair of pairs) {
        assert(Array.isArray(pair) && pair.length === 2 && pair.every(word => typeof word === "string" && word.trim() === word && word.length > 0 && word.length <= 40), "malformed pair in " + category);
        const normalized = pair.map(word => word.normalize("NFKC").toLocaleLowerCase());
        assert(normalized[0] !== normalized[1], "identical words in " + category);
        const key = normalized.sort().join("|");
        assert(!seen.has(key), "duplicate pair: " + key); seen.add(key);
      }
    }
    assert(seen.size >= 240, "word library unexpectedly small");
  }],
  ["every built-in pack can assign secret roles", () => {
    for (const category of Object.keys(game.DEFAULT_PAIRS)) {
      resetRoles([["civilian", true], ["civilian", true], ["imposter", true]]);
      game.state.imposterCount = 1; game.state.whiteCount = 0; game.state.category = category;
      game.startGame();
      assert(game.state.screen === "handoff" && game.state.roles.length === 3, "pack failed to start: " + category);
      assert(game.DEFAULT_PAIRS[category].some(pair => pair.slice().sort().join("|") === game.state.pair.slice().sort().join("|")), "wrong pack used");
      assert(game.state.roles.every(role => role.word === game.state.pair[role.type === "civilian" ? 0 : 1]), "incorrect role words");
    }
  }],
  ["word library loads before the game and is cached offline", () => {
    const html = fs.readFileSync("index.html", "utf8");
    assert(html.indexOf('src="words.js"') >= 0 && html.indexOf('src="words.js"') < html.indexOf('src="app.js"'), "library load order is wrong");
    assert(fs.readFileSync("sw.js", "utf8").includes('"./words.js"'), "library missing from offline cache");
  }],
  ["avatar selections persist in setup and resumed games", () => {
    resetRoles([["civilian", true], ["civilian", true], ["imposter", true]]);
    game.state.avatars = ["bunny", "cat", "pup"];
    game.saveSetup(); game.saveSessionGame();
    assert(JSON.parse(sandbox.localStorage.getItem("hush-setup")).avatars.join(",") === "bunny,cat,pup", "setup lost chosen avatars");
    assert(game.loadSessionGame().avatars.join(",") === "bunny,cat,pup", "resume lost chosen avatars");
  }],
  ["older saved games and invalid avatars get safe defaults", () => {
    resetRoles([["civilian", true], ["civilian", true], ["imposter", true]]);
    game.saveSessionGame();
    const saved = JSON.parse(sandbox.sessionStorage.getItem("hush-active-game"));
    delete saved.state.avatars;
    sandbox.sessionStorage.setItem("hush-active-game", JSON.stringify(saved));
    assert(game.loadSessionGame().avatars.join(",") === "bear,cat,bunny", "older game failed avatar migration");
    assert(game.normalizeAvatars(["pup", "invalid", null], 3).join(",") === "pup,cat,bunny", "invalid avatar was accepted");
  }],
  ["player count changes keep avatars aligned", () => {
    game.state.screen = "setup"; game.state.players = ["A", "B", "C"]; game.state.avatars = ["pup", "cat", "bunny"];
    clickTarget({ action: "players-up" });
    assert(game.state.avatars.length === 4 && game.state.avatars[0] === "pup", "adding player lost avatars");
    clickTarget({ action: "players-down" });
    assert(game.state.avatars.join(",") === "pup,cat,bunny", "removing player misaligned avatars");
  }],
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
