import { NextResponse } from "next/server";
import { listTemplates } from "@/lib/pdf";

/** Public — list is cached per request. */
export async function GET() {
  const templates = await listTemplates();
  return NextResponse.json({ templates });
}

export const dynamic = "force-dynamic";