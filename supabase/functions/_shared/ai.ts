// Delad AI-motor för Hönsgårdens edge functions.
//
// Fallback-kedja (första konfigurerade nyckeln vinner, vid fel faller kedjan vidare):
//   1. GEMINI_API_KEY  → Google AI Studio (OpenAI-kompatibel endpoint)
//   2. OPENAI_API_KEY  → OpenAI (modell via OPENAI_MODEL, annars gpt-4o-mini)
//   3. LOVABLE_API_KEY → Lovable AI-gateway (historisk standard, kvar som reserv)
//
// Utan egna nycklar beter sig kedjan exakt som tidigare: bara Lovable anropas
// och samma statuskoder (402/429/502) bubblar upp till anroparen.

export interface AiMessage {
  role: string;
  content: unknown;
}

export interface AiUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export interface AiCallOptions {
  /** Modell-id i Lovables format, t.ex. "google/gemini-2.5-flash". Mappas per leverantör. */
  model: string;
  messages: AiMessage[];
  maxTokens?: number;
  temperature?: number;
  tools?: unknown[];
  toolChoice?: unknown;
}

export type AiProvider = "gemini" | "openai" | "lovable";

export interface AiSuccess {
  ok: true;
  provider: AiProvider;
  /** Faktisk modell som användes hos leverantören. */
  model: string;
  /** choices[0].message.content ("" om svaret bara innehåller tool_calls). */
  text: string;
  // deno-lint-ignore no-explicit-any
  /** Hela respons-JSON:en – för tool_calls-parsning. */
  raw: any;
  usage: AiUsage | null;
}

export interface AiStreamSuccess {
  ok: true;
  provider: AiProvider;
  model: string;
  /** Obearbetad SSE-ström (text/event-stream) från leverantören. */
  body: ReadableStream<Uint8Array>;
}

export interface AiFailure {
  ok: false;
  /** Sista leverantörens HTTP-status (500 om ingen nyckel alls är satt). */
  status: number;
  error: string;
  /** Kort spår av vad kedjan provade – loggas alltid vid totalt misslyckande. */
  attempts: string[];
}

interface ProviderDef {
  id: AiProvider;
  keyEnv: string;
  url: string;
  mapModel: (model: string) => string;
  /** stream_options stöds inte av Googles OpenAI-kompatibla lager – hoppas över där. */
  supportsStreamUsage: boolean;
}

const PROVIDERS: ProviderDef[] = [
  {
    id: "gemini",
    keyEnv: "GEMINI_API_KEY",
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    mapModel: (m) => m.replace(/^google\//, ""),
    supportsStreamUsage: false,
  },
  {
    id: "openai",
    keyEnv: "OPENAI_API_KEY",
    url: "https://api.openai.com/v1/chat/completions",
    mapModel: () => Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini",
    supportsStreamUsage: true,
  },
  {
    id: "lovable",
    keyEnv: "LOVABLE_API_KEY",
    url: "https://ai.gateway.lovable.dev/v1/chat/completions",
    mapModel: (m) => m,
    supportsStreamUsage: true,
  },
];

function buildBody(
  provider: ProviderDef,
  model: string,
  opts: AiCallOptions,
  stream: boolean,
): string {
  const body: Record<string, unknown> = {
    model: provider.mapModel(model),
    messages: opts.messages,
  };
  if (opts.maxTokens !== undefined) body.max_tokens = opts.maxTokens;
  if (opts.temperature !== undefined) body.temperature = opts.temperature;
  if (opts.tools) body.tools = opts.tools;
  if (opts.toolChoice) body.tool_choice = opts.toolChoice;
  if (stream) {
    body.stream = true;
    if (provider.supportsStreamUsage) {
      body.stream_options = { include_usage: true };
    }
  }
  return JSON.stringify(body);
}

function failure(status: number, error: string, attempts: string[]): AiFailure {
  console.error(`[ai] Leverantörskedjan misslyckades (${attempts.join(" → ")})`);
  return { ok: false, status, error, attempts };
}

/** Icke-strömmande AI-anrop med automatisk fallback mellan leverantörer. */
export async function callAi(opts: AiCallOptions): Promise<AiSuccess | AiFailure> {
  const attempts: string[] = [];
  let anyKey = false;

  for (const provider of PROVIDERS) {
    const apiKey = Deno.env.get(provider.keyEnv);
    if (!apiKey) continue;
    anyKey = true;
    const model = provider.mapModel(opts.model);

    let res: Response;
    try {
      res = await fetch(provider.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: buildBody(provider, opts.model, opts, false),
        signal: AbortSignal.timeout(90_000),
      });
    } catch (err) {
      attempts.push(`${provider.id}: nätverksfel (${err instanceof Error ? err.message : String(err)})`);
      continue;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      attempts.push(`${provider.id}: HTTP ${res.status} ${text.slice(0, 200)}`);
      // Spara status om det är sista konfigurerade leverantören – annars prova nästa.
      if (PROVIDERS.slice(PROVIDERS.indexOf(provider) + 1).some((p) => Deno.env.get(p.keyEnv))) {
        continue;
      }
      return failure(res.status, text.slice(0, 300) || `HTTP ${res.status}`, attempts);
    }

    // deno-lint-ignore no-explicit-any
    const raw: any = await res.json().catch(() => null);
    if (!raw) {
      attempts.push(`${provider.id}: ogiltig JSON`);
      continue;
    }

    return {
      ok: true,
      provider: provider.id,
      model,
      text: raw?.choices?.[0]?.message?.content ?? "",
      raw,
      usage: raw?.usage ?? null,
    };
  }

  if (!anyKey) {
    return failure(500, "Ingen AI-nyckel konfigurerad (GEMINI_API_KEY, OPENAI_API_KEY eller LOVABLE_API_KEY)", attempts);
  }
  return failure(502, "AI-tjänsten svarade inte", attempts);
}

/** Strömmande AI-anrop (SSE) med samma fallback-kedja. */
export async function callAiStream(opts: AiCallOptions): Promise<AiStreamSuccess | AiFailure> {
  const attempts: string[] = [];
  let anyKey = false;

  for (const provider of PROVIDERS) {
    const apiKey = Deno.env.get(provider.keyEnv);
    if (!apiKey) continue;
    anyKey = true;
    const model = provider.mapModel(opts.model);

    let res: Response;
    try {
      res = await fetch(provider.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: buildBody(provider, opts.model, opts, true),
        signal: AbortSignal.timeout(60_000),
      });
    } catch (err) {
      attempts.push(`${provider.id}: nätverksfel (${err instanceof Error ? err.message : String(err)})`);
      continue;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      attempts.push(`${provider.id}: HTTP ${res.status} ${text.slice(0, 200)}`);
      if (PROVIDERS.slice(PROVIDERS.indexOf(provider) + 1).some((p) => Deno.env.get(p.keyEnv))) {
        continue;
      }
      return failure(res.status, text.slice(0, 300) || `HTTP ${res.status}`, attempts);
    }

    if (!res.body) {
      attempts.push(`${provider.id}: tom ström`);
      continue;
    }

    return { ok: true, provider: provider.id, model, body: res.body };
  }

  if (!anyKey) {
    return failure(500, "Ingen AI-nyckel konfigurerad (GEMINI_API_KEY, OPENAI_API_KEY eller LOVABLE_API_KEY)", attempts);
  }
  return failure(502, "AI-tjänsten svarade inte", attempts);
}
