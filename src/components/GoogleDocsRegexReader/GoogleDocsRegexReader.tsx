"use client";

import { useState } from "react";

export function GoogleDocsRegexReader() {
  const [matches, setMatches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleSearch() {
    setLoading(true);

    try {
      const response = await fetch("/api/docs");

      const data = await response.json();

      if (!response.ok) {
        console.error(data.error);
        return;
      }

      setMatches(data.matches);
      console.log(matches)
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button onClick={handleSearch} disabled={loading}>
        {loading ? "Buscando..." : "Buscar matches"}
      </button>

      <ul>
        {matches.map((match, index) => (
          <li key={`${match}-${index}`}>{match}</li>
        ))}
      </ul>
    </div>
  );
}