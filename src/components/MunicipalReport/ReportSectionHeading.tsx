import type { ReactNode } from "react";

export function ReportSectionHeading({
  level,
  accent,
  children,
}: {
  level: 2 | 3;
  accent: string;
  children: ReactNode;
}) {
  const Tag = level === 2 ? "h2" : "h3";
  const size = level === 2 ? "text-[18px]" : "text-base";

  return (
    <div className="report-heading flex items-center gap-3">
      <span
        aria-hidden="true"
        data-report-accent-bar
        className="h-6 w-[3px] shrink-0 rounded-full"
        style={{ backgroundColor: accent }}
      />
      <Tag className={`font-open-sans ${size} font-semibold leading-6 text-[#292829]`}>
        {children}
      </Tag>
    </div>
  );
}
