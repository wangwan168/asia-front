// 大模型外交设置（阶段 2.5 前半）：玩家自填 OpenAI 兼容接口的 baseUrl / apiKey / model。
// Key 只存本地（经注入的 KeyValueStorage，浏览器即 localStorage），不进存档、不进日志、不上传任何服务器。
// 本文件只管设置存取与可用性判定，不发请求（请求在 llmClient.ts）。

import type { KeyValueStorage } from "../save/saveGame";

export interface LlmSettings {
  baseUrl: string; // 如 https://api.openai.com/v1（OpenAI 兼容）
  apiKey: string;
  model: string;
}

export const DEFAULT_LLM_SETTINGS: LlmSettings = {
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "",
};

export const LLM_SETTINGS_KEY = "asia-front.llm.settings";

export function loadLlmSettings(storage: KeyValueStorage): LlmSettings {
  const raw = storage.get(LLM_SETTINGS_KEY);
  if (raw === null) {
    return { ...DEFAULT_LLM_SETTINGS };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<LlmSettings>;
    return {
      baseUrl: typeof parsed.baseUrl === "string" ? parsed.baseUrl : DEFAULT_LLM_SETTINGS.baseUrl,
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      model: typeof parsed.model === "string" ? parsed.model : "",
    };
  } catch {
    return { ...DEFAULT_LLM_SETTINGS };
  }
}

export function saveLlmSettings(storage: KeyValueStorage, settings: LlmSettings): void {
  storage.set(LLM_SETTINGS_KEY, JSON.stringify(settings));
}

export function clearLlmSettings(storage: KeyValueStorage): void {
  storage.remove(LLM_SETTINGS_KEY);
}
