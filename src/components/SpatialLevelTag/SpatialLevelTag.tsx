import { useTranslations } from "next-intl";
import type { SearchOptionLevel } from "@/components/SearchBar/searchBarUtils";

// País, estado e município: cores da proposta da nova home. A do município é
// um tom abaixo da proposta (#777e32) para o texto branco passar de 4,5:1.
// Os demais recortes vêm das amostras de Territórios do mapa; o verde do bioma
// é um tom abaixo do #588157 da legenda, que ficava em 4,48:1.
const LEVEL_COLORS: Record<SearchOptionLevel, string> = {
  country: "#432b05",
  region: "#325967",
  state: "#5f662f",
  biome: "#4c7150",
  semiarid: "#7E692C",
  asd: "#973D2B",
  municipality: "#757b31",
};

/**
 * Etiqueta com o tipo de recorte (País, Região, Estado, Bioma...) de um local. A
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
