/** challenge/js/config.js — 正式挑戰參數（單機版） */
export const CHALLENGE = {
  STAGES: [
    { tier: 1, count: 20, full: 2, half: 1, name: '一星', fullStars: '⭐' },
    { tier: 2, count: 20, full: 4, half: 2, name: '二星', fullStars: '⭐⭐' },
    { tier: 3, count: 10, full: 6, half: 3, name: '三星', fullStars: '⭐⭐⭐' },
  ],
  MAX_ATTEMPTS: 2,
  INPUT_MAXLEN: 7,
  INPUT_ABS_MAX: 1000000, // 單格允許的最大絕對值（超過視為無效輸入，不消耗次數）
  STORAGE_KEY: 'ccb1.challenge.v1',
  STORAGE_VERSION: 1,
  TEST_SEED: 'challenge-test-1',
  CONCEPT_HINT: '請先確認左右兩組直行相乘是否符合上方目標，再檢查兩條交叉相乘的結果相加是否符合下方目標。',
};

export const STATUS = {
  UNATTEMPTED: 'unattempted',
  IN_PROGRESS: 'in_progress',
  FIRST_CORRECT: 'first_correct',
  SECOND_CORRECT: 'second_correct',
  BOTH_WRONG: 'both_wrong',
  INTERRUPTED: 'interrupted', // 預留：未來教師結束房間時的中斷標記（本批不主動產生）
};

export function stageOfGlobalIndex(idx) {
  // idx: 0-based global (0..49) → {stageIdx, posInStage}
  let base = 0;
  for (let s = 0; s < CHALLENGE.STAGES.length; s++) {
    if (idx < base + CHALLENGE.STAGES[s].count) return { stageIdx: s, pos: idx - base };
    base += CHALLENGE.STAGES[s].count;
  }
  return null;
}

export function stageStartIndex(stageIdx) {
  let base = 0;
  for (let s = 0; s < stageIdx; s++) base += CHALLENGE.STAGES[s].count;
  return base;
}
