type DocsThemeRouteContext = {
  params: Promise<{
    theme: string;
  }>;
};


export async function GET(request: Request, context: DocsThemeRouteContext) {
  const { theme } = await context.params;
  const envKey = `DOCS_${theme}`;
  const docsUrl = process.env[envKey];

  if (!docsUrl) {
    return Response.json(
      { error: `Invalid docs URL for theme: ${theme}` },
      { status: 400 },
    );
  }

  const response = await fetch(docsUrl, {
    cache: "no-store",
    signal: request.signal,
  });

  if (!response.ok) {
    return Response.json(
      { error: "Não foi possível carregar o documento" },
      { status: response.status },
    );
  }

  try {
    const text = await response.text();

    return Response.json({ text });
  } catch (error) {
    console.error(error);

    return Response.json(
      { error: "Error while processing the docs" },
      { status: 500 },
    );
  }
}
