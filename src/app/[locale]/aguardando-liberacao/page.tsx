import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { Link } from "@/translations/routing";
import {
  SESSION_COOKIE_NAME,
  getAuthenticatedSessionFromCookie,
} from "@/lib/server-session";

/**
 * Destino de quem está autenticado mas ainda não foi liberado pelo OCA. Não faz
 * guard nenhum de propósito: quem não tem sessão simplesmente vê a mesma página
 * sem a linha do e-mail, e quem já foi liberado chega aqui só se digitar a URL.
 */
export default async function PendingApprovalPage() {
  const t = await getTranslations("PendingApproval");
  const sessionCookie = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  const session = await getAuthenticatedSessionFromCookie(sessionCookie);

  return (
    <main className="flex min-h-[calc(100vh-4.125rem)] w-full items-center justify-center bg-white px-6 py-16">
      <div className="flex w-full max-w-[520px] flex-col gap-6">
        <h1 className="font-inter text-[24px] font-medium leading-8 tracking-[-0.36px] text-[#50554C]">
          {t("title")}
        </h1>

        <p className="text-[15px] leading-6 text-[#676264]">
          {t("description")}
        </p>

        {session?.email ? (
          <p className="text-[13px] leading-5 text-[#838B77]">
            {t("signedInAs")}{" "}
            <span className="font-medium text-[#50554C]">{session.email}</span>
          </p>
        ) : null}

        <Link
          href="/"
          className="font-open-sans flex h-[33px] w-fit items-center justify-center rounded-md bg-[#989F43] px-4 py-1.5 text-[11.65px] leading-5 text-white transition hover:bg-[#5B612A] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#777E32] focus-visible:ring-offset-2"
        >
          {t("backHome")}
        </Link>
      </div>
    </main>
  );
}
