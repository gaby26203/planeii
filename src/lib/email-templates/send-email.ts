import * as React from "react";
import { render } from "@react-email/render";
import { TEMPLATES } from "./registry";

// Solo servidor: lee RESEND_API_KEY. Nunca importar desde componentes de cliente.
//
// Antes los correos salían por la API gestionada de Lovable (@lovable.dev/email-js).
// Ahora se envían con Resend (https://resend.com) mediante su API HTTP, sin SDK.
// Variables:
//   RESEND_API_KEY  clave secreta de Resend (si falta, el correo se registra en consola y no se envía)
//   EMAIL_FROM      remitente, p. ej. "PLANEI OS <noreply@chamaviaja.com>" (dominio verificado en Resend)
//   EMAIL_REPLY_TO  opcional, respuesta por defecto cuando la llamada no indica una

const DEFAULT_FROM = "PLANEI OS <noreply@chamaviaja.com>";
const RESEND_URL = "https://api.resend.com/emails";

export type SendTemplateEmailResult =
  | { sent: true; id?: string }
  | { sent: false; reason: "not_configured" };

export interface SendTemplateEmailOptions {
  templateData?: Record<string, any>;
  /** Evita duplicados si se reintenta el mismo envío lógico (cabecera Idempotency-Key de Resend). */
  idempotencyKey?: string;
  replyTo?: string;
}

export class EmailSendError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "EmailSendError";
  }
}

/**
 * Renderiza una plantilla registrada y la envía con Resend.
 * Si falta RESEND_API_KEY devuelve { sent: false } y deja el correo en consola,
 * para que el desarrollo local funcione sin proveedor. Cualquier otro fallo lanza EmailSendError.
 */
export async function sendTemplateEmail(
  templateName: string,
  to: string,
  options: SendTemplateEmailOptions = {},
): Promise<SendTemplateEmailResult> {
  const template = TEMPLATES[templateName];
  if (!template) {
    throw new Error(
      `Template '${templateName}' not found. Available: ${Object.keys(TEMPLATES).join(", ")}`,
    );
  }

  // El `to` fijo de la plantilla tiene prioridad (plantillas de notificación interna).
  const recipient = template.to || to;
  if (!recipient) {
    throw new Error("Recipient is required (the template defines no fixed recipient)");
  }

  const templateData = options.templateData ?? {};
  const element = React.createElement(template.component, templateData);
  const html = await render(element);
  const text = await render(element, { plainText: true });
  const subject =
    typeof template.subject === "function" ? template.subject(templateData) : template.subject;

  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) {
    console.warn(
      `[email] RESEND_API_KEY no configurada; no se envía '${templateName}' a ${recipient}: ${subject}`,
    );
    return { sent: false, reason: "not_configured" };
  }

  const replyTo = options.replyTo || process.env["EMAIL_REPLY_TO"];
  const response = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from: process.env["EMAIL_FROM"] || DEFAULT_FROM,
      to: [recipient],
      subject,
      html,
      text,
      tags: [{ name: "template", value: templateName }],
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string; name?: string };
    throw new EmailSendError(
      body.message || `Resend respondió ${response.status}`,
      response.status,
      body.name,
    );
  }

  const { id } = (await response.json().catch(() => ({}))) as { id?: string };
  return { sent: true, id };
}
