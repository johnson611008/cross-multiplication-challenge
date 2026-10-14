/** challenge/js/ui.js — 畫面呈現（深藍系，沿用探索活動視覺語言） */
import { formatElapsed } from './timer.js';

let root = null;

export function mount(el) {
  root = el;
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function stars(tier) {
  return tier === 1 ? '⭐' : tier === 2 ? '⭐⭐' : '⭐⭐⭐';
}

/* ---------- 說明頁 ---------- */
export function renderIntro(mode, handlers, notice) {
  const isTest = mode === 'test';
  root.innerHTML =
    '<section class="cb-panel cb-narrow" data-screen="intro">'
    + (isTest ? '<div class="cb-testbadge">測試模式（不影響正式流程）</div>' : '')
    + '<div class="cb-title">正式挑戰即將開始</div>'
    + (notice ? '<div class="cb-feedback cb-fb-bad">' + esc(notice) + '</div>' : '')
    + '<p class="cb-sub">完成 10 題探索活動的你，已經掌握十字交乘的數字規律。接下來是三階段正式挑戰：</p>'
    + '<ul class="cb-rules">'
    + '<li>⭐ 一星：第 1～10 題（第一次答對 2 分，第二次 1 分）</li>'
    + '<li>⭐⭐ 二星：第 11～20 題（第一次答對 4 分，第二次 2 分）</li>'
    + '<li>⭐⭐⭐ 三星：第 21～25 題（第一次答對 6 分，第二次 3 分）</li>'
    + '<li>每題最多提交 2 次；總滿分 90 分</li>'
    + '<li>四格都必須填寫非零整數；格式錯誤不消耗次數</li>'
    + '</ul>'
    + '<button class="cb-btn" id="cb-start">' + (isTest ? '開始測試挑戰' : '開始正式挑戰') + '</button>'
    + (isTest ? '<button class="cb-btn cb-btn-ghost" id="cb-reset">測試用重置（清除本機挑戰紀錄）</button>'
      + '<p class="cb-note">測試入口：可不經探索活動直接開始；正式銜接請由探索完成畫面的「前往正式挑戰」進入。</p>' : '')
    + '</section>';
  document.getElementById('cb-start').addEventListener('click', handlers.onStart);
  if (isTest && handlers.onReset) {
    document.getElementById('cb-reset').addEventListener('click', handlers.onReset);
  }
}

/* ---------- 題目頁 ---------- */
export function renderQuestion(vm, handlers) {
  root.innerHTML =
    '<section class="cb-panel" data-screen="question">'
    + (vm.isTest ? '<div class="cb-testbadge">測試模式</div>' : '')
    + '<div class="cb-hud">'
    + '<span class="cb-pill">' + esc(vm.stars) + ' ' + esc(vm.tierName) + '</span>'
    + '<span>第 ' + vm.globalNo + '／25 題</span>'
    + '<span>' + esc(vm.tierName) + '第 ' + vm.stagePos + '／' + vm.stageCount + ' 題</span>'
    + '<span>總分 <b id="cb-score">' + vm.score + '</b></span>'
    + '<span>⏱ <span id="cb-timer">' + esc(vm.timerText) + '</span></span>'
    + '</div>'
    + '<div class="cb-keyhelp-top" id="cb-keyhelp">'
    + '<span class="cb-keyhelp-title">【數字鍵盤使用說明】</span>'
    + '<span>先點選要填入的格子，再使用數字鍵盤輸入。</span>'
    + '<span><b>−</b>：按一下加上負號，再按一下取消負號。</span>'
    + '<span><b>←</b>：刪除最後一位數字。</span>'
    + '<span><b>清除本格</b>：清空目前選取格子的內容。</span>'
    + '<span class="cb-keyhelp-tip">小提醒：正數直接輸入數字，不需要加上正號。</span>'
    + '</div>'
    + '<div class="cb-mainrow">'
    + '<div class="cb-leftcol">'
    + '<div class="cb-targets">'
    + '<div class="cb-target"><span class="cb-tlabel">左上目標 P</span><span class="cb-tval cb-sky" id="cb-P">' + vm.P + '</span></div>'
    + '<div class="cb-target"><span class="cb-tlabel">右上目標 Q</span><span class="cb-tval cb-indigo" id="cb-Q">' + vm.Q + '</span></div>'
    + '</div>'
    + '<div class="cb-crosswrap">'
    + '<svg class="cb-x" viewBox="0 0 200 200" aria-hidden="true">'
    + '<line x1="45" y1="45" x2="155" y2="155"/><line x1="155" y1="45" x2="45" y2="155"/>'
    + '</svg>'
    + '<div class="cb-grid">'
    + ['A', 'B', 'C', 'D'].map((k, i) => {
      const pos = ['左上', '右上', '左下', '右下'][i];
      return '<label class="cb-cell" data-cell="' + k + '"><span class="cb-pos">' + k + '・' + pos + '</span>'
        + '<input id="cb-in-' + k + '" inputmode="none" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" maxlength="7" placeholder="?" value="' + esc(vm.draft[k] || '') + '" aria-label="作答格 ' + k + '（請用遊戲內建數字鍵盤輸入）">'
        + '</label>';
    }).join('')
    + '</div>'
    + '</div>'
    + '<div class="cb-target cb-target-bottom"><span class="cb-tlabel">下方目標 R</span><span class="cb-tval cb-green" id="cb-R">' + vm.R + '</span></div>'
    + '</div>'
    + '<div class="cb-keypad" id="cb-keypad" role="group" aria-label="遊戲內建數字鍵盤">'
    + '<div class="cb-keys">'
    + ['7', '8', '9', '4', '5', '6', '1', '2', '3'].map((d) => '<button type="button" class="cb-key" data-key="' + d + '">' + d + '</button>').join('')
    + '<button type="button" class="cb-key cb-key-fn" data-key="sign" aria-label="正負號切換">−</button>'
    + '<button type="button" class="cb-key" data-key="0">0</button>'
    + '<button type="button" class="cb-key cb-key-fn" data-key="back" aria-label="刪除最後一位">←</button>'
    + '</div>'
    + '<button type="button" class="cb-key cb-clear" data-key="clear">清除本格</button>'
    + '</div>'
    + '</div>'
    + '<div class="cb-keyhint' + (vm.keyHint ? '' : ' cb-hidden') + '" id="cb-keyhint">點選要填入的格子，再使用數字鍵盤輸入；需要負數時，按 −。</div>'
    + '<div class="cb-attempts">已提交 <span id="cb-attempts">' + vm.attemptsUsed + '</span>／' + vm.maxAttempts + ' 次</div>'
    + '<div class="cb-feedback" id="cb-feedback" role="status"></div>'
    + '<div id="cb-reveal"></div>'
    + '<button class="cb-btn" id="cb-verify">' + esc(vm.verifyLabel || '驗證答案') + '</button>'
    + '<button class="cb-btn cb-btn-green cb-hidden" id="cb-next">下一題</button>'
    + '</section>';
  ['A', 'B', 'C', 'D'].forEach((k) => {
    const input = document.getElementById('cb-in-' + k);
    input.addEventListener('input', (e) => handlers.onInput(k, e.target.value));
    input.addEventListener('focus', () => handlers.onSelect(k));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && handlers.onEnter) handlers.onEnter();
    });
    const cell = document.querySelector('.cb-cell[data-cell="' + k + '"]');
    if (cell) cell.addEventListener('pointerdown', () => handlers.onSelect(k));
  });
  document.getElementById('cb-keypad').addEventListener('click', (e) => {
    const b = e.target.closest ? e.target.closest('[data-key]') : null;
    if (b && handlers.onKey) handlers.onKey(b.getAttribute('data-key'));
  });
  document.getElementById('cb-verify').addEventListener('click', handlers.onVerify);
  document.getElementById('cb-next').addEventListener('click', handlers.onNext);
  selectCell(vm.selected || 'A');
  if (vm.feedback) setFeedback(vm.feedback.kind, vm.feedback.html);
  if (vm.locked) { lockInputs(true); lockKeypad(true); }
  if (vm.showNext) showNext(true);
  if (vm.revealHtml) {
    document.getElementById('cb-reveal').innerHTML = vm.revealHtml;
  }
}

