/** challenge/js/app.js — 進入點 */
import { CHALLENGE } from './config.js';
import { LocalStorageAdapter } from './storage.js';
import { createApp } from './flow.js';
import { mount } from './ui.js';

function main() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('test') === '1' ? 'test' : 'formal';
  mount(document.getElementById('app'));
  const store = new LocalStorageAdapter(CHALLENGE.STORAGE_KEY);
  const app = createApp({ mode, store });
  app.boot();
  // 測試鉤子：僅測試模式暴露（正式模式無任何全域鉤子）
  if (mode === 'test') {
    window.__CB__ = app.testAPI();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
