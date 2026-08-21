import fs from "node:fs";
import path from "node:path";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import type { SpatialArea, SpatialSelection } from "@/utils/spatialScope";

type BoundaryArea = Exclude<SpatialArea, "national">;
export type SpatialBoundaryFeature = Feature<Geometry, { name: string }>;

type SpatialBoundaryIndex = ReadonlyMap<
  BoundaryArea,
  ReadonlyMap<string, SpatialBoundaryFeature>
>;

const BOUNDARY_CONFIG: Record<
  BoundaryArea,
  { fileName: string; expectedNames: readonly string[] }
> = {
  region: {
    fileName: "regionBoundaries.json",
    expectedNames: ["Centro-Oeste", "Nordeste", "Norte", "Sudeste", "Sul"],
  },
  biome: {
    fileName: "biomeBoundaries.json",
    expectedNames: [
      "Amazônia",
      "Caatinga",
      "Cerrado",
      "Mata Atlântica",
      "Pampa",
      "Pantanal",
    ],
  },
  semiarid: {
    fileName: "semiaridBoundary.json",
    expectedNames: ["semiárido"],
  },
  asd: {
    fileName: "asdBoundary.json",
    expectedNames: ["ASD", "Entorno"],
  },
  state: {
    fileName: "geometria.json",
    expectedNames: [
      "Acre",
      "Alagoas",
      "Amapá",
      "Amazonas",
      "Bahia",
      "Ceará",
      "Distrito Federal",
      "Espírito Santo",
      "Goiás",
      "Maranhão",
      "Mato Grosso",
      "Mato Grosso do Sul",
      "Minas Gerais",
      "Pará",
      "Paraíba",
      "Paraná",
      "Pernambuco",
      "Piauí",
      "Rio de Janeiro",
      "Rio Grande do Norte",
      "Rio Grande do Sul",
      "Rondônia",
      "Roraima",
      "Santa Catarina",
      "São Paulo",
      "Sergipe",
      "Tocantins",
    ],
  },
};

const isFeatureCollection = (
  value: unknown,
): value is FeatureCollection<Geometry, { name?: unknown }> => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<FeatureCollection>;
  return (
    candidate.type === "FeatureCollection" && Array.isArray(candidate.features)
  );
};

function parseBoundaryFile(
  area: BoundaryArea,
  fileName: string,
  rawFile: string,
) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawFile);
  } catch (error) {
    throw new Error(`Invalid boundary JSON in ${fileName}.`, { cause: error });
  }

  if (!isFeatureCollection(parsed)) {
    throw new Error(`${fileName} must contain a GeoJSON FeatureCollection.`);
  }

  const featuresByName = new Map<string, SpatialBoundaryFeature>();
  for (const feature of parsed.features) {
    const rawProperties = feature.properties as { name?: string; info?: { nome?: string } } | null;
    const name = rawProperties?.name ?? rawProperties?.info?.nome;
    if (
      feature.type !== "Feature" ||
      !feature.geometry ||
      typeof name !== "string" ||
      !name.trim()
    ) {
      throw new Error(
        `${fileName} contains a feature without geometry or properties.name.`,
      );
    }
    if (featuresByName.has(name)) {
      throw new Error(`${fileName} contains duplicate boundary ${name}.`);
    }
    featuresByName.set(name, {
      ...feature,
      properties: { ...feature.properties, name },
    } as SpatialBoundaryFeature);
  }

  for (const expectedName of BOUNDARY_CONFIG[area].expectedNames) {
    if (!featuresByName.has(expectedName)) {
      throw new Error(
        `${fileName} is missing the configured boundary ${expectedName}.`,
      );
    }
  }

  return featuresByName;
}

export function loadSpatialBoundaryIndex({
  dataDirectory = path.join(process.cwd(), "src", "data"),
  readFile = (filePath: string) => fs.readFileSync(filePath, "utf8"),
}: {
  dataDirectory?: string;
  readFile?: (filePath: string) => string;
} = {}): SpatialBoundaryIndex {
  const index = new Map<
    BoundaryArea,
    ReadonlyMap<string, SpatialBoundaryFeature>
  >();

  for (const [area, config] of Object.entries(BOUNDARY_CONFIG) as Array<
    [BoundaryArea, (typeof BOUNDARY_CONFIG)[BoundaryArea]]
  >) {
    const filePath = path.join(dataDirectory, config.fileName);
    let rawFile: string;
    try {
      rawFile = readFile(filePath);
    } catch (error) {
      throw new Error(`Unable to load spatial boundary ${config.fileName}.`, {
        cause: error,
      });
    }
    index.set(area, parseBoundaryFile(area, config.fileName, rawFile));
  }

  return index;
}

let boundaryIndex: SpatialBoundaryIndex | null = null;

const getBoundaryIndex = () => {
  boundaryIndex ??= loadSpatialBoundaryIndex();
  return boundaryIndex;
};

export function getSpatialBoundaryFeatures(
  selection: Exclude<SpatialSelection, { spatialArea: "national" }>,
): readonly SpatialBoundaryFeature[] {
  const featuresByName = getBoundaryIndex().get(selection.spatialArea);
  if (!featuresByName) {
    throw new Error(
      `No boundary collection configured for ${selection.spatialArea}.`,
    );
  }

  const featureNames =
    selection.spatialArea === "asd"
      ? ["ASD", "Entorno"]
      : [selection.spatialValue];
  return featureNames.map((name) => {
    const feature = featuresByName.get(name);
    if (!feature) {
      throw new Error(
        `Boundary ${name} is not available for ${selection.spatialArea}.`,
      );
    }
    return feature;
  });
}

export function getAllSpatialBoundaryFeaturesForArea(
  area: BoundaryArea,
): readonly SpatialBoundaryFeature[] {
  const featuresByName = getBoundaryIndex().get(area);
  if (!featuresByName) {
    throw new Error(
      `No boundary collection configured for ${area}.`,
    );
  }
  return Array.from(featuresByName.values());
}

