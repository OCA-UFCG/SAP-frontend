export const GEE_STATISTICS_LAYER_IDS = ["carbonoembrapa"] as const;

export function isGeeStatisticsLayerId(panelLayerId: string): boolean {
  return GEE_STATISTICS_LAYER_IDS.some((layerId) => layerId === panelLayerId);
}
