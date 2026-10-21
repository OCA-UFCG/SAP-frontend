import type { SVGProps } from "react";

/**
 * O Símbolo Internacional de Acesso, que a LBI (art. 63, §1º) pede em destaque
 * nos sites acessíveis. É decorativo: o texto do link ao lado já diz para onde
 * ele leva, então o leitor de tela não precisa anunciar o desenho.
 *
 * @example
 * <AccessibilitySymbol className="h-6 w-6" />
 */
export const AccessibilitySymbol = (props: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    {...props}
  >
    <circle cx="10" cy="3.5" r="2" fill="currentColor" stroke="none" />
    <path d="M10 7v6.5h6l2.5 5.5" />
    <path d="M10 10h5" />
    <path d="M7 11.5a5.5 5.5 0 1 0 8.2 6.8" />
  </svg>
);
