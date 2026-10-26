"use client";

import { openCookiePreferences } from "@/lib/analytics-consent";

// O rodapé é montado no servidor, que não aceita onClick: o botão que reabre o
// aviso precisa ser um componente do navegador.
export const CookiePreferencesButton = ({
  className,
  label,
}: {
  className: string;
  label: string;
}) => (
  <button type="button" onClick={openCookiePreferences} className={className}>
    {label}
  </button>
);