export function readInputs() {
  const o = {};
  ['A', 'B', 'C', 'D'].forEach((k) => {
    const el = document.getElementById('cb-in-' + k);
    o[k] = el ? el.value : '';
  });
  return o;
}

export function updateHud(o) {
  const s = document.getElementById('cb-score');
  if (s && o.score !== undefined) s.textContent = o.score;
  const a = document.getElementById('cb-attempts');
  if (a && o.attempts !== undefined) a.textContent = o.attempts;
  const t = document.getElementById('cb-timer');
  if (t && o.timerText !== undefined) t.textContent = o.timerText;
}

export function setFeedback(kind, html) {
  const el = document.getElementById('cb-feedback');
  if (!el) return;
  el.className = 'cb-feedback cb-fb-' + kind;
  el.innerHTML = html;
}

/** 清除提示區（「再試一次」收起提示用，不碰輸入與次數） */
export function clearFeedback() {
  const el = document.getElementById('cb-feedback');
  if (!el) return;
  el.className = 'cb-feedback';
  el.innerHTML = '';
}

/** 切換主按鈕文字（驗證答案／再試一次） */
export function setVerifyLabel(text) {
  const el = document.getElementById('cb-verify');
  if (el) el.textContent = text;
}

export function lockInputs(locked) {
  ['A', 'B', 'C', 'D'].forEach((k) => {
    const el = document.getElementById('cb-in-' + k);
    if (el) el.disabled = locked;
  });
  const v = document.getElementById('cb-verify');
  if (v) v.classList.toggle('cb-hidden', locked);
}

