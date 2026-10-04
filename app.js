const AVATARS = [
  { id: "bear", name: "Milk Bear", color: "#fff8e9", ears: "round" },
  { id: "cat", name: "Biscuit Cat", color: "#f5ddad", ears: "point" },
  { id: "bunny", name: "Mochi Bunny", color: "#f1d6df", ears: "long" },
  { id: "mint", name: "Mint Bean", color: "#d4e1c3" },
  { id: "cloud", name: "Cloud Puff", color: "#c9dee4" },
  { id: "lilac", name: "Lilac Bear", color: "#e2d6ee", ears: "round" },
  { id: "peach", name: "Peach Bun", color: "#f4cdb5" },
  { id: "pup", name: "Cocoa Pup", color: "#dfc9b3", ears: "floppy" }
];
function normalizeAvatars(value, count) {
  return Array.from({ length: count }, (_, i) => AVATARS.some(a => a.id === value?.[i]) ? value[i] : AVATARS[i % AVATARS.length].id);
}
function avatarArt(id) {
  const a = AVATARS.find(a => a.id === id) || AVATARS[0];
  const ears = a.ears === "round" ? '<circle cx="32" cy="32" r="13"/><circle cx="68" cy="32" r="13"/>'
    : a.ears === "point" ? '<path d="M24 43V18l24 18M76 43V18L52 36"/>'
    : a.ears === "long" ? '<ellipse cx="35" cy="25" rx="9" ry="21"/><ellipse cx="65" cy="25" rx="9" ry="21"/>'
    : a.ears === "floppy" ? '<ellipse cx="22" cy="52" rx="11" ry="24"/><ellipse cx="78" cy="52" rx="11" ry="24"/>' : "";
  return `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false"><g fill="${a.color}" stroke="#ac9781" stroke-width="2.2" stroke-linejoin="round">${ears}<path d="M20 60C16 17 84 17 80 60l2 18q0 14-18 12H36Q18 92 18 78Z"/></g><g fill="#665449"><circle cx="40" cy="54" r="2.6"/><circle cx="60" cy="54" r="2.6"/></g><path d="M47 63q3 3 6 0" fill="none" stroke="#665449" stroke-width="2" stroke-linecap="round"/><g fill="#e7aaa9"><ellipse cx="30" cy="62" rx="6" ry="4"/><ellipse cx="70" cy="62" rx="6" ry="4"/></g></svg>`;
}
function playerAvatar(index, large = false) {
  return `<span class="player-avatar${large ? " large" : ""}" aria-hidden="true">${avatarArt(state.avatars[index])}</span>`;
}
function playerSetup(name, i) {
  const selected = AVATARS.find(a => a.id === state.avatars[i]) || AVATARS[0];
  return `<div class="player-setup"><div class="player-name-row">${playerAvatar(i)}<input aria-label="${t("Player name", "玩家姓名")} ${i+1}" data-player="${i}" maxlength="24" value="${escapeHtml(name)}" placeholder="${t("Player", "玩家")} ${i+1}"></div><details class="avatar-picker" data-avatar-picker="${i}"><summary>${t("Choose avatar", "选择头像")} <span>${avatarName(selected)}</span></summary><div class="avatar-options" role="group" aria-label="${t("Avatar for player", "玩家头像")} ${i+1}">${AVATARS.map(a => `<button type="button" class="avatar-option" data-avatar-player="${i}" data-avatar-id="${a.id}" aria-label="${avatarName(a)} · ${t("Player", "玩家")} ${i+1}" aria-pressed="${a.id === selected.id}">${avatarArt(a.id)}<span>${avatarName(a)}</span></button>`).join("")}</div></details></div>`;
}


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
      language: value.language === "zh" ? "zh" : "en",
      category: DEFAULT_PAIRS[value.category] || value.category === "My words" && normalizeCustomPairs(loadStoredJson(value.language === "zh" ? "hush-custom-pairs-zh" : "hush-custom-pairs", [])).length ? value.category : "Everyday",
      customPairs: normalizeCustomPairs(loadStoredJson(value.language === "zh" ? "hush-custom-pairs-zh" : "hush-custom-pairs", [])),
      avatars: normalizeAvatars(value.avatars, value.players.length),
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
const savedLanguage = savedSetup.language === "zh" ? "zh" : "en";
const savedPlayers = Array.isArray(savedSetup.players) && savedSetup.players.length >= 3 && savedSetup.players.length <= 12 ? savedSetup.players.map(name => String(name).slice(0, 24)) : ["", "", "", ""];
const app = document.querySelector("#app");
const state = {
  screen: "home", players: savedPlayers, avatars: normalizeAvatars(savedSetup.avatars, savedPlayers.length), imposterCount: Number.isSafeInteger(savedSetup.imposterCount) ? savedSetup.imposterCount : 1, whiteCount: Number.isSafeInteger(savedSetup.whiteCount) ? savedSetup.whiteCount : 1,
  language: savedLanguage,
  category: DEFAULT_PAIRS[savedSetup.category] ? savedSetup.category : "Everyday", customPairs: normalizeCustomPairs(loadStoredJson(savedLanguage === "zh" ? "hush-custom-pairs-zh" : "hush-custom-pairs", [])),
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

function names() { return state.players.map((n, i) => n.trim() || `${t("Player", "玩家")} ${i + 1}`); }
function duplicateNameIndex(values = names()) {
  const normalized = values.map(name => name.replace(/\s+/g, " ").trim().toLocaleLowerCase());
  return normalized.findIndex((name, index) => normalized.indexOf(name) !== index);
}
function syncSetupInputs() {
  document.querySelectorAll("[data-player]").forEach(el => state.players[+el.dataset.player] = el.value);
  if (document.querySelector("#category")) state.category = document.querySelector("#category").value;
}
function t(english, chinese, values = {}) {
  const text = state.language === "zh" ? chinese : english;
  return text.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match);
}
function avatarName(avatar) {
  const names = {"Milk Bear": "牛奶熊", "Biscuit Cat": "饼干猫", "Mochi Bunny": "麻薯兔", "Mint Bean": "薄荷豆", "Cloud Puff": "云朵", "Lilac Bear": "丁香熊", "Peach Bun": "桃子包", "Cocoa Pup": "可可狗"};
  return t(avatar.name, names[avatar.name]);
}
function localizeShell() {
  if (document.documentElement) document.documentElement.lang = state.language === "zh" ? "zh-Hans" : "en";
  document.title = t("Hush — Offline Imposter Game", "Hush — 离线谁是卧底");
  document.querySelectorAll("[data-i18n-zh]").forEach(node => {
    node.dataset.i18nEn ??= node.textContent;
    node.textContent = t(node.dataset.i18nEn, node.dataset.i18nZh);
  });
  document.querySelectorAll("[data-i18n-aria-zh]").forEach(node => {
    node.dataset.i18nAriaEn ??= node.getAttribute("aria-label");
    node.setAttribute("aria-label", t(node.dataset.i18nAriaEn, node.dataset.i18nAriaZh));
  });
}

