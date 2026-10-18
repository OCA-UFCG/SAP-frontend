"use client";

import { useState } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import { useLocale, useTranslations } from "next-intl";
import type { CaptchaAction } from "@/lib/captcha";

type CaptchaProps = {
  action: CaptchaAction;
  /**
   * Recebe o token quando o Turnstile aprova, e `null` quando ele expira ou
   * falha. O token só vale uma vez: depois de cada envio, quem usa o componente
   * troca a `key` dele para gerar outro.
   */
  onToken: (token: string | null) => void;
};

/**
 * O widget do Turnstile. Ele só entrega o token; quem decide se a pessoa passa
 * é o servidor, em `@/lib/captcha`.
 */
export function Captcha({ action, onToken }: CaptchaProps) {
  const t = useTranslations("Captcha");
  const locale = useLocale();
  const [unavailable, setUnavailable] = useState(false);

  return (
    <div className="flex w-full flex-col gap-1">
      <Turnstile
        // Trocar o idioma do site recria o widget no idioma novo.
        key={locale}
        siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""}
        options={{ action, language: locale, theme: "light", size: "flexible" }}
        onSuccess={(token) => {
          setUnavailable(false);
          onToken(token);
        }}
        onExpire={() => onToken(null)}
        onError={() => {
          setUnavailable(true);
          onToken(null);
        }}
        // Bloqueador de anúncio ou Cloudflare fora do ar: sem este aviso, a
        // pessoa só veria o botão desabilitado sem saber por quê.
        scriptOptions={{ onError: () => setUnavailable(true) }}
      />
      {unavailable ? (
        <p role="alert" className="text-[12px] leading-4 text-[#B3261E]">
          {t("unavailable")}
        </p>
      ) : null}
    </div>
  );
}

export default Captcha;
