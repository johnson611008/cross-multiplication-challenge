/** challenge/js/bank-loader.js — 題庫產生與載入（封裝 qbank，出題演算法不重寫） */
import { CHALLENGE, SELECT25, totalCount } from './config.js';

/* 精選洗牌專用輕量 RNG（只影響挑選順序；相同輸入 seed 結果固定） */
function hashStr(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry(seedNum) {
  let a = seedNum | 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 豐富配對：P 與 |Q| 各有 ≥2 組正整數因數配對 */
function isRich(q) {
  const i = q.info;
  return !!i && i.fP >= 2 && i.fQ >= 2;
}

function quotaStats(list) {
  return {
    negR: list.filter((x) => x.R < 0).length,
    qNeg: list.filter((x) => x.Q < 0).length,
    rich: list.filter(isRich).length,
  };
}

/** 依配額從候選池挑 n 題；不可行回傳 null（由呼叫端重抽整組）
 *  小池用組合搜尋（保證找到可行解），大池用貪婪法。 */
function comboCount(n, k) {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - i + 1)) / i;
  return Math.round(r);
}

function satisfies(list, n, quota) {
  if (list.length !== n) return false;
  const s = quotaStats(list);
  if (s.negR < (quota.negRMin || 0)) return false;
  if (quota.negRMax !== null && quota.negRMax !== undefined && s.negR > quota.negRMax) return false;
  if (s.qNeg < (quota.qNegMin || 0)) return false;
  if (quota.qNegMax !== null && quota.qNegMax !== undefined && s.qNeg > quota.qNegMax) return false;
  if (s.rich < (quota.richMin || 0)) return false;
  return true;
}

function selectQuota(pool, n, quota, rng) {
  if (comboCount(pool.length, n) <= 3000) {
    // 組合搜尋：列舉全部子集（打散順序後取首個可行，結果具可重現性）
    const idx = pool.map((_, i) => i);
    const combos = [];
    const cur = [];
    (function bt(start) {
      if (cur.length === n) { combos.push(cur.slice()); return; }
      for (let i = start; i < idx.length; i++) { cur.push(i); bt(i + 1); cur.pop(); }
    })(0);
    for (let i = combos.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = combos[i]; combos[i] = combos[j]; combos[j] = t;
    }
    for (const c of combos) {
      const list = c.map((i) => pool[i]);
      if (satisfies(list, n, quota)) {
        const set = new Set(list);
        return pool.filter((x) => set.has(x));
      }
    }
    return null;
  }
  const order = pool.slice();
  const overMax = (cand, s) => (
    (quota.negRMax !== null && quota.negRMax !== undefined && cand.R < 0 && s.negR >= quota.negRMax)
    || (quota.qNegMax !== null && quota.qNegMax !== undefined && cand.Q < 0 && s.qNeg >= quota.qNegMax)
  );
  // 大池貪婪： reshuffle 最多 200 次取首個可行（RNG 序列固定，結果可重現）
  for (let a = 0; a < 200; a++) {
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = order[i]; order[i] = order[j]; order[j] = t;
    }
    const picked = [];
    const has = (c) => picked.indexOf(c) !== -1;
    const cnt = (list, fn) => list.filter(fn).length;
    const needs = [];
    if (quota.negRMin) needs.push([(c) => c.R < 0, quota.negRMin]);
    if (quota.qNegMin) needs.push([(c) => c.Q < 0, quota.qNegMin]);
    if (quota.richMin) needs.push([isRich, quota.richMin]);
    for (const pair of needs) {
      const fn = pair[0]; const min = pair[1];
      for (const cand of order) {
        if (picked.length >= n) break;
        if (has(cand) || !fn(cand) || cnt(picked, fn) >= min) continue;
        if (overMax(cand, quotaStats(picked))) continue;
        picked.push(cand);
      }
    }
    for (const cand of order) {
      if (picked.length >= n) break;
      if (has(cand)) continue;
      if (overMax(cand, quotaStats(picked))) continue;
      picked.push(cand);
    }
    if (satisfies(picked, n, quota)) {
      const set = new Set(picked);
      return pool.filter((x) => set.has(x));
    }
  }
  return null;
}

/**
 * 自 50 題候選池精選 25 題（各星等配額見 SELECT25）；不可行回傳 null
 * 純函式（不依賴 window），Node 測試可直接呼叫。
 */
export function trySelect25(rawQuestions, seed) {
  const rng = mulberry(hashStr(seed + '|select25'));
  const out = [];
  const tiers = [1, 2, 3];
  for (const t of tiers) {
    const pool = rawQuestions.filter((q) => q.tier === t);
    const sel = selectQuota(pool, SELECT25[t].n, SELECT25[t], rng);
    if (!sel) return { ok: false, reason: '星等' + t + '配額挑選不可行' };
    out.push.apply(out, sel);
  }
  return { ok: true, questions: out };
}

function qbank() {
  if (!window.QBank || !window.QBank.generator) {
    throw new Error('[bank] qbank-bundle 尚未載入');
  }
  return window.QBank;
}

/** 以 seed 產生本次 25 題（只在挑戰開始時呼叫一次，之後固定）
 *  流程：qbank 產生 50 題候選 → 依 SELECT25 精選 → 題號重排 1..25。
 *  精選不可行時整組重抽（上限 25 次，皆用 seed 衍生，相同 seed 結果固定）。 */
export function buildBank(seed) {
  const gen = qbank().generator.genBank;
  let lastReason = '';
  for (let t = 0; t < 25; t++) {
    const raw = gen(seed + (t === 0 ? '' : '#r' + t)).questions;
    const sel = trySelect25(raw, seed + '#sel' + t);
    if (sel.ok) {
      return sel.questions.map((q, i) => ({
        qid: i + 1,
        tier: q.tier,
        P: q.P, Q: q.Q, R: q.R,
        ref: { A: q.A, B: q.B, C: q.C, D: q.D },
        difficulty: q.info ? q.info.score : null,
      }));
    }
    lastReason = sel.reason;
  }
  throw new Error('[bank] 25 題精選失敗：已重抽 25 組候選（末次原因：' + lastReason + '）');
}

/** 驗證精選後 25 題（逐題公式＋星等適配＋不重複；供測試與除錯用） */
export function verifyBank25(questions) {
  const errors = [];
  const seen = new Set();
  questions.forEach((q, i) => {
    const tag = '第' + (i + 1) + '題';
    const v = qbank().validator.verifyFormulas(q.P, q.Q, q.R, q.ref.A, q.ref.B, q.ref.C, q.ref.D);
    if (!v.ok) errors.push(tag + '：參考答案未通過三公式驗算');
    const T = qbank().config.TIERS[q.tier];
    const fit = qbank().difficulty.checkTierFit(
      { P: q.P, Q: q.Q, R: q.R, A: q.ref.A, B: q.ref.B, C: q.ref.C, D: q.ref.D }, q.tier, T);
    if (!fit.ok) errors.push(tag + '：星等不符（' + fit.reasons.join('；') + '）');
    const key = q.P + ',' + q.Q + ',' + q.R;
    if (seen.has(key)) errors.push(tag + '：(P,Q,R)重複');
    seen.add(key);
  });
  return { ok: errors.length === 0, errors };
}

/** 檢查題庫結構（題數＝各星等 count 加總，qid 連續） */
export function checkBankShape(questions) {
  const total = totalCount();
  if (!Array.isArray(questions) || questions.length !== total) {
    return { ok: false, reason: '題庫須為 ' + total + ' 題，實為 ' + (questions && questions.length) };
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
