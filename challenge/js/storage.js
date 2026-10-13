/** challenge/js/storage.js — 進度保存介面（本批 localStorage，未來可換 Firebase 實作） */
export class StorageAdapter {
  save(/* snapshot */) { throw new Error('未實作'); }
  load() { throw new Error('未實作'); }
  clear() { throw new Error('未實作'); }
}

export class LocalStorageAdapter extends StorageAdapter {
  constructor(key, ls) {
    super();
    this.key = key;
    this.ls = ls || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!this.ls) throw new Error('[storage] 無可用的 localStorage');
  }
  save(snapshot) {
    const data = { ...snapshot, updatedAt: Date.now() };
    this.ls.setItem(this.key, JSON.stringify(data));
  }
  load() {
    const raw = this.ls.getItem(this.key);
    if (raw === null || raw === undefined) return null;
    return JSON.parse(raw); // 解析失敗由呼叫端捕捉處理
  }
  clear() {
    this.ls.removeItem(this.key);
  }
}

/** 僅供單元測試的記憶體實作 */
export class MemoryAdapter extends StorageAdapter {
  constructor() { super(); this.data = null; }
  save(s) { this.data = JSON.parse(JSON.stringify(s)); }
  load() { return this.data ? JSON.parse(JSON.stringify(this.data)) : null; }
  clear() { this.data = null; }
}
