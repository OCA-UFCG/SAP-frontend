import type { SearchSelectionMethod } from "@/types/telemetry";

export interface SearchSubmissionMetadata {
  selectionMethod: SearchSelectionMethod;
  visibleOptionCount: number;
}

export interface SearchTelemetryContext {
  activeLayerId: string;
  activeLayerName?: string;
  activeDateLabel: string;
}
