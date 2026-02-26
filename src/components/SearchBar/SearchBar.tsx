import { useState } from "react"
import { Icon } from "../Icon/Icon"

const SearchBar = () => {
    const [input, setInput] = useState("")

    return (
        <div className="min-w-80 w-full p-4 flex items-center text-lg ml-4 rounded-xl shadow-sm bg-[#E4E5E2] overflow-hidden t  transition
  hover:border-neutral-400
  focus-within:border-neutral-600 focus-within:ring-2 focus-within:ring-neutral-600">  
             <Icon id="loupe" className="mr-4" fill="#292829" size={24}/>
            <input className="w-full text-[#292829] bg-transparent border-none outline-none ring-0" placeholder="Pesquise uma cidade ou estado"/>
        </div>

    )
}

export default SearchBar