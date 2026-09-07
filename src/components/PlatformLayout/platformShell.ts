/**
 * A casca da plataforma ocupa exatamente o que sobra da viewport abaixo do
 * cabeçalho — `Header` é `sticky` e mede 66px (`h-16.5` incluindo a borda).
 *
 * Manter isso num único lugar existe por causa de um bug real: as telas usavam
 * `calc(100vh - 64px)` copiado à mão, 2px a menos que o cabeçalho de verdade, e
 * cada seção chegou a medir a própria altura de um jeito diferente. Com uma
 * medida só, monitoramento, catálogo, auditoria e AMFE começam na mesma altura e
 * o rodapé fica logo abaixo da dobra em todas elas.
 *
 * @example
 * <div className={`w-full ${PLATFORM_SHELL_MIN_HEIGHT_CLASS}`}>{children}</div>
 */
export const PLATFORM_HEADER_HEIGHT_PX = 66;

/** Piso da casca: telas que crescem (catálogo, auditoria) rolam a partir dele. */
export const PLATFORM_SHELL_MIN_HEIGHT_CLASS = "min-h-[calc(100vh-66px)]";

/** Altura fixa: telas que não rolam a página (mapa, AMFE) e a trilha lateral. */
export const PLATFORM_SHELL_HEIGHT_CLASS = "h-[calc(100vh-66px)]";
