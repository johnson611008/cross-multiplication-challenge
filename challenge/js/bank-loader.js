/** challenge/js/bank-loader.js — 題庫產生與載入（封裝 qbank，出題演算法不重寫） */
import { CHALLENGE } from './config.js';

function qbank() {
  if (!window.QBank || !window.QBank.generator) {
    throw new Error('[bank] qbank-bundle 尚未載入');
  }
  return window.QBank;
}

/** 以 seed 產生本次 50 題（只在挑戰開始時呼叫一次，之後固定） */
export function buildBank(seed) {
  const bank = qbank().generator.genBank(seed);
  return bank.questions.map((q) => ({
    qid: q.qid,
    tier: q.tier,
    P: q.P, Q: q.Q, R: q.R,
    ref: { A: q.A, B: q.B, C: q.C, D: q.D },
    difficulty: q.info ? q.info.score : null,
  }));
}

/** 檢查題庫結構（20/20/10、qid 連續） */
export function checkBankShape(questions) {
  if (!Array.isArray(questions) || questions.length !== 50) {
    return { ok: false, reason: '題庫須為 50 題，實為 ' + (questions && questions.length) };
  }
  const counts = { 1: 0, 2: 0, 3: 0 };
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (q.qid !== i + 1) return { ok: false, reason: '題號不連續（index ' + i + ')' };
    if (!counts[q.tier] && counts[q.tier] !== 0) return { ok: false, reason: '未知星等' };
    counts[q.tier]++;
  }
  const expect = {};
  CHALLENGE.STAGES.forEach((s) => { expect[s.tier] = s.count; });
  for (const t of [1, 2, 3]) {
    if (counts[t] !== expect[t]) return { ok: false, reason: t + '星題數錯誤' };
  }
  return { ok: true };
}

/** 正式／測試模式的初始 seed */
export function freshSeed(testMode, rng) {
  if (testMode) return CHALLENGE.TEST_SEED;
  const r = rng || Math.random;
  return 'formal-' + Date.now().toString(36) + '-' + Math.floor(r() * 1e9).toString(36);
}
