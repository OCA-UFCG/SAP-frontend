// app/api/google-docs-regex/route.ts
import { NextRequest } from "next/server";

const TARGET_REGEX = /seu-padrao/;

export async function GET(request: NextRequest) {
  const docsUrl = process.env.GOOGLE_DOCS_URL

  if (!docsUrl) {
    return Response.json({ error: "Invalid docs URL" }, { status: 400 });
  }

  const response = await fetch(docsUrl, {
    cache: "no-store",
    signal: request.signal,
  });

  if (!response.ok) {
    return Response.json(
      { error: "Não foi possível carregar o documento" },
      { status: response.status }
    );
  }

  const text = await response.text();
  const matches = [...text.matchAll(TARGET_REGEX)].map((match) => match[0]);

  return Response.json({ matches });
}