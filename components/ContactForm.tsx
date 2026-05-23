"use client";

import { useState } from "react";
import { Send, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/utils/wait-time";

type Status = "idle" | "loading" | "success" | "error";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      setStatus("success");
      setName("");
      setEmail("");
      setMessage("");
    } catch {
      setStatus("error");
      setErrorMsg("Unable to send message. Please try again later.");
    }
  }

  if (status === "success") {
    return (
      <div className="card mt-6 flex items-start gap-3 p-5">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--wait-low)]" />
        <div>
          <p className="text-sm font-medium text-[var(--fg)]">Message sent</p>
          <p className="mt-1 text-sm text-[var(--fg-secondary)]">
            Thanks for reaching out. We&apos;ll get back to you soon.
          </p>
          <button
            onClick={() => setStatus("idle")}
            className="mt-3 text-sm text-[var(--fg-secondary)] underline underline-offset-2 hover:text-[var(--fg)]"
          >
            Send another message
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <div>
        <label htmlFor="name" className="label mb-1.5 block">
          Name
        </label>
        <input
          id="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input-field w-full px-4 py-2.5 text-sm"
          placeholder="Your name"
          disabled={status === "loading"}
        />
      </div>

      <div>
        <label htmlFor="email" className="label mb-1.5 block">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input-field w-full px-4 py-2.5 text-sm"
          placeholder="you@example.com"
          disabled={status === "loading"}
        />
      </div>

      <div>
        <label htmlFor="message" className="label mb-1.5 block">
          Message
        </label>
        <textarea
          id="message"
          required
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="input-field w-full resize-none px-4 py-2.5 text-sm"
          placeholder="How can we help?"
          disabled={status === "loading"}
        />
      </div>

      {status === "error" && (
        <div className="flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-hover)] p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--wait-high)]" />
          <p className="text-sm text-[var(--fg-secondary)]">{errorMsg}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-opacity",
          "bg-[var(--fg)] text-[var(--bg)] hover:opacity-90 disabled:opacity-50"
        )}
      >
        <Send className="h-4 w-4" />
        {status === "loading" ? "Sending..." : "Send message"}
      </button>
    </form>
  );
}
