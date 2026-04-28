export const BRAZIL_TERRITORY_CODE = "BR";

export function resolveNextSelectedState(
  currentSelectedState: string | null | undefined,
  clickedStateUf: string,
): string {
  const normalizedClickedState = clickedStateUf.trim().toUpperCase();
  const normalizedCurrentState =
    currentSelectedState?.trim().toUpperCase() ?? BRAZIL_TERRITORY_CODE;

  return normalizedCurrentState === normalizedClickedState
    ? BRAZIL_TERRITORY_CODE
    : normalizedClickedState;
}
