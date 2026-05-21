import { NextResponse } from "next/server";
import {
  createFirebaseSessionCookie,
  SESSION_COOKIE_MAX_AGE_SECONDS,
  SESSION_COOKIE_NAME,
} from "@/lib/server-session";

function isFirebaseAdminConfigurationError(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  return (
    message.includes("Firebase Admin credentials are not set") ||
    message.includes("Failed to parse private key") ||
    message.includes("Invalid PEM formatted message")
  );
}

export async function POST(req: Request) {
  try {
    const { token } = (await req.json()) as { token?: unknown };

    if (typeof token !== "string" || !token) {
      return NextResponse.json(
        { error: "Missing Firebase ID token." },
        { status: 400 },
      );
    }

    const sessionCookie = await createFirebaseSessionCookie(token);
    const response = NextResponse.json({ success: true });

    response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
    });

    return response;
  } catch (error) {
    console.error("Failed to create Firebase session cookie.", error);

    if (isFirebaseAdminConfigurationError(error)) {
      return NextResponse.json(
        { error: "Session service unavailable." },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "Unauthorized access." },
      { status: 401 },
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });

  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  response.cookies.set("token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
