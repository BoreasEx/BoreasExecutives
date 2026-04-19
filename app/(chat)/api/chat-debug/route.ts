import { NextResponse } from "next/server";

function withCors(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  return response;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function GET() {
  return withCors(
    NextResponse.json({
      ok: true,
      route: "chat-debug",
      message: "chat-debug route is live",
      usage: {
        method: "POST",
        bodyShape: {
          messages: [
            {
              role: "user",
              content: "test",
            },
          ],
        },
      },
    })
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    return withCors(
      NextResponse.json({
        ok: true,
        received: body,
      })
    );
  } catch (error) {
    console.error("chat-debug failed", error);

    return withCors(
      NextResponse.json(
        {
          ok: false,
          error: "chat-debug failed",
        },
        { status: 500 }
      )
    );
  }
}