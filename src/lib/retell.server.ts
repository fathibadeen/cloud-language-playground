/**
 * Thin server-only Retell AI client.
 * The platform owns a single Retell account; every tenant company gets its own
 * Retell LLM + agent (+ phone number) inside that account.
 */

const BASE = "https://api.retellai.com";

function apiKey(): string {
  const key = process.env["RETELL_API_KEY"];
  if (!key) throw new Error("retell_api_key_missing");
  return key;
}

async function call<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`retell_${res.status}: ${text.slice(0, 300)}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

export type RetellCall = {
  call_id: string;
  agent_id?: string;
  call_type?: string;
  direction?: string;
  from_number?: string;
  to_number?: string;
  call_status?: string;
  start_timestamp?: number;
  end_timestamp?: number;
  duration_ms?: number;
  recording_url?: string;
  disconnection_reason?: string;
  transcript?: string;
  call_analysis?: { call_summary?: string; user_sentiment?: string };
};

export async function ping(): Promise<boolean> {
  await call<unknown[]>("/list-agents");
  return true;
}

/** Picks a voice that matches the requested language, falling back sensibly. */
export async function pickVoice(language: "ar" | "en"): Promise<string> {
  const override = process.env[language === "ar" ? "RETELL_VOICE_AR" : "RETELL_VOICE_EN"];
  if (override) return override;
  const voices = await call<
    { voice_id: string; voice_name?: string; language?: string; accent?: string }[]
  >("/list-voices");
  const want = language === "ar" ? "arab" : "english";
  const match = voices.find((v) =>
    `${v.language ?? ""} ${v.accent ?? ""} ${v.voice_name ?? ""}`.toLowerCase().includes(want),
  );
  return match?.voice_id ?? voices[0]?.voice_id ?? "11labs-Adrian";
}

export async function createLlm(input: {
  prompt: string;
  greeting: string;
}): Promise<{ llm_id: string }> {
  return call<{ llm_id: string }>("/create-retell-llm", {
    method: "POST",
    body: {
      model: "gpt-4o-mini",
      general_prompt: input.prompt,
      begin_message: input.greeting,
    },
  });
}

export async function updateLlm(llmId: string, prompt: string, greeting: string) {
  return call(`/update-retell-llm/${llmId}`, {
    method: "PATCH",
    body: { general_prompt: prompt, begin_message: greeting },
  });
}

export async function createAgent(input: {
  name: string;
  llmId: string;
  voiceId: string;
  language: "ar" | "en";
  webhookUrl: string;
}): Promise<{ agent_id: string }> {
  return call<{ agent_id: string }>("/create-agent", {
    method: "POST",
    body: {
      agent_name: input.name,
      response_engine: { type: "retell-llm", llm_id: input.llmId },
      voice_id: input.voiceId,
      language: input.language === "ar" ? "multi" : "en-US",
      webhook_url: input.webhookUrl,
    },
  });
}

export async function buyPhoneNumber(input: {
  agentId: string;
  areaCode?: number;
}): Promise<{ phone_number: string }> {
  return call<{ phone_number: string }>("/create-phone-number", {
    method: "POST",
    body: {
      inbound_agent_id: input.agentId,
      outbound_agent_id: input.agentId,
      ...(input.areaCode ? { area_code: input.areaCode } : {}),
    },
  });
}

export async function getCall(callId: string): Promise<RetellCall> {
  return call<RetellCall>(`/v2/get-call/${callId}`);
}

export async function listCalls(agentIds: string[], limit = 100): Promise<RetellCall[]> {
  const res = await call<RetellCall[]>("/v2/list-calls", {
    method: "POST",
    body: { filter_criteria: { agent_id: agentIds }, limit, sort_order: "descending" },
  });
  return Array.isArray(res) ? res : [];
}

export function buildPrompt(input: {
  companyName: string;
  industry?: string | null;
  description?: string | null;
  personality?: string | null;
  instructions?: string | null;
  knowledge?: string | null;
  language: "ar" | "en";
}): string {
  const lines =
    input.language === "ar"
      ? [
          `أنت موظف خدمة عملاء ذكي يعمل لدى "${input.companyName}".`,
          input.industry ? `مجال الشركة: ${input.industry}.` : "",
          input.description ? `عن الشركة: ${input.description}` : "",
          input.personality ? `أسلوبك: ${input.personality}` : "تحدث بلهجة عربية مهذبة وواضحة ومختصرة.",
          input.instructions ?? "",
          "أجب فقط بما تعرفه عن الشركة، وإن لم تعرف الإجابة اعتذر واعرض تحويل العميل لموظف بشري.",
          input.knowledge ? `معلومات الشركة:\n${input.knowledge}` : "",
        ]
      : [
          `You are an AI customer service agent for "${input.companyName}".`,
          input.industry ? `Industry: ${input.industry}.` : "",
          input.description ? `About: ${input.description}` : "",
          input.personality ?? "Be polite, clear and concise.",
          input.instructions ?? "",
          "Only answer from the company information. If unsure, apologise and offer a transfer to a human agent.",
          input.knowledge ? `Company information:\n${input.knowledge}` : "",
        ];
  return lines.filter(Boolean).join("\n\n").slice(0, 8000);
}
