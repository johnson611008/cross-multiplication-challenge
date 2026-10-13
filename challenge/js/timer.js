/** challenge/js/timer.js — 累計作答計時（可注入時鐘以利測試） */
export function createTimer(saved, clock) {
  const now = clock || (() => Date.now());
  const t = {
    accumulatedMs: 0,
    runningSince: null,
    log: [],
    // 擴充預留（第 4 批伺服器權威時間／同步截止）
    authority: 'local',
    serverOffsetMs: 0,
    syncDeadline: null,
  };
  if (saved && typeof saved === 'object') {
    if (Number.isFinite(saved.accumulatedMs) && saved.accumulatedMs >= 0) {
      t.accumulatedMs = Math.floor(saved.accumulatedMs);
    }
    // 重新整理前若在計時， reload 後延續累計（不得重設為 0）
    if (saved.runningSince !== null && saved.runningSince !== undefined) {
      t.runningSince = saved.runningSince;
    }
    if (Array.isArray(saved.log)) t.log = saved.log.slice(-50);
  }

  function pushLog(ev) {
    t.log.push({ ev, at: now() });
    if (t.log.length > 50) t.log = t.log.slice(-50);
  }

  return {
    _t: t,
    isRunning() { return t.runningSince !== null; },
    start() {
      if (t.runningSince === null) {
        t.runningSince = now();
        pushLog('start');
      }
    },
    resume() { this.start(); },
    pause() {
      if (t.runningSince !== null) {
        t.accumulatedMs += Math.max(0, now() - t.runningSince);
        t.runningSince = null;
        pushLog('pause');
      }
    },
    elapsedMs() {
      return t.accumulatedMs + (t.runningSince !== null ? Math.max(0, now() - t.runningSince) : 0);
    },
    toJSON() {
      return {
        accumulatedMs: t.accumulatedMs,
        runningSince: t.runningSince,
        log: t.log.slice(),
        authority: t.authority,
        serverOffsetMs: t.serverOffsetMs,
        syncDeadline: t.syncDeadline,
      };
    },
  };
}

export function formatElapsed(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? h + ':' + pad(m) + ':' + pad(sec) : pad(m) + ':' + pad(sec);
}
