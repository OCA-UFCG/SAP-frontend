"use client";

import { useState } from "react";
import MapComponent from "@/components/Map/MapComponent";

/**
 * Demo page to test the GEE API route.
 * Fetches a tile URL from /api/ee and renders it on the map.
 */

const SAMPLE_PAYLOAD = {
  id: "ods",
  name: "Dinâmica da Degradação da Terra - ODS 15.3.1",
  description:
    "O Objetivo do Desenvolvimento Sustentável 15.3, visa o progresso em direção a um mundo neutro de degradação da terra sendo avaliado pelo indicador 15.3.1 que expressa a dinâmica da degradação da terra, a partir de informaçoes de cobertura da terra, carbono orgânico do solo e produtividade do solo.",
  measurementUnit: "classes",
  type: "Ambiental",
  minScale: 1,
  maxScale: 3,
  imageData: {
    general: {
      default: true,
      imageId: "projects/ee-ocaufcg/assets/ODS_15_3_1",
      imageParams: [
        {
          color: "#9b2779",
          label: "Degradando",
          pixelLimit: 9,
        },
        {
          color: "#ffffe0",
          label: "Estável",
          pixelLimit: 10,
        },
        {
          color: "#006500",
          label: "Melhorando",
        },
      ],
    },
  },
};

const DEMO_NAME = "ods";
const DEMO_YEAR = "general";

export default function DemoGeePage() {
  const [tileUrl, setTileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFetch = async () => {
    setLoading(true);
    setError(null);
    setTileUrl(null);

    try {
      console.log("📡 Sending POST to /api/ee ...");

      const res = await fetch(
        `/api/ee?name=${DEMO_NAME}&year=${DEMO_YEAR}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(SAMPLE_PAYLOAD),
        },
      );

      const data = await res.json();

      console.log("✅ Response status:", res.status);
      console.log("✅ Response data:", data);

      if (data.url) {
        setTileUrl(data.url);
      } else {
        setError("GEE returned null – check server logs");
      }
    } catch (err: any) {
      console.error("❌ Request failed:", err);
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ padding: "2rem", maxWidth: 1000, margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem", fontFamily: "monospace" }}>
        🌍 GEE Map Demo
      </h1>
      <p style={{ color: "#666", marginBottom: "1rem", fontFamily: "monospace", fontSize: "0.85rem" }}>
        Fetches a GEE tile URL and renders it as a raster overlay on the map.
      </p>

      <button
        onClick={handleFetch}
        disabled={loading}
        style={{
          padding: "0.75rem 1.5rem",
          fontSize: "1rem",
          cursor: loading ? "wait" : "pointer",
          backgroundColor: loading ? "#999" : "#1a73e8",
          color: "#fff",
          border: "none",
          borderRadius: "8px",
          marginBottom: "1rem",
        }}
      >
        {loading
          ? "⏳ Carregando tiles do GEE..."
          : tileUrl
            ? "🔄 Recarregar"
            : "🚀 Carregar camada GEE"}
      </button>

      {error && (
        <pre
          style={{
            background: "#fdecea",
            color: "#b71c1c",
            padding: "1rem",
            borderRadius: "8px",
            whiteSpace: "pre-wrap",
            fontFamily: "monospace",
            marginBottom: "1rem",
          }}
        >
          ❌ {error}
        </pre>
      )}

      {tileUrl && (
        <p
          style={{
            fontFamily: "monospace",
            fontSize: "0.75rem",
            color: "#388e3c",
            marginBottom: "1rem",
            wordBreak: "break-all",
          }}
        >
          ✅ Tile URL loaded — rendering on map below
        </p>
      )}

      {/* Map container — mirrors MapSection's layout so the Map gets proper dimensions */}
      <div className="flex flex-col h-[550px]">
        <div className="relative flex w-full h-full rounded-2xl overflow-hidden border border-neutral-200 shadow-sm">
          <MapComponent
            center={[-15.749997, -47.9499962]}
            zoom={4}
            estadoSelecionado="BR"
            className="w-full h-full"
            tileLayerUrl={tileUrl}
          />
        </div>
      </div>
    </main>
  );
}
