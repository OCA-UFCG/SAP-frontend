const MAX_FIELD_LENGTH = 60;

/**
 * O mesmo índice calculado com bases de dados diferentes.
 *
 * O Índice de Aridez existe com dados do BR-DWGD e do ERA5 Land: são dois
 * `panelLayer`, mas para quem consulta é um índice só, em que se escolhe a
 * fonte. Os índices com o mesmo `group` viram um cartão só no Monitoramento,
 * com esse nome, e o Detalhamento mostra `source` como opção do seletor
 * "Fonte dos dados".
 *
 * @example
 * const sourceGroup: PanelLayerSourceGroup = {
 *   group: "Índice de Aridez",
 *   source: "BR-DWGD",
 * };
 */
export interface PanelLayerSourceGroup {
  /** O nome do cartão que junta as fontes: "Índice de Aridez". */
  group: string;
  /** A base de dados deste índice dentro do grupo: "BR-DWGD", "ERA5 Land". */
  source: string;
}

const FIELD_LABELS: Record<keyof PanelLayerSourceGroup, string> = {
  group: "Nome do índice no Monitoramento",
  source: "Fonte dos dados",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readField(
  value: Record<string, unknown>,
  key: keyof PanelLayerSourceGroup,
) {
  const raw = value[key];
  return typeof raw === "string" ? raw.trim() : "";
}

/**
 * Valida o que foi digitado no catálogo. Os dois vazios significam "não está
 * num grupo" e devolvem `undefined`; preencher só um é erro, porque o índice
 * ficaria fora do grupo sem ninguém notar.
 *
 * @example
 * parseSourceGroupInput({ group: "Índice de Aridez", source: "" });
 * // Error: Preencha também Fonte dos dados.
 */
export function parseSourceGroupInput(
  value: unknown,
): PanelLayerSourceGroup | undefined {
  if (value == null) return undefined;
  if (!isRecord(value)) throw new Error("Grupo de fontes inválido.");

  const sourceGroup = {
    group: readField(value, "group"),
    source: readField(value, "source"),
  };
  const keys = Object.keys(sourceGroup) as Array<keyof PanelLayerSourceGroup>;
  const missing = keys.filter((key) => !sourceGroup[key]);

  if (missing.length === keys.length) return undefined;
  if (missing.length > 0) {
    throw new Error(`Preencha também ${FIELD_LABELS[missing[0]]}.`);
  }

  const tooLong = keys.find(
    (key) => sourceGroup[key].length > MAX_FIELD_LENGTH,
  );
  if (tooLong) {
    throw new Error(
      `${FIELD_LABELS[tooLong]} aceita até ${MAX_FIELD_LENGTH} caracteres.`,
    );
  }

  return sourceGroup;
}

/**
 * A leitura do que veio publicado: um valor inválido vira `null` em vez de
 * derrubar a lista de camadas, e o índice aparece como um cartão comum.
 */
export function tryParsePanelLayerSourceGroup(
  value: unknown,
): PanelLayerSourceGroup | null {
  try {
    return parseSourceGroupInput(value) ?? null;
  } catch {
    return null;
  }
}
