/** challenge/js/verify.js — 輸入解析＋作答驗證（沿用 qbank 數學判定） */
import { CHALLENGE } from './config.js';

function fail(reason) {
  return { ok: false, reason };
}

/**
 * 解析單格輸入。重點處理：
 * - 空字串／純空白 → 未填完整（避開 Number('')===0 陷阱，不用 Number 先轉）
 * - 小數、非法字元、16 進位、科學記號 → 非整數（只接受 [-+]?數字）
 * - 0 → 非零整數限制；超過安全範圍 → 無效
 */
export function parseSlot(raw) {
  if (raw === null || raw === undefined) return fail('四格都要填寫數字');
  const s = String(raw).trim();
  if (s === '') return fail('四格都要填寫數字，不可空白');
  if (!/^[-+]?\d+$/.test(s)) return fail('請輸入整數（不可有小數、空白或數字正負號以外的字元）');
  const n = Number(s);
  if (!Number.isSafeInteger(n)) return fail('數字超出可處理的安全整數範圍');
  if (n === 0) return fail('四格都必須是非零整數（不可填 0）');
  if (Math.abs(n) > CHALLENGE.INPUT_ABS_MAX) {
    return fail('數字超出允許範圍（|數字| ≤ ' + CHALLENGE.INPUT_ABS_MAX + '）');
  }
  return { ok: true, value: n };
}

export function parseAnswer(raw) {
  const keys = ['A', 'B', 'C', 'D'];
  const values = {};
  for (const k of keys) {
    const r = parseSlot(raw[k]);
    if (!r.ok) return { ok: false, reason: k + '格：' + r.reason };
    values[k] = r.value;
  }
  return { ok: true, values };
}

/** 以 qbank 判定：任何符合三公式的非零整數排列皆算對（不限參考解）。
 *  validator 可注入（Node 測試用）；瀏覽器預設取 window.QBank.validator */
export function checkAnswer(question, values, validator) {
  const v = validator
    || (typeof window !== 'undefined' && window.QBank ? window.QBank.validator : null);
  if (!v) throw new Error('[verify] 缺少驗證器（需 qbank validator）');
  const r = v.acceptsAnswer(question.P, question.Q, question.R, values);
  return { correct: r.ok, reason: r.reason || null };
}
