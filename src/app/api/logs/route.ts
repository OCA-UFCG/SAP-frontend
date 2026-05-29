import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/server-session";
import { ingestTelemetryEvents } from "@/services/telemetry/telemetryService";
import { TelemetryValidationError } from "@/types/telemetry";

function isFirebaseAdminConfigurationError(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  return (
    message.includes("Firebase Admin credentials are not set") ||
    message.includes("Failed to parse private key") ||
    message.includes("Invalid PEM formatted message")
  );
}

export async function POST(req: Request) {
  let payload: unknown;

  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const uid = await getAuthenticatedUserId(req);
    const result = await ingestTelemetryEvents(payload, { uid });

    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    if (error instanceof TelemetryValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (isFirebaseAdminConfigurationError(error)) {
      return NextResponse.json(
        { error: "Logs service unavailable." },
        { status: 503 },
      );
    }

    console.error("Failed to record log event.", error);

    return NextResponse.json(
      { error: "Failed to record logs." },
      { status: 500 },
    );
  }
}