export function showNext(show) {
  const n = document.getElementById('cb-next');
  if (n) n.classList.toggle('cb-hidden', !show);
}

/** 標示目前選取的格子（同欄鍵盤輸入目標） */
export function selectCell(k) {
  document.querySelectorAll('.cb-cell').forEach((el) => {
    el.classList.toggle('selected', el.getAttribute('data-cell') === k);
  });
}

/** 鎖定／解鎖虛擬鍵盤（作答完成後鎖定） */
export function lockKeypad(locked) {
  document.querySelectorAll('#cb-keypad [data-key]').forEach((el) => {
    el.disabled = locked;
  });
}

/** 兩次皆錯：以十字圖形展示參考排列＋三公式驗算 */
export function revealReference(q) {
  const r = q.ref;
  const f1 = r.A * r.C;
  const f2 = r.B * r.D;
  const f3 = r.A * r.D + r.B * r.C;
  const ok = (g, e) => (g === e ? '✓' : '✗');
  return '<div class="cb-reveal">'
    + '<div class="cb-reveal-title">正確排列如下（已鎖定，0 分）：</div>'
    + '<div class="cb-minigrid">'
    + '<span>A=' + r.A + '</span><span>B=' + r.B + '</span>'
    + '<span>C=' + r.C + '</span><span>D=' + r.D + '</span>'
    + '</div>'
    + '<div class="cb-formulas">'
    + '<div>P = A×C ＝ ' + r.A + '×' + r.C + ' ＝ ' + f1 + ' ' + ok(f1, q.P) + '</div>'
    + '<div>Q = B×D ＝ ' + r.B + '×' + r.D + ' ＝ ' + f2 + ' ' + ok(f2, q.Q) + '</div>'
    + '<div>R = A×D＋B×C ＝ ' + r.A + '×' + r.D + '＋' + r.B + '×' + r.C + ' ＝ ' + f3 + ' ' + ok(f3, q.R) + '</div>'
    + '</div>'
    + '</div>';
}

/* ---------- 結算頁 ---------- */
export function renderSettle(stageName, stars, stats, maxScore, nextLabel, onNext) {
  root.innerHTML =
    '<section class="cb-panel cb-narrow" data-screen="settle">'
    + '<div class="cb-title">' + esc(stars + ' ' + stageName + '階段結算') + '</div>'
    + '<div class="cb-stats">'
    + '<div><span>本階段得分</span><b>' + stats.score + '／' + maxScore + '</b></div>'
    + '<div><span>第一次答對</span><b>' + stats.first + ' 題</b></div>'
    + '<div><span>第二次答對</span><b>' + stats.second + ' 題</b></div>'
    + '<div><span>兩次皆錯</span><b>' + stats.wrong + ' 題</b></div>'
    + '<div><span>本階段答對</span><b>' + stats.answered + '／' + stats.total + ' 題</b></div>'
    + '</div>'
    + '<button class="cb-btn" id="cb-next-stage">' + esc(nextLabel) + '</button>'
    + '</section>';
  document.getElementById('cb-next-stage').addEventListener('click', onNext);
}

/* ---------- 最終成績 ---------- */
export function renderFinal(t, handlers) {
  root.innerHTML =
    '<section class="cb-panel cb-narrow" data-screen="final">'
    + (t.isTest ? '<div class="cb-testbadge">測試模式</div>' : '')
    + '<div class="cb-big">🏆</div>'
    + '<div class="cb-title">恭喜完成十字交乘三階段挑戰！</div>'
    + '<div class="cb-stats">'
    + '<div><span>一星得分</span><b>' + t.s1 + '／20</b></div>'
    + '<div><span>二星得分</span><b>' + t.s2 + '／40</b></div>'
    + '<div><span>三星得分</span><b>' + t.s3 + '／30</b></div>'
    + '<div class="cb-total"><span>總得分</span><b>' + t.total + '／90</b></div>'
    + '<div><span>第一次答對</span><b>' + t.first + ' 題</b></div>'
    + '<div><span>第二次答對</span><b>' + t.second + ' 題</b></div>'
    + '<div><span>兩次皆錯</span><b>' + t.wrong + ' 題</b></div>'
    + '<div><span>總答對</span><b>' + t.answered + '／25 題</b></div>'
    + '<div><span>有效作答時間</span><b>' + esc(t.elapsedText) + '</b></div>'
    + '</div>'
    + (t.isTest ? '<p class="cb-note">測試模式成績（本機保存，僅供測試）。</p>' : '')
    + (t.isTest && handlers && handlers.onReset
      ? '<button class="cb-btn cb-btn-ghost" id="cb-reset2">測試用重置（清除本機挑戰紀錄）</button>' : '')
    + '</section>';
  if (t.isTest && handlers && handlers.onReset) {
    const rb = document.getElementById('cb-reset2');
    if (rb) rb.addEventListener('click', handlers.onReset);
  }
}

export function fmtTime(ms) {
  return formatElapsed(ms);
}
