import { useTranslations } from "next-intl";
import { Link } from "@/translations/routing";
import { ErrorScreen } from "@/components/ErrorScreen/ErrorScreen";
import {
  PRIMARY_ACTION_CLASS,
  SECONDARY_ACTION_CLASS,
} from "@/components/ErrorScreen/errorScreenActionStyles";

/**
 * Destino dos `notFound()` disparados dentro de um locale. O caso real não é
 * URL inexistente — essas caem no catch-all `[...slug]` — e sim o gate da
 * `LOGS_ALLOWED_EMAILS` em `/platform?view=logs|catalog`. Por isso o texto
 * junta "não existe" e "não está disponível para a sua conta": quem não tem
 * acesso não deve conseguir descobrir que a página existe.
 */
export default function LocaleNotFound() {
  const t = useTranslations("ErrorPage");

  return (
    <ErrorScreen
      title={t("notFound.title")}
      description={t("notFound.description")}
      actions={
        <>
          <Link href="/" className={PRIMARY_ACTION_CLASS}>
            {t("notFound.home")}
          </Link>
          <Link href="/platform" className={SECONDARY_ACTION_CLASS}>
            {t("notFound.platform")}
          </Link>
        </>
      }
    />
  );
}
