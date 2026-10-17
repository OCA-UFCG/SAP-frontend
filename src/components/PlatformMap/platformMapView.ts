/**
 * Enquadramento inicial do mapa da plataforma. Monitoramento e Análise sempre
 * abriram no mesmo ponto e no mesmo zoom; com uma instância só de mapa entre as
 * duas, os valores passam a ter um lugar único.
 */
export const PLATFORM_MAP_CENTER: [number, number] = [-15.749997, -47.9499962];
export const PLATFORM_MAP_INITIAL_ZOOM = 4;
export const PLATFORM_MAP_MIN_ZOOM = 3;

/**
 * No celular até o zoom 3 deixa o Brasil mais largo que a tela (~440px), e
 * Brasília não é o meio do país: sem o painel ao lado para compensar, o mapa
 * abria mostrando só um pedaço. Com 2,6 o país inteiro cabe em ~340px.
 */
export const PLATFORM_MAP_PHONE_CENTER: [number, number] = [-14.2, -53.1];
export const PLATFORM_MAP_PHONE_INITIAL_ZOOM = 2.6;
export const PLATFORM_MAP_PHONE_MIN_ZOOM = 2.4;

/** O mesmo corte do `md` do Tailwind, abaixo do qual a plataforma vira celular. */
export function isPhoneViewport() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(max-width: 767.98px)").matches
  );
}
