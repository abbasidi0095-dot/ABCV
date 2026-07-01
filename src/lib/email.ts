const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";

export interface SendEmailArgs {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export async function sendEmail(args: SendEmailArgs) {
  if (!RESEND_API_KEY) {
    console.warn("RESEND_API_KEY not configured — email not sent");
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: args.from ?? "abCV <onboarding@resend.dev>",
      to: Array.isArray(args.to) ? args.to : [args.to],
      subject: args.subject,
      html: args.html,
      text: args.text ?? args.html.replace(/<[^>]*>/g, ""),
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "unknown");
    throw new Error(`Resend API error (${res.status}): ${err}`);
  }

  return res.json() as Promise<{ id: string }>;
}
