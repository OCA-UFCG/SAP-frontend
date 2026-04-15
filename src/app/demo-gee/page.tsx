"use client";

import { useState, useEffect } from "react";
import MapComponent from "@/components/Map/MapComponent";
import { PanelLayerI } from "@/utils/interfaces";
import { GET_PANEL_LAYER } from "@/utils/queries";

/**
 * Demo page to test the GEE API route using real Contentful panelLayer data.
 * Fetches panelLayers from Contentful, lets the user pick one, and renders the GEE tile on the map.
 */

async function fetchPanelLayers(): Promise<PanelLayerI[]> {
    const spaceId = process.env.NEXT_PUBLIC_CONTENTFUL_SPACE_ID;
    const token = process.env.NEXT_PUBLIC_CONTENTFUL_ACCESS_TOKEN;

    const res = await fetch(
        `https://graphql.contentful.com/content/v1/spaces/${spaceId}`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ query: GET_PANEL_LAYER }),
        },
    );

    const json = await res.json();
    return json?.data?.panelLayerCollection?.items ?? [];
}

export default function DemoGeePage() {
    const [panelLayers, setPanelLayers] = useState<PanelLayerI[]>([]);
    const [selectedId, setSelectedId] = useState<string>("");
    const [tileUrl, setTileUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loadingLayers, setLoadingLayers] = useState(true);

    // Load panel layers from Contentful on mount
    useEffect(() => {
        fetchPanelLayers()
            .then((layers) => {
                const withImageData = layers.filter((l) => l.imageData);
                setPanelLayers(withImageData);
                if (withImageData.length > 0) {
                    setSelectedId(withImageData[0].id);
                }
            })
            .catch((err) => setError(err.message))
            .finally(() => setLoadingLayers(false));
    }, []);

    const selectedLayer = panelLayers.find((l) => l.id === selectedId);

    const handleFetch = async () => {
        if (!selectedLayer?.imageData) return;

        setLoading(true);
        setError(null);
        setTileUrl(null);

        try {
            const years = Object.keys(selectedLayer.imageData);
            const year = years.includes("general") ? "general" : years[0];

            console.log(`📡 POST /api/ee?name=${selectedLayer.id}&year=${year}`);

            const res = await fetch(
                `/api/ee?name=${selectedLayer.id}&year=${year}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(selectedLayer),
                },
            );

            const data = await res.json();

            console.log("✅ Response status:", res.status);
            console.log("✅ Response data:", data);

            if (data.url) {
                setTileUrl(data.url);
            } else {
                setError("GEE returned no URL — check server logs");
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
                Fetches a GEE tile URL from a real Contentful panelLayer and renders it on the map.
            </p>

            {loadingLayers ? (
                <p style={{ fontFamily: "monospace", color: "#999" }}>⏳ Carregando camadas do Contentful...</p>
            ) : panelLayers.length === 0 ? (
                <p style={{ fontFamily: "monospace", color: "#b71c1c" }}>❌ Nenhuma camada com imageData encontrada no Contentful.</p>
            ) : (
                <>
                    <div style={{ marginBottom: "1rem", display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
                        <label htmlFor="layer-select" style={{ fontFamily: "monospace", fontSize: "0.9rem" }}>
                            Camada:
                        </label>
                        <select
                            id="layer-select"
                            value={selectedId}
                            onChange={(e) => {
                                setSelectedId(e.target.value);
                                setTileUrl(null);
                                setError(null);
                            }}
                            style={{
                                padding: "0.5rem 0.75rem",
                                fontFamily: "monospace",
                                fontSize: "0.9rem",
                                border: "1px solid #ccc",
                                borderRadius: "6px",
                            }}
                        >
                            {panelLayers.map((l) => (
                                <option key={l.id} value={l.id}>
                                    {l.name} ({l.id})
                                </option>
                            ))}
                        </select>

                        <button
                            id="load-gee-button"
                            onClick={handleFetch}
                            disabled={loading || !selectedLayer}
                            style={{
                                padding: "0.5rem 1.25rem",
                                fontSize: "0.95rem",
                                cursor: loading ? "wait" : "pointer",
                                backgroundColor: loading ? "#999" : "#1a73e8",
                                color: "#fff",
                                border: "none",
                                borderRadius: "8px",
                            }}
                        >
                            {loading
                                ? "⏳ Carregando..."
                                : tileUrl
                                    ? "🔄 Recarregar"
                                    : "🚀 Carregar camada GEE"}
                        </button>
                    </div>

                    {selectedLayer && (
                        <p style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#555", marginBottom: "0.75rem" }}>
                            Anos disponíveis: {Object.keys(selectedLayer.imageData ?? {}).join(", ")}
                        </p>
                    )}
                </>
            )}

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
