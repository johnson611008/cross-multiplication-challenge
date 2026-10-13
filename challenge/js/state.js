/** challenge/js/state.js — 作答紀錄、狀態機、計分（分數由狀態衍生，杜絕重複加分） */
import { CHALLENGE, STATUS } from './config.js';

export function createRecord(q) {
  return {
    qid: q.qid,
    tier: q.tier,
    P: q.P, Q: q.Q, R: q.R,
    ref: { A: q.ref.A, B: q.ref.B, C: q.ref.C, D: q.ref.D },
    attempts: [], // {input:{A,B,C,D}, correct, at}
    status: STATUS.UNATTEMPTED,
    score: 0,
    startedAt: null,
    completedAt: null,
    revealed: false, // 是否已展示參考答案（both_wrong）
    draft: { A: '', B: '', C: '', D: '' }, // 作答中四格輸入（供重新整理恢復）
  };
}

export function isFinished(rec) {
  return rec.status === STATUS.FIRST_CORRECT
    || rec.status === STATUS.SECOND_CORRECT
    || rec.status === STATUS.BOTH_WRONG;
}

export function scoreFor(tier, correctOnAttempt) {
  const st = CHALLENGE.STAGES.find((s) => s.tier === tier);
  if (!st) return 0;
  return correctOnAttempt === 1 ? st.full : st.half;
}

/**
 * 提交一次「有效」作答（呼叫前須先 parse 成功）。
 * 已完成題目直接忽略（locked），不重複計分。
 */
export function submitAttempt(rec, tier, values, correct, now) {
  if (isFinished(rec)) return { ignored: true, reason: 'locked' };
  const attemptNo = rec.attempts.length + 1;
  rec.attempts.push({ input: { ...values }, correct, at: now });
  if (rec.startedAt === null) rec.startedAt = now;
  if (correct) {
    rec.status = attemptNo === 1 ? STATUS.FIRST_CORRECT : STATUS.SECOND_CORRECT;
    rec.score = scoreFor(tier, attemptNo);
    rec.completedAt = now;
  } else if (attemptNo >= CHALLENGE.MAX_ATTEMPTS) {
    rec.status = STATUS.BOTH_WRONG;
    rec.score = 0;
    rec.completedAt = now;
    rec.revealed = true;
  } else {
    rec.status = STATUS.IN_PROGRESS;
  }
  return { ignored: false, status: rec.status, score: rec.score };
}

/** 預留：未來教師結束房間時，將作答中題目標記為中斷（本批不主動呼叫） */
export function markInterrupted(rec) {
  if (rec.status === STATUS.IN_PROGRESS || rec.status === STATUS.UNATTEMPTED) {
    rec.status = STATUS.INTERRUPTED;
    return true;
  }
  return false;
}

export function stageStats(records) {
  const s = { first: 0, second: 0, wrong: 0, score: 0, total: records.length };
  records.forEach((r) => {
    if (r.status === STATUS.FIRST_CORRECT) { s.first++; s.score += r.score; }
    else if (r.status === STATUS.SECOND_CORRECT) { s.second++; s.score += r.score; }
    else if (r.status === STATUS.BOTH_WRONG) { s.wrong++; }
  });
  s.answered = s.first + s.second;
  return s;
}

export function totalStats(allRecords) {
  const s = stageStats(allRecords);
  s.totalCorrect = s.first + s.second;
  return s;
}
