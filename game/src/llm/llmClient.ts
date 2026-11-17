// 大模型外交请求层（阶段 2.5 前半，骨架）：接口、可用性判定、超时/错误回退包装。
// 硬要求（用户 2026-11-16 00:18 / 00:57 澄清）：没接入 AI 就是正常完整的游戏，不是「不能用」——
// 外交七项行动与 AI 国家决策全靠规则引擎照常运转，AI 对话只是多一种谈判方式。
// isLlmAvailable() 只控制「对话入口」的显隐，不许拦任何基础功能；本模块任何失败都回退，绝不抛异常阻断游戏：
// - 未配置（无 Key 等）=> isLlmAvailable() 为 false，调用方直接走按钮外交；
// - 请求超时/transport 报错 => 返回 { kind: "fallback", reason }，调用方走按钮外交/规则 AI 路径。
// 本阶段不接真实对话逻辑：transport 可注入（真实实现阶段 2.5 后半接 fetch），测试用假 transport。
// 模型输出只作「结构化动作建议」，必须经规则引擎校验才生效（阶段 2.5/5 接入，本层只回原文）。

import type { LlmSettings } from "./llmSettings";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmRequest {
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  timeoutMs: number;
}

/** transport：执行一次对话请求并返回模型原文。真实实现用 fetch 调 OpenAI 兼容 /chat/completions。 */
export type LlmTransport = (request: LlmRequest) => Promise<string>;

export type DiplomacyReplyResult =
  | { kind: "llm"; text: string }
  | {
      kind: "fallback";
      reason: "not_configured" | "timeout" | "transport_error";
      detail?: string;
    };

export const DEFAULT_TIMEOUT_MS = 15000;

export function isLlmAvailable(settings: LlmSettings): boolean {
  return (
    settings.baseUrl.trim() !== "" &&
    settings.apiKey.trim() !== "" &&
    settings.model.trim() !== ""
  );
}

// 「领袖对话」入口状态（UI 唯一需要向 llm 层问的东西）：isLlmAvailable 只决定这一个入口的显隐/可用与文案，
// 不拦任何基础功能。未接入时的文案为中性提示，不许出现「外交不可用」之类说法（用户 2026-11-16 00:57 口径）。
export interface DiplomacyDialogEntry {
  enabled: boolean;
  label: string;
}

export function getDiplomacyDialogEntry(settings: LlmSettings): DiplomacyDialogEntry {
  return isLlmAvailable(settings)
    ? { enabled: true, label: "领袖对话" }
    : { enabled: false, label: "未接入 AI 对话（可在设置中接入）" };
}

export async function requestDiplomacyReply(
  settings: LlmSettings,
  messages: ChatMessage[],
  transport: LlmTransport,
  options: { timeoutMs?: number } = {},
): Promise<DiplomacyReplyResult> {
  if (!isLlmAvailable(settings)) {
    return { kind: "fallback", reason: "not_configured" };
  }
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const request: LlmRequest = {
    baseUrl: settings.baseUrl,
    apiKey: settings.apiKey,
    model: settings.model,
    messages,
    timeoutMs,
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error("LLM_TIMEOUT")), timeoutMs);
  });
  try {
    const text = await Promise.race([transport(request), timeoutPromise]);
    return { kind: "llm", text };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      kind: "fallback",
      reason: message === "LLM_TIMEOUT" ? "timeout" : "transport_error",
      detail: message,
    };
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}
