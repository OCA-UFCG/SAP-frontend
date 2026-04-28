import { BRAZIL_TERRITORY_CODE } from "./stateSelection";

type ScrollZoomHandlerLike = {
  disable(): void;
  enable(options?: boolean | { around: "center" }): void;
};

const normalizeSelectedState = (selectedState: string | null | undefined) =>
  selectedState?.trim().toUpperCase() || BRAZIL_TERRITORY_CODE;

export const shouldZoomAroundSelectedState = (
  selectedState: string | null | undefined,
) => normalizeSelectedState(selectedState) !== BRAZIL_TERRITORY_CODE;

export const getSelectionAwareScrollZoomOptions = (
  selectedState: string | null | undefined,
): true | { around: "center" } =>
  shouldZoomAroundSelectedState(selectedState) ? { around: "center" } : true;

export const syncSelectionAwareScrollZoom = (
  scrollZoom: ScrollZoomHandlerLike,
  selectedState: string | null | undefined,
) => {
  const options = getSelectionAwareScrollZoomOptions(selectedState);

  scrollZoom.disable();

  if (options === true) {
    scrollZoom.enable();
    return options;
  }

  scrollZoom.enable(options);
  return options;
};
