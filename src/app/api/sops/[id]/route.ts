import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ error: "SOPs have moved to the knowledge library." }, { status: 410 });
}
