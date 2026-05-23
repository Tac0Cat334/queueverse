import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getResend, getContactEmailConfig } from "@/lib/resend";

export async function POST(request: NextRequest) {
  const resend = getResend();
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  const { recipient, from } = getContactEmailConfig();

  if (!resend || !webhookSecret) {
    return NextResponse.json(
      { error: "Webhook not configured." },
      { status: 503 }
    );
  }

  if (!recipient) {
    return NextResponse.json(
      { error: "Forward recipient not configured." },
      { status: 503 }
    );
  }

  try {
    const payload = await request.text();
    const id = request.headers.get("svix-id");
    const timestamp = request.headers.get("svix-timestamp");
    const signature = request.headers.get("svix-signature");

    if (!id || !timestamp || !signature) {
      return new NextResponse("Missing webhook headers", { status: 400 });
    }

    const event = resend.webhooks.verify({
      payload,
      headers: { id, timestamp, signature },
      webhookSecret,
    });

    if (event.type === "email.received") {
      const { error } = await resend.emails.receiving.forward({
        emailId: event.data.email_id,
        to: recipient,
        from,
        passthrough: true,
      });

      if (error) {
        console.error("Resend forward error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Resend webhook error:", err);
    return new NextResponse("Invalid webhook", { status: 400 });
  }
}

export const dynamic = "force-dynamic";
