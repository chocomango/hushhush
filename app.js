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
    const saved = loadStoredJson("hush-active-game", null) || JSON.parse(sessionStorage.getItem("hush-active-game"));
    const value = saved?.state;
    const screens = ["handoff", "round", "vote", "elimination", "whiteGuess", "ballotHandoff", "ballotResult"];
    if (![2, 3].includes(saved?.version) || !value || !screens.includes(value.screen) || !Array.isArray(value.players) || !Array.isArray(value.roles) || value.players.length < 3 || value.players.length > 12 || value.roles.length !== value.players.length || !Array.isArray(value.pair) || value.pair.length !== 2 || !value.pair.every(word => typeof word === "string")) return null;
    if (!value.players.every(name => typeof name === "string") || !value.roles.every(role => role && ROLE_TYPES.includes(role.type) && typeof role.active === "boolean" && (role.word === null || typeof role.word === "string"))) return null;
    if (!Number.isSafeInteger(value.revealIndex) || value.revealIndex < 0 || value.revealIndex >= value.players.length) return null;
    const validIndex = index => index === null || Number.isSafeInteger(index) && index >= 0 && index < value.players.length;
    if (!validIndex(value.selectedVote) || !validIndex(value.eliminatedIndex)) return null;
    if (["elimination", "whiteGuess"].includes(value.screen) && value.eliminatedIndex === null) return null;
    if (!value.roles.some(role => role.active)) return null;
    if (value.screen === "vote" && value.selectedVote !== null && !value.roles[value.selectedVote].active) value.selectedVote = null;
    const roles = value.roles.map(role => ({ type: role.type, active: role.active, word: typeof role.word === "string" ? role.word.slice(0, 40) : null, ...(Number.isSafeInteger(role.eliminatedRound) ? { eliminatedRound: Math.min(100, Math.max(1, role.eliminatedRound)) } : {}) }));
    if (["elimination", "whiteGuess"].includes(value.screen) && roles[value.eliminatedIndex].active) return null;
    if (value.screen === "whiteGuess" && roles[value.eliminatedIndex].type !== "white") return null;
    const config = normalizeGameConfig(value, value.players.length);
    const duration = config.mode === "blitz" ? 15 : Math.min(180, Math.max(10, Number(value.duration) || 30));
    let ballotState = { votingStyle: value.votingStyle === "secret" ? "secret" : "group", ballotOrder: [], ballots: {}, ballotPosition: 0, ballotCandidates: [], selectedBallot: null };
    if (["ballotHandoff", "ballotResult"].includes(value.screen)) {
      const order = roles.map((role, i) => role.active ? i : -1).filter(i => i >= 0);
      let candidates = Array.isArray(value.ballotCandidates) ? [...new Set(value.ballotCandidates.filter(i => Number.isSafeInteger(i) && roles[i]?.active))] : [];
      if (candidates.length < 2) candidates = [];
      const ballots = {};
      for (const voter of order) {
        const target = value.ballots?.[voter];
        if (Number.isSafeInteger(target) && roles[target]?.active && voter !== target && (!candidates.length || candidates.includes(target))) ballots[voter] = target;
        else break;
      }
      const position = Object.keys(ballots).length;
      ballotState = { votingStyle: "secret", ballotOrder: order, ballots, ballotPosition: position, ballotCandidates: candidates, selectedBallot: null };
      value.screen = position === order.length ? "ballotResult" : "ballotHandoff";
      const totals = order.map(i => ({ index: i, votes: Object.values(ballots).filter(v => v === i).length }));
      const max = Math.max(...totals.map(p => p.votes));
      const leaders = totals.filter(p => p.votes === max);
      value.selectedVote = value.screen === "ballotResult" && leaders.length === 1 ? leaders[0].index : null;
    }
    const whiteGuesses = {};
    if (value.whiteGuesses && typeof value.whiteGuesses === "object") Object.entries(value.whiteGuesses).forEach(([index, guess]) => { if (Number.isSafeInteger(+index) && +index >= 0 && +index < roles.length && typeof guess === "string") whiteGuesses[index] = guess.slice(0, 40); });
    return {
      ...config, ...ballotState,
      gameId: typeof value.gameId === "string" ? value.gameId.slice(0, 100) : makeGameId(),
      gamesRecorded: false, startedAt: Number.isFinite(value.startedAt) ? value.startedAt : Date.now(),
      challengeId: CLUE_RULES.some(rule => rule.id === value.challengeId) ? value.challengeId : null,
      language: value.language === "zh" ? "zh" : "en",
      category: Object.hasOwn(DEFAULT_PAIRS, value.category) || value.category === "Surprise me" || value.category === "My words" && normalizeCustomPairs(loadStoredJson(value.language === "zh" ? "hush-custom-pairs-zh" : "hush-custom-pairs", [])).length ? value.category : "Everyday",
      customPairs: normalizeCustomPairs(loadStoredJson(value.language === "zh" ? "hush-custom-pairs-zh" : "hush-custom-pairs", [])),
      avatars: normalizeAvatars(value.avatars, value.players.length),
      screen: value.screen, players: value.players.map(name => name.slice(0, 24)), roles, pair: value.pair.map(word => word.slice(0, 40)),
      revealIndex: value.revealIndex, starter: Number.isSafeInteger(value.starter) && value.starter >= 0 && value.starter < roles.length ? value.starter : 0,
      turnPosition: Math.min(roles.filter(role => role.active).length - 1, Math.max(0, Number.isSafeInteger(value.turnPosition) ? value.turnPosition : 0)), clueCycle: Math.min(100, Math.max(1, Number.isSafeInteger(value.clueCycle) ? value.clueCycle : 1)),
      roundNumber: Math.min(100, Math.max(1, Number.isSafeInteger(value.roundNumber) ? value.roundNumber : 1)), duration, remaining: Math.min(duration, Math.max(0, Number(value.remaining) || 0)),
      selectedVote: value.selectedVote, eliminatedIndex: value.eliminatedIndex, winner: null, whiteGuesses, whiteGuessed: false,
      imposterCount: roles.filter(role => role.type === "imposter").length, whiteCount: roles.filter(role => role.type === "white").length,
      timerRunning: false, timerDeadline: null, timerId: null
    };
  } catch { return null; }
}
function clearSessionGame() {
  try { localStorage.removeItem("hush-active-game"); } catch { /* Storage may be unavailable. */ }
  try { sessionStorage.removeItem("hush-active-game"); } catch { /* Ignore unavailable storage. */ }
}
function normalizeCustomPairs(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set(), pairs = [];
  for (const item of value) {
    if (!Array.isArray(item) || item.length !== 2 || !item.every(word => typeof word === "string" && word.trim())) continue;
    const pair = item.map(word => word.trim().slice(0, 40));
    const key = wordPairKey(pair);
    if (normalizeWord(pair[0]) === normalizeWord(pair[1]) || seen.has(key)) continue;
    seen.add(key); pairs.push(pair);
    if (pairs.length === 100) break;
  }
  return pairs;
}
const storedSetup = loadStoredJson("hush-setup", {});
const savedSetup = storedSetup && typeof storedSetup === "object" ? storedSetup : {};
const savedLanguage = savedSetup.language === "zh" ? "zh" : "en";
const savedPlayers = Array.isArray(savedSetup.players) && savedSetup.players.length >= 3 && savedSetup.players.length <= 12 ? savedSetup.players.map(name => String(name).slice(0, 24)) : ["", "", "", ""];
const app = document.querySelector("#app");
const state = {
  screen: "home", players: savedPlayers, avatars: normalizeAvatars(savedSetup.avatars, savedPlayers.length), imposterCount: Number.isSafeInteger(savedSetup.imposterCount) ? savedSetup.imposterCount : 1, whiteCount: Number.isSafeInteger(savedSetup.whiteCount) ? savedSetup.whiteCount : 1,
  language: savedLanguage, ...normalizeGameConfig(savedSetup, savedPlayers.length),
  feedbackEnabled: savedSetup.feedbackEnabled === true, votingStyle: savedSetup.votingStyle === "secret" ? "secret" : "group",
  ballotOrder: [], ballots: {}, ballotPosition: 0, ballotCandidates: [], selectedBallot: null,
  gameId: null, gamesRecorded: false, challengeId: null, startedAt: null,
  category: Object.hasOwn(DEFAULT_PAIRS, savedSetup.category) || savedSetup.category === "Surprise me" ? savedSetup.category : "Everyday", customPairs: normalizeCustomPairs(loadStoredJson(savedLanguage === "zh" ? "hush-custom-pairs-zh" : "hush-custom-pairs", [])),
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
  const normalized = values.map(normalizeWord);
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
  saveStoredJson("hush-setup", { players: state.players, avatars: state.avatars, imposterCount: state.imposterCount, whiteCount: state.whiteCount, category: state.category, language: state.language, mode: state.mode, votingStyle: state.votingStyle, accompliceEnabled: state.accompliceEnabled, jesterEnabled: state.jesterEnabled, feedbackEnabled: state.feedbackEnabled });
}
function saveSessionGame() {
  if (!state.roles.length || ["home", "setup", "result"].includes(state.screen)) return;
  const safeScreen = state.screen === "role" ? "handoff" : state.screen === "ballot" ? "ballotHandoff" : state.screen;
  const remaining = state.timerRunning && state.timerDeadline ? Math.max(0, Math.ceil((state.timerDeadline - Date.now()) / 1000)) : state.remaining;
  const snapshot = { ...state, screen: safeScreen, selectedBallot: null, remaining, timerId: null, timerRunning: false, timerDeadline: null };
  resumableGame = snapshot;
  saveStoredJson("hush-active-game", { version: 3, roles: snapshot.roles, pair: snapshot.pair, state: snapshot });
  try { sessionStorage.setItem("hush-active-game", JSON.stringify({ version: 3, roles: snapshot.roles, pair: snapshot.pair, state: snapshot })); } catch { /* Continue without resume support. */ }
}
function normalizeWord(value) { return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase(); }
function activeIndices() { return state.roles.map((role, i) => role.active ? i : -1).filter(i => i >= 0); }
function roleName(type) {
  const labels = { civilian: ["a Civilian", "平民"], imposter: ["an Imposter", "卧底"], white: ["Mr. White", "白板"], accomplice: ["the Accomplice", "共谋者"], jester: ["the Jester", "小丑"] };
  return t(...labels[type]);
}
function specialCount() { return Number(state.accompliceEnabled) + Number(state.jesterEnabled); }
function normalizeSetupRoles() { Object.assign(state, normalizeGameConfig(state, state.players.length)); }
function makeGameId() { return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function modeName() { return t(...GAME_MODES[state.mode].name); }
function sourcePairs() {
  if (state.category === "My words") return state.customPairs;
  if (state.category === "Surprise me") return Object.values(wordPacks()).flat();
  return Object.hasOwn(wordPacks(), state.category) ? wordPacks()[state.category] : [];
}
function selectChallenge() {
  if (state.mode !== "chaos") { state.challengeId = null; return; }
  const options = CLUE_RULES.filter(rule => rule.id !== state.challengeId);
  state.challengeId = options[Math.floor(Math.random() * options.length)].id;
}
function ruleBanner() {
  if (state.mode === "chaos") {
    const rule = CLUE_RULES.find(rule => rule.id === state.challengeId);
    if (rule) return `<aside class="rule-banner"><span class="rule-kicker">${t("THIS ROUND'S TWIST", "本轮挑战")}</span><b>${t(...rule.name)}</b><p>${t(...rule.description)}</p></aside>`;
  }
  return `<aside class="rule-banner"><span class="rule-kicker">${modeName()}</span><b>${state.mode === "blitz" ? t("One clue. Fifteen seconds. Go!", "一个线索，十五秒，开始！") : t("Be clever. Keep your word secret.", "巧妙描述，保守秘密。")}</b><p>${state.mode === "blitz" ? t("One turn each, then vote. The timer moves play forward when it ends.", "每人描述一次后投票。倒计时结束时自动进入下一位。") : t("Give a clue without saying your word, spelling it, or translating it. Everyone gets a turn before voting.", "不能说出、拼读或翻译你的词语。投票前，每人都有一次发言机会。")}</p></aside>`;
}
function playerTracker() {
  return `<details class="players-tracker"><summary>${t("Players remaining", "剩余玩家")} · ${activeIndices().length}/${state.players.length}</summary><div class="tracker-list">${state.roles.map((role, i) => `<div class="tracker-player">${playerAvatar(i)}<b>${escapeHtml(names()[i])}</b><span class="tracker-status">${role.active ? t("In play", "在场") : roleName(role.type)}</span></div>`).join("")}</div></details>`;
}
function modePicker() {
  return `<div class="mode-picker" role="group" aria-label="${t("Game mode", "游戏模式")}">${Object.entries(GAME_MODES).map(([id, mode]) => `<button type="button" class="mode-card" data-mode="${id}" aria-pressed="${state.mode === id}"><span class="mode-icon" aria-hidden="true">${mode.icon}</span><b class="mode-name">${t(...mode.name)}</b><span class="mode-description">${t(...mode.description)}</span></button>`).join("")}</div>`;
}
function specialRoleOptions() {
  const available = state.players.length >= 5;
  const options = [
    ["jesterEnabled", "🎭", t("Jester", "小丑"), t("A solo trickster. Receives the Imposter word and wins alone if voted out. Surviving is not a win.", "独立阵营。获得卧底词，被投票淘汰即独自获胜；活到最后不算胜利。")],
    ["accompliceEnabled", "🤝", t("Accomplice", "共谋者"), t("Knows their role and the Civilian word, but wins with the infiltrators. Protect the other infiltrators without knowing who they are.", "知道自己的身份和平民词，却属于卧底阵营。你不知道其他卧底是谁，需要巧妙保护他们。")]
  ];
  return `<details class="special-roles" ${specialCount() ? "open" : ""}><summary>${t("Optional special roles", "可选特殊身份")} ${specialCount() ? `· ${specialCount()}` : ""}</summary><p class="tiny">${available ? t("One of each at most. Keep at least two Civilians and one Imposter or Mr. White.", "每种最多一名，至少保留两名平民和一名卧底或白板。") : t("Bring 5 or more players to unlock special roles.", "5 人及以上可启用特殊身份。")}</p><div class="special-role-list">${options.map(([key, icon, name, note]) => `<label class="special-role"><input type="checkbox" data-special-role="${key}" ${state[key] ? "checked" : ""} ${!available || !state[key] && state.imposterCount + state.whiteCount + specialCount() >= state.players.length - 2 ? "disabled" : ""}><span><b>${icon} ${name}</b><small>${note}</small></span></label>`).join("")}</div></details>`;
}
function loadScoreboard() {
  const stored = loadStoredJson("hush-scoreboard", {});
  return { players: Array.isArray(stored?.players) ? stored.players.filter(p => p && typeof p.name === "string" && Number.isSafeInteger(p.wins) && p.wins >= 0 && Number.isSafeInteger(p.played) && p.played >= p.wins).slice(-200) : [], recorded: Array.isArray(stored?.recorded) ? stored.recorded.filter(id => typeof id === "string").slice(-100) : [] };
}
function recordGame() {
  if (!state.gameId || state.gamesRecorded || !state.winner) return;
  const board = loadScoreboard();
  if (board.recorded.includes(state.gameId)) { state.gamesRecorded = true; return; }
  state.roles.forEach((role, i) => {
    const name = names()[i];
    // Unnamed seats are excluded so changing languages does not create fake people.
    if (!state.players[i].trim()) return;
    const key = normalizeWord(name);
    let player = board.players.find(p => normalizeWord(p.name) === key);
    if (!player) { player = { name, wins: 0, played: 0, avatar: state.avatars[i] }; board.players.push(player); }
    player.name = name; player.avatar = state.avatars[i]; player.played++;
    if (isWinningPlayer(role, i, state.winner, state.eliminatedIndex)) player.wins++;
  });
  board.recorded.push(state.gameId); board.recorded = board.recorded.slice(-100); board.players = board.players.slice(-200);
  saveStoredJson("hush-scoreboard", board); state.gamesRecorded = true;
}
function scoreboard() {
  const board = loadScoreboard();
  const rows = board.players.slice().sort((a, b) => b.wins - a.wins || b.played - a.played || a.name.localeCompare(b.name)).slice(0, 8);
  if (!rows.length) return "";
  return `<details class="scoreboard"><summary>${t("Your group's hall of fame", "小伙伴荣誉榜")}</summary><p class="tiny">${t("Wins across completed games on this device. Add names to keep score.", "记录本设备已完成游戏的胜场。填写名字即可计分。")}</p>${rows.map((p, i) => `<div class="score-row"><span class="score-position">${i + 1}</span><span class="player-avatar" aria-hidden="true">${avatarArt(p.avatar)}</span><b class="score-name">${escapeHtml(p.name)}</b><span class="score-wins">${t("{wins} wins · {games} games", "{wins} 胜 · {games} 局", { wins: p.wins, games: p.played })}</span></div>`).join("")}<button class="button secondary wide" data-action="reset-scores">${t("Reset scores", "重置成绩")}</button></details>`;
}
function endGame(winner) {
  pauseTimer(); state.winner = winner; state.screen = "result"; recordGame(); clearSessionGame(); resumableGame = null; render();
}
let audioContext = null;
function feedback() {
  if (!state.feedbackEnabled) return;
  navigator.vibrate?.([100, 50, 100]);
  try {
    if (!audioContext || audioContext.state !== "running") return;
    const tone = audioContext.createOscillator(), gain = audioContext.createGain();
    tone.frequency.value = 660; gain.gain.setValueAtTime(.08, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + .25);
    tone.connect(gain); gain.connect(audioContext.destination); tone.start(); tone.stop(audioContext.currentTime + .25);
  } catch { /* Timer feedback is optional. */ }
}
function unlockAudio() {
  if (!state.feedbackEnabled) return;
  try { const Audio = window.AudioContext || window.webkitAudioContext; if (Audio) { audioContext ||= new Audio(); audioContext.resume().catch(() => {}); } } catch { /* Some devices do not support audio. */ }
}
function nextSpeaker() {
  if (state.screen !== "round") return;
  pauseTimer();
  const count = discussionOrder().length;
  if (state.mode === "blitz" && state.turnPosition >= count - 1) { beginVoting(); return; }
  state.turnPosition++;
  if (state.turnPosition >= count) { state.turnPosition = 0; state.clueCycle++; toast(t("Everyone has spoken — continue or vote", "所有人都已发言，请继续讨论或投票")); }
  state.remaining = state.duration; render();
}
function roleCounter(label, type, count) {
  const totalInfiltrators = state.imposterCount + state.whiteCount + specialCount();
  const atMaximum = totalInfiltrators >= state.players.length - 2;
  const otherCount = type === "imposter" ? state.whiteCount : state.imposterCount;
  return `<div class="role-counter"><span><b>${label}</b><small>${type === "imposter" ? t("Related word", "相近的词") : t("No word", "没有词语")}</small></span><div class="mini-stepper"><button data-role-type="${type}" data-delta="-1" aria-label="${t("Fewer", "减少")} ${label}" ${count === 0 || state.imposterCount + state.whiteCount === 1 ? "disabled" : ""}>−</button><strong aria-live="polite">${count}</strong><button data-role-type="${type}" data-delta="1" aria-label="${t("More", "增加")} ${label}" ${atMaximum && otherCount === 0 ? "disabled" : ""}>+</button></div></div>`;
}
let renderedScreen = null;
function render() {
  const screenChanged = renderedScreen !== state.screen;
  const activeId = !screenChanged ? document.activeElement?.id : null;
  const activeData = !screenChanged && document.activeElement?.dataset ? { ...document.activeElement.dataset } : null;
  clearInterval(state.timerId);
  state.timerId = null;
  const views = { home, setup, handoff, role, round, vote, elimination, whiteGuess, result, ballotHandoff, ballot, ballotResult };
  app.innerHTML = views[state.screen]();
  localizeShell();
  if (!screenChanged) app.firstElementChild?.classList.add("no-enter");
  if (screenChanged) {
    window.scrollTo({ top: 0, behavior: "auto" });
    const heading = app.querySelector("h1, h2");
    if (heading) { heading.tabIndex = -1; window.requestAnimationFrame?.(() => heading.focus({ preventScroll: true })); }
  } else if (activeData) {
    const selector = activeData.action ? `[data-action="${activeData.action}"]` : activeData.vote !== undefined ? `[data-vote="${activeData.vote}"]` : activeData.ballot !== undefined ? `[data-ballot="${activeData.ballot}"]` : activeData.mode ? `[data-mode="${activeData.mode}"]` : activeData.specialRole ? `[data-special-role="${activeData.specialRole}"]` : activeData.roleType ? `[data-role-type="${activeData.roleType}"][data-delta="${activeData.delta}"]` : null;
    if (selector) window.requestAnimationFrame?.(() => app.querySelector(selector)?.focus({ preventScroll: true }));
    else if (["category", "voting-style", "feedback-enabled"].includes(activeId)) window.requestAnimationFrame?.(() => app.querySelector(`#${activeId}`)?.focus({ preventScroll: true }));
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
    <div class="home-features"><div class="feature-card"><span class="feature-icon" aria-hidden="true">🎲</span><b>${t("Three ways to play", "三种玩法")}</b><p>${t("Classic, Blitz & Chaos", "经典、闪电、奇趣")}</p></div><div class="feature-card"><span class="feature-icon" aria-hidden="true">🎭</span><b>${t("Secret identities", "秘密身份")}</b><p>${t("Optional roles, new strategies", "特殊身份，全新策略")}</p></div><div class="feature-card"><span class="feature-icon" aria-hidden="true">✈️</span><b>${t("Play anywhere", "随处可玩")}</b><p>${t("One phone. Fully offline.", "一部手机，离线畅玩。")}</p></div></div>
    ${scoreboard()}
    <div class="hero-art" aria-hidden="true"><img src="friends.svg" alt="" width="600" height="230"></div>
    <p class="tiny offline-status">${state.offlineStatus === "ready" ? t("● Offline ready", "● 已可离线游玩") : state.offlineStatus === "unavailable" ? t("Offline mode unavailable", "离线模式不可用") : t("Preparing offline play…", "正在准备离线游戏…")} • ${t("3–12 players", "3–12 名玩家")}</p>
  </section>`; }

function setup() { return `
  <section class="screen">
    <p class="eyebrow">${t("GAME SETUP", "游戏设置")}</p><h2>${t("Gather your little crew.", "召集你的小伙伴。")}</h2>
    <div class="setup-intro">${modePicker()}</div>
    <div class="setup-columns">
      <div>
        <div class="stepper"><div><b>${t("Players", "玩家")}</b><div class="tiny">${t("3 to 12 people", "3 至 12 人")}</div></div><div class="stepper-controls"><button data-action="players-down" aria-label="${t("Fewer players", "减少玩家")}" ${state.players.length <= 3 ? "disabled" : ""}>−</button><span aria-live="polite">${state.players.length}</span><button data-action="players-up" aria-label="${t("More players", "增加玩家")}" ${state.players.length >= 12 ? "disabled" : ""}>+</button></div></div>
        <div class="player-list">${state.players.map(playerSetup).join("")}</div>
      </div>
      <div>
        <div class="section"><div class="section-heading"><h3>${t("Hidden roles", "隐藏身份")}</h3><small>${state.players.length - state.imposterCount - state.whiteCount - specialCount()} ${t("Civilians", "平民")}</small></div>
          <div class="role-count-list">${roleCounter(t("Imposters", "卧底"), "imposter", state.imposterCount)}${roleCounter(t("Mr. White", "白板"), "white", state.whiteCount)}</div>
          <p class="tiny">${t("At least two players remain Civilians. Imposters and Civilians only see their secret word—not their role.", "至少保留两名平民。卧底和平民只能看到自己的词语，不会知道自己的身份。")}</p>
        </div>
        ${specialRoleOptions()}
        <label class="field-label" for="category">${state.language === "zh" ? "词库" : "WORD PACK"}</label>
        <select id="category">${["Surprise me", ...Object.keys(wordPacks()), ...(state.customPairs.length ? ["My words"] : [])].map(c => `<option value="${escapeHtml(c)}" ${c === state.category ? "selected" : ""}>${state.language === "zh" ? (c === "Surprise me" ? "随机词库" : CHINESE_PACK_LABELS[c]) || escapeHtml(c) : escapeHtml(c)}</option>`).join("")}</select>
        <p class="pack-meta">${t("{count} word pairs · no repeats until you run out", "{count} 组词语 · 用完前不重复", { count: sourcePairs().length })}</p>
        <p class="tiny word-note">${t("↻ Word-pair sides are randomly swapped every game.", "↻ 每局随机交换平民词和卧底词。")}</p>
      </div>
    </div>
    <div class="settings-summary"><span class="summary-chip">${modeName()}</span><span class="summary-chip">${t("{count} infiltrators", "{count} 名卧底阵营玩家", { count: state.imposterCount + state.whiteCount + Number(state.accompliceEnabled) })}</span>${state.jesterEnabled ? `<span class="summary-chip">${t("1 Jester", "1 名小丑")}</span>` : ""}</div>
    <label class="field-label" for="voting-style">${t("HOW TO VOTE", "投票方式")}</label><select id="voting-style"><option value="group" ${state.votingStyle === "group" ? "selected" : ""}>${t("Group vote · host selects the result", "公开投票 · 主持人选择结果")}</option><option value="secret" ${state.votingStyle === "secret" ? "selected" : ""}>${t("Secret ballots · pass the phone to vote", "秘密投票 · 传手机逐一投票")}</option></select><p class="tiny word-note">${t("Secret ballots collect one vote per surviving player, with automatic tallies and runoffs for ties.", "秘密投票为每位在场玩家记录一票，自动计票，平票时进行决胜投票。")}</p>
    <label class="special-role"><input type="checkbox" id="feedback-enabled" ${state.feedbackEnabled ? "checked" : ""}><span><b>${t("Timer sound & vibration", "计时音效与振动")}</b><small>${t("A gentle alert when speaking time ends.", "发言时间结束时轻声提醒。")}</small></span></label>
    <div class="button-row"><button class="button primary wide" data-action="start-game">${t("Assign secret roles", "分配秘密身份")}</button><button class="button secondary" data-action="custom-words">${t("Add words", "添加词语")}</button></div>
  </section>`; }

function handoff() {
  const name = names()[state.revealIndex];
  return `<section class="screen handoff">${playerAvatar(state.revealIndex, true)}<p class="eyebrow">${t("Player {index} of {total}", "第 {index} 位玩家，共 {total} 位", { index: state.revealIndex + 1, total: state.players.length })}</p><h2>${t("Pass to {name}", "请交给 {name}", { name: escapeHtml(name) })}</h2><p class="privacy">${t("Make sure nobody else can see the screen. Hold the button when you're ready.", "确保其他人看不到屏幕。准备好后，长按按钮。")}</p><button class="button primary wide hold-button" data-action="hold-reveal">${t("Hold to reveal", "长按查看")}<div class="progress"><i></i></div></button></section>`;
}

function role() {
  const secret = state.roles[state.revealIndex];
  const special = ["white", "accomplice", "jester"].includes(secret.type);
  const notes = {
    white: t("Listen carefully and bluff. If voted out, you get one chance to guess the Civilians' word.", "仔细听线索，巧妙伪装。被投票淘汰后，你有一次机会猜平民的词语。"),
    accomplice: t("This is the Civilian word, but you are on the infiltrator team. You do not know who the other infiltrators are. Mislead the group and help them survive.", "这是平民词，但你属于卧底阵营。你不知道其他卧底是谁。巧妙误导大家，帮助他们活到最后。"),
    jester: t("This is the Imposter word. You win alone if the group votes you out. Act suspicious, but do not make your plan too obvious. Staying alive does not win.", "这是卧底词。被大家投票淘汰时，你独自获胜。表现得可疑，但别太明显；活到最后不会获胜。")
  };
  const note = notes[secret.type] || t("You might be a Civilian or an Imposter. Your word alone does not reveal which—listen carefully to the clues.", "你可能是平民，也可能是卧底。仅凭词语无法判断身份，请仔细听大家的线索。");
  return `<section class="screen secret-screen"><p class="eyebrow">${t("YOUR SECRET", "你的秘密")}</p><div class="role-card ${special ? "imposter" : ""}"><div class="card-stamp">${t("TOP", "绝密")}<br>${t("SECRET", "档案")}</div><div>${special ? `<span class="special-badge">${roleName(secret.type)}</span>` : ""}<span class="role-label">${secret.type === "white" ? t("YOU ARE MR. WHITE", "你是白板") : t("YOUR WORD IS", "你的词语是")}</span><h2 class="secret-word">${secret.word === null ? t("No word.", "你没有词语。") : escapeHtml(secret.word)}</h2></div><p class="role-note">${note}</p></div><button class="button primary wide" data-action="hide-role" style="margin-top:18px">${t("I've got it — hide my secret", "记住了，隐藏我的秘密")}</button></section>`;
}

function round() {
  const pct = `${(state.remaining / state.duration) * 100}%`;
  const order = discussionOrder();
  const speaker = order[state.turnPosition % order.length];
  return `<section class="screen"><div class="game-header"><div><p class="eyebrow">${t("DISCUSSION", "讨论")}</p><h2>${t("Describe your word.", "描述你的词语。")}</h2></div><span class="round-pill">${t("Round {round}", "第 {round} 轮", { round: state.roundNumber })}</span></div>${ruleBanner()}<div class="speaker-card" aria-live="polite"><span>${t("Now speaking · Clue cycle {cycle}", "当前发言 · 第 {cycle} 次描述", { cycle: state.clueCycle })}</span><b class="player-identity">${playerAvatar(speaker)}${escapeHtml(names()[speaker])}</b><small>${t("{index} of {total}", "第 {index} 位，共 {total} 位", { index: state.turnPosition + 1, total: order.length })}</small></div><div role="timer" aria-label="${t("Speaking time remaining", "剩余发言时间")}" class="timer ${state.timerRunning ? "is-running" : ""} ${state.remaining === 0 ? "is-done" : ""}" style="--timer:${pct}"><div class="timer-inner"><div class="timer-time">${formatTime(state.remaining)}</div><small>${state.remaining === 0 ? t("TIME'S UP", "时间到") : state.timerRunning ? t("COUNTING", "计时中") : t("READY", "准备就绪")}</small></div></div>${state.mode !== "blitz" ? `<div class="timer-adjust" aria-label="${t("Adjust speaking time", "调整发言时间")}"><button data-action="timer-down" aria-label="${t("Remove five seconds", "减少五秒")}" ${state.duration <= 10 ? "disabled" : ""}>−5</button><span><b>${state.duration}${t("s", "秒")}</b><small>${t("per person", "每人")}</small></span><button data-action="timer-up" aria-label="${t("Add five seconds", "增加五秒")}" ${state.duration >= 180 ? "disabled" : ""}>+5</button></div>` : ""}<div class="timer-actions"><button class="button secondary" data-action="reset-timer">${t("Reset", "重置")}</button><button class="button primary" data-action="toggle-timer">${state.timerRunning ? t("Pause", "暂停") : state.remaining < state.duration && state.remaining > 0 ? t("Resume", "继续") : t("Start", "开始")}</button><button class="button secondary" data-action="next-speaker">${state.mode === "blitz" && state.turnPosition >= order.length - 1 ? t("Time to vote →", "进入投票 →") : t("Next player →", "下一位 →")}</button></div>${state.mode === "blitz" ? "" : `<button class="button vote-button wide" data-action="vote">${t("End discussion & vote", "结束讨论并投票")}</button>`}${playerTracker()}</section>`;
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

function beginVoting(candidates = []) {
  pauseTimer(); state.selectedVote = null; state.selectedBallot = null;
  if (state.votingStyle === "secret") {
    state.ballotOrder = activeIndices(); state.ballots = {}; state.ballotPosition = 0;
    state.ballotCandidates = candidates.filter(i => state.roles[i]?.active);
    state.screen = "ballotHandoff";
  } else state.screen = "vote";
  render();
}
function ballotVoter() { return state.ballotOrder[state.ballotPosition]; }
function ballotOptions() {
  return (state.ballotCandidates.length ? state.ballotCandidates : activeIndices()).filter(i => state.roles[i]?.active && i !== ballotVoter());
}
function tallyBallots() {
  const counts = activeIndices().map(index => ({ index, votes: Object.values(state.ballots).filter(vote => vote === index).length }));
  const maximum = Math.max(0, ...counts.map(row => row.votes));
  return { counts, leaders: counts.filter(row => row.votes === maximum).map(row => row.index) };
}
function castBallot() {
  if (state.screen !== "ballot" || !ballotOptions().includes(state.selectedBallot)) return;
  state.ballots[ballotVoter()] = state.selectedBallot; state.selectedBallot = null; state.ballotPosition++;
  if (state.ballotPosition === state.ballotOrder.length) {
    const tally = tallyBallots(); state.selectedVote = tally.leaders.length === 1 ? tally.leaders[0] : null; state.screen = "ballotResult";
  } else state.screen = "ballotHandoff";
  render();
}
function ballotHandoff() {
  const voter = ballotVoter();
  return `<section class="screen handoff">${playerAvatar(voter, true)}<p class="eyebrow">${t("PRIVATE VOTE", "秘密投票")} · ${state.ballotPosition + 1}/${state.ballotOrder.length}</p><h2>${t("Pass to {name}", "请交给 {name}", { name: escapeHtml(names()[voter]) })}</h2><p class="privacy">${t("Only this player should see the next screen. Your vote stays hidden until everyone has voted.", "只有这位玩家可以查看下一页。所有人投完票后才会公布计票结果。")}</p><button class="button primary wide" data-action="open-ballot">${t("I'm ready to vote", "我准备好投票了")}</button></section>`;
}
function ballot() {
  return `<section class="screen"><p class="eyebrow">${t("YOUR PRIVATE VOTE", "你的秘密一票")}</p><h2>${t("Who seems suspicious?", "谁最可疑？")}</h2><p class="muted">${t("Choose one player. You cannot vote for yourself. Your choice is final once you lock it in.", "选择一位玩家，不能投自己。确认后无法修改。")}</p><div class="vote-list">${ballotOptions().map(i => `<button class="vote ${state.selectedBallot === i ? "selected" : ""}" data-ballot="${i}" aria-pressed="${state.selectedBallot === i}"><span class="player-identity">${playerAvatar(i)}${escapeHtml(names()[i])}</span><span>${state.selectedBallot === i ? t("SELECTED", "已选择") : t("TAP TO VOTE", "点击投票")}</span></button>`).join("")}</div><button class="button primary wide" data-action="cast-ballot" ${state.selectedBallot === null ? "disabled" : ""}>${t("Lock in my vote", "确认我的投票")}</button></section>`;
}
function ballotResult() {
  const tally = tallyBallots(), tied = tally.leaders.length !== 1;
  return `<section class="screen"><p class="eyebrow">${t("THE VOTES ARE IN", "投票已完成")}</p><h2>${tied ? t("It's a tie.", "平票了。") : t("The group has decided.", "大家作出了选择。")}</h2><p class="muted">${tied ? t("Discuss the tied players, then take a runoff vote between them. Everyone still in play gets a vote.", "讨论平票的玩家，再只在他们之间进行决胜投票。所有在场玩家仍各有一票。") : t("Confirm the elimination to reveal this player's role.", "确认淘汰后，将公布这位玩家的身份。")}</p><div class="vote-list">${tally.counts.sort((a, b) => b.votes - a.votes).map(row => `<div class="vote"><span class="player-identity">${playerAvatar(row.index)}${escapeHtml(names()[row.index])}</span><span>${t("{count} votes", "{count} 票", { count: row.votes })}</span></div>`).join("")}</div>${tied ? `<button class="button primary wide" data-action="runoff-vote">${t("Runoff vote", "决胜投票")}</button>` : `<button class="button danger wide" data-action="eliminate">${t("Eliminate {name}", "淘汰 {name}", { name: escapeHtml(names()[state.selectedVote]) })}</button>`}<button class="button secondary tie-button" data-action="back-round">${t("Discuss again", "继续讨论")}</button></section>`;
}
function vote() { return `<section class="screen"><p class="eyebrow">${t("Round {round}", "第 {round} 轮", { round: state.roundNumber })} · ${t("THE VOTE", "投票")}</p><h2>${t("Who seems suspicious?", "谁最可疑？")}</h2><p class="muted">${t("Only surviving players can be eliminated. If the vote is tied, discuss and vote again until one player is chosen.", "只能淘汰仍在场的玩家。如果票数相同，请继续讨论并重新投票，直到选出一位玩家。")}</p><div class="vote-list">${activeIndices().map(i => `<button class="vote ${state.selectedVote === i ? "selected" : ""}" data-vote="${i}" aria-pressed="${state.selectedVote === i}"><span class="player-identity">${playerAvatar(i)}${escapeHtml(names()[i])}</span><span>${state.selectedVote === i ? t("SELECTED", "已选择") : t("TAP TO VOTE", "点击投票")}</span></button>`).join("")}</div><div class="button-row"><button class="button danger wide" data-action="eliminate" ${state.selectedVote === null ? "disabled" : ""}>${state.selectedVote === null ? t("Choose a player", "选择一位玩家") : t("Eliminate {name}", "淘汰 {name}", { name: escapeHtml(names()[state.selectedVote]) })}</button><button class="button secondary" data-action="back-round">${t("Tie? Discuss again", "平票？再讨论一次")}</button></div>${playerTracker()}</section>`; }

function elimination() {
  const i = state.eliminatedIndex, role = state.roles[i];
  return `<section class="screen reveal-result elimination-reveal"><div class="reveal-rays" aria-hidden="true"></div><p class="eyebrow">${t("PLAYER ELIMINATED", "玩家已淘汰")}</p><div class="eliminated-avatar">${playerAvatar(i, true)}</div><div class="result-icon">${role.type === "civilian" ? "😬" : role.type === "imposter" ? "🕵️" : "⬜"}</div><h2>${t("{name} was {role}.", "{name} 的身份是{role}。", { name: escapeHtml(names()[i]), role: roleName(role.type) })}</h2><p class="lede" style="margin-inline:auto">${role.type === "white" ? t("Mr. White now gets one final chance to steal the game.", "白板现在有最后一次猜词机会，可以逆转获胜。") : role.type === "jester" ? t("The Jester fooled everyone into voting them out. They win alone!", "小丑成功被大家投票淘汰，独自获胜！") : role.type === "accomplice" ? t("The Accomplice was playing for the infiltrators with the Civilian word.", "共谋者拿着平民词，却属于卧底阵营。") : role.type === "imposter" ? t("One Imposter is out. Are there more hiding?", "一名卧底已出局。还有其他卧底吗？") : t("An innocent Civilian has been eliminated.", "一名无辜的平民被淘汰了。")}</p><button class="button primary wide" data-action="after-elimination">${role.type === "white" ? t("Make the final guess", "进行最后猜词") : t("Check the game", "继续游戏")}</button></section>`;
}

function whiteGuess() {
  return `<section class="screen"><p class="eyebrow">${t("MR. WHITE'S LAST CHANCE", "白板的最后机会")}</p><h2>${t("Guess the Civilians' word.", "猜出平民的词语。")}</h2><p class="muted"><b>${escapeHtml(names()[state.eliminatedIndex])}</b>${t(" gets one exact guess. Capitalization and surrounding spaces do not matter.", " 有一次猜词机会，答案必须准确。大小写和首尾空格不影响判断。")}</p><form id="white-guess-form"><label class="field-label" for="white-guess">${t("FINAL GUESS", "最后猜词")}</label><input id="white-guess" maxlength="40" autocomplete="off" enterkeyhint="done" placeholder="${t("Type the word", "输入词语")}"><button class="button primary wide" type="submit" style="margin-top:14px">${t("Lock in guess", "确认答案")}</button></form></section>`;
}

function result() {
  const label = state.winner === "civilian" ? t("Civilians win!", "平民获胜！") : state.winner === "infiltrator" ? t("Infiltrators win!", "卧底阵营获胜！") : state.winner === "jester" ? t("The Jester wins!", "小丑获胜！") : t("Mr. White wins!", "白板获胜！");
  const note = state.winner === "civilian" ? t("Every infiltrator has been caught.", "所有卧底阵营玩家都已被找出。") : state.winner === "infiltrator" ? t("Only one Civilian remains, so the infiltrator faction takes the game.", "只剩一名平民，卧底阵营赢得了游戏。") : state.winner === "jester" ? t("A perfect act. The group voted out the one player who wanted to leave.", "演技满分！大家淘汰了唯一想被淘汰的玩家。") : t("Mr. White cracked the Civilians' word after being eliminated.", "白板被淘汰后猜中了平民的词语。");
  const particles = Array.from({length: 30}, (_, i) => `<i style="--x:${(i * 43) % 101 - 50};--r:${(i * 67) % 360};--d:${(i % 7) * .08}s"></i>`).join("");
  const playerRows = state.roles.map((role, index) => {
    const won = isWinningPlayer(role, index, state.winner, state.eliminatedIndex);
    const guessWon = state.winner === "white" && index === state.eliminatedIndex;
    const guess = role.type === "white" && state.whiteGuesses[index] ? `<em class="${guessWon ? "guess-correct" : "guess-wrong"}">${guessWon ? t("Correct", "正确") : t("Incorrect", "错误")}: “${escapeHtml(state.whiteGuesses[index])}”</em>` : "";
    return `<div class="player-outcome ${won ? "won" : "lost"}"><span class="player-identity">${playerAvatar(index)}<span class="outcome-name">${escapeHtml(names()[index])}<small>${roleName(role.type)}${guess}</small></span></span><span class="outcome-tags">${won ? `<b class="status winner-status">${t("Winner", "获胜")}</b>` : ""}<b class="status ${role.active ? "alive-status" : "out-status"}">${role.active ? t("Survived", "仍在场") : t("Voted · R{round}", "已淘汰 · 第 {round} 轮", { round: role.eliminatedRound || "?" })}</b></span></div>`;
  }).join("");
  return `<section class="screen reveal-result celebration winner-${state.winner}"><div class="confetti" aria-hidden="true">${particles}</div><div class="victory-halo" aria-hidden="true"></div><p class="eyebrow">${t("GAME OVER", "游戏结束")}</p><div class="result-icon">${state.winner === "civilian" ? "🏆" : state.winner === "infiltrator" ? "🕵️" : state.winner === "jester" ? "🎭" : "⬜"}</div><h2>${label}</h2><p class="lede" style="margin-inline:auto">${note}</p><div class="word-pair"><span class="word-chip">${t("Civilian word:", "平民词：")} <b>${escapeHtml(state.pair[0])}</b></span><span class="word-chip">${t("Imposter word:", "卧底词：")} <b>${escapeHtml(state.pair[1])}</b></span></div><div class="result-stats"><span>${modeName()}</span><span>${t("{rounds} rounds", "{rounds} 轮", { rounds: state.roundNumber })}</span></div><div class="final-roles">${playerRows}</div>${scoreboard()}<div class="button-row"><button class="button primary wide" data-action="play-again">${t("Play again", "再玩一局")}</button><button class="button secondary wide" data-action="home">${t("Home", "首页")}</button></div></section>`;
}

function startGame() {
  syncSetupInputs();
  const effectiveNames = names();
  const duplicate = duplicateNameIndex(effectiveNames);
  if (duplicate >= 0) {
    const normalizedDuplicate = normalizeWord(effectiveNames[duplicate]);
    const first = effectiveNames.findIndex(name => normalizeWord(name) === normalizedDuplicate);
    const inputs = document.querySelectorAll("[data-player]");
    inputs[first]?.setAttribute("aria-invalid", "true");
    inputs[duplicate]?.setAttribute("aria-invalid", "true");
    inputs[duplicate]?.focus();
    toast(t("Each player needs a unique name", "每位玩家的名字必须不同"));
    return;
  }
  normalizeSetupRoles();
  state.duration = state.mode === "blitz" ? 15 : 30;
  state.remaining = state.duration;
  let source = sourcePairs();
  if (!source.length) { state.category = "Everyday"; source = sourcePairs(); }
  const historyKey = `hush-word-history-${state.language}`;
  const storedHistory = loadStoredJson(historyKey, []);
  const draw = drawWordPair(source, Array.isArray(storedHistory) ? storedHistory : []);
  state.pair = draw.pair; saveStoredJson(historyKey, draw.history);
  state.gameId = makeGameId(); state.gamesRecorded = false; state.startedAt = Date.now();
  selectChallenge(); saveSetup();
  if (Math.random() < .5) state.pair.reverse();
  const types = shuffle(configuredRoleTypes(state, state.players.length));
  state.roles = types.map(type => ({ type, word: type === "white" ? null : ["civilian", "accomplice"].includes(type) ? state.pair[0] : state.pair[1], active: true }));
  clearSessionGame(); resumableGame = null;
  state.revealIndex = 0; state.starter = chooseStarter(); state.turnPosition = 0; state.clueCycle = 1; state.roundNumber = 1; state.selectedVote = null; state.eliminatedIndex = null; state.winner = null; state.whiteGuessed = false; state.whiteGuesses = {}; state.timerRunning = false; state.screen = "handoff"; render();
}

function finishElimination() {
  const winner = detectWinner(state.roles, state.eliminatedIndex);
  if (winner) { endGame(winner); return; }
  state.roundNumber++; state.remaining = state.duration; state.turnPosition = 0; state.clueCycle = 1;
  state.selectedVote = null; state.eliminatedIndex = null; state.starter = chooseStarter(true);
  selectChallenge(); state.screen = "round"; render();
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
  if (state.screen !== "whiteGuess" || state.roles[state.eliminatedIndex]?.type !== "white" || state.roles[state.eliminatedIndex].active) return;
  const enteredGuess = document.querySelector("#white-guess")?.value.trim();
  if (!enteredGuess) { toast(t("Enter one final guess", "请输入最后的猜词答案")); return; }
  state.whiteGuesses[state.eliminatedIndex] = enteredGuess;
  if (normalizeWord(enteredGuess) === normalizeWord(state.pair[0])) {
    state.whiteGuessed = true; endGame("white");
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
  feedback();
  if (state.mode === "blitz") nextSpeaker(); else render();
  toast(t("Time's up — next player!", "时间到，下一位！"));
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
  const modeButton = e.target.closest("[data-mode]");
  if (modeButton && state.screen === "setup" && Object.hasOwn(GAME_MODES, modeButton.dataset.mode)) {
    syncSetupInputs(); state.mode = modeButton.dataset.mode; saveSetup(); render(); return;
  }
  const roleButton = e.target.closest("[data-role-type]");
  if (roleButton && state.screen === "setup") {
    syncSetupInputs();
    const key = roleButton.dataset.roleType === "imposter" ? "imposterCount" : "whiteCount";
    const delta = +roleButton.dataset.delta;
    const otherKey = key === "imposterCount" ? "whiteCount" : "imposterCount";
    const next = state[key] + delta;
    const nextTotal = state.imposterCount + state.whiteCount + specialCount() + delta;
    if (delta > 0 && nextTotal > state.players.length - 2 && state[otherKey] > 0) { state[otherKey]--; state[key]++; }
    else if (next >= 0 && state.imposterCount + state.whiteCount + delta >= 1 && nextTotal <= state.players.length - 2) state[key] = next;
    saveSetup(); render();
    return;
  }
  const voteButton = e.target.closest("[data-vote]");
  if (voteButton && state.screen === "vote") { const index = Number(voteButton.dataset.vote); if (Number.isSafeInteger(index) && state.roles[index]?.active) { state.selectedVote = index; render(); } return; }
  const ballotButton = e.target.closest("[data-ballot]");
  if (ballotButton && state.screen === "ballot") {
    const index = Number(ballotButton.dataset.ballot); if (ballotOptions().includes(index)) { state.selectedBallot = index; render(); } return;
  }
  const action = e.target.closest("[data-action]")?.dataset.action; if (!action) return;
  if ((action === "language-en" || action === "language-zh") && state.screen === "home") {
    state.language = action === "language-zh" ? "zh" : "en";
    state.customPairs = normalizeCustomPairs(loadStoredJson(customStorageKey(), []));
    if (state.category === "My words" && !state.customPairs.length) state.category = "Everyday";
    saveSetup(); render(); return;
  }
  if (action === "reset-scores" && ["home", "result"].includes(state.screen)) { if (window.confirm(t("Reset all scores on this device?", "重置本设备的全部成绩吗？"))) { saveStoredJson("hush-scoreboard", { players: [], recorded: loadScoreboard().recorded }); render(); } return; }
  if (action === "new-game") { if (resumableGame && !window.confirm(t("Start over and discard the saved game?", "重新开始并放弃已保存的游戏吗？"))) return; clearSessionGame(); resumableGame = null; state.roles = []; state.screen = "setup"; render(); }
  if (action === "resume-game" && resumableGame) { Object.assign(state, resumableGame, { language: state.language, customPairs: state.customPairs, timerId: null, timerRunning: false, timerDeadline: null }); resumableGame = null; if (state.mode === "chaos" && !state.challengeId) selectChallenge(); if (state.category === "My words" && !state.customPairs.length) state.category = "Everyday"; render(); }
  if (action === "home") {
    cancelRevealHold(); pauseTimer();
    if (state.roles.length && !["home", "setup", "result"].includes(state.screen)) saveSessionGame();
    if (state.screen === "setup") { syncSetupInputs(); saveSetup(); }
    state.roles = []; state.screen = "home"; render();
  }
  if (action === "open-help") { if (state.timerRunning) { pauseTimer(); render(); } document.querySelector("#help-dialog").showModal(); }
  if (action === "close-help") document.querySelector("#help-dialog").close();
  if (action === "players-up" && state.screen === "setup" && state.players.length < 12) { syncSetupInputs(); state.players.push(""); state.avatars = normalizeAvatars(state.avatars, state.players.length); saveSetup(); render(); }
  if (action === "players-down" && state.screen === "setup" && state.players.length > 3) { syncSetupInputs(); state.players.pop(); state.avatars.pop(); const previousSpecials = specialCount(); normalizeSetupRoles(); if (specialCount() < previousSpecials) toast(t("Special roles adjusted to keep the game balanced", "已调整特殊身份，确保游戏平衡")); saveSetup(); render(); }
  if (action === "start-game" && state.screen === "setup") { unlockAudio(); startGame(); }
  if (action === "custom-words" && state.screen === "setup") openCustomWords();
  if (action === "close-words") document.querySelector("#words-dialog").close();
  if (action === "save-custom-pair") saveCustomPair();
  if (action === "hold-reveal" && e.detail === 0 && state.screen === "handoff") { cancelRevealHold(); state.screen = "role"; render(); }
  if (action === "hide-role" && state.screen === "role") { state.revealIndex++; if (state.revealIndex >= state.players.length) { state.revealIndex = 0; state.screen = "round"; } else state.screen = "handoff"; render(); }
  if (action === "toggle-timer" && state.screen === "round") { unlockAudio(); if (state.timerRunning) pauseTimer(); else { if (state.remaining === 0) state.remaining = state.duration; state.timerRunning = true; state.timerDeadline = Date.now() + state.remaining * 1000; } render(); }
  if (action === "reset-timer") { pauseTimer(); state.remaining = state.duration; render(); }
  if ((action === "timer-down" || action === "timer-up") && state.screen === "round" && state.mode !== "blitz") { const delta = action === "timer-up" ? 5 : -5; if (state.timerRunning) updateTimerDisplay(); const previous = state.duration; state.duration = Math.max(10, Math.min(180, state.duration + delta)); const applied = state.duration - previous; state.remaining = Math.max(0, Math.min(state.duration, state.remaining + applied)); if (state.timerRunning) state.timerDeadline = Date.now() + state.remaining * 1000; if (state.timerRunning && state.remaining === 0) finishTimer(); else render(); }
  if (action === "next-speaker") nextSpeaker();
  if (action === "vote" && state.screen === "round") beginVoting();
  if (action === "open-ballot" && state.screen === "ballotHandoff") { state.screen = "ballot"; state.selectedBallot = null; render(); }
  if (action === "cast-ballot") castBallot();
  if (action === "runoff-vote" && state.screen === "ballotResult") { const tally = tallyBallots(); if (tally.leaders.length > 1) beginVoting(tally.leaders); }
  if (action === "back-round" && ["vote", "ballotResult"].includes(state.screen)) { state.selectedVote = null; state.turnPosition = 0; state.clueCycle++; state.remaining = state.duration; state.screen = "round"; render(); }
  if (action === "eliminate" && ["vote", "ballotResult"].includes(state.screen) && Number.isSafeInteger(state.selectedVote) && state.roles[state.selectedVote]?.active) { if (!window.confirm(t("Eliminate {name}? This cannot be undone.", "淘汰 {name} 吗？此操作无法撤销。", { name: names()[state.selectedVote] }))) return; state.eliminatedIndex = state.selectedVote; state.roles[state.eliminatedIndex].active = false; state.roles[state.eliminatedIndex].eliminatedRound = state.roundNumber; state.screen = "elimination"; render(); }
  if (action === "after-elimination" && state.screen === "elimination") { if (state.roles[state.eliminatedIndex].type === "white") { state.screen = "whiteGuess"; render(); document.querySelector("#white-guess")?.focus(); } else finishElimination(); }
  if (action === "submit-guess" && state.screen === "whiteGuess") submitWhiteGuess();
  if (action === "play-again" && state.screen === "result") { clearSessionGame(); resumableGame = null; state.roles = []; state.screen = "setup"; render(); }
});

let holdTimer = null;
function beginRevealHold(button) {
  if (holdTimer || state.screen !== "handoff" || document.hidden) return;
  const player = state.revealIndex;
  button.classList.add("holding");
  const pending = setTimeout(() => {
    if (holdTimer !== pending) return;
    holdTimer = null;
    if (state.screen !== "handoff" || state.revealIndex !== player || document.hidden) return;
    state.screen = "role"; render();
  }, 700);
  holdTimer = pending;
}
function cancelRevealHold() {
  clearTimeout(holdTimer); holdTimer = null; document.querySelector(".holding")?.classList.remove("holding");
}
document.addEventListener("pointerdown", e => {
  const button = e.target.closest('[data-action="hold-reveal"]');
  if (button && (e.button === undefined || e.button === 0)) beginRevealHold(button);
});
document.addEventListener("pointerup", cancelRevealHold);
document.addEventListener("pointercancel", cancelRevealHold);
document.addEventListener("pointerleave", e => {
  const button = e.target.closest?.('[data-action="hold-reveal"]');
  if (button && e.target === button && !button.contains?.(e.relatedTarget)) cancelRevealHold();
}, true);
document.addEventListener("keydown", e => { const button = e.target.closest?.('[data-action="hold-reveal"]'); if (!button || !["Enter", " "].includes(e.key)) return; e.preventDefault(); beginRevealHold(button); });
document.addEventListener("keyup", e => { if (["Enter", " "].includes(e.key)) cancelRevealHold(); });
document.addEventListener("change", e => {
  if (e.target.id === "category") { state.category = e.target.value; saveSetup(); render(); }
  if (e.target.id === "voting-style" && state.screen === "setup") { state.votingStyle = e.target.value === "secret" ? "secret" : "group"; saveSetup(); }
  if (e.target.id === "feedback-enabled") { state.feedbackEnabled = e.target.checked; saveSetup(); unlockAudio(); }
  const key = e.target.dataset?.specialRole;
  if (["jesterEnabled", "accompliceEnabled"].includes(key) && state.screen === "setup") {
    syncSetupInputs(); state[key] = e.target.checked; normalizeSetupRoles(); saveSetup(); render();
  }
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
  if (document.hidden) { cancelRevealHold(); saveSessionGame(); if (["role", "ballot"].includes(state.screen)) { state.screen = state.screen === "role" ? "handoff" : "ballotHandoff"; state.selectedBallot = null; render(); } }
  if (!document.hidden && state.timerRunning) updateTimerDisplay();
});
function concealSecret() {
  cancelRevealHold();
  if (["role", "ballot"].includes(state.screen)) { state.screen = state.screen === "role" ? "handoff" : "ballotHandoff"; state.selectedBallot = null; render(); }
  saveSessionGame();
}
window.addEventListener("blur", concealSecret);
window.addEventListener("pagehide", concealSecret);
document.querySelector("#words-dialog")?.addEventListener("close", () => { if (state.screen === "setup") render(); });

if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").then(() => navigator.serviceWorker.ready).then(() => { state.offlineStatus = "ready"; if (state.screen === "home") render(); }).catch(() => { state.offlineStatus = "unavailable"; if (state.screen === "home") render(); }));
else state.offlineStatus = "unavailable";
render();
