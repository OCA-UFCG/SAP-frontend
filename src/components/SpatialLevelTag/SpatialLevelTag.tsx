import { useTranslations } from "next-intl";
import type { SearchOptionLevel } from "@/components/SearchBar/searchBarUtils";

// Cores da proposta da nova home. A do município é um tom abaixo da proposta
// (#777e32) para o texto branco passar de 4,5:1.
const LEVEL_COLORS: Record<SearchOptionLevel, string> = {
  country: "#432b05",
  state: "#5f662f",
  municipality: "#757b31",
};

/**
 * Etiqueta com o tipo de recorte (País, Estado, Município) de um local. A
 * vírgula escondida separa o tipo do nome no leitor de tela: sem ela, ele lê
 * "Sousa - PBMunicípio".
 */
export function SpatialLevelTag({ level }: { level: SearchOptionLevel }) {
  const t = useTranslations("SpatialLevelTag");

  return (
    <span
      className="shrink-0 rounded-md px-2 py-0.5 text-[0.625rem] font-bold uppercase leading-4 tracking-wide text-white"
      style={{ backgroundColor: LEVEL_COLORS[level] }}
    >
      <span className="sr-only">, </span>
      {t(level)}
    </span>
  );
}
