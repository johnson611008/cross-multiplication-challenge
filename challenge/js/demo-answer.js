/** challenge/js/demo-answer.js — 兩次答錯後的示範答案（純函式，可單元測試）
 *
 * 教學偏好（只影響示範，不影響判定）：
 * - P 為正數時，優先 A、C 皆為正數的正確排列（尤其 P=1 用 A=1、C=1）；
 * - B、D 依 Q、R 條件搭配；多組時取「最大絕對值→總和→字典序」最小（直觀易懂）；
 * - 找不到偏好排列時，回退為出題器參考解；回傳前一律重驗公式，絕不產生錯誤示範。
 */
function orderedPosPairs(m) {
  // m>0 的有序正因數配對 [[a,c]]（a*c=m）
  const out = [];
  for (let d = 1; d * d <= m; d++) {
    if (m % d !== 0) continue;
    out.push([d, m / d]);
    if (d * d !== m) out.push([m / d, d]);
  }
  return out;
}

function verify(P, Q, R, s) {
  return s.A * s.C === P && s.B * s.D === Q && s.A * s.D + s.B * s.C === R;
}

function rankKey(s) {
  const m = Math.max(Math.abs(s.A), Math.abs(s.B), Math.abs(s.C), Math.abs(s.D));
  const sum = Math.abs(s.A) + Math.abs(s.B) + Math.abs(s.C) + Math.abs(s.D);
  return [m, sum, s.A, s.B, s.C, s.D];
}

function lessKey(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}

/**
 * @param {number} P,Q,R 目標數字
 * @param {{A,B,C,D}} fallback 出題器參考解（非零整數）
 * @returns {{A,B,C,D}} 保證符合三公式的示範答案
 */
export function preferredDemo(P, Q, R, fallback) {
  const fb = { A: fallback.A, B: fallback.B, C: fallback.C, D: fallback.D };
  if (P > 0 && Number.isSafeInteger(P) && Number.isSafeInteger(Q)
    && Math.abs(P) <= 1000000 && Math.abs(Q) <= 1000000 && Q !== 0) {
    let best = null;
    let bestKey = null;
    for (const pair of orderedPosPairs(P)) {
      const a = pair[0]; const c = pair[1];
      for (const qd of orderedPosPairs(Math.abs(Q))) {
        const x = qd[0]; const y = qd[1];
        const candidates = [
          [x, y], [y, x],
          [-x, -y], [-y, -x],
          [x, -y], [-x, y],
          [y, -x], [-y, x],
        ];
        for (const bd of candidates) {
          const s = { A: a, B: bd[0], C: c, D: bd[1] };
          if (!verify(P, Q, R, s)) continue;
          const k = rankKey(s);
          if (!best || lessKey(k, bestKey)) { best = s; bestKey = k; }
        }
      }
    }
    if (best) return best;
  }
  return fb;
}
