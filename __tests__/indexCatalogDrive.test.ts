import { describe, expect, it } from "vitest";
import {
  getCatalogClassColumns,
  getCatalogRowPeriod,
  inferCatalogDriveRole,
  inspectCatalogCsvRows,
} from "@/utils/indexCatalogDrive";

describe("index catalog Drive inspection", () => {
  it("detects panel, municipality and multilevel roles", () => {
    expect(
      inferCatalogDriveRole([
        "location_key",
        "location_name",
        "valor_classe_1",
      ]),
    ).toBe("panel");
    expect(
      inferCatalogDriveRole(["CD_MUN", "NM_MUN", "SIGLA_UF"]),
    ).toBe("municipal");
    expect(
      inferCatalogDriveRole(["NIVEL_AGRUPAMENTO", "NOME_LOCAL"]),
    ).toBe("multilevel");
  });

  it("detects ordered class columns and periods", () => {
    expect(
      getCatalogClassColumns([
        "perc_classe_3",
        "perc_classe_1",
        "perc_classe_2",
      ]),
    ).toEqual(["perc_classe_1", "perc_classe_2", "perc_classe_3"]);
    expect(getCatalogRowPeriod({ data_img: "2026-07-15" })).toBe("2026-07");
    expect(getCatalogRowPeriod({ ano: "2025" })).toBe("2025");
  });

  it("blocks unknown territorial contracts with a visible warning", () => {
    const inspection = inspectCatalogCsvRows([
      { ano: "2025", valor_classe_1: "10" },
    ]);
    expect(inspection.role).toBe("unsupported");
    expect(inspection.warnings).toContain(
      "Formato territorial não reconhecido pela pipeline.",
    );
  });
});
