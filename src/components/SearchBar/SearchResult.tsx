import { SearchResultI } from "@/utils/interfaces"

const SearchResult = ({ key, label }: SearchResultI) => {
  return (
    <option key={key} value={label}>
      {label}
    </option>
  )
}

export default SearchResult