interface SearchButtonProps {
  onClick: () => void
  children: React.ReactNode
}

const SearchButton = ({ onClick, children }: SearchButtonProps) => {
  return (
    <button
      onClick={onClick}
      className="
        bg-[#989F43]
        text-white
        px-5 py-2
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