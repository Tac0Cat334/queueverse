import type { Metadata } from "next";
import { LegalLayout } from "@/components/LegalLayout";
import { ContactForm } from "@/components/ContactForm";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Contact",
};

export default function ContactPage() {
  return (
    <LegalLayout title="Contact" description={`Get in touch with ${BRAND.name}`}>
      <p>
        Have a question, feedback, or found an issue? Send us a message and
        we&apos;ll get back to you.
      </p>

      <ContactForm />

      <h2>Data attribution</h2>
      <p>
        Wait time data is provided by{" "}
        <a href="https://queue-times.com" target="_blank" rel="noopener noreferrer">
          Queue-Times.com
        </a>
        .
      </p>

      <h2>Affiliation</h2>
      <p>{BRAND.disclaimer}</p>
    </LegalLayout>
  );
}
