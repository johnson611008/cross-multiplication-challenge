/* qbank-bundle.js — 由 tools/build-qbank-bundle.js 自動產生，請勿手動編輯。
 * 來源：qbank/*.js（CommonJS），瀏覽器相容包裝。 */
(function (global) {
  "use strict";
  var __mods = {};
  function __req(name) {
    var key = name.replace(/^\.\//, "");
    if (!__mods[key]) throw new Error("[qbank-bundle] 找不到模組：" + name);
    return __mods[key];
  }
  function __def(name, fn) {
    var module = { exports: {} };
    fn(__req, module, module.exports);
    __mods[name] = module.exports;
  }
  __def("rng", function (require, module, exports) {
/**
 * qbank/rng.js — 可重現隨機數（seed 支援）
 * 同一個 seed 應產生完全相同的數列，與執行環境無關（僅依賴整數位運算）。
 */

// 字串 seed → 32 位元整數（xmur3）
function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

// mulberry32
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {string|number} seed 隨機種子
 * @returns {{next:Function,int:Function,pick:Function,shuffle:Function,chance:Function}}
 */
function createRNG(seed) {
  const s = typeof seed === 'number' ? (seed >>> 0) : hashSeed(String(seed));
  const next = mulberry32(s);
  return {
    next,
    /** [min, max] 閉區間整數 */
    int(min, max) {
      if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
        throw new Error('[qbank] rng.int 參數錯誤：min=' + min + ', max=' + max);
      }
      return min + Math.floor(next() * (max - min + 1));
    },
    /** 回傳 0..1 機率事件是否成立 */
    chance(p) {
      return next() < p;
    },
    pick(arr) {
      if (!arr.length) throw new Error('[qbank] rng.pick 空陣列');
      return arr[Math.floor(next() * arr.length)];
    },
    /** Fisher-Yates，就地洗牌並回傳同一陣列 */
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const t = arr[i];
        arr[i] = arr[j];
        arr[j] = t;
      }
      return arr;
    },
  };
}

module.exports = { createRNG, hashSeed };

  });
  __def("math", function (require, module, exports) {
/**
 * qbank/math.js — 因數工具（純函式，無隨機）
 */

/** |n| 的正因數（由小到大），n 不可為 0 */
function divisors(n) {
  const m = Math.abs(n);
  if (!Number.isInteger(n) || m === 0) {
    throw new Error('[qbank] divisors 只接受非零整數，收到：' + n);
  }
  const small = [];
  const large = [];
  for (let d = 1; d * d <= m; d++) {
    if (m % d === 0) {
      small.push(d);
      if (d * d !== m) large.push(m / d);
    }
  }
  return small.concat(large.reverse());
}

/** |n| 的無序因數配對 [[a,b]]（a<=b, a*b=|n|），n 不可為 0 */
function unorderedFactorPairs(n) {
  const m = Math.abs(n);
  const out = [];
  for (let d = 1; d * d <= m; d++) {
    if (m % d === 0) out.push([d, m / d]);
  }
  return out;
}

function signOf(x) {
  return x > 0 ? '+' : (x < 0 ? '-' : '0');
}

module.exports = { divisors, unorderedFactorPairs, signOf };

  });
  __def("config", function (require, module, exports) {
/**
 * qbank/config.js — 難度與品質參數集中管理
 *
 * 之後若要對照原始題目圖片微調難度，只需修改此檔，
 * 產生器、驗證器、測試工具會自動沿用（seed 相同但參數不同 → 題庫不同，此為預期行為）。
 */

const VERSION = 'qbank-v1';

const TIERS = {
  // 一星：P 固定為 1；Q 絕對值 2～72
  1: {
    count: 20,
    P_SET: [1],
    P_NEG_PROB: 0, // P 恆為 +1
    Q_MIN: 2,
    Q_MAX: 72,
    R_CAP: 150, // |R| 安全上限（實際最大值約 73）
    Q_NEG_COUNT: 10, // 20 題中 Q 為負的題數（正負各半）
    R_NEG_MIN: 8, // R 正負目標各半（10/10），允許各差 2 題
    R_NEG_MAX: 12,
    RICH_MIN_COUNT: 0, // 一星不設多拆法配額
  },
  // 二星：|P| ∈ {2,3,4,5}；Q 絕對值 2～15；P 限定正整數（驗收決議，不再產生負數 P）
  2: {
    count: 20,
    P_SET: [2, 3, 4, 5],
    P_NEG_PROB: 0,
    Q_MIN: 2,
    Q_MAX: 15,
    R_CAP: 60,
    Q_NEG_COUNT: 10,
    R_NEG_MIN: 4,
    R_NEG_MAX: null, // 二星 R 只設下限
    RICH_MIN_COUNT: 0,
  },
  // 三星（A 方案，貼近原始圖片，不刻意放大數字）：
  // |P| ∈ {4,6,8,10,12,14,15,16}；Q 絕對值 3～35；P 限定正整數
  3: {
    count: 10,
    P_SET: [4, 6, 8, 10, 12, 14, 15, 16],
    P_NEG_PROB: 0,
    Q_MIN: 3,
    Q_MAX: 35,
    R_CAP: 90, // 三星 |R| 原則上控制在 90 以內（貼近原始圖片，不放大數字）
    Q_NEG_COUNT: 5,
    R_NEG_MIN: 2,
    R_NEG_MAX: null,
    RICH_MIN_COUNT: 7, // 三星至少 7 題 P 與 |Q| 各有 ≥2 組正整數因數配對（排除質數 Q）
  },
};

const DIFFICULTY = {
  // 難度分 = trials*W_TRIAL + signScore*W_SIGN + magBand + twoSided + struct
  // 其中 twoSided 反映「二星以上須同時拆解 P、Q 兩組因數」（一星 P=1 只需拆 Q），
  // struct 反映「兩側皆有多組拆法」的額外搜尋負擔；皆與數字大小無關。
  W_TRIAL: 1,
  W_SIGN: 2,
  TWO_SIDED_BONUS: 3, // |P|>1（P 側需要拆解）即得
  STRUCT_BONUS: 2, // |P|>1 且 P、Q 拆法數皆 ≥2 才得
  // |R| 量級分段（上限值）：<=5→0, <=12→1, <=25→2, 更大→3
  MAG_BANDS: [5, 12, 25],
  // 三星排除「全正且 R 過小」的過度簡單題（< 此值才排除）
  THREE_STAR_MIN_R: 5,
  // 因數結構相似度上限：同一簽名佔該星等比例不可超過此值
  MAX_SIGNATURE_SHARE: 0.4,
  // 各星等至少需要的相異簽名數
  MIN_DISTINCT_SIGNATURE: { 1: 6, 2: 6, 3: 4 },
};

const QUALITY = {
  MAX_QUESTION_ATTEMPTS: 500, // 單題重試上限（防無限迴圈）
  MAX_TIER_BUILDS: 30, // 單星等整組重建上限
};

module.exports = { VERSION, TIERS, DIFFICULTY, QUALITY };

  });
  __def("difficulty", function (require, module, exports) {
/**
 * qbank/difficulty.js — 難度資訊計算與星等篩選器
 *
 * 設計原則：不單純以 P 或 R 較大就判定三星。
 * 三星 = P 結構門檻（|P| 限複合數集合）＋ Q 範圍 ＋ 排除過度簡單
 *        ＋ 上限保護；難度分另由「配對組合數、符號複雜度、量級、
 *        兩組拆解、兩側多拆法」五個面向組成，每題皆附判定依據。
 */
const { unorderedFactorPairs, signOf } = require('./math');
const { DIFFICULTY } = require('./config');

/** 計算每題難度資訊（純函式） */
function metrics(q) {
  const fP = unorderedFactorPairs(q.P).length;
  const fQ = unorderedFactorPairs(q.Q).length;
  // 需嘗試的交叉配對數量估計：(P 拆法 × Q 拆法 × 斜向指派 2 種)
  const trials = fP * fQ * 2;
  const signScore = (q.P < 0 ? 1 : 0) + (q.Q < 0 ? 1 : 0) + (q.R < 0 ? 1 : 0);
  const mag = Math.abs(q.R);
  const bands = DIFFICULTY.MAG_BANDS;
  const magBand = mag <= bands[0] ? 0 : mag <= bands[1] ? 1 : mag <= bands[2] ? 2 : 3;
  const structBonus = (Math.abs(q.P) > 1 && fP >= 2 && fQ >= 2) ? DIFFICULTY.STRUCT_BONUS : 0;
  // 一星 P=1 只需拆 Q；二星以上 |P|>1，P、Q 兩組都要拆解，固定加分以反映此結構差異
  const twoSided = Math.abs(q.P) > 1 ? DIFFICULTY.TWO_SIDED_BONUS : 0;
  const oneReliance = Math.abs(q.P) === 1 || Math.min(Math.abs(q.A), Math.abs(q.C)) === 1
    || Math.min(Math.abs(q.B), Math.abs(q.D)) === 1;
  const score = trials * DIFFICULTY.W_TRIAL + signScore * DIFFICULTY.W_SIGN + magBand + twoSided + structBonus;

  const basis = [];
  basis.push('P拆法' + fP + '×Q拆法' + fQ + '×斜向指派2＝' + trials + '種交叉嘗試');
  basis.push('符號複雜度' + signScore + '(P' + signOf(q.P) + '/Q' + signOf(q.Q) + '/R' + signOf(q.R) + ')');
  basis.push('|R|=' + mag + '(量級' + magBand + ')');
  if (twoSided) basis.push('P、Q兩組皆需拆解(結構+' + DIFFICULTY.TWO_SIDED_BONUS + ')');
  else basis.push('僅需拆解Q組(P=1)');
  if (structBonus) basis.push('兩側皆有多組拆法(結構+' + DIFFICULTY.STRUCT_BONUS + ')');
  if (oneReliance) basis.push('含因數1');
  else basis.push('不依賴因數1');

  // 結構簽名：用於「因數結構過度相似」檢查（|P|相等是星等設計使然，故簽名聚焦 Q 結構＋符號）
  const signature = 'fQ' + fQ + ':' + signOf(q.Q) + signOf(q.R);

  return { fP, fQ, trials, signScore, magBand, twoSided, structBonus, oneReliance, score, basis, signature };
}

/**
 * 星等適配檢查（可調整的難度篩選器）
 * @returns {{ok:boolean, reasons:string[]}}
 */
function checkTierFit(q, tier, T) {
  const reasons = [];
  const fail = (msg) => reasons.push(msg);
  let ok = true;
  const no = (msg) => { ok = false; fail(msg); };

  if (q.R === 0) no('R=0（退化目標）');
  if (Math.abs(q.R) > T.R_CAP) no('|R|=' + Math.abs(q.R) + ' 超過上限 ' + T.R_CAP);

  if (tier === 1) {
    if (q.P !== 1) no('一星 P 須固定為 1，實為 ' + q.P);
    if (Math.abs(q.Q) < T.Q_MIN || Math.abs(q.Q) > T.Q_MAX) {
      no('一星 |Q| 須介於 ' + T.Q_MIN + '～' + T.Q_MAX + '，實為 ' + Math.abs(q.Q));
    }
    if (ok) fail('符合一星：P=1、|Q|∈[' + T.Q_MIN + ',' + T.Q_MAX + ']、|R|≤' + T.R_CAP);
  } else if (tier === 2) {
    if (q.P <= 0 || !T.P_SET.includes(q.P)) no('二星 P 須為正整數 ' + T.P_SET.join('/') + '，實為 ' + q.P);
    if (Math.abs(q.Q) < T.Q_MIN || Math.abs(q.Q) > T.Q_MAX) {
      no('二星 |Q| 須介於 ' + T.Q_MIN + '～' + T.Q_MAX + '，實為 ' + Math.abs(q.Q));
    }
    if (ok) fail('符合二星：|P|∈{' + T.P_SET.join(',') + '}、|Q|∈[' + T.Q_MIN + ',' + T.Q_MAX + ']');
  } else if (tier === 3) {
    if (q.P <= 0 || !T.P_SET.includes(q.P)) no('三星 P 須為正整數 ' + T.P_SET.join('/') + '，實為 ' + q.P);
    if (Math.abs(q.Q) < T.Q_MIN || Math.abs(q.Q) > T.Q_MAX) {
      no('三星 |Q| 須介於 ' + T.Q_MIN + '～' + T.Q_MAX + '，實為 ' + Math.abs(q.Q));
    }
    // 非尺寸型門檻：排除「全正且 R 過小」的過度簡單題
    if (q.Q > 0 && q.R > 0 && q.R < DIFFICULTY.THREE_STAR_MIN_R) {
      no('三星排除過度簡單題（全正且 R=' + q.R + ' < ' + DIFFICULTY.THREE_STAR_MIN_R + '）');
    }
    if (ok) fail('符合三星：|P|∈複合數集合、|Q|∈[' + T.Q_MIN + ',' + T.Q_MAX + ']、非全正小數字、|R|≤' + T.R_CAP);
  } else {
    no('未知星等：' + tier);
  }
  return { ok, reasons };
}

module.exports = { metrics, checkTierFit };

  });
  __def("validator", function (require, module, exports) {
/**
 * qbank/validator.js — 公式驗算與題庫品質檢查（純函式）
 * 判定公式與探索活動一致：P=A×C，Q=B×D，R=A×D+B×C。
 * 學生作答接受「任何」符合三公式的非零整數排列，不限於出題用解。
 */
const { checkTierFit } = require('./difficulty');
const { TIERS } = require('./config');

function isNonZeroInt(x) {
  return Number.isInteger(x) && x !== 0;
}

/** 驗算單題三公式 */
function verifyFormulas(P, Q, R, A, B, C, D) {
  const details = [
    { name: 'P=A×C', expect: P, actual: A * C, ok: A * C === P },
    { name: 'Q=B×D', expect: Q, actual: B * D, ok: B * D === Q },
    { name: 'R=A×D+B×C', expect: R, actual: A * D + B * C, ok: A * D + B * C === R },
  ];
  return { ok: details.every((d) => d.ok), details };
}

/** 學生答案是否可接受（任何符合公式的非零整數排列） */
function acceptsAnswer(P, Q, R, ans) {
  if (!ans || !isNonZeroInt(ans.A) || !isNonZeroInt(ans.B) || !isNonZeroInt(ans.C) || !isNonZeroInt(ans.D)) {
    return { ok: false, reason: '答案須為四個非零整數' };
  }
  const v = verifyFormulas(P, Q, R, ans.A, ans.B, ans.C, ans.D);
  return v.ok ? { ok: true } : { ok: false, reason: '不符合 P=A×C、Q=B×D、R=A×D+B×C' };
}

/** 整庫檢查 */
function validateBank(bank) {
  const errors = [];
  const tiers = { 1: 0, 2: 0, 3: 0 };
  const seen = new Set();
  bank.questions.forEach((q, i) => {
    const tag = '第' + (i + 1) + '題';
    tiers[q.tier] = (tiers[q.tier] || 0) + 1;
    if (![q.A, q.B, q.C, q.D].every(isNonZeroInt)) {
      errors.push(tag + '：A、B、C、D 須為非零整數');
    }
    const v = verifyFormulas(q.P, q.Q, q.R, q.A, q.B, q.C, q.D);
    if (!v.ok) errors.push(tag + '：參考答案未通過三公式驗算');
    const key = q.P + ',' + q.Q + ',' + q.R;
    if (seen.has(key)) errors.push(tag + '：(P,Q,R)=' + key + ' 與題庫內其他題重複');
    seen.add(key);
    const fit = checkTierFit(q, q.tier, TIERS[q.tier]);
    if (!fit.ok) errors.push(tag + '：星等不符（' + fit.reasons.join('；') + '）');
  });
  [1, 2, 3].forEach((t) => {
    if (tiers[t] !== TIERS[t].count) {
      errors.push('星等 ' + t + ' 題數為 ' + tiers[t] + '，應為 ' + TIERS[t].count);
    }
  });
  return { ok: errors.length === 0, errors };
}

module.exports = { isNonZeroInt, verifyFormulas, acceptsAnswer, validateBank };

  });
  __def("generator", function (require, module, exports) {
/**
 * qbank/generator.js — 50 題自動出題器（seed 可重現）
 *
 * 方法：先抽非零整數 (A,B,C,D) 再算出 (P,Q,R)，故每題先天至少有一組解；
 * 再以星等篩選器、重複檢查、符號分布、結構相似度層層把關。
 * 所有重試皆有上限，失敗時丟出明確錯誤，絕不無限迴圈。
 */
const { createRNG } = require('./rng');
const { divisors } = require('./math');
const { VERSION, TIERS, DIFFICULTY, QUALITY } = require('./config');
const { metrics, checkTierFit } = require('./difficulty');

/** 由乘積絕對值抽一組帶號因數 (x,y)，x*y = prod（prod 可正可負） */
function drawSignedPair(rng, mag, positive) {
  const ds = divisors(mag);
  const f = rng.pick(ds);
  let x0 = f;
  let y0 = mag / f;
  if (rng.chance(0.5)) { const t = x0; x0 = y0; y0 = t; }
  const sx = rng.chance(0.5) ? 1 : -1;
  const sy = positive ? sx : -sx;
  return [sx * x0, sy * y0];
}

/** 產生單題（不處理題庫級去重以外的邏輯） */
function genOne(rng, tier, forceQSign, usedKeys) {
  const T = TIERS[tier];
  for (let attempt = 1; attempt <= QUALITY.MAX_QUESTION_ATTEMPTS; attempt++) {
    const pMag = rng.pick(T.P_SET);
    const pPos = tier === 1 ? true : !rng.chance(T.P_NEG_PROB);
    const [A, C] = drawSignedPair(rng, pMag, pPos);
    const P = A * C;

    const qMag = rng.int(T.Q_MIN, T.Q_MAX);
    const qSign = forceQSign !== null && forceQSign !== undefined
      ? forceQSign
      : (rng.chance(0.5) ? 1 : -1);
    const [B, D] = drawSignedPair(rng, qMag, qSign > 0);
    const Q = B * D;
    const R = A * D + B * C;

    if (R === 0) continue;
    if (Math.abs(R) > T.R_CAP) continue;
    const q = { P, Q, R, A, B, C, D, tier };
    const fit = checkTierFit(q, tier, T);
    if (!fit.ok) continue;
    const key = P + ',' + Q + ',' + R;
    if (usedKeys.has(key)) continue;
    usedKeys.add(key);
    q.info = metrics(q);
    q.fitReasons = fit.reasons;
    return q;
  }
  throw new Error('[qbank] 星等' + tier + '單題產生失敗：已重試 '
    + QUALITY.MAX_QUESTION_ATTEMPTS + ' 次仍無符合條件者（請檢查參數是否過嚴）');
}

function signatureStats(questions) {
  const counts = {};
  questions.forEach((q) => {
    const s = q.info.signature;
    counts[s] = (counts[s] || 0) + 1;
  });
  const distinct = Object.keys(counts).length;
  const maxShare = Math.max.apply(null, Object.values(counts)) / questions.length;
  return { counts, distinct, maxShare };
}

/** 產生單一星等（正負分布＋結構相似度把關，整組重建有上限） */
function genTier(rng, tier, usedKeys) {
  const T = TIERS[tier];
  let lastError = null;
  for (let build = 1; build <= QUALITY.MAX_TIER_BUILDS; build++) {
    // 本輪先還原 usedKeys（整組重建不污染後續）
    const snapshot = new Set(usedKeys);
    try {
      const signs = [];
      for (let i = 0; i < T.count - T.Q_NEG_COUNT; i++) signs.push(1);
      for (let i = 0; i < T.Q_NEG_COUNT; i++) signs.push(-1);
      rng.shuffle(signs);
      const questions = [];
      for (let i = 0; i < T.count; i++) {
        questions.push(genOne(rng, tier, signs[i], usedKeys));
      }
      const negR = questions.filter((q) => q.R < 0).length;
      if (T.R_NEG_MIN != null && negR < T.R_NEG_MIN) {
        throw new Error('R為負僅 ' + negR + ' 題，未達下限 ' + T.R_NEG_MIN);
      }
      if (T.R_NEG_MAX != null && negR > T.R_NEG_MAX) {
        throw new Error('R為負達 ' + negR + ' 題，超過上限 ' + T.R_NEG_MAX);
      }
      if (T.RICH_MIN_COUNT) {
        const rich = questions.filter((q) => q.info.fP >= 2 && q.info.fQ >= 2).length;
        if (rich < T.RICH_MIN_COUNT) {
          throw new Error('P、|Q|皆有多組拆法僅 ' + rich + ' 題，未達下限 ' + T.RICH_MIN_COUNT);
        }
      }
      const stats = signatureStats(questions);
      const minD = DIFFICULTY.MIN_DISTINCT_SIGNATURE[tier];
      if (stats.distinct < minD) {
        throw new Error('相異結構簽名僅 ' + stats.distinct + ' 種，未達下限 ' + minD);
      }
      if (stats.maxShare > DIFFICULTY.MAX_SIGNATURE_SHARE) {
        throw new Error('單一結構簽名佔比 ' + stats.maxShare.toFixed(2) + ' 超過上限');
      }
      questions._sigStats = stats;
      return questions;
    } catch (e) {
      lastError = e;
      usedKeys.clear();
      snapshot.forEach((k) => usedKeys.add(k));
    }
  }
  throw new Error('[qbank] 星等' + tier + '整組產生失敗：已重建 '
    + QUALITY.MAX_TIER_BUILDS + ' 次（末次原因：' + (lastError && lastError.message) + '）');
}

/**
 * 產生完整 50 題題庫
 * @param {string|number} seed 隨機種子（相同 seed＋相同版本＋相同參數 → 完全相同的題庫與順序）
 */
function genBank(seed) {
  const rng = createRNG(seed);
  const usedKeys = new Set();
  const questions = [];
  [1, 2, 3].forEach((tier) => {
    const qs = genTier(rng, tier, usedKeys);
    delete qs._sigStats;
    questions.push.apply(questions, qs);
  });
  questions.forEach((q, i) => { q.qid = i + 1; });
  return {
    version: VERSION,
    seed: String(seed),
    params: {
      tiers: { 1: TIERS[1], 2: TIERS[2], 3: TIERS[3] },
      difficulty: DIFFICULTY,
    },
    questions,
  };
}

module.exports = { genBank, genTier, genOne, signatureStats };

  });
  global.QBank = {
    rng: __req("rng"), math: __req("math"), config: __req("config"),
    difficulty: __req("difficulty"), validator: __req("validator"),
    generator: __req("generator")
  };
})(typeof window !== "undefined" ? window : globalThis);
