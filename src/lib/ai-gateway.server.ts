import { createOpenAI } from "@ai-sdk/openai";

// Proveedor de IA para la generación de textos de venta.
//
// Antes se usaba el AI Gateway de Lovable (https://ai.gateway.lovable.dev/v1) con
// LOVABLE_API_KEY y el modelo "openai/gpt-6-astra". Ahora se habla directamente con
// cualquier API compatible con la Responses API de OpenAI.
// Variables:
//   AI_API_KEY   clave secreta del proveedor (obligatoria para activar la IA)
//   AI_BASE_URL  opcional; por defecto la API de OpenAI (https://api.openai.com/v1)
//   AI_MODEL     modelo a usar (obligatorio; ver .env.example)

export type AiConfig = { apiKey: string; model: string; baseURL?: string };

/** Lee la configuración de IA del entorno; devuelve null si falta algo obligatorio. */
export function readAiConfig(): AiConfig | null {
  const apiKey = process.env.AI_API_KEY?.trim();
  const model = process.env.AI_MODEL?.trim();
  if (!apiKey || !model) return null;
  const baseURL = process.env.AI_BASE_URL?.trim() || undefined;
  return { apiKey, model, baseURL };
}

/** Crea el modelo de lenguaje (Responses API) para una petición. */
export function createResponsesModel(config: AiConfig) {
  const provider = createOpenAI({ apiKey: config.apiKey, baseURL: config.baseURL });
  return provider.responses(config.model);
}
