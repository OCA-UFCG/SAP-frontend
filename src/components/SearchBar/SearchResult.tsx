import { SearchResultProps } from "@/utils/interfaces"

const SearchResult = ({ key, label }: SearchResultProps) => {
  return (
    <option key={key} value={label}>
      {label}
    </option>
  )
}

export default SearchResult