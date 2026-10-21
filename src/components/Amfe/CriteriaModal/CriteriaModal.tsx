import React, { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { CriterionOption } from "@/utils/amfeInterfaces";
import { Icon } from "@/components/Icon/Icon";
import { normalize } from "@/utils/functions";
import { useDialogFocus } from "@/hooks/useDialogFocus";

export interface CriteriaModalProps {
  options?: CriterionOption[];
  defaultSelected?: string[];
  onApply?: (selectedIds: string[]) => void;
  children: (open: () => void) => React.ReactNode;
}

const MAX_SELECTED = 8;

// A grade tem três colunas, então a primeira linha são os três primeiros itens
// e a última coluna precisa abrir o balão para a esquerda para não vazar do modal.
const COLUMNS = 3;

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <Icon
      id={checked ? "checkboxChecked" : "checkboxUnchecked"}
      size={16}
      className="shrink-0"
      aria-hidden
    />
  );
}

export function InfoTooltip({
  name,
  description,
  open,
  onToggle,
  onOpen,
  onClose,
  placement,
  align,
}: {
  id: string;
  name: string;
  description?: string;
  open: boolean;
  onToggle: (e: React.MouseEvent) => void;
  onOpen: () => void;
  onClose: () => void;
  placement: "above" | "below";
  align: "left" | "right";
}) {
  const t = useTranslations("CriteriaModal");
  const tooltipId = useId();
  return (
    // O passar do mouse só repete o que o foco do botão já faz pelo teclado,
    // então o invólucro em si não é um controle.
    <div
      role="presentation"
      className="relative inline-block shrink-0"
      onMouseEnter={onOpen}
      onMouseLeave={onClose}
    >
      <button
        type="button"
        onClick={onToggle}
        onFocus={onOpen}
        onBlur={onClose}
        aria-label={t("infoAriaLabel", { name })}
        aria-describedby={open ? tooltipId : undefined}
        title={t("infoTitle")}
        className="flex items-center justify-center p-1"
      >
        <Icon id="info" size={20} className="text-[#989D93]" aria-hidden />
      </button>

      {open && (
        <div
          id={tooltipId}
          role="tooltip"
          className={`absolute z-[200] w-[260px] max-w-[calc(100vw-48px)] rounded-[8px] border border-[#E4E5E2] bg-white p-3 text-left shadow-[0_4px_20px_rgba(0,0,0,0.13)] ${placement === "below" ? "top-[calc(100%+10px)]" : "bottom-[calc(100%+10px)]"} ${align === "right" ? "right-[-26px]" : "left-[-26px]"}`}
        >
          <span
            className={`absolute block h-3 w-3 rotate-45 bg-white ${placement === "below" ? "-top-[6px] border-t border-l border-[#E4E5E2]" : "-bottom-[6px] border-r border-b border-[#E4E5E2]"} ${align === "right" ? "right-[34px]" : "left-[34px]"}`}
          />

          <p className="mb-1 text-[0.8125rem] leading-[18px] font-semibold text-black">
            {name}
          </p>

          <p className="text-[0.75rem] leading-[1.55] text-[#292829]">
            {description || t("defaultDescription", { name })}
          </p>
        </div>
      )}
    </div>
  );
}

