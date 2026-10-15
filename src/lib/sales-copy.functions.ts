import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const inputSchema = z.object({
  destination: z.string().trim().min(1).max(120),
  dates: z.string().trim().max(120),
  duration: z.string().trim().max(80),
  audience: z.string().trim().max(400),
  highlights: z.string().trim().max(1500),
  tone: z.string().trim().max(80),
  extra: z.string().trim().max(1500),
});

const outputSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  storyHeading: z.array(z.string()),
  storyParagraphs: z.array(z.string()),
  highlights: z.array(z.object({ title: z.string(), description: z.string() })),
  faq: z.array(z.object({ q: z.string(), a: z.string() })),
  finalHeading: z.string(),
  finalButton: z.string(),
  finalNote: z.string(),
});

export type SalesCopy = z.infer<typeof outputSchema>;
export type SalesCopyResult = { ok: true; copy: SalesCopy } | { ok: false; error: string };

export const generateSalesCopy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<SalesCopyResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { ok: false, error: "La IA no está configurada todavía." };
    const { streamText, Output, NoObjectGeneratedError, APICallError } = await import("ai");
    const { createGatewayResponsesProvider } = await import("./ai-gateway.server");
    const provider = createGatewayResponsesProvider(apiKey);

    const prompt = `Detalles del viaje grupal para mujeres:
- Destino: ${data.destination}
- Fechas: ${data.dates || "sin definir"}
- Duración: ${data.duration || "sin definir"}
- Público: ${data.audience || "mujeres viajeras"}
- Experiencias destacadas: ${data.highlights || "sin detallar"}
- Tono deseado: ${data.tone || "cálido y evocador"}
- Notas adicionales: ${data.extra || "ninguna"}`;

    try {
      const result = streamText({
        model: provider.responses("openai/gpt-6-astra"),
        system: `Sos redactora experta en marketing de viajes grupales para mujeres. Escribí en español neutro textos promocionales para una página de venta. Reglas: título de máximo 12 palabras; subtítulo de 1-2 frases; storyHeading exactamente 2 frases cortas; storyParagraphs exactamente 3 párrafos de 2-4 frases; highlights exactamente 4 (título corto + descripción de 1-2 frases); faq exactamente 5 preguntas frecuentes útiles con respuestas breves; finalHeading una frase de cierre; finalButton 2-4 palabras; finalNote una frase breve. No inventes precios ni datos concretos que no se te dieron.`,
        prompt,
        output: Output.object({ schema: outputSchema }),
        providerOptions: {
          openai: {
            forceReasoning: true,
            reasoningEffort: "low",
            reasoningSummary: "auto",
            store: false,
            include: ["reasoning.encrypted_content"],
          },
        },
      });
      const copy = await result.output;
      return {
        ok: true,
        copy: {
          ...copy,
          storyHeading: copy.storyHeading.slice(0, 2),
          storyParagraphs: copy.storyParagraphs.slice(0, 4),
          highlights: copy.highlights.slice(0, 6),
          faq: copy.faq.slice(0, 8),
        },
      };
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        return { ok: false, error: "La IA no devolvió un texto válido. Probá de nuevo." };
      }
      const status = APICallError.isInstance(error) ? error.statusCode : undefined;
      if (status === 429) return { ok: false, error: "Demasiadas solicitudes. Esperá un momento e intentá otra vez." };
      if (status === 402) return { ok: false, error: "No quedan créditos de IA. Recargalos en Ajustes → Planes y créditos." };
      if (status === 403) return { ok: false, error: "El uso de IA está bloqueado para este espacio de trabajo." };
      console.error("generateSalesCopy failed", error);
      return { ok: false, error: "No se pudieron generar los textos. Intentá de nuevo." };
    }
  });
