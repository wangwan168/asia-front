// localStorage 适配层：把浏览器的 localStorage 包成 KeyValueStorage 注入 SaveManager。
// 与纯逻辑（saveGame.ts）分离；无 localStorage 的环境（测试/SSR）调用方应改用 createMemoryStorage。

import type { KeyValueStorage } from "./saveGame";

export function createLocalStorageAdapter(): KeyValueStorage {
  const ls = globalThis.localStorage;
  if (!ls) {
    throw new Error("localStorage is not available in this environment");
  }
  return {
    get: (k) => ls.getItem(k),
    set: (k, v) => {
      ls.setItem(k, v);
    },
    remove: (k) => {
      ls.removeItem(k);
    },
  };
}
