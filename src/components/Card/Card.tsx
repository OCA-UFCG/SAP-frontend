import { cn } from "@/lib/utils";

type Props = {
  highlighted?: boolean;
  hoverScale?: boolean;
  className?: string;
  title?: string;
  children: React.ReactNode;
};

export const Card = ({
  highlighted = false,
  hoverScale = false,
  className = "",
  title,
  children,
}: Props) => {
  return (
    <div
      className={cn(
        "group relative rounded-lg bg-white shadow-sm transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-lg",
        highlighted ? "border-2 border-[#989F43]" : "border border-[#E4E5E2]",
        hoverScale && "hover:scale-[1.03] hover:border-[#989F43]",
        className,
      )}
    >
      {title && (
        <div
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-3 -translate-x-1/2 translate-y-1 whitespace-nowrap rounded-md bg-[#21240F] px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition-all duration-200 ease-out group-hover:translate-y-0 group-hover:opacity-100"
        >
          {title}
          <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-[#21240F]" />
        </div>
      )}
      {children}
    </div>
  );
};

export default Card;