function ModalOverlay({
  options,
  defaultSelected,
  onApply,
  onClose,
}: {
  options: CriterionOption[];
  defaultSelected: string[];
  onApply: (ids: string[]) => void;
  onClose: () => void;
}) {
  const t = useTranslations("CriteriaModal");
  const [selected, setSelected] = useState<Set<string>>(
    new Set(defaultSelected),
  );
  const [search, setSearch] = useState("");
  const [infoOption, setInfoOption] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  // Esc fecha, o Tab fica preso no modal e o foco volta ao botão que o abriu.
  useDialogFocus(dialogRef, { onClose });

  // Sem acento: "precipitacao" acha "Anomalia de Precipitação".
  const filtered = options.filter((o) =>
    normalize(o.name).includes(normalize(search)),
  );

  const MIN_SELECTED = 1;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size <= MIN_SELECTED) return prev;
        next.delete(id);
      } else {
        if (next.size >= MAX_SELECTED) return prev;
        next.add(id);
      }
      return next;
    });
  };

  const handleApply = () => {
    onApply(Array.from(selected));
    onClose();
  };

  return (
    // O fundo só fecha pelo mouse; pelo teclado quem fecha é o Esc.
    <div
      role="presentation"
      onMouseDown={(e) => {
        if (e.target !== e.currentTarget) return;
        setInfoOption(null);
        onClose();
      }}
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/35 p-4"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="relative flex max-h-[calc(100vh-32px)] w-[880px] max-w-full flex-col overflow-hidden rounded-[12px] bg-white shadow-[0_8px_40px_rgba(0,0,0,0.15)] focus:outline-none"
      >
        <div className="flex shrink-0 flex-col gap-4 border-b border-[#B4BA61] px-6 py-4 text-left">
          <div className="flex min-h-6 w-full items-start justify-between gap-4">
            <h2
              id={titleId}
              className="font-inter text-[1.5rem] leading-7 font-semibold tracking-[-0.015em] text-black">
              {t("title")}
            </h2>

            <button
              type="button"
              onClick={onClose}
              aria-label={t("close")}
              className="flex h-7 w-7 shrink-0 items-center justify-center"
            >
              <Icon id="close-modal" size={18} aria-hidden />
            </button>
          </div>

          <p
            id={descriptionId}
            className="font-inter max-w-[460px] text-[1rem] leading-6 font-normal tracking-[-0.015em] text-[#5F6268]">
            {t("description")}
          </p>
        </div>

        <div className="flex min-h-0 flex-col gap-4 px-5 py-4">
          <div className="flex h-14 w-full shrink-0 items-center gap-3 rounded-[10px] bg-[#EFEFED] px-5">
            <Icon
              id="loupe"
              size={20}
              className="shrink-0"
              fill="#6B7068"
              aria-hidden
            />
            <input
              type="text"
              aria-label={t("searchLabel")}
              data-autofocus
              placeholder={t("searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-full min-w-0 flex-1 bg-transparent font-['Open_Sans'] text-[1rem] leading-6 text-[#292829] outline-none placeholder:text-[#6B7068]"
            />
          </div>

          <div className="grid min-h-0 grid-cols-1 gap-x-6 gap-y-1 overflow-y-auto pr-1 sm:grid-cols-3">
            {filtered.map((option, index) => {
              const checked = selected.has(option.id);
              const disabled =
                (!checked && selected.size >= MAX_SELECTED) ||
                (checked && selected.size <= MIN_SELECTED);
              return (
                // O botão de informação fica ao lado da caixa, não dentro
                // dela: um controle dentro do outro confundia o leitor de tela.
                <div
                  key={option.id}
                  className={`flex min-h-9 items-center gap-2 rounded-[6px] px-2 py-1 transition-colors ${disabled ? "opacity-40" : "hover:bg-[#F8F8F7]"}`}
                >
                  {/* `aria-disabled` em vez de `disabled`: a opção continua
                      no Tab, e o leitor de tela diz que ela está bloqueada. */}
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    aria-disabled={disabled}
                    onClick={() => {
                      setInfoOption(null);
                      if (!disabled) toggle(option.id);
                    }}
                    className={`flex min-w-0 flex-1 items-center gap-2 text-left ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <Checkbox checked={checked} />
                    <span className="min-w-0 break-words font-['Open_Sans'] text-[1rem] leading-5 font-normal text-black">
                      {option.name}
                    </span>
                  </button>

                  <InfoTooltip
                    id={option.id}
                    name={option.name}
                    description={option.description}
                    open={infoOption === option.id}
                    onToggle={(e) => {
                      e.stopPropagation();
                      setInfoOption(option.id);
                    }}
                    onOpen={() => setInfoOption(option.id)}
                    onClose={() => setInfoOption(null)}
                    placement={index < COLUMNS ? "below" : "above"}
                    align={index % COLUMNS === COLUMNS - 1 ? "right" : "left"}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex shrink-0 border-t border-[#B4BA61] px-6 py-4">
          <button
            type="button"
            onClick={handleApply}
            className="flex h-11 w-full cursor-pointer items-center justify-center rounded-[8px] bg-[#646B2D] px-4 py-2 transition-colors hover:bg-[#4F5424]"
          >
            <span className="font-['Open_Sans'] text-[1rem] leading-6 font-semibold text-white">
              {t("applyButton")}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CriteriaModal({
  options = [],
  defaultSelected = [],
  onApply = () => {},
  children,
}: CriteriaModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {children(() => setOpen(true))}
      {open &&
        createPortal(
          <ModalOverlay
            options={options}
            defaultSelected={defaultSelected}
            onApply={onApply}
            onClose={() => setOpen(false)}
          />,
          document.body,
        )}
    </>
  );
}
