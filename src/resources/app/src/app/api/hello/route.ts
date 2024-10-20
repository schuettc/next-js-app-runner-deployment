import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ message: "Hello from the API!" });
}

export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json({ message: "Hello from the API!", data: body });
}
