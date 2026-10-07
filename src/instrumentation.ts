/**
 * Roda uma vez quando o servidor sobe, antes do primeiro pedido.
 *
 * O código do Node fica num arquivo à parte e só é importado dentro do `if`:
 * o Next compila este arquivo também para o runtime edge, onde `node:crypto`
 * (usado pelo cliente do Earth Engine) não existe e quebraria o build.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { warmUpOnStartup } = await import("./instrumentation-node");
    warmUpOnStartup();
  }
}
