/**
 * Enquadramento inicial do mapa da plataforma. Monitoramento e Análise sempre
 * abriram no mesmo ponto e no mesmo zoom; com uma instância só de mapa entre as
 * duas, os valores passam a ter um lugar único.
 */
export const PLATFORM_MAP_CENTER: [number, number] = [-15.749997, -47.9499962];
export const PLATFORM_MAP_INITIAL_ZOOM = 4;
export const PLATFORM_MAP_MIN_ZOOM = 3;
