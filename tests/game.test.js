const fs = require("node:fs");
const vm = require("node:vm");

const listeners = {};
const windowListeners = {};
const timeouts = new Map();
const intervals = new Map();
let nextTimerId = 1;
const storage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key), clear: () => values.clear() };
};
const app = { innerHTML: "", querySelector: () => null };
const toastTemplate = { content: { firstElementChild: { cloneNode: () => ({ textContent: "", remove() {} }) } } };
const elements = new Map();
function dialog() {
  const events = {};
  return { open: false, addEventListener(type, callback) { (events[type] ??= []).push(callback); }, showModal() { this.open = true; }, close() { this.open = false; (events.close ?? []).forEach(callback => callback()); } };
}
elements.set("#words-dialog", dialog());
elements.set("#help-dialog", dialog());
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
const window = { scrollTo() {}, requestAnimationFrame(callback) { callback(); }, addEventListener(type, callback) { (windowListeners[type] ??= []).push(callback); }, confirm: () => true };
class ClockDate extends Date { static now() { return sandbox.now; } }
const sandbox = {
  console, document, window, navigator: {}, localStorage: storage(), sessionStorage: storage(),
  setInterval(callback) { const id = nextTimerId++; intervals.set(id, callback); return id; }, clearInterval(id) { intervals.delete(id); },
  setTimeout(callback, delay = 0) { const id = nextTimerId++; timeouts.set(id, { callback, at: sandbox.now + delay }); return id; }, clearTimeout(id) { timeouts.delete(id); },
  Date: ClockDate, Math: Object.create(Math), toasts: [], now: 1800000000000
};
vm.createContext(sandbox);
const source = fs.readFileSync("app.js", "utf8") + `\nglobalThis.game = { state, names, duplicateNameIndex, shuffle, chooseStarter, discussionOrder, finishElimination, submitWhiteGuess, result, roleCounter, render, pauseTimer, saveSessionGame, saveSetup, loadSessionGame, normalizeAvatars, startGame, DEFAULT_PAIRS, CHINESE_PAIRS, home, setup, handoff, role, round, vote, elimination, whiteGuess, renderCustomPairs, localizeShell, normalizeGameConfig, configuredRoleTypes, detectWinner, isWinningPlayer, wordPairKey, drawWordPair, GAME_MODES, CLUE_RULES, nextSpeaker, finishTimer, updateTimerDisplay, selectChallenge, sourcePairs, recordGame, loadScoreboard, endGame, clearSessionGame, beginRevealHold, cancelRevealHold, concealSecret, normalizeCustomPairs, beginVoting, ballotVoter, ballotOptions, tallyBallots, castBallot, ballotHandoff, ballot, ballotResult };`;
vm.runInContext(fs.readFileSync("words.js", "utf8"), sandbox);
vm.runInContext(fs.readFileSync("rules.js", "utf8"), sandbox);
vm.runInContext(source, sandbox);
const game = sandbox.game;

