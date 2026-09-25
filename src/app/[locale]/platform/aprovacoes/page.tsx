import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { SESSION_COOKIE_NAME } from "@/lib/server-session";
import { resolveLogsViewerAccess } from "@/lib/logs-access";
import { listPendingAccessRequests } from "@/lib/access-requests";
import { ApprovalsTable } from "./ApprovalsTable";

/**
 * Tela de decisão sobre pedidos de acesso.
 *
 * Guardada pela allowlist de operadores, a mesma das telas de auditoria — e a
 * rota que grava a decisão repete a checagem com o guard do catálogo. A tela
 * mostrar algo nunca é o que autoriza: quem autoriza é a rota.
 *
 * Quem não é operador recebe 404 em vez de 403: não vale contar que esta tela
 * existe para quem não pode usá-la.
 */
export default async function ApprovalsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const sessionCookie = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const access = await resolveLogsViewerAccess(sessionCookie);

  if (access !== "allowed") {
    notFound();
  }

  const t = await getTranslations("Approvals");

  // A consulta exige um índice composto do Firestore (ver
  // `firestore.indexes.json`). Sem ele, ela falha — e a página inteira ia
  // junto, deixando os pedidos sem nenhuma forma de serem decididos. Um aviso
  // na tela é muito melhor que uma tela quebrada: pelo menos o operador sabe
  // que existe algo a consertar.
  let pending: Awaited<ReturnType<typeof listPendingAccessRequests>> = [];
  let failed = false;

  try {
    pending = await listPendingAccessRequests();
  } catch (error) {
    failed = true;
    console.error("Falha ao listar os pedidos de acesso pendentes.", error);
  }

  if (failed) {
    return (
      <main className="flex w-full flex-col gap-4 px-6 py-10">
        <h1 className="font-inter text-[22px] font-medium leading-7 tracking-[-0.36px] text-[#50554C]">
          {t("title")}
        </h1>
        <p
          role="alert"
          className="max-w-[46rem] rounded-[7px] bg-[#FCE8E6] px-3 py-2.5 text-[14px] leading-6 text-[#B3261E]"
        >
          {t("loadFailed")}
        </p>
      </main>
    );
  }

  return (
    <main className="flex w-full flex-col gap-6 px-6 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="font-inter text-[22px] font-medium leading-7 tracking-[-0.36px] text-[#50554C]">
          {t("title")}
        </h1>
        <p className="max-w-[46rem] text-[14px] leading-6 text-[#676264]">
          {t("subtitle")}
        </p>
      </div>

      <ApprovalsTable
        rows={pending.map((request) => ({
          uid: request.uid,
          email: request.email,
          intention: request.intention,
          requestedAt: new Intl.DateTimeFormat(locale, {
            dateStyle: "short",
          }).format(new Date(request.createdAt)),
        }))}
      />
    </main>
  );
}
