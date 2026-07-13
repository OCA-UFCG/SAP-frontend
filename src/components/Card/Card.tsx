import { cn } from "@/lib/utils";

type Props = {
  highlighted?: boolean;
  hoverScale?: boolean;
  className?: string;
  children: React.ReactNode;
};

export const Card = ({
  highlighted = false,
  hoverScale = false,
  className = "",
  children,
}: Props) => {
  return (
    <div
      className={cn(
        "rounded-lg bg-white shadow-sm transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-lg",
        highlighted ? "border-2 border-[#989F43]" : "border border-[#E4E5E2]",
        hoverScale && "hover:scale-[1.03] hover:border-[#989F43]",
        className,
      )}
    >
      {children}
    </div>
  );
};

export default Card;