function assert(condition, message) { if (!condition) throw new Error(message); }
function clickTarget({ action, roleType, delta, vote, ballot, mode, deletePair, detail = 1 }) {
  const target = { closest(selector) {
    if (selector === "[data-role-type]" && roleType) return { dataset: { roleType, delta: String(delta) } };
    if (selector === "[data-action]" && action) return { dataset: { action } };
    if (selector === "[data-vote]" && vote !== undefined) return { dataset: { vote: String(vote) } };
    if (selector === "[data-ballot]" && ballot !== undefined) return { dataset: { ballot: String(ballot) } };
    if (selector === "[data-mode]" && mode) return { dataset: { mode } };
    if (selector === "[data-delete-pair]" && deletePair !== undefined) return { dataset: { deletePair: String(deletePair) } };
    return null;
  } };
  listeners.click[0]({ target, detail });
}
function dispatch(type, event = {}, target = listeners) { (target[type] ?? []).forEach(callback => callback(event)); }
function advanceTime(milliseconds) {
  sandbox.now += milliseconds;
  for (const [id, timeout] of [...timeouts]) if (timeout.at <= sandbox.now) { timeouts.delete(id); timeout.callback(); }
}
function resetRoles(roles) {
  game.pauseTimer(); game.cancelRevealHold(); timeouts.clear(); intervals.clear();
  game.state.players = roles.map((_, index) => `P${index + 1}`);
  game.state.roles = roles.map(([type, active]) => ({ type, active, word: type === "white" ? null : ["civilian", "accomplice"].includes(type) ? "Moon" : "Sun" }));
  game.state.avatars = game.normalizeAvatars([], roles.length);
  game.state.mode = "classic"; game.state.accompliceEnabled = false; game.state.jesterEnabled = false; game.state.challengeId = null;
  game.state.votingStyle = "group"; game.state.ballotOrder = []; game.state.ballots = {}; game.state.ballotPosition = 0; game.state.ballotCandidates = []; game.state.selectedBallot = null;
  game.state.imposterCount = roles.filter(([type]) => type === "imposter").length; game.state.whiteCount = roles.filter(([type]) => type === "white").length;
  game.state.gameId = null; game.state.gamesRecorded = false; game.state.feedbackEnabled = false;
  game.state.pair = ["Moon", "Sun"];
  game.state.roundNumber = 1; game.state.clueCycle = 1; game.state.duration = 30; game.state.remaining = 30;
  game.state.timerRunning = false; game.state.timerDeadline = null; game.state.selectedVote = null; game.state.eliminatedIndex = null;
  game.state.winner = null; game.state.whiteGuesses = {}; game.state.screen = "round"; game.state.starter = 0; game.state.turnPosition = 0;
}
function castVotes(targets) {
  targets.forEach(target => {
    assert(game.state.screen === "ballotHandoff", "next ballot was not hidden behind a handoff");
    clickTarget({ action: "open-ballot" }); clickTarget({ ballot: target }); clickTarget({ action: "cast-ballot" });
  });
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
    assert(seen.size >= 320, "Chinese library unexpectedly small");
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
    assert(seen.size >= 400, "English library unexpectedly small");
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
    assert(html.indexOf('src="rules.js"') >= 0 && html.indexOf('src="rules.js"') < html.indexOf('src="app.js"'), "rules load order is wrong");
    assert(fs.readFileSync("sw.js", "utf8").includes('"./words.js"'), "library missing from offline cache");
    assert(fs.readFileSync("sw.js", "utf8").includes('"./rules.js"'), "rules missing from offline cache");
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
    const saved = JSON.parse(sandbox.localStorage.getItem("hush-active-game"));
    delete saved.state.avatars;
    sandbox.localStorage.setItem("hush-active-game", JSON.stringify(saved));
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
    assert(game.duplicateNameIndex(["Alex", "Ａlex"]) === 1, "scoreboard-equivalent Unicode duplicate missed");
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
    const saved = JSON.parse(sandbox.localStorage.getItem("hush-active-game"));
    assert(saved.state.screen === "handoff" && saved.state.revealIndex === 1, "resume snapshot exposed secret");
  }],
  ["backgrounding hides a revealed secret", () => {
    resetRoles([["civilian", true], ["civilian", true], ["imposter", true]]); game.state.screen = "role"; document.hidden = true;
    listeners.visibilitychange[0](); document.hidden = false;
    assert(game.state.screen === "handoff", "secret remained exposed");
  }],
  ["configuration always keeps two Civilians and an Imposter or Mr White", () => {
    for (let playerCount = 3; playerCount <= 12; playerCount++) {
      for (const imposterCount of [-1, 0, 1, 4, 99, NaN]) {
        for (const whiteCount of [0, 1, 4, 99]) {
          const config = game.normalizeGameConfig({ mode: "constructor", imposterCount, whiteCount, accompliceEnabled: true, jesterEnabled: true }, playerCount);
          const roles = game.configuredRoleTypes(config, playerCount);
          assert(config.mode === "classic", "prototype mode passed validation");
          assert(roles.length === playerCount && roles.filter(role => role === "civilian").length >= 2, "configuration lost minimum Civilians");
          assert(config.imposterCount + config.whiteCount >= 1, "special roles replaced every baseline infiltrator");
          assert(playerCount >= 5 || !config.accompliceEnabled && !config.jesterEnabled, "special role enabled for small group");
          assert(roles.filter(role => role === "jester").length <= 1 && roles.filter(role => role === "accomplice").length <= 1, "multiple unique special roles");
        }
      }
    }
  }],
  ["shrinking the group disables special roles and preserves role balance", () => {
    resetRoles([["civilian", true], ["civilian", true], ["imposter", true], ["accomplice", true], ["jester", true]]);
    game.state.screen = "setup"; game.state.accompliceEnabled = true; game.state.jesterEnabled = true;
    sandbox.toasts.length = 0; clickTarget({ action: "players-down" });
    assert(game.state.players.length === 4 && !game.state.accompliceEnabled && !game.state.jesterEnabled, "small group kept special roles");
    assert(game.state.players.length - game.state.imposterCount - game.state.whiteCount >= 2, "shrinking removed minimum Civilians");
    assert(sandbox.toasts.length === 1, "special-role adjustment was not explained");
  }],
  ["special roles cannot remove the last Imposter or Mr White", () => {
    resetRoles([["civilian", true], ["civilian", true], ["imposter", true], ["accomplice", true], ["jester", true]]);
    game.state.screen = "setup"; game.state.accompliceEnabled = true; game.state.jesterEnabled = true;
    const html = game.roleCounter("Imposters", "imposter", 1);
    assert(/data-role-type="imposter" data-delta="-1"[^>]*disabled/.test(html), "last baseline infiltrator decrement appeared enabled");
    clickTarget({ roleType: "imposter", delta: -1 });
    assert(game.state.imposterCount === 1 && game.state.whiteCount === 0, "special roles replaced the last baseline infiltrator");
  }],
  ["Jester elimination wins before normal faction checks", () => {
    const roles = [{ type: "civilian", active: true }, { type: "imposter", active: true }, { type: "jester", active: false }];
    assert(game.detectWinner(roles, 2) === "jester", "infiltrators overrode eliminated Jester");
    roles[1].active = false;
    assert(game.detectWinner(roles, 2) === "jester", "Civilians overrode eliminated Jester");
    resetRoles([["civilian", true], ["civilian", true], ["imposter", true], ["jester", false], ["civilian", true]]);
    game.state.eliminatedIndex = 3; game.finishElimination();
    assert(game.state.screen === "result" && game.state.winner === "jester", "Jester elimination did not end game");
  }],
  ["surviving Jester is neutral and never shares faction victories", () => {
    const roles = [{ type: "civilian", active: true }, { type: "civilian", active: true }, { type: "imposter", active: false }, { type: "jester", active: true }];
    assert(game.detectWinner(roles, 2) === "civilian", "surviving Jester blocked Civilian victory");
    assert(!game.isWinningPlayer(roles[3], 3, "civilian", 2) && !game.isWinningPlayer(roles[3], 3, "infiltrator", 2), "Jester joined faction victory");
    assert(!game.isWinningPlayer(roles[3], 3, "jester", 2), "wrong Jester seat won");
  }],
  ["special roles receive their own instructions and the correct secret words", () => {
    resetRoles([["civilian", true], ["civilian", true], ["imposter", true], ["accomplice", true], ["jester", true]]);
    game.state.language = "en"; game.state.category = "Everyday"; game.state.accompliceEnabled = true; game.state.jesterEnabled = true;
    game.startGame();
    const accomplice = game.state.roles.findIndex(role => role.type === "accomplice");
    const jester = game.state.roles.findIndex(role => role.type === "jester");
    assert(accomplice >= 0 && jester >= 0, "special role missing from deal");
    assert(game.state.roles[accomplice].word === game.state.pair[0] && game.state.roles[jester].word === game.state.pair[1], "special role assigned wrong word");
    game.state.revealIndex = accomplice;
    assert(game.role().includes("the Accomplice") && game.role().includes("infiltrator team"), "Accomplice did not learn their allegiance");
    game.state.revealIndex = jester;
    assert(game.role().includes("the Jester") && game.role().includes("win alone"), "Jester did not learn their win condition");
    assert(game.detectWinner([{ type: "civilian", active: true }, { type: "accomplice", active: true }], null) === "infiltrator", "Accomplice excluded from infiltrator victory");
  }],
  ["new modes, special roles, scoreboard and timer controls translate into Chinese", () => {
    resetRoles([["civilian", true], ["civilian", true], ["imposter", true], ["accomplice", true], ["jester", false]]);
    game.state.language = "zh"; game.state.accompliceEnabled = true; game.state.jesterEnabled = true; game.state.category = "Surprise me";
    const setup = game.setup();
    for (const label of ["经典", "闪电", "奇趣", "共谋者", "小丑", "随机词库", "计时音效与振动"]) assert(setup.includes(label), "untranslated setup: " + label);
    game.state.revealIndex = 3; assert(game.role().includes("你属于卧底阵营"), "Accomplice instructions not translated");
    game.state.revealIndex = 4; assert(game.role().includes("你独自获胜"), "Jester instructions not translated");
    game.state.winner = "jester"; game.state.eliminatedIndex = 4;
    assert(game.result().includes("小丑获胜！") && game.round().includes('aria-label="剩余发言时间"'), "result/timer not translated");
    game.state.language = "en";
  }],
  ["Blitz deals a fixed fifteen-second game and ignores duration adjustment", () => {
    resetRoles([["civilian", true], ["civilian", true], ["imposter", true]]);
    game.state.mode = "blitz"; game.state.duration = 120; game.state.category = "Everyday"; game.startGame();
    assert(game.state.duration === 15 && game.state.remaining === 15, "Blitz duration was not fixed");
    game.state.screen = "round"; clickTarget({ action: "timer-up" });
    assert(game.state.duration === 15 && !game.round().includes('data-action="timer-up"'), "Blitz time could be adjusted");
  }],
  ["Blitz advances once and sends the last speaker straight to voting", () => {
    resetRoles([["civilian", true], ["civilian", true], ["imposter", true]]);
    game.state.mode = "blitz"; game.state.duration = 15; game.state.remaining = 2;
    clickTarget({ action: "next-speaker" });
    assert(game.state.turnPosition === 1 && game.state.remaining === 15 && game.state.screen === "round", "Blitz did not advance first speaker");
    game.state.turnPosition = 2; game.state.selectedVote = 1; clickTarget({ action: "next-speaker" });
    assert(game.state.screen === "vote" && game.state.selectedVote === null && game.state.clueCycle === 1, "Blitz started another clue cycle");
    clickTarget({ action: "next-speaker" });
    assert(game.state.screen === "vote" && game.state.turnPosition === 2, "repeated Next changed the voting state");
  }],
  ["Blitz deadline expiry advances the last speaker exactly once", () => {
    resetRoles([["civilian", true], ["civilian", true], ["imposter", true]]);
    game.state.mode = "blitz"; game.state.duration = 15; game.state.remaining = 1; game.state.turnPosition = 2;
    game.state.timerRunning = true; game.state.timerDeadline = sandbox.now + 1000;
    game.render(); advanceTime(1001); game.updateTimerDisplay(); game.updateTimerDisplay();
    assert(game.state.screen === "vote" && game.state.clueCycle === 1 && !game.state.timerRunning, "expiry did not finish Blitz clue cycle");
    assert(intervals.size === 0, "expired Blitz kept an active timer");
  }],
  ["Chaos keeps its challenge through rendering and recovery and changes next round", () => {
    resetRoles([["civilian", true], ["civilian", true], ["civilian", true], ["imposter", true], ["white", false]]);
    game.state.mode = "chaos"; game.state.eliminatedIndex = 4; game.selectChallenge();
    const challenge = game.state.challengeId;
    game.render(); game.render(); game.saveSessionGame();
    assert(game.state.challengeId === challenge && game.loadSessionGame().challengeId === challenge, "Chaos rerolled on render/recovery");
    game.finishElimination();
    assert(game.state.screen === "round" && game.state.roundNumber === 2 && game.state.challengeId !== challenge, "Chaos repeated its previous challenge");
  }],
  ["shared pair history avoids repeats when switching between category and mixed packs", () => {
    const category = [["Coffee", "Tea"], ["Fork", "Spoon"]];
    const mixed = [...category, ["Moon", "Sun"]];
    let draw = game.drawWordPair(category, [], () => 0);
    const keys = [game.wordPairKey(draw.pair)];
    draw = game.drawWordPair(mixed, draw.history, () => 0); keys.push(game.wordPairKey(draw.pair));
    draw = game.drawWordPair(mixed, draw.history, () => 0); keys.push(game.wordPairKey(draw.pair));
    assert(new Set(keys).size === 3, "switching packs repeated an unexhausted pair");
    const last = game.wordPairKey(draw.pair);
    draw = game.drawWordPair(mixed, draw.history, () => 0);
    assert(game.wordPairKey(draw.pair) !== last, "exhaustion repeated the immediately previous pair");
    assert(mixed[0].join(",") === "Coffee,Tea", "draw mutated the source library");
    assert(game.wordPairKey([" ＣＯＦＦＥＥ ", "tea"]) === game.wordPairKey(["Tea", "coffee"]), "pair history ignored normalization/reversal");
  }],
  ["a single custom pair remains playable after exhaustion", () => {
    const source = [["包子", "馒头"]];
    const first = game.drawWordPair(source, [], () => 0);
    const second = game.drawWordPair(source, first.history, () => 0);
    assert(second.pair.join(",") === source[0].join(",") && second.history.length === 1, "single-pair library could not reset");
  }],
  ["language histories stay independent and Surprise me draws from built-in packs", () => {
    resetRoles([["civilian", true], ["civilian", true], ["imposter", true]]);
    game.state.language = "en"; game.state.category = "Surprise me";
    game.state.customPairs = [["Private", "Custom"]];
    assert(game.sourcePairs().length === Object.values(game.DEFAULT_PAIRS).flat().length, "Surprise me omitted a pack or included custom secrets");
    game.startGame(); const englishHistory = sandbox.localStorage.getItem("hush-word-history-en");
    game.state.language = "zh"; game.startGame();
    assert(sandbox.localStorage.getItem("hush-word-history-en") === englishHistory, "Chinese game overwrote English history");
    assert(JSON.parse(sandbox.localStorage.getItem("hush-word-history-zh")).includes(game.wordPairKey(game.state.pair)), "Chinese draw was not remembered");
  }],
  ["Home pauses and preserves a hidden recoverable game", () => {
    resetRoles([["civilian", true], ["civilian", true], ["imposter", true]]);
    game.state.language = "en"; game.state.screen = "role"; game.state.revealIndex = 1; game.state.remaining = 20;
    clickTarget({ action: "home" });
    const saved = JSON.parse(sandbox.localStorage.getItem("hush-active-game"));
    assert(game.state.screen === "home" && game.home().includes("Continue game"), "Home removed the Continue action");
    assert(saved.state.screen === "handoff" && saved.state.revealIndex === 1, "Home exposed/lost current secret");
    clickTarget({ action: "resume-game" });
    assert(game.state.screen === "handoff" && game.state.roles.length === 3 && !game.state.timerRunning, "Home could not safely resume");
  }],
  ["durable recovery prefers local storage and upgrades legacy session games", () => {
    resetRoles([["civilian", true], ["civilian", true], ["imposter", true]]); game.state.mode = "blitz"; game.state.duration = 15;
    game.saveSessionGame();
    const durable = JSON.parse(sandbox.localStorage.getItem("hush-active-game"));
    const stale = JSON.parse(JSON.stringify(durable)); stale.state.pair = ["Stale", "Session"];
    sandbox.sessionStorage.setItem("hush-active-game", JSON.stringify(stale));
    assert(game.loadSessionGame().pair.join(",") === "Moon,Sun", "stale session replaced durable game");
    sandbox.localStorage.removeItem("hush-active-game");
    durable.version = 2; delete durable.state.mode; delete durable.state.gameId;
    sandbox.sessionStorage.setItem("hush-active-game", JSON.stringify(durable));
    const restored = game.loadSessionGame();
    assert(restored && restored.mode === "classic" && typeof restored.gameId === "string", "legacy session did not migrate defaults");
    Object.assign(game.state, restored); game.render();
    assert(JSON.parse(sandbox.localStorage.getItem("hush-active-game")).version === 3, "resumed legacy session was not saved durably");
  }],
  ["running timer recovery preserves remaining time and stays paused", () => {
    resetRoles([["civilian", true], ["civilian", true], ["imposter", true]]);
    game.state.timerRunning = true; game.state.timerDeadline = sandbox.now + 8200; game.saveSessionGame();
    const restored = game.loadSessionGame();
    assert(restored.remaining === 9 && !restored.timerRunning && restored.timerDeadline === null, "recovery changed timer or restarted it");
  }],
  ["timer uses elapsed wall time and preserves the remainder while paused", () => {
    resetRoles([["civilian", true], ["civilian", true], ["imposter", true]]);
    game.state.remaining = 10; game.state.timerRunning = true; game.state.timerDeadline = sandbox.now + 10000;
    game.render(); advanceTime(4250); game.updateTimerDisplay();
    assert(game.state.remaining === 6, "delayed timer update did not account for elapsed time");
    game.pauseTimer(); advanceTime(5000); game.updateTimerDisplay();
    assert(game.state.remaining === 6 && !game.state.timerRunning, "paused timer kept counting");
    clickTarget({ action: "toggle-timer" });
    assert(game.state.timerRunning && game.state.timerDeadline === sandbox.now + 6000, "timer resume reset the remaining time");
  }],
  ["malformed recovery rejects empty survivors and sanitizes category/vote/speaker", () => {
    resetRoles([["civilian", true], ["civilian", true], ["imposter", false]]); game.state.screen = "vote"; game.saveSessionGame();
    const valid = JSON.parse(sandbox.localStorage.getItem("hush-active-game"));
    valid.state.category = "constructor"; valid.state.selectedVote = 2; valid.state.turnPosition = 99;
    sandbox.localStorage.setItem("hush-active-game", JSON.stringify(valid));
    const restored = game.loadSessionGame();
    assert(restored.category === "Everyday" && restored.selectedVote === null && restored.turnPosition === 1, "unsafe category/vote/speaker survived validation");
    valid.state.roles.forEach(role => role.active = false);
    sandbox.localStorage.setItem("hush-active-game", JSON.stringify(valid));
    assert(game.loadSessionGame() === null, "all-eliminated game was accepted");
    sandbox.localStorage.removeItem("hush-active-game"); sandbox.sessionStorage.removeItem("hush-active-game");
  }],
  ["inactive players cannot be selected or eliminated", () => {
    resetRoles([["civilian", true], ["civilian", true], ["imposter", false]]); game.state.screen = "vote";
    clickTarget({ vote: 2 }); assert(game.state.selectedVote === null, "inactive player selected");
    game.state.selectedVote = 2; clickTarget({ action: "eliminate" });
    assert(game.state.screen === "vote" && game.state.eliminatedIndex === null, "inactive player eliminated again");
  }],
  ["secret ballots include living voters and prohibit self or eliminated votes", () => {
    resetRoles([["civilian", true], ["civilian", true], ["imposter", true], ["white", false]]);
    game.state.votingStyle = "secret"; clickTarget({ action: "vote" });
    assert(game.state.screen === "ballotHandoff" && game.state.ballotOrder.join(",") === "0,1,2", "secret voting included an eliminated voter");
    clickTarget({ action: "open-ballot" });
    assert(game.ballotOptions().join(",") === "1,2", "ballot included self/eliminated player");
    clickTarget({ ballot: 0 }); clickTarget({ ballot: 3 }); clickTarget({ action: "cast-ballot" });
    assert(game.state.ballotPosition === 0 && Object.keys(game.state.ballots).length === 0, "invalid vote was cast");
    assert(!game.ballot().includes("Moon") && !game.ballot().includes("Sun"), "private ballot leaked secret words");
    clickTarget({ ballot: 2 }); clickTarget({ action: "cast-ballot" }); clickTarget({ action: "cast-ballot" });
    assert(game.state.screen === "ballotHandoff" && game.state.ballotPosition === 1 && game.state.ballots[0] === 2, "vote counted twice or skipped privacy handoff");
  }],
  ["completed private ballots select the unique leader and reveal only after confirmation", () => {
    resetRoles([["civilian", true], ["civilian", true], ["imposter", true], ["civilian", true]]);
    game.state.votingStyle = "secret"; game.beginVoting(); castVotes([2, 2, 1, 2]);
    const tally = game.tallyBallots();
    assert(game.state.screen === "ballotResult" && game.state.selectedVote === 2 && tally.leaders.join(",") === "2", "unique ballot leader was not selected");
    assert(tally.counts.find(row => row.index === 2).votes === 3 && game.state.roles[2].active, "tally incorrect or player eliminated before confirmation");
    clickTarget({ action: "eliminate" });
    assert(game.state.screen === "elimination" && !game.state.roles[2].active && game.state.eliminatedIndex === 2, "ballot winner was not eliminated");
    assert(game.state.roles[2].eliminatedRound === 1, "ballot elimination lost round history");
  }],
  ["tied private ballots run off between tied players with every survivor voting", () => {
    resetRoles([["civilian", true], ["civilian", true], ["imposter", true], ["civilian", true]]);
    game.state.votingStyle = "secret"; game.beginVoting(); castVotes([1, 0, 1, 0]);
    assert(game.state.selectedVote === null && game.tallyBallots().leaders.join(",") === "0,1", "tied ballot silently chose a player");
    clickTarget({ action: "eliminate" }); assert(game.state.screen === "ballotResult", "tie allowed elimination");
    clickTarget({ action: "runoff-vote" });
    assert(game.state.ballotCandidates.join(",") === "0,1" && game.state.ballotOrder.length === 4 && Object.keys(game.state.ballots).length === 0, "runoff excluded voters or kept old votes");
    assert(game.ballotOptions().join(",") === "1", "tied candidate could vote for themselves");
    castVotes([1, 0, 1, 1]);
    assert(game.state.screen === "ballotResult" && game.state.selectedVote === 1 && game.tallyBallots().leaders.join(",") === "1", "runoff did not resolve tied candidates");
  }],
  ["secret ballot recovery retains cast votes and hides the unfinished choice", () => {
    resetRoles([["civilian", true], ["civilian", true], ["imposter", true], ["civilian", true]]);
    game.state.votingStyle = "secret"; game.beginVoting(); castVotes([2]);
    clickTarget({ action: "open-ballot" }); clickTarget({ ballot: 2 }); game.saveSessionGame();
    const saved = JSON.parse(sandbox.localStorage.getItem("hush-active-game"));
    const restored = game.loadSessionGame();
    assert(saved.state.screen === "ballotHandoff" && saved.state.selectedBallot === null, "saved ballot exposed unfinished choice");
    assert(restored.screen === "ballotHandoff" && restored.ballotPosition === 1 && restored.ballots[0] === 2 && restored.selectedBallot === null, "partial ballot was not recovered");
    Object.assign(game.state, restored); castVotes([2, 1, 2]);
    assert(game.state.screen === "ballotResult" && game.state.selectedVote === 2, "recovered ballots could not finish");
  }],
  ["completed ballot recovery recalculates the leader instead of trusting saved selection", () => {
    resetRoles([["civilian", true], ["civilian", true], ["imposter", true], ["civilian", true]]);
    game.state.votingStyle = "secret"; game.beginVoting(); castVotes([2, 2, 1, 2]);
    const saved = JSON.parse(sandbox.localStorage.getItem("hush-active-game")); saved.state.selectedVote = 0;
    sandbox.localStorage.setItem("hush-active-game", JSON.stringify(saved));
    const restored = game.loadSessionGame();
    assert(restored.screen === "ballotResult" && restored.selectedVote === 2 && restored.ballotPosition === 4, "recovery trusted stale ballot result");
  }],
  ["malformed ballots retain only the valid prefix and recover a usable handoff", () => {
    resetRoles([["civilian", true], ["civilian", true], ["imposter", true], ["civilian", true], ["white", false]]);
    game.state.votingStyle = "secret"; game.beginVoting(); game.saveSessionGame();
    const saved = JSON.parse(sandbox.localStorage.getItem("hush-active-game"));
    saved.state.ballots = { 0: 2, 1: 1, 2: 0, 4: 0 }; saved.state.ballotPosition = 99;
    saved.state.ballotOrder = [4, 4, 0]; saved.state.ballotCandidates = [2, 3, 4, 999, 2];
    sandbox.localStorage.setItem("hush-active-game", JSON.stringify(saved));
    const restored = game.loadSessionGame();
    assert(restored.screen === "ballotHandoff" && restored.ballotPosition === 1 && restored.ballotOrder.join(",") === "0,1,2,3", "invalid ballot position/order was trusted");
    assert(Object.keys(restored.ballots).join(",") === "0" && restored.ballotCandidates.join(",") === "2,3", "invalid/self/eliminated ballot survived recovery");
  }],
  ["a malformed one-candidate runoff cannot trap a voter without choices", () => {
    resetRoles([["civilian", true], ["civilian", true], ["imposter", true]]);
    game.state.votingStyle = "secret"; game.beginVoting(); game.saveSessionGame();
    const saved = JSON.parse(sandbox.localStorage.getItem("hush-active-game")); saved.state.ballotCandidates = [0, 0, 999];
    sandbox.localStorage.setItem("hush-active-game", JSON.stringify(saved));
    const restored = game.loadSessionGame(); Object.assign(game.state, restored);
    assert(restored.ballotCandidates.length === 0 && game.ballotOptions().length > 0, "restored runoff left its sole candidate unable to vote");
  }],
  ["Home and background events conceal an unfinished private ballot", () => {
    resetRoles([["civilian", true], ["civilian", true], ["imposter", true]]);
    game.state.votingStyle = "secret"; game.beginVoting(); clickTarget({ action: "open-ballot" }); clickTarget({ ballot: 2 });
    document.hidden = true; dispatch("visibilitychange"); document.hidden = false;
    assert(game.state.screen === "ballotHandoff" && game.state.selectedBallot === null, "background exposed private ballot selection");
    clickTarget({ action: "open-ballot" }); clickTarget({ ballot: 1 }); clickTarget({ action: "home" }); clickTarget({ action: "resume-game" });
    assert(game.state.screen === "ballotHandoff" && game.state.selectedBallot === null && game.state.ballotPosition === 0, "Home/resume exposed or cast unfinished vote");
  }],
  ["Blitz enters the configured secret voting flow after the final speaker", () => {
    resetRoles([["civilian", true], ["civilian", true], ["imposter", true]]);
    game.state.mode = "blitz"; game.state.votingStyle = "secret"; game.state.turnPosition = 2;
    clickTarget({ action: "next-speaker" });
    assert(game.state.screen === "ballotHandoff" && game.state.ballotOrder.length === 3, "Blitz bypassed secret voting preference");
  }],
  ["secret voting still applies Jester victory and awards only its solo score", () => {
    sandbox.localStorage.removeItem("hush-scoreboard");
    resetRoles([["civilian", true], ["civilian", true], ["jester", true], ["imposter", true], ["civilian", true]]);
    game.state.votingStyle = "secret"; game.state.jesterEnabled = true; game.state.gameId = "ballot-jester";
    game.beginVoting(); castVotes([2, 2, 1, 2, 2]); clickTarget({ action: "eliminate" }); clickTarget({ action: "after-elimination" });
    assert(game.state.screen === "result" && game.state.winner === "jester", "private Jester elimination did not win");
    const board = game.loadScoreboard();
    assert(board.players.length === 5 && board.players[2].wins === 1 && board.players.filter(player => player.wins).length === 1, "private Jester result scored wrong winners");
  }],
  ["secret ballot interfaces and voting preference translate into Chinese", () => {
    resetRoles([["civilian", true], ["civilian", true], ["imposter", true]]);
    game.state.language = "zh"; game.state.votingStyle = "secret";
    assert(game.setup().includes("秘密投票 · 传手机逐一投票"), "voting preference not translated");
    game.beginVoting(); assert(game.ballotHandoff().includes("我准备好投票了"), "private handoff not translated");
    clickTarget({ action: "open-ballot" }); assert(game.ballot().includes("确认我的投票"), "private ballot not translated");
    game.state.screen = "ballotHandoff"; castVotes([1, 2, 0]);
    assert(game.ballotResult().includes("平票了。") && game.ballotResult().includes("决胜投票"), "runoff tally not translated");
    game.state.language = "en";
  }],
  ["custom-word recovery removes identical, reversed and truncated duplicates", () => {
    const repeated = "A".repeat(40);
    const pairs = game.normalizeCustomPairs([["Coffee", "Tea"], [" tea ", "ＣＯＦＦＥＥ"], ["Moon", "Moon"], [repeated + "1", repeated + "2"], ["Fork", "Spoon"], null, ["", "Sun"]]);
    assert(pairs.length === 2 && pairs[0].join(",") === "Coffee,Tea" && pairs[1].join(",") === "Fork,Spoon", "invalid/duplicate restored custom pairs accepted");
  }],
  ["completed game scores are idempotent across render and recovery", () => {
    sandbox.localStorage.removeItem("hush-scoreboard");
    resetRoles([["civilian", true], ["civilian", false], ["imposter", false]]); game.state.language = "en";
    game.state.gameId = "score-idempotent"; game.endGame("civilian"); game.render(); game.recordGame();
    let board = game.loadScoreboard();
    assert(board.players.every(player => player.played === 1) && board.players[0].wins === 1 && board.players[1].wins === 1 && board.players[2].wins === 0, "faction scores were incorrect");
    game.state.gamesRecorded = false; game.recordGame(); board = game.loadScoreboard();
    assert(board.players.every(player => player.played === 1) && board.recorded.filter(id => id === "score-idempotent").length === 1, "recovery recorded completed game twice");
  }],
  ["score reset requires confirmation and preserves completed-game deduplication", () => {
    sandbox.localStorage.removeItem("hush-scoreboard");
    resetRoles([["civilian", true], ["civilian", true], ["imposter", false]]);
    game.state.language = "en"; game.state.gameId = "score-reset"; game.endGame("civilian");
    assert(game.result().includes('data-action="reset-scores"'), "score reset control missing");
    const original = sandbox.localStorage.getItem("hush-scoreboard");
    const confirm = window.confirm;
    try {
      window.confirm = () => false; clickTarget({ action: "reset-scores" });
      assert(sandbox.localStorage.getItem("hush-scoreboard") === original, "cancelled reset changed scores");
      window.confirm = () => true; clickTarget({ action: "reset-scores" });
      const board = game.loadScoreboard();
      assert(board.players.length === 0 && board.recorded.includes("score-reset"), "reset lost game deduplication history");
      game.state.gamesRecorded = false; game.recordGame();
      assert(game.loadScoreboard().players.length === 0, "completed result re-added reset scores");
      assert(!game.result().includes('data-action="reset-scores"'), "empty scoreboard kept reset control");
    } finally { window.confirm = confirm; }
  }],
  ["scoreboard awards infiltrator and solo victories to the right players", () => {
    const roles = [["civilian", true], ["imposter", false], ["white", false], ["accomplice", true], ["jester", true]];
    for (const [winner, eliminatedIndex, expectedWinners] of [["infiltrator", 0, [1, 2, 3]], ["jester", 4, [4]], ["white", 2, [2]]]) {
      sandbox.localStorage.removeItem("hush-scoreboard"); resetRoles(roles);
      game.state.gameId = "scores-" + winner; game.state.eliminatedIndex = eliminatedIndex; game.state.winner = winner; game.recordGame();
      const board = game.loadScoreboard();
      board.players.forEach((player, index) => assert(player.played === 1 && player.wins === Number(expectedWinners.includes(index)), "incorrect " + winner + " winner " + index));
    }
  }],
  ["unnamed seats never create fake people in the scoreboard", () => {
    sandbox.localStorage.removeItem("hush-scoreboard");
    resetRoles([["civilian", true], ["civilian", true], ["imposter", false]]);
    game.state.players = ["", "   ", "Alex"]; game.state.winner = "civilian"; game.state.gameId = "unnamed-english"; game.state.language = "en"; game.recordGame();
    game.state.gameId = "unnamed-chinese"; game.state.gamesRecorded = false; game.state.language = "zh"; game.recordGame();
    const board = game.loadScoreboard();
    assert(board.players.length === 1 && board.players[0].name === "Alex" && board.players[0].played === 2, "language change created scores for unnamed seats");
    game.state.language = "en";
  }],
  ["native custom-dialog dismissal refreshes setup and empty packs safely fall back", () => {
    resetRoles([["civilian", true], ["civilian", true], ["imposter", true]]);
    game.state.screen = "setup"; game.state.language = "en"; game.state.customPairs = []; game.state.category = "Everyday";
    app.innerHTML = "stale setup"; elements.get("#words-dialog").close();
    assert(app.innerHTML.includes("Assign secret roles"), "native dialog close did not refresh setup");
    elements.set("#category", { value: "My words" }); game.startGame(); elements.delete("#category");
    assert(game.state.screen === "handoff" && game.state.category === "Everyday" && game.state.pair.length === 2, "empty custom pack crashed game start");
  }],
  ["short or cancelled reveal holds never expose a secret", () => {
    resetRoles([["civilian", true], ["civilian", true], ["imposter", true]]); game.state.screen = "handoff";
    const classes = new Set(); const button = { classList: { add: value => classes.add(value), remove: value => classes.delete(value) } };
    elements.set(".holding", button); game.beginRevealHold(button); advanceTime(699); dispatch("pointerup"); advanceTime(10);
    assert(game.state.screen === "handoff" && !classes.has("holding"), "short hold exposed secret");
    game.beginRevealHold(button); dispatch("pointercancel"); advanceTime(701);
    assert(game.state.screen === "handoff", "cancelled pointer exposed secret");
    elements.delete(".holding");
  }],
  ["moving within a reveal button does not cancel the privacy hold", () => {
    resetRoles([["civilian", true], ["civilian", true], ["imposter", true]]); game.state.screen = "handoff";
    const button = { classList: { add() {}, remove() {} } };
    const progressBar = { closest: () => button };
    game.beginRevealHold(button); advanceTime(350);
    dispatch("pointerleave", { target: progressBar, relatedTarget: button }); advanceTime(350);
    assert(game.state.screen === "role", "moving off a child inside the button cancelled the hold");
  }],
  ["reveal holds complete deliberately and support screen-reader activation", () => {
    resetRoles([["civilian", true], ["civilian", true], ["imposter", true]]); game.state.screen = "handoff";
    const button = { classList: { add() {}, remove() {} } };
    game.beginRevealHold(button); advanceTime(700);
    assert(game.state.screen === "role", "completed hold did not reveal");
    game.state.screen = "handoff"; clickTarget({ action: "hold-reveal", detail: 1 });
    assert(game.state.screen === "handoff", "ordinary short click bypassed privacy hold");
    clickTarget({ action: "hold-reveal", detail: 0 });
    assert(game.state.screen === "role", "assistive click could not reveal");
  }],
  ["blur and pagehide conceal secrets and cancel pending reveals", () => {
    const button = { classList: { add() {}, remove() {} } };
    for (const event of ["blur", "pagehide"]) {
      resetRoles([["civilian", true], ["civilian", true], ["imposter", true]]); game.state.screen = "handoff";
      game.beginRevealHold(button); dispatch(event, {}, windowListeners); advanceTime(701);
      assert(game.state.screen === "handoff", event + " left a pending reveal");
      game.state.screen = "role"; dispatch(event, {}, windowListeners);
      assert(game.state.screen === "handoff" && game.loadSessionGame().screen === "handoff", event + " exposed a returning secret");
    }
  }]
];

let passed = 0;
for (const [name, test] of tests) {
  try { test(); passed++; console.log(`✓ ${name}`); }
  catch (error) { console.error(`✗ ${name}\n  ${error.message}`); process.exitCode = 1; }
}
console.log(`\n${passed}/${tests.length} tests passed`);