function wordPacks() { return state.language === "zh" ? CHINESE_PAIRS : DEFAULT_PAIRS; }
function customStorageKey() { return state.language === "zh" ? "hush-custom-pairs-zh" : "hush-custom-pairs"; }
function saveSetup() {
  saveStoredJson("hush-setup", { players: state.players, avatars: state.avatars, imposterCount: state.imposterCount, whiteCount: state.whiteCount, category: state.category, language: state.language });
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
function roleName(type) { return type === "civilian" ? t("a Civilian", "平民") : type === "imposter" ? t("an Imposter", "卧底") : t("Mr. White", "白板"); }
function roleCounter(label, type, count) {
  const totalInfiltrators = state.imposterCount + state.whiteCount;
  const atMaximum = totalInfiltrators >= state.players.length - 2;
  const otherCount = type === "imposter" ? state.whiteCount : state.imposterCount;
  return `<div class="role-counter"><span><b>${label}</b><small>${type === "imposter" ? t("Related word", "相近的词") : t("No word", "没有词语")}</small></span><div class="mini-stepper"><button data-role-type="${type}" data-delta="-1" aria-label="${t("Fewer", "减少")} ${label}" ${count === 0 || totalInfiltrators === 1 ? "disabled" : ""}>−</button><strong aria-live="polite">${count}</strong><button data-role-type="${type}" data-delta="1" aria-label="${t("More", "增加")} ${label}" ${atMaximum && otherCount === 0 ? "disabled" : ""}>+</button></div></div>`;
}
let renderedScreen = null;
function render() {
  const screenChanged = renderedScreen !== state.screen;
  const activeData = !screenChanged && document.activeElement?.dataset ? { ...document.activeElement.dataset } : null;
  clearInterval(state.timerId);
  state.timerId = null;
  const views = { home, setup, handoff, role, round, vote, elimination, whiteGuess, result };
  app.innerHTML = views[state.screen]();
  localizeShell();
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
    <div class="language-toggle home-language" role="group" aria-label="${t("App language", "应用语言")}"><button type="button" data-action="language-en" aria-pressed="${state.language === "en"}" lang="en">English</button><button type="button" data-action="language-zh" aria-pressed="${state.language === "zh"}" lang="zh-Hans">中文</button></div>
    <p class="eyebrow">${t("LITTLE FRIENDS, BIG SECRETS", "小伙伴，大秘密")}</p>
    <h1>${t("A cozy little", "轻松温馨的")}<br><span>${t("game of secrets.", "秘密游戏。")}</span></h1>
    <p class="lede">${t("Gather your friends, pass the phone, and find the sneaky one. A little bluffing, a lot of giggles.", "叫上朋友，传递手机，找出藏在你们之中的卧底。一起斗智，放声欢笑。")}</p>
    <div class="button-row">${resumableGame ? `<button class="button primary" data-action="resume-game">${t("Continue game", "继续游戏")}</button><button class="button secondary" data-action="new-game">${t("Start over", "重新开始")}</button>` : `<button class="button primary" data-action="new-game">${t("Start a game", "开始游戏")}</button>`}<button class="button secondary" data-action="open-help">${t("How it works", "游戏玩法")}</button></div>
    <div class="hero-art" aria-hidden="true"><img src="friends.svg" alt="" width="600" height="230"></div>
    <p class="tiny offline-status">${state.offlineStatus === "ready" ? t("● Offline ready", "● 已可离线游玩") : state.offlineStatus === "unavailable" ? t("Offline mode unavailable", "离线模式不可用") : t("Preparing offline play…", "正在准备离线游戏…")} • ${t("3–12 players", "3–12 名玩家")}</p>
  </section>`; }

function setup() { return `
  <section class="screen">
    <p class="eyebrow">${t("GAME SETUP", "游戏设置")}</p><h2>${t("Gather your little crew.", "召集你的小伙伴。")}</h2>
    <div class="setup-columns">
      <div>
        <div class="stepper"><div><b>${t("Players", "玩家")}</b><div class="tiny">${t("3 to 12 people", "3 至 12 人")}</div></div><div class="stepper-controls"><button data-action="players-down" aria-label="${t("Fewer players", "减少玩家")}" ${state.players.length <= 3 ? "disabled" : ""}>−</button><span aria-live="polite">${state.players.length}</span><button data-action="players-up" aria-label="${t("More players", "增加玩家")}" ${state.players.length >= 12 ? "disabled" : ""}>+</button></div></div>
        <div class="player-list">${state.players.map(playerSetup).join("")}</div>
      </div>
      <div>
        <div class="section"><div class="section-heading"><h3>${t("Hidden roles", "隐藏身份")}</h3><small>${state.players.length - state.imposterCount - state.whiteCount} ${t("Civilians", "平民")}</small></div>
          <div class="role-count-list">${roleCounter(t("Imposters", "卧底"), "imposter", state.imposterCount)}${roleCounter(t("Mr. White", "白板"), "white", state.whiteCount)}</div>
          <p class="tiny">${t("At least two players remain Civilians. Imposters and Civilians only see their secret word—not their role.", "至少保留两名平民。卧底和平民只能看到自己的词语，不会知道自己的身份。")}</p>
        </div>
        <label class="field-label" for="category">${state.language === "zh" ? "词库" : "WORD PACK"}</label>
        <select id="category">${[...Object.keys(wordPacks()), ...(state.customPairs.length ? ["My words"] : [])].map(c => `<option value="${escapeHtml(c)}" ${c === state.category ? "selected" : ""}>${state.language === "zh" ? CHINESE_PACK_LABELS[c] || escapeHtml(c) : escapeHtml(c)}</option>`).join("")}</select>
        <p class="tiny word-note">${t("↻ Word-pair sides are randomly swapped every game.", "↻ 每局随机交换平民词和卧底词。")}</p>
      </div>
    </div>
    <div class="button-row"><button class="button primary wide" data-action="start-game">${t("Assign secret roles", "分配秘密身份")}</button><button class="button secondary" data-action="custom-words">${t("Add words", "添加词语")}</button></div>
  </section>`; }

function handoff() {
  const name = names()[state.revealIndex];
  return `<section class="screen handoff">${playerAvatar(state.revealIndex, true)}<p class="eyebrow">${t("Player {index} of {total}", "第 {index} 位玩家，共 {total} 位", { index: state.revealIndex + 1, total: state.players.length })}</p><h2>${t("Pass to {name}", "请交给 {name}", { name: escapeHtml(name) })}</h2><p class="privacy">${t("Make sure nobody else can see the screen. Hold the button when you're ready.", "确保其他人看不到屏幕。准备好后，长按按钮。")}</p><button class="button primary wide hold-button" data-action="hold-reveal">${t("Hold to reveal", "长按查看")}<div class="progress"><i></i></div></button></section>`;
}

function role() {
  const role = state.roles[state.revealIndex];
  const isWhite = role.type === "white";
  return `<section class="screen secret-screen"><p class="eyebrow">${t("YOUR SECRET", "你的秘密")}</p><div class="role-card ${isWhite ? "imposter" : ""}"><div class="card-stamp">${t("TOP", "绝密")}<br>${t("SECRET", "档案")}</div><div><span class="role-label">${isWhite ? t("YOU ARE MR. WHITE", "你是白板") : t("YOUR WORD IS", "你的词语是")}</span><h2 class="secret-word">${isWhite ? t("No word.", "你没有词语。") : escapeHtml(role.word)}</h2></div><p class="role-note">${isWhite ? t("Listen carefully and bluff. If voted out, you get one chance to guess the Civilians' word.", "仔细听线索，巧妙伪装。被投票淘汰后，你有一次机会猜平民的词语。") : t("You might be a Civilian or an Imposter. Your word alone does not reveal which—listen carefully to the clues.", "你可能是平民，也可能是卧底。仅凭词语无法判断身份，请仔细听大家的线索。")}</p></div><button class="button primary wide" data-action="hide-role" style="margin-top:18px">${t("I've got it — hide my secret", "记住了，隐藏我的秘密")}</button></section>`;
}

function round() {
  const pct = `${(state.remaining / state.duration) * 100}%`;
  const order = discussionOrder();
  const speaker = order[state.turnPosition % order.length];
  return `<section class="screen"><div class="game-header"><div><p class="eyebrow">${t("DISCUSSION", "讨论")}</p><h2>${t("Describe your word.", "描述你的词语。")}</h2></div><span class="round-pill">${t("Round {round}", "第 {round} 轮", { round: state.roundNumber })}</span></div><div class="speaker-card"><span>${t("Now speaking · Clue cycle {cycle}", "当前发言 · 第 {cycle} 次描述", { cycle: state.clueCycle })}</span><b class="player-identity">${playerAvatar(speaker)}${escapeHtml(names()[speaker])}</b><small>${t("{index} of {total}", "第 {index} 位，共 {total} 位", { index: state.turnPosition + 1, total: order.length })}</small></div><div class="timer ${state.timerRunning ? "is-running" : ""} ${state.remaining === 0 ? "is-done" : ""}" style="--timer:${pct}"><div class="timer-inner"><div class="timer-time">${formatTime(state.remaining)}</div><small>${state.remaining === 0 ? t("TIME'S UP", "时间到") : state.timerRunning ? t("COUNTING", "计时中") : t("READY", "准备就绪")}</small></div></div><div class="timer-adjust" aria-label="${t("Adjust speaking time", "调整发言时间")}"><button data-action="timer-down" aria-label="${t("Remove five seconds", "减少五秒")}" ${state.duration <= 10 ? "disabled" : ""}>−5</button><span><b>${state.duration}${t("s", "秒")}</b><small>${t("per person", "每人")}</small></span><button data-action="timer-up" aria-label="${t("Add five seconds", "增加五秒")}" ${state.duration >= 180 ? "disabled" : ""}>+5</button></div><div class="timer-actions"><button class="button secondary" data-action="reset-timer">${t("Reset", "重置")}</button><button class="button primary" data-action="toggle-timer">${state.timerRunning ? t("Pause", "暂停") : state.remaining < state.duration && state.remaining > 0 ? t("Resume", "继续") : t("Start", "开始")}</button><button class="button secondary" data-action="next-speaker">${t("Next player →", "下一位 →")}</button></div><button class="button vote-button wide" data-action="vote">${t("End discussion & vote", "结束讨论并投票")}</button></section>`;
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

function vote() { return `<section class="screen"><p class="eyebrow">${t("Round {round}", "第 {round} 轮", { round: state.roundNumber })} · ${t("THE VOTE", "投票")}</p><h2>${t("Who seems suspicious?", "谁最可疑？")}</h2><p class="muted">${t("Only surviving players can be eliminated. If the vote is tied, discuss and vote again until one player is chosen.", "只能淘汰仍在场的玩家。如果票数相同，请继续讨论并重新投票，直到选出一位玩家。")}</p><div class="vote-list">${activeIndices().map(i => `<button class="vote ${state.selectedVote === i ? "selected" : ""}" data-vote="${i}" aria-pressed="${state.selectedVote === i}"><span class="player-identity">${playerAvatar(i)}${escapeHtml(names()[i])}</span><span>${state.selectedVote === i ? t("SELECTED", "已选择") : t("TAP TO VOTE", "点击投票")}</span></button>`).join("")}</div><div class="button-row"><button class="button danger wide" data-action="eliminate" ${state.selectedVote === null ? "disabled" : ""}>${state.selectedVote === null ? t("Choose a player", "选择一位玩家") : t("Eliminate {name}", "淘汰 {name}", { name: escapeHtml(names()[state.selectedVote]) })}</button><button class="button secondary" data-action="back-round">${t("Back", "返回")}</button></div></section>`; }

function elimination() {
  const i = state.eliminatedIndex, role = state.roles[i];
  return `<section class="screen reveal-result elimination-reveal"><div class="reveal-rays" aria-hidden="true"></div><p class="eyebrow">${t("PLAYER ELIMINATED", "玩家已淘汰")}</p><div class="eliminated-avatar">${playerAvatar(i, true)}</div><div class="result-icon">${role.type === "civilian" ? "😬" : role.type === "imposter" ? "🕵️" : "⬜"}</div><h2>${t("{name} was {role}.", "{name} 的身份是{role}。", { name: escapeHtml(names()[i]), role: roleName(role.type) })}</h2><p class="lede" style="margin-inline:auto">${role.type === "white" ? t("Mr. White now gets one final chance to steal the game.", "白板现在有最后一次猜词机会，可以逆转获胜。") : role.type === "imposter" ? t("One Imposter is out. Are there more hiding?", "一名卧底已出局。还有其他卧底吗？") : t("An innocent Civilian has been eliminated.", "一名无辜的平民被淘汰了。")}</p><button class="button primary wide" data-action="after-elimination">${role.type === "white" ? t("Make the final guess", "进行最后猜词") : t("Check the game", "继续游戏")}</button></section>`;
}

function whiteGuess() {
  return `<section class="screen"><p class="eyebrow">${t("MR. WHITE'S LAST CHANCE", "白板的最后机会")}</p><h2>${t("Guess the Civilians' word.", "猜出平民的词语。")}</h2><p class="muted"><b>${escapeHtml(names()[state.eliminatedIndex])}</b>${t(" gets one exact guess. Capitalization and surrounding spaces do not matter.", " 有一次猜词机会，答案必须准确。大小写和首尾空格不影响判断。")}</p><form id="white-guess-form"><label class="field-label" for="white-guess">${t("FINAL GUESS", "最后猜词")}</label><input id="white-guess" maxlength="40" autocomplete="off" enterkeyhint="done" placeholder="${t("Type the word", "输入词语")}"><button class="button primary wide" type="submit" style="margin-top:14px">${t("Lock in guess", "确认答案")}</button></form></section>`;
}

function result() {
  const label = state.winner === "civilian" ? t("Civilians win!", "平民获胜！") : state.winner === "infiltrator" ? t("Infiltrators win!", "卧底阵营获胜！") : t("Mr. White wins!", "白板获胜！");
  const note = state.winner === "civilian" ? t("Every Imposter and Mr. White has been caught.", "所有卧底和白板都已被找出。") : state.winner === "infiltrator" ? t("Only one Civilian remains, so the infiltrator faction takes the game.", "只剩一名平民，卧底阵营赢得了游戏。") : t("Mr. White cracked the Civilians' word after being eliminated.", "白板被淘汰后猜中了平民的词语。");
  const particles = Array.from({length: 30}, (_, i) => `<i style="--x:${(i * 43) % 101 - 50};--r:${(i * 67) % 360};--d:${(i % 7) * .08}s"></i>`).join("");
  const playerRows = state.roles.map((role, index) => {
    const won = state.winner === "civilian" && role.type === "civilian" || state.winner === "infiltrator" && role.type !== "civilian" || state.winner === "white" && index === state.eliminatedIndex;
    const guessWon = state.winner === "white" && index === state.eliminatedIndex;
    const guess = role.type === "white" && state.whiteGuesses[index] ? `<em class="${guessWon ? "guess-correct" : "guess-wrong"}">${guessWon ? t("Correct", "正确") : t("Incorrect", "错误")}: “${escapeHtml(state.whiteGuesses[index])}”</em>` : "";
    return `<div class="player-outcome ${won ? "won" : "lost"}"><span class="player-identity">${playerAvatar(index)}<span class="outcome-name">${escapeHtml(names()[index])}<small>${roleName(role.type)}${guess}</small></span></span><span class="outcome-tags">${won ? `<b class="status winner-status">${t("Winner", "获胜")}</b>` : ""}<b class="status ${role.active ? "alive-status" : "out-status"}">${role.active ? t("Survived", "仍在场") : t("Voted · R{round}", "已淘汰 · 第 {round} 轮", { round: role.eliminatedRound || "?" })}</b></span></div>`;
  }).join("");
  return `<section class="screen reveal-result celebration winner-${state.winner}"><div class="confetti" aria-hidden="true">${particles}</div><div class="victory-halo" aria-hidden="true"></div><p class="eyebrow">${t("GAME OVER", "游戏结束")}</p><div class="result-icon">${state.winner === "civilian" ? "🏆" : state.winner === "infiltrator" ? "🕵️" : "⬜"}</div><h2>${label}</h2><p class="lede" style="margin-inline:auto">${note}</p><div class="word-pair"><span class="word-chip">${t("Civilian word:", "平民词：")} <b>${escapeHtml(state.pair[0])}</b></span><span class="word-chip">${t("Imposter word:", "卧底词：")} <b>${escapeHtml(state.pair[1])}</b></span></div><div class="final-roles">${playerRows}</div><div class="button-row"><button class="button primary wide" data-action="play-again">${t("Play again", "再玩一局")}</button><button class="button secondary wide" data-action="home">${t("Home", "首页")}</button></div></section>`;
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
    toast(t("Each player needs a unique name", "每位玩家的名字必须不同"));
    return;
  }
  state.remaining = state.duration;
  const source = state.category === "My words" ? state.customPairs : wordPacks()[state.category];
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
  document.querySelector("#custom-word-one").placeholder = state.language === "zh" ? "包子" : "Coffee";
  document.querySelector("#custom-word-two").placeholder = state.language === "zh" ? "馒头" : "Tea";
  document.querySelector("#words-dialog").showModal();
  document.querySelector("#custom-word-one").focus();
}

function renderCustomPairs() {
  const list = document.querySelector("#custom-pairs");
  if (!list) return;
  list.innerHTML = state.customPairs.length ? `<p class="field-label">${t("SAVED PAIRS", "已保存的词语对")}</p>${state.customPairs.map((pair, index) => `<div class="custom-pair"><span><b>${escapeHtml(pair[0])}</b><small>↔</small><b>${escapeHtml(pair[1])}</b></span><button data-delete-pair="${index}" aria-label="${t("Delete {first} and {second}", "删除 {first} 和 {second}", { first: escapeHtml(pair[0]), second: escapeHtml(pair[1]) })}">×</button></div>`).join("")}` : `<p class="empty-state">${t("No custom pairs yet.", "还没有自定义词语对。")}</p>`;
}

function saveCustomPair() {
  const firstInput = document.querySelector("#custom-word-one");
  const secondInput = document.querySelector("#custom-word-two");
  const first = firstInput.value.trim();
  const second = secondInput.value.trim();
  firstInput.removeAttribute("aria-invalid"); secondInput.removeAttribute("aria-invalid");
  if (!first || !second) { (!first ? firstInput : secondInput).setAttribute("aria-invalid", "true"); toast(t("Enter both words", "请输入两个词语")); return; }
  if (normalizeWord(first) === normalizeWord(second)) { secondInput.setAttribute("aria-invalid", "true"); toast(t("Use two different words", "请使用两个不同的词语")); return; }
  const duplicate = state.customPairs.some(pair => pair.map(normalizeWord).sort().join("|") === [normalizeWord(first), normalizeWord(second)].sort().join("|"));
  if (duplicate) { toast(t("That pair is already saved", "这组词语已保存")); return; }
  if (state.customPairs.length >= 100) { toast(t("Custom word library is full", "自定义词库已满")); return; }
  state.customPairs.push([first, second]);
  saveStoredJson(customStorageKey(), state.customPairs);
  state.category = "My words"; saveSetup();
  firstInput.value = ""; secondInput.value = ""; renderCustomPairs(); firstInput.focus(); toast(t("Word pair saved", "词语对已保存"));
}

function submitWhiteGuess() {
  const enteredGuess = document.querySelector("#white-guess")?.value.trim();
  if (!enteredGuess) { toast(t("Enter one final guess", "请输入最后的猜词答案")); return; }
  state.whiteGuesses[state.eliminatedIndex] = enteredGuess;
  if (normalizeWord(enteredGuess) === normalizeWord(state.pair[0])) {
    state.whiteGuessed = true; state.winner = "white"; state.screen = "result"; clearSessionGame(); resumableGame = null; render();
  } else {
    toast(t("Incorrect guess", "猜错了")); finishElimination();
  }
}

function formatTime(seconds) { return `${String(Math.floor(seconds / 60)).padStart(2,"0")}:${String(seconds % 60).padStart(2,"0")}`; }
function pauseTimer() {
  if (state.timerRunning && state.timerDeadline) state.remaining = Math.max(0, Math.ceil((state.timerDeadline - Date.now()) / 1000));
  state.timerRunning = false; state.timerDeadline = null; clearInterval(state.timerId); state.timerId = null;
}
function finishTimer() {
  clearInterval(state.timerId); state.timerId = null; state.timerRunning = false; state.timerDeadline = null; state.remaining = 0;
  navigator.vibrate?.([150,80,150]); render(); toast(t("Time's up — next player!", "时间到，下一位！"));
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
    saveStoredJson(customStorageKey(), state.customPairs);
    if (!state.customPairs.length && state.category === "My words") state.category = "Everyday";
    saveSetup(); renderCustomPairs(); toast(t("Word pair removed", "词语对已删除")); return;
  }
  const avatarButton = e.target.closest("[data-avatar-player]");
  if (avatarButton && state.screen === "setup") {
    const index = Number(avatarButton.dataset.avatarPlayer);
    const id = avatarButton.dataset.avatarId;
    if (!Number.isSafeInteger(index) || index < 0 || index >= state.players.length || !AVATARS.some(a => a.id === id)) return;
    syncSetupInputs(); state.avatars[index] = id; saveSetup(); render();
    const picker = app.querySelector(`[data-avatar-picker="${index}"]`);
    if (picker) { picker.open = true; picker.querySelector(`[data-avatar-id="${id}"]`)?.focus({ preventScroll: true }); }
    return;
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
  if ((action === "language-en" || action === "language-zh") && state.screen === "home") {
    state.language = action === "language-zh" ? "zh" : "en";
    state.customPairs = normalizeCustomPairs(loadStoredJson(customStorageKey(), []));
    if (state.category === "My words" && !state.customPairs.length) state.category = "Everyday";
    saveSetup(); render(); return;
  }
  if (action === "new-game") { if (resumableGame && !window.confirm(t("Start over and discard the saved game?", "重新开始并放弃已保存的游戏吗？"))) return; clearSessionGame(); resumableGame = null; state.roles = []; state.screen = "setup"; render(); }
  if (action === "resume-game" && resumableGame) { Object.assign(state, resumableGame, { language: state.language, customPairs: state.customPairs, timerId: null, timerRunning: false, timerDeadline: null }); resumableGame = null; if (state.category === "My words" && !state.customPairs.length) state.category = "Everyday"; render(); }
  if (action === "home") { const activeGame = state.roles.length && !["home", "setup", "result"].includes(state.screen); if (activeGame && !window.confirm(t("Leave this game? Current progress will be lost.", "离开游戏吗？当前进度将丢失。"))) return; pauseTimer(); clearSessionGame(); resumableGame = null; state.roles = []; state.screen = "home"; render(); }
  if (action === "open-help") { if (state.timerRunning) { pauseTimer(); render(); } document.querySelector("#help-dialog").showModal(); }
  if (action === "close-help") document.querySelector("#help-dialog").close();
  if (action === "players-up" && state.players.length < 12) { syncSetupInputs(); state.players.push(""); state.avatars = normalizeAvatars(state.avatars, state.players.length); saveSetup(); render(); }
  if (action === "players-down" && state.players.length > 3) { syncSetupInputs(); state.players.pop(); state.avatars.pop(); while (state.imposterCount + state.whiteCount > state.players.length - 2) { if (state.whiteCount > 0) state.whiteCount--; else state.imposterCount--; } saveSetup(); render(); }
  if (action === "start-game") startGame();
  if (action === "custom-words") openCustomWords();
  if (action === "close-words") { document.querySelector("#words-dialog").close(); if (state.screen === "setup") render(); }
  if (action === "save-custom-pair") saveCustomPair();
  if (action === "hide-role") { state.revealIndex++; if (state.revealIndex >= state.players.length) { state.revealIndex = 0; state.screen = "round"; } else state.screen = "handoff"; render(); }
  if (action === "toggle-timer") { if (state.timerRunning) pauseTimer(); else { if (state.remaining === 0) state.remaining = state.duration; state.timerRunning = true; state.timerDeadline = Date.now() + state.remaining * 1000; } render(); }
  if (action === "reset-timer") { pauseTimer(); state.remaining = state.duration; render(); }
  if (action === "timer-down" || action === "timer-up") { const delta = action === "timer-up" ? 5 : -5; if (state.timerRunning) updateTimerDisplay(); const previous = state.duration; state.duration = Math.max(10, Math.min(180, state.duration + delta)); const applied = state.duration - previous; state.remaining = Math.max(0, Math.min(state.duration, state.remaining + applied)); if (state.timerRunning) state.timerDeadline = Date.now() + state.remaining * 1000; if (state.timerRunning && state.remaining === 0) finishTimer(); else render(); }
  if (action === "next-speaker") { pauseTimer(); const count = discussionOrder().length; state.turnPosition++; if (state.turnPosition >= count) { state.turnPosition = 0; state.clueCycle++; toast(t("Everyone has spoken — continue or vote", "所有人都已发言，请继续讨论或投票")); } state.remaining = state.duration; render(); }
  if (action === "vote") { pauseTimer(); state.selectedVote = null; state.screen = "vote"; render(); }
  if (action === "back-round") { state.screen = "round"; render(); }
  if (action === "eliminate" && state.selectedVote !== null) { if (!window.confirm(t("Eliminate {name}? This cannot be undone.", "淘汰 {name} 吗？此操作无法撤销。", { name: names()[state.selectedVote] }))) return; state.eliminatedIndex = state.selectedVote; state.roles[state.eliminatedIndex].active = false; state.roles[state.eliminatedIndex].eliminatedRound = state.roundNumber; state.screen = "elimination"; render(); }
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
