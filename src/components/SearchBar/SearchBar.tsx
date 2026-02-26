import { useState } from "react"
import { Icon } from "../Icon/Icon"
import { CitySearchItem } from "@/utils/interfaces";
import SearchResult from "./SearchResult";

const mockData = [
  { id: "SP-1", type: "city", city: "São Paulo", state: "São Paulo", label: "São Paulo, São Paulo"},
  { id: "SP-2", type: "city", city: "Guarulhos", state: "São Paulo", label: "Guarulhos, São Paulo" },
  { id: "SP-3", type: "city", city: "Campinas", state: "São Paulo", label: "Campinas, São Paulo" },
  { id: "SP-4", type: "city", city: "Santos", state: "São Paulo", label: "Santos, São Paulo" },
  { id: "SP-5", type: "city", city: "Ribeirão Preto", state: "São Paulo", label: "Ribeirão Preto, São Paulo" },
  { id: "RJ-1", type: "city", city: "Rio de Janeiro", state: "Rio de Janeiro", label: "Rio de Janeiro, Rio de Janeiro" },
  { id: "RJ-2", type: "city", city: "Niterói", state: "Rio de Janeiro", label: "Niterói, Rio de Janeiro" },
  { id: "RJ-3", type: "city", city: "Duque de Caxias", state: "Rio de Janeiro", label: "Duque de Caxias, Rio de Janeiro" },
  { id: "RJ-4", type: "city", city: "Nova Iguaçu", state: "Rio de Janeiro", label: "Nova Iguaçu, Rio de Janeiro" },
  { id: "RJ-5", type: "city", city: "Campos dos Goytacazes", state: "Rio de Janeiro", label: "Campos dos Goytacazes, Rio de Janeiro" },
  { id: "PB-1", type: "city", city: "João Pessoa", state: "Paraíba", label: "João Pessoa, Paraíba" },
  { id: "PB-2", type: "city", city: "Campina Grande", state: "Paraíba", label: "Campina Grande, Paraíba" },
  { id: "PB-3", type: "city", city: "Santa Rita", state: "Paraíba", label: "Santa Rita, Paraíba" },
  { id: "PB-4", type: "city", city: "Patos", state: "Paraíba", label: "Patos, Paraíba" },
  { id: "PB-5", type: "city", city: "Bayeux", state: "Paraíba", label: "Bayeux, Paraíba" },
];

const SearchBar = () => {
    const [search, setSearch] = useState("")
    const [searchResults, setSearchResults] = useState<CitySearchItem[] | []>([])

    const searchData = (value: string) => {
        return mockData.filter((data) => {
            return value && data && data.city && data.city.toLowerCase().includes(value.toLowerCase()) || data.state && data.state.toLowerCase().includes(value.toLowerCase())
        })
    }

    const handleChange = (value: string) => {
        setSearch(value)
        const dataSearched = searchData(value)
        
        setSearchResults(dataSearched)
    }

    return (
        <div 
            className="min-w-85 w-full p-4 flex items-center text-lg ml-4 rounded-xl shadow-sm bg-[#E4E5E2] overflow-hidden t  transition hover:border-neutral-400
            focus-within:border-neutral-600 focus-within:ring-2 focus-within:ring-neutral-600"
        >
            <Icon 
                id="loupe" 
                className="mr-4" 
                fill="#292829" 
                size={24}
            />
            <input 
                value={search} 
                onChange={(e) => handleChange(e.target.value)} 
                list="result"
                className="w-full text-[#292829] bg-transparent border-none outline-none ring-0" placeholder="Pesquise uma cidade ou estado"
            />
            <datalist id="result">
                {searchResults.map((result) => {
                    return <SearchResult id={result.id} label={result.label} />
                })}
            </datalist>
        </div>
    )
}

export default SearchBar