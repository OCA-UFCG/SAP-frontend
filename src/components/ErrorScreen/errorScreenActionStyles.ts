/**
 * As ações das telas de falha aparecem ora como `<button>` (tentar de novo),
 * ora como `<Link>` (voltar ao início), então o estilo mora aqui em vez de num
 * componente: os dois elementos precisam da mesma aparência.
 */
export const PRIMARY_ACTION_CLASS =
  "cursor-pointer rounded-sm bg-[#5B612A] px-6 py-3 font-medium text-white transition duration-300 hover:bg-[#4F5424] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5B612A]";

export const SECONDARY_ACTION_CLASS =
  "cursor-pointer rounded-sm border border-[#5B612A] px-6 py-3 font-medium text-[#5B612A] transition duration-300 hover:bg-[#E1E2B4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5B612A]";
