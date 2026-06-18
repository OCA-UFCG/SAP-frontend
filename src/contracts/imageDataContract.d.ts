import type { CompactTerritorialAnalysisDataset } from "@/utils/analysis";

export const TERRITORIAL_COMPACT_SCHEMA_VERSION: 1;

export type ImageDataContractContext =
  | "runtimeRead"
  | "panelLayerPublish"
  | "municipalPatch"
  | "compressedMunicipalPatch";

export interface ImageDataContractOptions {
  context?: ImageDataContractContext;
}

export interface ImageDataContractValidation {
  ok: boolean;
  errors: string[];
}

export function validateImageDataContract(
  value: unknown,
  options?: ImageDataContractOptions,
): ImageDataContractValidation;

export function assertValidImageDataContract(
  value: unknown,
  options?: ImageDataContractOptions,
): unknown;

export function isCompactTerritorialImageData(
  value: unknown,
): value is CompactTerritorialAnalysisDataset;

export function isLegacyImageDataMap(value: unknown): boolean;

export function validateCompressedTerritorialEnvelope(
  value: unknown,
): ImageDataContractValidation;
