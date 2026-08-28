import { NextResponse } from "next/server";
import { getSessionUserStrict } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUserStrict();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 200 });
  }
  return NextResponse.json({ user });
}
