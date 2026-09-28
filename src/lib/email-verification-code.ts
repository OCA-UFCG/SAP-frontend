/**
 * Confirmação de endereço sem passar pela página do Firebase.
 *
 * O link que o Firebase gera leva a pessoa para `<projeto>.firebaseapp.com`,
 * numa tela em inglês e com o nome interno do projeto na barra do navegador.
 * O que confirma o endereço, porém, é só o código de uso único que vai dentro
 * desse link. Por isso o e-mail leva o código para a nossa própria página, e o
 * servidor o entrega ao Firebase por trás.
 *
 * O código é credencial: nada aqui o registra em log.
 */

const IDENTITY_TOOLKIT_URL =
  "https://identitytoolkit.googleapis.com/v1/accounts:update";

/** Tira o código de uso único de dentro do link gerado pelo Firebase. */
export function extractVerificationCode(firebaseLink: string) {
  try {
    return new URL(firebaseLink).searchParams.get("oobCode");
  } catch {
    return null;
  }
}

/**
 * Entrega o código ao Firebase, que marca o endereço como confirmado.
 *
 * Devolve o e-mail que o código confirmou, ou `null` quando o código não vale
 * (já usado, vencido, inventado). Código já usado é o caso comum de quem abre
 * o link uma segunda vez, e quem chama segue conferindo `emailVerified` na
 * conta — então `null` não é erro, é "este código não confirmou nada agora".
 */
export async function applyVerificationCode(code: string) {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

  if (!apiKey) {
    console.error(
      "Não dá para confirmar o endereço: NEXT_PUBLIC_FIREBASE_API_KEY não está configurada.",
    );
    return null;
  }

  try {
    const response = await fetch(
      `${IDENTITY_TOOLKIT_URL}?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oobCode: code }),
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      },
    );

    if (!response.ok) return null;

    const { email } = (await response.json()) as { email?: unknown };
    return typeof email === "string" && email ? email.toLowerCase() : null;
  } catch {
    console.error("Falha ao falar com o Firebase para confirmar o endereço.");
    return null;
  }
}
