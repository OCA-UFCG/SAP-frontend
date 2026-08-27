import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { CriterionOption } from "@/utils/amfeInterfaces";
import { Icon } from "@/components/Icon/Icon";

export interface CriteriaModalProps {
  options?: CriterionOption[];
  defaultSelected?: string[];
  onApply?: (selectedIds: string[]) => void;
  children: (open: () => void) => React.ReactNode;
}

const MAX_SELECTED = 8;

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <Icon
      id={checked ? "checkboxChecked" : "checkboxUnchecked"}
      size={16}
      className="shrink-0"
    />
  );
}

function InfoTooltip({
  name,
  description,
  open,
  onToggle,
  onOpen,
  onClose,
  placement,
}: {
  id: string;
  name: string;
  description?: string;
  open: boolean;
  onToggle: (e: React.MouseEvent) => void;
  onOpen: () => void;
  onClose: () => void;
  placement: "above" | "below";
}) {
  const t = useTranslations("CriteriaModal");
  return (
    <div
      className="relative ml-auto inline-block"
      onMouseEnter={onOpen}
      onMouseLeave={onClose}
    >
      <button
        type="button"
        onClick={onToggle}
        onFocus={onOpen}
        onBlur={onClose}
        aria-label={t("infoAriaLabel", { name })}
        title={t("infoTitle")}
        className="flex items-center justify-center p-1"
      >
        <Icon id="info" size={20} className="text-[#989D93]" />
      </button>

      {open && (
        <div
          role="tooltip"
          className={`absolute right-0 z-[200] w-[260px] max-w-[calc(100vw-48px)] rounded-[8px] border border-[#E4E5E2] bg-white p-3 text-left shadow-[0_4px_20px_rgba(0,0,0,0.13)] ${placement === "below" ? "top-[calc(100%+10px)]" : "bottom-[calc(100%+10px)]"}`}
        >
          <span
            className={`absolute right-[14px] block h-3 w-3 rotate-45 bg-white ${placement === "below" ? "-top-[6px] border-t border-l border-[#E4E5E2]" : "-bottom-[6px] border-r border-b border-[#E4E5E2]"}`}
          />

          <p className="mb-1 text-[13px] leading-[18px] font-semibold text-black">
            {name}
          </p>

          <p className="text-[12px] leading-[1.55] text-[#292829]">
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

  const filtered = options.filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase()),
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
    <div
      onClick={() => {
        setInfoOption(null);
        onClose();
      }}
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/35"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex h-[calc(100vh-32px)] max-h-[860px] w-[543px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-[12px] bg-white shadow-[0_8px_40px_rgba(0,0,0,0.15)]"
      >
        <div className="flex min-h-[120px] shrink-0 flex-col gap-4 border-b border-[#B4BA61] px-6 py-4 text-left">
          <div className="flex min-h-6 w-full items-start justify-between gap-4">
            <h2 className="font-inter text-[24px] leading-7 font-semibold tracking-[-0.015em] text-black">
              {t("title")}
            </h2>

            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 shrink-0 items-center justify-center"
            >
              <Icon id="close-modal" size={18} />
            </button>
          </div>

          <p className="font-inter max-w-[460px] text-[16px] leading-6 font-normal tracking-[-0.015em] text-[#5F6268]">
            {t("description")}
          </p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 px-5 py-4">
          <div className="flex h-14 w-full shrink-0 items-center gap-3 rounded-[10px] border border-[#D1D4CF] bg-[#F8F8F7] px-5">
            <Icon id="loupe" size={20} className="shrink-0" fill="#8C9189" />
            <input
              type="text"
              placeholder={t("searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-full min-w-0 flex-1 bg-transparent font-['Open_Sans'] text-[16px] leading-6 text-[#292829] outline-none placeholder:text-[#8C9189]"
            />
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
            {filtered.map((option, index) => {
              const checked = selected.has(option.id);
              const disabled =
                (!checked && selected.size >= MAX_SELECTED) ||
                (checked && selected.size <= MIN_SELECTED);
              return (
                <div
                  key={option.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setInfoOption(null);
                    if (!disabled) toggle(option.id);
                  }}
                  onKeyDown={(e) => {
                    if (disabled) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggle(option.id);
                    }
                  }}
                  className={`flex min-h-12 shrink-0 items-center gap-3 rounded-[8px] border border-[#E4E5E2] px-3 py-2 text-left transition-colors ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer hover:bg-[#F8F8F7]"}`}
                >
                  <Checkbox checked={checked} />
                  <span className="min-w-0 flex-1 font-['Open_Sans'] text-[16px] leading-5 font-normal text-black">
                    {option.name}
                  </span>

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
                    placement={index < 2 ? "below" : "above"}
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
            className="flex h-11 w-full cursor-pointer items-center justify-center rounded-[8px] bg-[#989F43] px-4 py-2 transition-colors hover:bg-[#8b923d]"
          >
            <span className="font-['Open_Sans'] text-[16px] leading-6 font-semibold text-white">
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
