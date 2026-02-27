'use client';

import MapComponent from '../Map/MapComponent';
import { useState } from 'react';
import geodata from '../../data/CDI_Janeiro_2024_Vetores.json';
import geometria from '../../data/geometria.json';
import { FeatureCollection, Feature, Geometry } from 'geojson';

export interface CDIFeatureProperties {
  classe_cdi: number;
  first: number;
  [key: string]: unknown;
}

interface EstadoProperties {
  codarea: string;
  info: {
    id: number;
    sigla: string;
    nome: string;
    regiao: {
      id: number;
      sigla: string;
      nome: string;
    };
  };
}


export type CDIVectorData = FeatureCollection<Geometry, CDIFeatureProperties>;

const MapSection = () => {
  const [estadoSelecionado, setEstadoSelecionado] = useState<string>('Brasil');
  const cdiData = geodata as unknown as CDIVectorData;
  const geoBrasil = geometria as unknown as FeatureCollection<
    Geometry,
    EstadoProperties
  >;
  return (
    <div className="bg-white-700 mx-auto my-5 h-[690px] w-[60%] flex z-10 my-20">
     
        <div className="p-4 bg-white border-b z-10">
          <select
            onChange={(e) => setEstadoSelecionado(e.target.value)}
            className="p-2 border rounded text-black"
          >
            <option value="Brasil">Brasil Inteiro</option>
            {geoBrasil?.features?.map((f) => (
              <option
                key={f.properties?.info.id}
                value={f.properties?.info.nome}
              >
                {f.properties?.info.nome}
              </option>
            ))}
          </select>
        </div>

        <div className='flex w-full h-full z-10'>
        <MapComponent
          center={[-15.749997, -47.9499962]}
          zoom={4}
          dadosCDI={cdiData}
          estadoSelecionado={estadoSelecionado}
        />
        </div>
    </div>
  );
};

export default MapSection;
