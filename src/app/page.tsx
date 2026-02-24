import { Header } from "@/components/NavigationMenu/NavigationMenu";
import { ISections } from "@/utils/interfaces";
import MapComponent from "@/components/Map/MapComponent";

export default function Home() {
  const content: ISections = {
  "home-section": {
    id: "1",
    name: "Home",
    path: "/",
    appears: true
  },
  "map-section": {
    id: "2",
    name: "Mapa",
    path: "/mock",
    appears: true,
  },
  "about-section": {
    id: "3",
    name: "Sobre o Sap",
    path: "/mock",
    appears: true
  },
  "contact-section": {
    id: "4",
    name: "Contatos",
    path: "/mock",
    appears: true
  }
};
  return (
    <div className="flex min-h-screen items-center justify-center  font-sans">
      <main className="flex min-h-screen w-full flex-col items-center justify-between py-1 bg-grey sm:items-start">
        <Header content={Object.values(content)}></Header>

        <div className="bg-white-700 mx-auto my-5 h-[690px] w-[60%] flex ">
          <MapComponent
            center={[-7.22, -35.88]}
            zoom={10}
          />
        </div>
      </main>
    </div>
  );
}
