import { SearchResultProps } from "@/utils/interfaces"

const SearchResult = ({ id, label }: SearchResultProps) => {
  return (
    <option id={id} value={label}>
      {label}
    </option>
  )
}

export default SearchResult