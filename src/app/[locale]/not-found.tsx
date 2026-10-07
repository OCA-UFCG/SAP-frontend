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
 * `LOGS_ALLOWED_EMAILS` em `/platform?view=logs|catalog`.
 *
 * A tela é a mesma nos dois casos, e é isso que importa: quem não tem acesso
 * recebe exatamente o que receberia se a página não existisse, e por isso não
 * consegue descobrir que ela existe. O título sozinho já diz tudo o que a
 * pessoa precisa saber, então não há segunda linha de texto.
 */
export default function LocaleNotFound() {
  const t = useTranslations("ErrorPage");

  return (
    <ErrorScreen
      title={t("notFound.title")}
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
