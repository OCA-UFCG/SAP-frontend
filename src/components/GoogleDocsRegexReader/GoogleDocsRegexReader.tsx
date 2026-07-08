"use client";

import { useState } from "react";

export function GoogleDocsRegexReader({city, state, month, year}) {
  const [matches, setMatches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/docs");
      const contentType = response.headers.get("content-type");
      const data = contentType?.includes("application/json")
        ? await response.json()
        : null;

      if (!response.ok || !data) {
        const message = data?.error ?? "Não foi possível buscar o documento";
        setError(message);
        console.error(message);
        return;
      }

      setMatches(data.matches);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro inesperado na busca";

      setError(message);
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button onClick={handleSearch} disabled={loading}>
        {loading ? "Buscando..." : "Buscar matches"}
      </button>

      {error && <p>{error}</p>}

      <ul>
        {matches.map((match, index) => (
          <li key={`${match}-${index}`}>{match}</li>
        ))}
      </ul>
    </div>
  );
}
