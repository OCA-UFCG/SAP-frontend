import { useState } from "react"
import { Icon } from "../Icon/Icon"
import { BrazilianState } from "@/utils/interfaces";
import SearchResult from "./SearchResult";
import SearchButton from "./SearchButton";

const mockStates = [
  { name: "Acre", uf: "AC" },
  { name: "Alagoas", uf: "AL" },
  { name: "Amapá", uf: "AP" },
  { name: "Amazonas", uf: "AM" },
  { name: "Bahia", uf: "BA" },
  { name: "Ceará", uf: "CE" },
  { name: "Distrito Federal", uf: "DF" },
  { name: "Espírito Santo", uf: "ES" },
  { name: "Goiás", uf: "GO" },
  { name: "Maranhão", uf: "MA" },
  { name: "Mato Grosso", uf: "MT" },
  { name: "Mato Grosso do Sul", uf: "MS" },
  { name: "Minas Gerais", uf: "MG" },
  { name: "Pará", uf: "PA" },
  { name: "Paraíba", uf: "PB" },
  { name: "Paraná", uf: "PR" },
  { name: "Pernambuco", uf: "PE" },
  { name: "Piauí", uf: "PI" },
  { name: "Rio de Janeiro", uf: "RJ" },
  { name: "Rio Grande do Norte", uf: "RN" },
  { name: "Rio Grande do Sul", uf: "RS" },
  { name: "Rondônia", uf: "RO" },
  { name: "Roraima", uf: "RR" },
  { name: "Santa Catarina", uf: "SC" },
  { name: "São Paulo", uf: "SP" },
  { name: "Sergipe", uf: "SE" },
  { name: "Tocantins", uf: "TO" },
];

const SearchBar = () => {
    const [search, setSearch] = useState("")
    const [stateResults, setStateResults] = useState<BrazilianState[] >([])
    const [searchResults, setSearchResults] = useState<BrazilianState[] | null>(null)

    const hasResultError = searchResults !== null && searchResults.length === 0

    const searchData = (value: string) => {
        return mockStates.filter((state) => {
            return value && state && state.name && state.name.toLowerCase().includes(value.toLowerCase()) || state.uf && state.uf.toLowerCase().includes(value.toLowerCase())
        })
    }

    const handleChange = (value: string) => {
        setSearch(value)
        const dataSearched = searchData(value)
        
        setStateResults(dataSearched)
    }

    const onSubmit = (inputValue: string) => {
        // using searcData handler but in future it will be use another fucntion (API search e.g)
        const result = searchData(inputValue)

        setSearchResults(result)
    }

    return (
        <div className="w-full flex justify-between gap-5 items-start">
            <div className="flex-1 flex flex-col"> 
            <div 
                className={`min-w-90 w-full p-4 flex items-center text-lg rounded-xl shadow-sm bg-[#E4E5E2] overflow-hidden 
                    ${
                        hasResultError ? "border-red-500 ring-2 ring-red-500" : 
                        "transition hover:border-neutral-400 border-transparent bg-[#E4E5E2] hover:border-neutral-400 focus-within:border-neutral-600 focus-within:ring-2 focus-within:ring-neutral-600"
                    }
                `}
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
                    {stateResults.map((result) => {
                        return <SearchResult key={result.uf} label={result.name} />
                    })}
                </datalist>
            </div>
                {hasResultError && (<p className="text-sm text-red-600 mt-1"> Estado não identificado.</p>)}
            </div>
            <SearchButton onClick={() => onSubmit(search)}>Pesquisar</SearchButton>
        </div>
    )
}

export default SearchBar