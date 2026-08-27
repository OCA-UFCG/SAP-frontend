#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const DEFAULT_TOLERANCE = 0.02;
const COORDINATE_DECIMALS = 3;
const DEFAULT_OUTPUT = "public/data/brazil-cities-overview.json";

function parseArgs(argv) {
  const positional = [];
  const options = { codeProperty: "codarea", tolerance: DEFAULT_TOLERANCE };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--code-property") options.codeProperty = argv[++index];
    else if (arg === "--tolerance") options.tolerance = Number(argv[++index]);
    else positional.push(arg);
  }

  return { ...options, source: positional[0], output: positional[1] ?? DEFAULT_OUTPUT };
}

function simplifyLine(points, tolerance) {
  if (points.length < 3) return points;

  const keep = new Array(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  const stack = [[0, points.length - 1]];

  while (stack.length > 0) {
    const [start, end] = stack.pop();
    if (end - start < 2) continue;

    const [x1, y1] = points[start];
    const [x2, y2] = points[end];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const norm = Math.hypot(dx, dy);

    let farthest = -1;
    let maxDistance = 0;

    for (let index = start + 1; index < end; index += 1) {
      const [x, y] = points[index];
      const distance = norm
        ? Math.abs(dy * x - dx * y + x2 * y1 - y2 * x1) / norm
        : Math.hypot(x - x1, y - y1);

      if (distance > maxDistance) {
        farthest = index;
        maxDistance = distance;
      }
    }

    if (maxDistance > tolerance) {
      keep[farthest] = true;
      stack.push([start, farthest], [farthest, end]);
    }
  }

  return points.filter((_, index) => keep[index]);
}

const boundingRing = (points) => {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const [minX, maxX] = [Math.min(...xs), Math.max(...xs)];
  const [minY, maxY] = [Math.min(...ys), Math.max(...ys)];

  return [
    [minX, minY],
    [maxX, minY],
    [maxX, maxY],
    [minX, maxY],
    [minX, minY],
  ];
};

function simplifyRing(ring, tolerance) {
  const points = ring.map(([x, y]) => [x, y]);
  if (points.length > 1) {
    const [firstX, firstY] = points[0];
    const [lastX, lastY] = points[points.length - 1];
    if (firstX === lastX && firstY === lastY) points.pop();
  }
  if (points.length < 3) return null;

  let farthest = 0;
  let maxDistance = -1;
  for (let index = 1; index < points.length; index += 1) {
    const distance = Math.hypot(
      points[index][0] - points[0][0],
      points[index][1] - points[0][1],
    );
    if (distance > maxDistance) {
      farthest = index;
      maxDistance = distance;
    }
  }

  const head = simplifyLine(points.slice(0, farthest + 1), tolerance);
  const tail = simplifyLine([...points.slice(farthest), points[0]], tolerance);
  const simplified = [...head.slice(0, -1), ...tail.slice(0, -1)];
  const ringPoints = simplified.length >= 3 ? simplified : boundingRing(points);

  return [...ringPoints, ringPoints[0]].map(([x, y]) => [
    Number(x.toFixed(COORDINATE_DECIMALS)),
    Number(y.toFixed(COORDINATE_DECIMALS)),
  ]);
}

function simplifyGeometry(geometry, tolerance) {
  const polygons =
    geometry.type === "Polygon"
      ? [geometry.coordinates]
      : geometry.type === "MultiPolygon"
        ? geometry.coordinates
        : [];

  const rings = polygons
    .map((polygon) => simplifyRing(polygon[0], tolerance))
    .filter(Boolean)
    .map((ring) => [ring]);

  if (rings.length === 0) return null;
  if (rings.length === 1) {
    return { type: "Polygon", coordinates: rings[0] };
  }

  return { type: "MultiPolygon", coordinates: rings };
}

function main() {
  const { source, output, codeProperty, tolerance } = parseArgs(
    process.argv.slice(2),
  );

  if (!source) {
    console.error(
      "Uso: node scripts/build-cities-overview.mjs <geojson-de-municipios> [saida]",
    );
    process.exit(1);
  }

  const collection = JSON.parse(readFileSync(source, "utf-8"));
  const features = [];
  const skipped = [];

  for (const feature of collection.features ?? []) {
    const code = feature.properties?.[codeProperty];
    if (code === undefined || code === null) {
      skipped.push("<sem código>");
      continue;
    }

    const geometry = simplifyGeometry(feature.geometry, tolerance);
    if (!geometry) {
      skipped.push(String(code));
      continue;
    }

    features.push({
      type: "Feature",
      properties: { c: String(code) },
      geometry,
    });
  }

  const payload = JSON.stringify({ type: "FeatureCollection", features });
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, payload);

  const points = features.reduce((total, feature) => {
    const polygons =
      feature.geometry.type === "Polygon"
        ? [feature.geometry.coordinates]
        : feature.geometry.coordinates;
    return (
      total +
      polygons.reduce((sum, polygon) => sum + polygon[0].length, 0)
    );
  }, 0);

  console.log(`fonte:      ${source}`);
  console.log(`saída:      ${output}`);
  console.log(`tolerância: ${tolerance}° (~${(tolerance * 111).toFixed(1)} km)`);
  console.log(`municípios: ${features.length}`);
  console.log(`vértices:   ${points}`);
  console.log(`tamanho:    ${(payload.length / 1e6).toFixed(2)} MB`);
  if (skipped.length > 0) {
    console.warn(`descartados (${skipped.length}): ${skipped.join(", ")}`);
  }
}

main();
