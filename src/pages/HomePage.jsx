import { useState, useEffect, useMemo, useCallback } from 'react';
import { GoogleMap, useLoadScript, Marker } from '@react-google-maps/api';
import { getPontos } from '../lib/supabase';
import { PontoInfoWindow } from '../components/PontoInfoWindow.jsx';
import { Header } from '../components/Header.jsx';

const containerStyle = {
  width: '100%',
  height: '100vh',
};

const mapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  streetViewControl: true,
  mapTypeControl: false,
  fullscreenControl: false,
};

function HomePage() {
  const [pontos, setPontos] = useState([]);
  const [selectedPonto, setSelectedPonto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const libraries = useMemo(() => ['maps'], []);
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries,
  });

  useEffect(() => {
    const fetchPontos = async () => {
      try {
        setLoading(true);
        const data = await getPontos();
        setPontos(data);
      } catch (err) {
        console.error('Erro ao carregar os pontos:', err);
        setError('Não foi possível carregar os dados do mapa.');
      } finally {
        setLoading(false);
      }
    };

    fetchPontos();
  }, []);

  const center = useMemo(() => ({
    lat: -22.7799, // Coordenadas aproximadas de Nova Odessa
    lng: -47.2946,
  }), []);

  const handleMarkerClick = useCallback((ponto) => {
    setSelectedPonto(ponto);
  }, []);

  const handleCloseInfoWindow = useCallback(() => {
    setSelectedPonto(null);
  }, []);

  const getMarkerIcon = (status) => {
    const color = {
      disponivel: 'green',
      reservado: 'yellow',
      vendido: 'red',
    }[status] || 'blue';

    return {
      path: window.google.maps.SymbolPath.CIRCLE,
      fillColor: color,
      fillOpacity: 0.9,
      scale: 8,
      strokeColor: 'white',
      strokeWeight: 2,
    };
  };

  if (loadError) return <div>Erro ao carregar o mapa. Verifique a chave da API do Google Maps.</div>;
  if (!isLoaded || loading) return <div>A carregar mapa...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div>
      <Header />
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={15}
        options={mapOptions}
      >
        {pontos.map((ponto) => (
          <Marker
            key={ponto.id}
            position={{ lat: ponto.latitude, lng: ponto.longitude }}
            onClick={() => handleMarkerClick(ponto)}
            icon={getMarkerIcon(ponto.status)}
            title={`${ponto.rua_principal} com ${ponto.rua_cruzamento}`}
          />
        ))}

        {selectedPonto && (
          <PontoInfoWindow
            ponto={selectedPonto}
            onClose={handleCloseInfoWindow}
          />
        )}
      </GoogleMap>
    </div>
  );
}

export default HomePage;
