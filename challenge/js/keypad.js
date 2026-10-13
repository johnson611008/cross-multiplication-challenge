/** challenge/js/keypad.js — 虛擬鍵盤純邏輯（字串層級，可單元測試）
 *
 * 草稿一律使用 ASCII '-' 作為負號（與驗證器正則 /^[-+]?\d+$/ 一致），
 * 顯示與內部同一格式，不存在全形／特殊符號造成判定失敗的問題。
 */
export const KEY_MAXLEN = 7; // 含負號最多字元（與 input maxlength 一致）

/** 拆解：{sign: ''|'-', digits: '235'|''} */
export function splitValue(s) {
  const str = s === null || s === undefined ? '' : String(s);
  if (str.startsWith('-')) return { sign: '-', digits: str.slice(1) };
  if (str.startsWith('+')) return { sign: '', digits: str.slice(1) };
  return { sign: '', digits: str };
}

function joinValue(sign, digits) {
  if (!digits) return sign === '-' ? '-' : '';
  if (/^0+$/.test(digits)) return '0'; // 全零不帶負號，避免產生 −0
  return sign + digits;
}

/** 按數字鍵（0-9）：接到目前格，去除不必要的前導零 */
export function pressDigit(current, d) {
  if (!/^[0-9]$/.test(d)) return String(current || '');
  const { sign, digits } = splitValue(current);
  let next = digits === '0' ? d : digits + d;
  if (next === '') next = d;
  const out = joinValue(sign, next);
  return out.length > KEY_MAXLEN ? joinValue(sign, digits) : out;
}

/** 按＋／−：切換正負號；空字串→'-'（先切換再輸入數字） */
export function pressSign(current) {
  const { sign, digits } = splitValue(current);
  if (sign === '-') return digits; // −5 → 5；- → ''
  return joinValue('-', digits); // 5 → −5；'' → '-'
}

/** 按 ←（退格）：刪除最後一位；剩單獨負號時清空 */
export function pressBack(current) {
  const { sign, digits } = splitValue(current);
  if (!digits) return '';
  return joinValue(sign, digits.slice(0, -1));
}

/** 按清除：只清空目前格 */
export function pressClear() {
  return '';
}
