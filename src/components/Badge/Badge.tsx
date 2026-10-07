import { cn } from "@/lib/utils";

export type BadgeVariant = "neutral" | "primary" | "accent" | "subtle";
export type BadgeSize = "sm" | "md";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  neutral: "bg-[#E4E5E2] text-[#292829]",
  primary: "bg-[#989F43] text-[#F8F7F8]",
  accent: "bg-[#E1E2B4] text-[#292829]",
  subtle: "bg-[#F6F7F6] text-[#292829]",
};

const SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: "font-open-sans text-xs font-bold leading-5",
  md: "font-inter text-sm font-medium leading-6",
};

type Props = {
  label: string;
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
};

export const Badge = ({
  label,
  variant = "neutral",
  size = "md",
  className = "",
}: Props) => {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-full px-2.5 py-0.5",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
    >
      {label}
    </span>
  );
};

export default Badge;
