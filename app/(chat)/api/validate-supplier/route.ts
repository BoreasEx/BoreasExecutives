import { NextRequest, NextResponse } from "next/server";
import { validateSupplierName } from "@/lib/suppliers";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = typeof body?.input === "string" ? body.input : "";

    if (!input.trim()) {
      return NextResponse.json(
        { error: "Missing supplier input" },
        { status: 400 }
      );
    }

    const result = validateSupplierName(input);

    return NextResponse.json(result);
  } catch (error) {
    console.error("validate-supplier error:", error);

    return NextResponse.json(
      { error: "Failed to validate supplier" },
      { status: 500 }
    );
  }
}