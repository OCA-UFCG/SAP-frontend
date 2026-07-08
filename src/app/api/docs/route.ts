import { NextRequest } from "next/server";

const BLOCK_SEPARATOR_REGEX = /(?:\r?\n\s*){2,}/g;

export async function GET(request: NextRequest) {
  const docsUrl = process.env.GOOGLE_DOCS_URL;

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

  try {
    const text = await response.text();
    const matches = text
      .split(BLOCK_SEPARATOR_REGEX)
      .map((block) => block.trim())
      .filter(Boolean);

    return Response.json({ matches });
  } catch (error) {
    console.error(error);

    return Response.json(
      { error: "Error while processing the docs" },
      { status: 500 }
    );
  }
}
