// Shared game rules. No browser dependencies; every mode works offline.
const GAME_MODES = {
  classic: { icon: "☕", name: ["Classic", "经典"], description: ["Take your time. Describe, debate, and find the infiltrators.", "慢慢描述，仔细讨论，找出卧底。"] },
  blitz: { icon: "⚡", name: ["Blitz", "闪电"], description: ["15 seconds each. One clue cycle, then straight to the vote.", "每人 15 秒，一轮描述后立即投票。"] },
  chaos: { icon: "🎲", name: ["Chaos", "奇趣"], description: ["A fresh clue challenge every round. Expect the unexpected.", "每轮一个新的描述挑战，惊喜不断。"] }
};
const CLUE_RULES = [
  { id: "one-word", name: ["One word only", "只说一个词"], description: ["Give exactly one word as your clue. No explanations.", "只用一个词给出线索，不作解释。"] },
  { id: "metaphor", name: ["Make a comparison", "打个比方"], description: ["Describe your word with a comparison. Never say the word itself.", "用一个比喻描述你的词语，不能说出词语本身。"] },
  { id: "memory", name: ["Tell a tiny story", "讲个小故事"], description: ["Give a short memory or imagined scene connected to your word.", "说一段与词语有关的小回忆或想象的场景。"] },
  { id: "question", name: ["Ask a question", "提个问题"], description: ["Your clue must be a question. The others listen without answering.", "用一个问题给出线索，其他人只听，不回答。"] },
  { id: "negative", name: ["What it is not", "反着描述"], description: ["Describe something your word is not. Keep the secret word out of it.", "描述你的词语不是什么，不能透露词语本身。"] },
  { id: "feeling", name: ["Set the mood", "说说感受"], description: ["Describe a feeling or atmosphere you associate with your word.", "说出这个词语让你联想到的感受或氛围。"] },
  { id: "sound", name: ["Sounds like…", "听起来像……"], description: ["Describe a sound connected to your word. You may imitate it, too.", "描述与词语有关的声音，也可以模仿这个声音。"] },
  { id: "use", name: ["An unexpected use", "意想不到的用途"], description: ["Suggest an unusual use for your word, or a surprising situation involving it.", "说一个不寻常的用途，或一个与词语有关的意外场景。"] }
];
const ROLE_TYPES = ["civilian", "imposter", "white", "accomplice", "jester"];
const INFILTRATOR_TYPES = ["imposter", "white", "accomplice"];
function normalizeGameConfig(value, playerCount) {
  const count = (v, fallback) => Number.isSafeInteger(v) ? Math.max(0, Math.min(playerCount - 2, v)) : fallback;
  const config = {
    mode: Object.hasOwn(GAME_MODES, value.mode) ? value.mode : "classic",
    imposterCount: count(value.imposterCount, 1), whiteCount: count(value.whiteCount, 0),
    accompliceEnabled: playerCount >= 5 && value.accompliceEnabled === true,
    jesterEnabled: playerCount >= 5 && value.jesterEnabled === true
  };
  config.whiteCount = Math.min(config.whiteCount, playerCount - 2 - config.imposterCount);
  if (config.imposterCount + config.whiteCount === 0) config.imposterCount = 1;
  let available = playerCount - 2 - config.imposterCount - config.whiteCount;
  if (config.accompliceEnabled && available > 0) available--; else config.accompliceEnabled = false;
  if (!(config.jesterEnabled && available > 0)) config.jesterEnabled = false;
  return config;
}
function configuredRoleTypes(config, count) {
  const roles = [...Array(config.imposterCount).fill("imposter"), ...Array(config.whiteCount).fill("white")];
  if (config.accompliceEnabled) roles.push("accomplice");
  if (config.jesterEnabled) roles.push("jester");
  return [...Array(count - roles.length).fill("civilian"), ...roles];
}
function detectWinner(roles, eliminatedIndex) {
  if (roles[eliminatedIndex]?.type === "jester" && !roles[eliminatedIndex].active) return "jester";
  const alive = roles.filter(role => role.active);
  if (!alive.some(role => INFILTRATOR_TYPES.includes(role.type))) return "civilian";
  if (alive.filter(role => role.type === "civilian").length <= 1) return "infiltrator";
  return null;
}
function isWinningPlayer(role, index, winner, eliminatedIndex) {
  if (winner === "civilian") return role.type === "civilian";
  if (winner === "infiltrator") return INFILTRATOR_TYPES.includes(role.type);
  return index === eliminatedIndex && role.type === winner;
}
function wordPairKey(pair) {
  return pair.map(word => word.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase()).sort().join("\u0000");
}
function drawWordPair(source, history, random = Math.random) {
  const keys = new Set(source.map(wordPairKey));
  let nextHistory = history.filter(key => typeof key === "string");
  let available = source.filter(pair => !nextHistory.includes(wordPairKey(pair)));
  if (!available.length) {
    const last = nextHistory[nextHistory.length - 1];
    nextHistory = nextHistory.filter(key => !keys.has(key));
    available = source.length > 1 ? source.filter(pair => wordPairKey(pair) !== last) : source;
  }
  const pair = available[Math.floor(random() * available.length)];
  return { pair: [...pair], history: [...nextHistory, wordPairKey(pair)].slice(-2000) };
}
