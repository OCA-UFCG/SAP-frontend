import { NextResponse } from "next/server";
import {
  createFirebaseSessionCookie,
  SESSION_COOKIE_MAX_AGE_SECONDS,
  SESSION_COOKIE_NAME,
} from "@/lib/server-session";
import { settleSignup } from "@/lib/signup-settlement";

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

    let creation = await createFirebaseSessionCookie(token);

    // Segunda chance antes de recusar: quem confirma o endereço e fecha a aba
    // nunca volta à nossa página de confirmação, então o cadastro nunca é
    // fechado — e no trilho institucional o acesso automático simplesmente não
    // acontece, sem nenhum caminho de recuperação. O login fecha por ela.
    if (
      creation.status === "unapproved" &&
      creation.emailVerified &&
      creation.email
    ) {
      const settlement = await settleSignup({
        uid: creation.uid,
        email: creation.email,
        emailVerified: true,
      });

      if (settlement === "approved") {
        creation = await createFirebaseSessionCookie(token);
      }
    }

    // Credenciais certas, acesso ainda não liberado. É um desfecho diferente de
    // "senha errada", e o cliente precisa distingui-los para levar a pessoa à
    // página de espera em vez de repetir o formulário de login.
    if (creation.status === "unapproved") {
      return NextResponse.json(
        {
          error: "Cadastro ainda não liberado.",
          code: "access_pending",
        },
        { status: 403 },
      );
    }

    const response = NextResponse.json({ success: true });

    response.cookies.set(SESSION_COOKIE_NAME, creation.sessionCookie, {
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
