import { renderCvPdf } from "@/lib/pdf";
import { sendEmail } from "@/lib/email";
import { welcomeEmailHtml } from "@/lib/welcome-email";
import type { CVContent } from "@/lib/schemas";

function sampleCVContent(name: string): CVContent {
  const firstName = name.split(" ")[0];
  return {
    summary: `Creative and results-driven professional with a passion for delivering impact. ${firstName} combines technical expertise with strong communication skills to drive projects from concept to completion.`,
    experience: [
      {
        company: "Stripe",
        title: "Senior Product Engineer",
        startDate: "Jan 2023",
        endDate: "Present",
        bullets: [
          "Led development of a real-time dashboard serving 10K+ merchants, improving payment visibility by 40%.",
          "Shipped 3 major API iterations with zero downtime, reducing p50 latency by 28%.",
          "Mentored 4 engineers through structured onboarding, cutting ramp-up time by 35%.",
        ],
      },
      {
        company: "Figma",
        title: "Full-Stack Engineer",
        startDate: "Jun 2020",
        endDate: "Dec 2022",
        bullets: [
          "Built collaborative design review features used by 500K+ monthly active users.",
          "Reduced WebSocket reconnection failures by 65% through a custom retry-with-backoff strategy.",
          "Drove adoption of TypeScript across the monorepo, increasing type coverage from 40% to 92%.",
        ],
      },
      {
        company: "Shopify",
        title: "Software Engineer (New Grad)",
        startDate: "Sep 2018",
        endDate: "May 2020",
        bullets: [
          "Delivered 15+ merchant-facing features on the checkout team, impacting 2M+ stores.",
          "Optimized GraphQL resolvers, cutting average query time from 320ms to 90ms.",
          "Wrote 200+ integration tests and lifted CI pipeline reliability to 99.7%.",
        ],
      },
    ],
    skills: ["TypeScript", "React", "Node.js", "PostgreSQL", "GraphQL", "AWS", "Docker", "CI/CD", "Python", "Figma API", "REST APIs", "Agile"],
    languages: [
      { name: "English", level: "high" },
      { name: "French", level: "medium" },
      { name: "Spanish", level: "medium" },
    ],
  };
}

export async function sendWelcomeEmail(name: string, email: string) {
  try {
    const content = sampleCVContent(name);
    const pdf = await renderCvPdf({
      templateId: "modern",
      accentColor: "#2563eb",
      fontId: "inter",
      fullName: name,
      email,
      phone: "",
      roleTitle: "Software Engineer · Sample CV",
      content,
    });

    await sendEmail({
      to: email,
      subject: "Welcome to abCV — your sample CV is inside",
      html: welcomeEmailHtml(name),
      attachments: [
        {
          filename: "Sample_CV.pdf",
          content: pdf.toString("base64"),
          content_type: "application/pdf",
        },
      ],
    });
  } catch (e) {
    console.warn("Welcome email failed to send:", (e as Error).message);
  }
}
