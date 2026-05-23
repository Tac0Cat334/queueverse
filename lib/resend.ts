import { Resend } from "resend";
import { BRAND } from "./brand";

let client: Resend | null = null;

export function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;

  if (!client) {
    client = new Resend(apiKey);
  }
  return client;
}

export function getContactEmailConfig() {
  return {
    recipient: process.env.CONTACT_RECIPIENT_EMAIL?.trim(),
    from:
      process.env.CONTACT_FROM_EMAIL?.trim() ??
      `${BRAND.name} <onboarding@resend.dev>`,
  };
}

export function isContactConfigured(): boolean {
  const { recipient } = getContactEmailConfig();
  return Boolean(getResend() && recipient);
}

export function isWebhookConfigured(): boolean {
  return Boolean(getResend() && process.env.RESEND_WEBHOOK_SECRET?.trim());
}
