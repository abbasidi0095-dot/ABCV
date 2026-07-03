import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Placeholder for Whop webhook handler.
// In a real scenario, you'd verify a signature from Whop here.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // In a real Whop webhook, the body contains the event type and data.
    // e.g., body.action === "membership.went_valid"
    // and you'd extract the user's identifier (email or a custom field) from body.data.

    const { email, action } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    if (action === "upgrade") {
      // Simulate upgrading a user
      await prisma.user.update({
        where: { email },
        data: { isPro: true },
      });
      console.log(`[WHOP WEBHOOK SIMULATION] Upgraded user: ${email}`);
    } else if (action === "downgrade") {
      // Simulate downgrading a user
      await prisma.user.update({
        where: { email },
        data: { isPro: false },
      });
      console.log(`[WHOP WEBHOOK SIMULATION] Downgraded user: ${email}`);
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
