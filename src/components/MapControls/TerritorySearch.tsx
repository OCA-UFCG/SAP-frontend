"use client";

import { useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/Icon/Icon";
import {
  REFERENCE_LAYER_SWATCHES,
  type ReferenceLayerId,
} from "@/components/MapLayerContext/mapLayerState";
import { MAP_CONTROL_LABEL_CLASS } from "./MapControlCard";
import {
  loadReferenceTerritories,
  searchReferenceTerritories,
  type ReferenceTerritory,
} from "./referenceTerritories";

// O cinza do texto de apoio. Não sai de MAP_CONTROL_LABEL_CLASS porque as duas
// cores de texto disputariam a mesma propriedade.
const SECONDARY_TEXT_CLASS =
  "font-open-sans text-[10px] leading-[14px] tracking-[-0.006em] text-[#6B6B6B]";

type LoadStatus = "idle" | "loading" | "ready" | "error";

interface TerritorySearchProps {
  activeOverlays: ReadonlySet<ReferenceLayerId>;
  onSelect: (territory: ReferenceTerritory) => void;
}

/**
 * Campo de busca por nome dentro do cartão de Territórios. Com alguma camada
 * ligada busca só nela; com todas desligadas busca em todas. A lista só é
 * baixada quando a pessoa clica no campo, e escolher um resultado leva o mapa
 * até o território.
 */
export function TerritorySearch({
  activeOverlays,
  onSelect,
}: TerritorySearchProps) {
  const t = useTranslations("PlatformMap");
  const listId = useId();
  const [query, setQuery] = useState("");
  const [territories, setTerritories] = useState<ReferenceTerritory[]>([]);
  const [status, setStatus] = useState<LoadStatus>("idle");
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo(
    () => searchReferenceTerritories(territories, query, activeOverlays),
    [territories, query, activeOverlays],
  );
  const showResults = query.trim().length >= 2;

  const startLoading = () => {
    if (status === "loading" || status === "ready") return;
    setStatus("loading");
    loadReferenceTerritories()
      .then((loaded) => {
        setTerritories(loaded);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  };

  const select = (territory: ReferenceTerritory) => {
    onSelect(territory);
    setQuery("");
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && results.length > 0) {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp" && results.length > 0) {
      event.preventDefault();
      setActiveIndex(
        (index) => (index - 1 + results.length) % results.length,
      );
    } else if (event.key === "Enter" && results[activeIndex]) {
      event.preventDefault();
      select(results[activeIndex]);
    } else if (event.key === "Escape") {
      setQuery("");
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 rounded-md border border-[#E4E4E4] bg-[#F7F7F6] px-2 py-1.5 focus-within:border-[#989F43]">
        <Icon id="loupe" className="shrink-0" fill="#898989" size={12} />
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          onFocus={startLoading}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-label={t("territorySearchLabel")}
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={showResults && results.length > 0}
          aria-activedescendant={
            showResults && results[activeIndex]
              ? `${listId}-${activeIndex}`
              : undefined
          }
          placeholder={t("territorySearchPlaceholder")}
          className="w-full min-w-0 bg-transparent font-open-sans text-[11px] text-[#292829] outline-none placeholder:text-[#898989]"
        />
      </div>

      {showResults && (
        <TerritorySearchResults
          listId={listId}
          status={status}
          results={results}
          activeIndex={activeIndex}
          onHover={setActiveIndex}
          onSelect={select}
        />
      )}
    </div>
  );
}

function TerritorySearchResults({
  listId,
  status,
  results,
  activeIndex,
  onHover,
  onSelect,
}: {
  listId: string;
  status: LoadStatus;
  results: ReferenceTerritory[];
  activeIndex: number;
  onHover: (index: number) => void;
  onSelect: (territory: ReferenceTerritory) => void;
}) {
  const t = useTranslations("PlatformMap");
  const message =
    status === "error"
      ? t("territorySearchError")
      : status !== "ready"
        ? t("territorySearchLoading")
        : results.length === 0
          ? t("territorySearchNoResults")
          : null;

  if (message) {
    return (
      <p className={`${SECONDARY_TEXT_CLASS} px-1`}>
        {message}
      </p>
    );
  }

  return (
    <ul
      id={listId}
      role="listbox"
      className="flex max-h-56 flex-col overflow-y-auto border-b border-[#EFEFEF] pb-1.5"
    >
      {results.map((territory, index) => {
        const swatch = REFERENCE_LAYER_SWATCHES[territory.layerId];
        const place = [territory.municipality, territory.uf]
          .filter(Boolean)
          .join(" · ");

        return (
          <li
            key={`${territory.layerId}-${territory.name}-${territory.bounds.join()}`}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={index === activeIndex}
            onMouseEnter={() => onHover(index)}
            // mousedown, e não click: o campo não perde o foco antes da escolha.
            onMouseDown={(event) => {
              event.preventDefault();
              onSelect(territory);
            }}
            className={`flex cursor-pointer items-start gap-2 rounded px-1 py-1 ${
              index === activeIndex ? "bg-[#F1F2EC]" : ""
            }`}
          >
            <span
              aria-hidden="true"
              className="mt-[3px] h-3 w-3 shrink-0 rounded-[2px] border-[1.5px]"
              style={{ borderColor: swatch.outline, background: swatch.fill }}
            />
            <span className="flex min-w-0 flex-col">
              <span
                className={`${MAP_CONTROL_LABEL_CLASS} truncate font-semibold`}
              >
                {territory.name}
              </span>
              <span className={`${SECONDARY_TEXT_CLASS} truncate`}>
                {t(territory.layerId)}
                {place && ` · ${place}`}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
