import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { Link } from "@/translations/routing";
import {
  SESSION_COOKIE_NAME,
  getAuthenticatedSessionFromCookie,
} from "@/lib/server-session";
import { pageTitleMetadata } from "@/lib/page-metadata";
import { ACCESS_REVOKED_PARAM } from "@/config/accessRoutes";
import { cn } from "@/lib/utils";
import { SECONDARY_BUTTON } from "@/components/PasswordReset/PasswordResetLayout";
import { WithdrawRequestClient } from "./WithdrawRequestClient";

export const generateMetadata = pageTitleMetadata("pendingApproval");

/**
 * Destino de quem está autenticado mas ainda não foi liberado pelo OCA. Não faz
 * guard nenhum de propósito: quem não tem sessão simplesmente vê a mesma página
 * sem a linha do e-mail, e quem já foi liberado chega aqui só se digitar a URL.
 *
 * Quem teve o acesso removido chega com `?removido=1` e vê outro texto, sem a
 * opção de desistir do pedido: não há pedido esperando, e a exclusão dessas
 * contas passa pela equipe.
 */
export default async function PendingApprovalPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("PendingApproval");
  const revoked = Boolean((await searchParams)?.[ACCESS_REVOKED_PARAM]);
  const sessionCookie = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = await getAuthenticatedSessionFromCookie(sessionCookie);

  return (
    <div className="flex min-h-[calc(100vh-4.125rem)] w-full items-center justify-center bg-white px-6 py-16">
      <div className="flex w-full max-w-[520px] flex-col gap-6">
        <h1 className="font-inter text-[1.5rem] font-medium leading-8 tracking-[-0.36px] text-[#50554C]">
          {revoked ? t("revokedTitle") : t("title")}
        </h1>

        <p className="text-[0.9375rem] leading-6 text-[#676264]">
          {revoked ? t("revokedDescription") : t("description")}
        </p>

        {session?.email ? (
          <p className="text-[0.8125rem] leading-5 text-[#838B77]">
            {t("signedInAs")}{" "}
            <span className="font-medium text-[#50554C]">{session.email}</span>
          </p>
        ) : null}

        <Link
          href="/"
          className="font-open-sans flex h-[33px] w-fit items-center justify-center rounded-md bg-[#646B2D] px-4 py-1.5 text-[0.7281rem] leading-5 text-white transition hover:bg-[#4F5424] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5B612A] focus-visible:ring-offset-2"
        >
          {t("backHome")}
        </Link>

        {revoked ? (
          <Link href="/contact" className={cn(SECONDARY_BUTTON, "w-fit px-4")}>
            {t("contactTeam")}
          </Link>
        ) : (
          <WithdrawRequestClient />
        )}
      </div>
    </div>
  );
}
