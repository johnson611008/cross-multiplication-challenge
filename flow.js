/** challenge/js/flow.js — 挑戰流程控制（題目導航、驗證、結算、計時啟停） */
import { CHALLENGE, STATUS, stageOfGlobalIndex, stageStartIndex } from './config.js';
import { buildBank, freshSeed, checkBankShape } from './bank-loader.js';
import { parseAnswer, checkAnswer } from './verify.js';
import { createRecord, isFinished, submitAttempt, stageStats, totalStats } from './state.js';
import { createTimer, formatElapsed } from './timer.js';
import { pressDigit, pressSign, pressBack, pressClear } from './keypad.js';
import * as ui from './ui.js';

const NEXT_LABEL = ['開始二星挑戰', '開始三星挑戰', '查看最終成績'];

export function createApp(opts) {
  const { mode, store, clock } = opts;
  const isTest = mode === 'test';
  const now = clock || (() => Date.now());

  let S = null; // snapshot: {version, mode, seed, bank, idx, records, screen, totalScore, timer, done, createdAt}
  let timer = null;
  let submitting = false;
  let tickId = null;
  let selectedKey = 'A'; // 虛擬鍵盤目前選取的格子（純 UI 狀態，答案仍只有 draft 一份）
  let noPersistOnHide = false; // 重置流程用：避免 unload 時把已清除的進度又寫回去

  function persist() {
    S.timer = timer.toJSON();
    S.totalScore = computeTotal();
    store.save(S);
  }

  function computeTotal() {
    return Object.values(S.records).reduce((a, r) => a + (r.score || 0), 0);
  }

  function questionAt(idx) {
    return S.bank[idx];
  }

  function recordFor(q) {
    if (!S.records[q.qid]) S.records[q.qid] = createRecord(q);
    return S.records[q.qid];
  }

  function freshSnapshot(seed, bank) {
    return {
      version: CHALLENGE.STORAGE_VERSION,
      mode,
      seed,
      bank,
      idx: 0,
      records: {},
      screen: { name: 'intro' },
      totalScore: 0,
      timer: null,
      done: false,
      createdAt: now(),
      keypadHintSeen: false, // 首次使用鍵盤／輸入區提示是否已看過（看過後不再顯示）
    };
  }

  /* ---------- 畫面 ---------- */
  function stopTick() {
    if (tickId !== null) { clearInterval(tickId); tickId = null; }
  }

  function startTick() {
    stopTick();
    tickId = setInterval(() => {
      if (S && S.screen.name === 'question' && timer.isRunning()) {
        ui.updateHud({ timerText: formatElapsed(timer.elapsedMs()) });
      }
    }, 1000);
  }

  function showIntro(notice) {
    stopTick();
    S.screen = { name: 'intro' };
    persist();
    ui.renderIntro(mode, { onStart: startNew, onReset: resetAll }, notice || null);
  }

  function startNew() {
    // seed 先決定再產生題庫，之後整場固定（重整不重抽）
    const seed = isTest ? CHALLENGE.TEST_SEED : freshSeed(false);
    let bank;
    try {
      bank = buildBank(seed);
    } catch (e) {
      showIntro('題庫產生失敗：' + e.message);
      return;
    }
    const shape = checkBankShape(bank);
    if (!shape.ok) {
      showIntro('題庫結構異常：' + shape.reason);
      return;
    }
    S = freshSnapshot(seed, bank);
    timer = createTimer(null, clock);
    timer.start();
    S.timer = timer.toJSON();
    S.screen = { name: 'question' };
    persist();
    renderQuestion();
  }

  function currentVM() {
    const q = questionAt(S.idx);
    const rec = recordFor(q);
    const pos = stageOfGlobalIndex(S.idx);
    const st = CHALLENGE.STAGES[pos.stageIdx];
    const fb = feedbackFor(rec);
    return {
      isTest,
      stars: st.fullStars,
      tierName: st.name,
      globalNo: S.idx + 1,
      stagePos: pos.pos + 1,
      stageCount: st.count,
      score: computeTotal(),
      attemptsUsed: rec.attempts.length,
      maxAttempts: CHALLENGE.MAX_ATTEMPTS,
      P: q.P, Q: q.Q, R: q.R,
      draft: rec.draft,
      timerText: formatElapsed(timer.elapsedMs()),
      feedback: fb,
      locked: isFinished(rec),
      showNext: isFinished(rec),
      revealHtml: rec.revealed ? ui.revealReference(q) : null,
      keyHint: S.keypadHintSeen !== true,
    };
  }

  function feedbackFor(rec) {
    if (rec.status === STATUS.FIRST_CORRECT || rec.status === STATUS.SECOND_CORRECT) {
      const pts = rec.score;
      return { kind: 'good', html: '⭐ 答對了！本題得 ' + pts + ' 分。' };
    }
    if (rec.status === STATUS.IN_PROGRESS && rec.attempts.length === 1 && !rec.attempts[0].correct) {
      return { kind: 'hint', html: '第 1 次未通過（1／2）。' + escHtml(CHALLENGE.CONCEPT_HINT) + '已保留你的輸入，修改後可再驗證一次。' };
    }
    if (rec.status === STATUS.BOTH_WRONG) {
      return { kind: 'bad', html: '兩次都未通過，本題 0 分。正確排列已展示在下方。' };
    }
    return null;
  }

  function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderQuestion() {
    S.screen = { name: 'question' };
    persist();
    startTick();
    selectedKey = 'A';
    const vm = currentVM();
    vm.selected = selectedKey;
    ui.renderQuestion(vm, {      onInput: (k, v) => setDraft(k, v),
      onSelect: (k) => { selectedKey = k; ui.selectCell(k); },
      onKey: applyKey,
      onEnter: onVerify,
      onVerify: onVerify,
      onNext: onNext,
    });
  }

  /** 草稿唯一寫入點（實體鍵盤與虛擬鍵盤共用同一份 draft） */
  function setDraft(k, v) {
    const rec = recordFor(questionAt(S.idx));
    if (isFinished(rec)) return;
    if (rec.status === STATUS.UNATTEMPTED) rec.status = STATUS.IN_PROGRESS;
    if (rec.startedAt === null) rec.startedAt = now();
    rec.draft[k] = v;
    if (S.keypadHintSeen !== true) {
      // 第一次使用輸入區：關閉簡短提示並記住（含重整後）
      S.keypadHintSeen = true;
      const hint = document.getElementById('cb-keyhint');
      if (hint) hint.classList.add('cb-hidden');
    }
    schedulePersist();
  }

  /** 虛擬鍵盤操作：直接改寫既有 draft，不另建答案狀態 */
  function applyKey(key) {
    const rec = recordFor(questionAt(S.idx));
    if (isFinished(rec)) return;
    const cur = rec.draft[selectedKey] || '';
    let next = cur;
    if (key === 'sign') next = pressSign(cur);
    else if (key === 'back') next = pressBack(cur);
    else if (key === 'clear') next = pressClear();
    else next = pressDigit(cur, key);
    const input = document.getElementById('cb-in-' + selectedKey);
    if (input) input.value = next;
    setDraft(selectedKey, next);
  }

  let persistTimer = null;
  function schedulePersist() {
    if (persistTimer !== null) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => { persistTimer = null; persist(); }, 400);
  }

  function onVerify() {
    if (submitting) return; // 連續點擊保護
    const q = questionAt(S.idx);
    const rec = recordFor(q);
    if (isFinished(rec)) return; // 鎖定後忽略
    submitting = true;
    try {
      const parsed = parseAnswer(ui.readInputs());
      if (!parsed.ok) {
        ui.setFeedback('warn', '⚠️ 輸入有誤（不消耗次數）：' + escHtml(parsed.reason));
        return;
      }
      const chk = checkAnswer(q, parsed.values);
      const res = submitAttempt(rec, q.tier, parsed.values, chk.correct, now());
      if (res.ignored) return;
      persist();
      ui.updateHud({ score: computeTotal(), attempts: rec.attempts.length });
      if (chk.correct) {
        ui.setFeedback('good', '⭐ 答對了！本題得 ' + rec.score + ' 分。');
        ui.lockInputs(true);
        ui.lockKeypad(true);
        ui.showNext(true);
      } else if (rec.status === STATUS.BOTH_WRONG) {
        ui.setFeedback('bad', '兩次都未通過，本題 0 分。正確排列已展示在下方。');
        ui.lockInputs(true);
        ui.lockKeypad(true);
        document.getElementById('cb-reveal').innerHTML = ui.revealReference(q);
        ui.showNext(true);
      } else {
        ui.setFeedback('hint', '第 1 次未通過（1／2）。' + escHtml(CHALLENGE.CONCEPT_HINT) + '已保留你的輸入，修改後可再驗證一次。');
      }
    } finally {
      submitting = false;
    }
  }

  function onNext() {
    const rec = recordFor(questionAt(S.idx));
    if (!isFinished(rec)) return;
    S.idx += 1;
    if (S.idx >= S.bank.length) {
      timer.pause();
      S.done = true;
      S.screen = { name: 'final' };
      persist();
      renderFinal();
      return;
    }
    const prevPos = stageOfGlobalIndex(S.idx - 1);
    const curPos = stageOfGlobalIndex(S.idx);
    if (curPos.stageIdx !== prevPos.stageIdx) {
      // 階段交界：暫停計時，顯示結算
      timer.pause();
      S.screen = { name: 'settle', stageIdx: prevPos.stageIdx };
      persist();
      renderSettle(prevPos.stageIdx);
      return;
    }
    persist();
    renderQuestion();
  }

  function stageRecords(stageIdx) {
    const start = stageStartIndex(stageIdx);
    const out = [];
    for (let i = 0; i < CHALLENGE.STAGES[stageIdx].count; i++) {
      const q = S.bank[start + i];
      out.push(recordFor(q));
    }
    return out;
  }

  function renderSettle(stageIdx) {
    stopTick();
    const st = CHALLENGE.STAGES[stageIdx];
    const stats = stageStats(stageRecords(stageIdx));
    const maxScore = st.count * st.full;
    ui.renderSettle(st.name, st.fullStars, stats, maxScore, NEXT_LABEL[stageIdx], () => {
      if (stageIdx >= CHALLENGE.STAGES.length - 1) {
        timer.pause();
        S.done = true;
        S.screen = { name: 'final' };
        persist();
        renderFinal();
        return;
      }
      // 下一階段開始後才恢復計時
      timer.resume();
      S.screen = { name: 'question' };
      persist();
      renderQuestion();
    });
  }

  function renderFinal() {
    stopTick();
    const per = CHALLENGE.STAGES.map((st, i) => stageStats(stageRecords(i)));
    const t = totalStats(Object.values(S.records));
    ui.renderFinal({
      isTest,
      s1: per[0].score, s2: per[1].score, s3: per[2].score,
      total: computeTotal(),
      first: t.first, second: t.second, wrong: t.wrong,
      answered: t.totalCorrect,
      elapsedText: formatElapsed(timer.elapsedMs()),
    }, { onReset: resetAll });
  }

  function resetAll() {
    stopTick();
    noPersistOnHide = true;
    store.clear();
    window.location.reload();
  }

  /* ---------- 啟動 ---------- */
  // 舊版 v1（50 題）儲存鍵：新版不載入，僅提示後移除（只動自家命名空間，不碰其他資料）
  const LEGACY_KEYS = ['ccb1.challenge.v1'];

  function boot() {
    let saved = null;
    // 跳轉／重整前強制寫入，草稿防抖等待中也不遺失
    window.addEventListener('pagehide', () => { try { if (S && !noPersistOnHide) persist(); } catch (e) { /* 忽略 */ } });
    let legacyFound = false;
    try {
      if (typeof localStorage !== 'undefined') {
        for (const k of LEGACY_KEYS) {
          if (localStorage.getItem(k) !== null) {
            legacyFound = true;
            localStorage.removeItem(k);
          }
        }
      }
    } catch (e) { /* 忽略 */ }
    try {
      saved = store.load();
    } catch (e) {
      saved = null;
    }
    if (saved && saved.version === CHALLENGE.STORAGE_VERSION && saved.bank
      && checkBankShape(saved.bank).ok && typeof saved.idx === 'number') {
      S = saved;
      if (!S.records) S.records = {};
      timer = createTimer(saved.timer, clock);
      resumeScreen();
      return { resumed: true };
    }
    S = freshSnapshot(null, []);
    S.bank = [];
    timer = createTimer(null, clock);
    if (legacyFound) {
      showIntro('偵測到舊版 50 題進度，新版 25 題挑戰將重新開始（舊進度不沿用）。');
    } else {
      showIntro();
    }
    return { resumed: false };
  }

  function resumeScreen() {
    const sc = S.screen || { name: 'intro' };
    if (S.done || sc.name === 'final') {
      S.done = true;
      S.screen = { name: 'final' };
      persist();
      renderFinal();
    } else if (sc.name === 'settle') {
      renderSettle(sc.stageIdx || 0);
    } else if (sc.name === 'question' && S.idx < S.bank.length) {
      renderQuestion();
    } else {
      showIntro();
    }
  }

  // 測試鉤子（正式模式不暴露）：走真實 DOM 與真實處理器，僅省去人工輸入
  function testAPI() {
    function fill(values) {
      ['A', 'B', 'C', 'D'].forEach((k) => {
        const el = document.getElementById('cb-in-' + k);
        if (el && !el.disabled) {
          el.value = values[k];
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
    }
    function clickVerify() {
      const b = document.getElementById('cb-verify');
      if (b) b.click();
    }
    function clickNext() {
      const b = document.getElementById('cb-next');
      if (b && !b.classList.contains('cb-hidden')) b.click();
    }
    function wrongOf(q) {
      // 保證不符合公式的有效整數（參考解 A+1，若恰好成立則再加）
      const cand = { A: q.ref.A + 1, B: q.ref.B, C: q.ref.C, D: q.ref.D };
      if (cand.A === 0) cand.A = 2;
      return cand;
    }
    return {
      snapshot() {
        const q = S.bank[S.idx];
        const rec = q ? S.records[q.qid] : null;
        return {
          mode, seed: S.seed, idx: S.idx,
          bankKey: q ? q.P + ',' + q.Q + ',' + q.R : null,
          tier: q ? q.tier : null,
          status: rec ? rec.status : null,
          attempts: rec ? rec.attempts.length : 0,
          score: computeTotal(),
          running: timer.isRunning(),
          elapsedMs: timer.elapsedMs(),
          screen: S.screen.name,
          draft: rec ? { ...rec.draft } : null,
          revealed: rec ? !!rec.revealed : false,
        };
      },
      /** 以參考解作答並按下一題（how: 'ref' 直接答對 / 'alt' 取反排列答對） */
      solveCurrent(how) {
        const q = questionAt(S.idx);
        if (!q) return 'no-question';
        const v = how === 'alt'
          ? { A: -q.ref.A, B: -q.ref.B, C: -q.ref.C, D: -q.ref.D }
          : { ...q.ref };
        fill(v);
        clickVerify();
        clickNext();
        return 'ok';
      },
      /** 送一次保證錯誤的有效答案（不按下一題） */
      submitWrong() {
        const q = questionAt(S.idx);
        fill(wrongOf(q));
        clickVerify();
        return 'ok';
      },
    };
  }

  return { boot, onVerify, onNext, startNew, resetAll, testAPI, _get: () => ({ S, timer }) };
}
