import { SearchButtonProps } from "@/utils/interfaces";

const SearchButton = ({ onClick, children }: SearchButtonProps) => {
  return (
    <button
      onClick={onClick}
      className="
        bg-[#989F43]
        text-white
        w-full
        min-w-30
        h-14
        rounded-xl
        hover:brightness-110
        active:brightness-95
        transition
      "
    >
      {children}
    </button>
  );
};

export default SearchButton