// Shared helper for sending transactional emails via Resend.
// Requires the RESEND_API_KEY secret to be set on the Supabase project
// (Edge Functions -> Manage secrets), and a verified sending domain in
// Resend (e.g. yellowdog.bg) so FROM_EMAIL below is accepted.

const FROM_EMAIL = "Студио Жълто куче <resend@yellowdog.bg>";

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  attachments?: { filename: string; content: string }[]
): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.error("[sendEmail] RESEND_API_KEY not configured — skipping send to", to);
    return;
  }
  if (!to) {
    console.error("[sendEmail] no recipient email provided — skipping send");
    return;
  }

  const body: Record<string, unknown> = {
    from: FROM_EMAIL,
    to: [to],
    subject,
    html,
  };
  if (attachments && attachments.length > 0) {
    body.attachments = attachments;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const responseBody = await res.text();
    console.error(`[sendEmail] Resend API error ${res.status} for ${to}:`, responseBody);
  }
}
