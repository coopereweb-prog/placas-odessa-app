import { useState, useEffect, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, MarkerF, InfoWindow } from '@react-google-maps/api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { PontoInfoWindow } from '@/components/PontoInfoWindow'; // CORREÇÃO APLICADA AQUI
import { ReservationForm } from '@/components/ReservationForm';
import { getPontos } from '../lib/supabase';
import { Loader2 } from 'lucide-react';

const containerStyle = {
  width: '100vw',
  height: '100vh'
};

const center = {
  lat: -22.786092,
  lng: -47.295678
};

const mapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
};

function HomePage() {
  const [pontos, setPontos] = useState([]);
  const [selectedPonto, setSelectedPonto] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [isReservationModalOpen, setReservationModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  });

  const fetchPontos = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPontos();
      setPontos(data);
    } catch (error) {
      console.error("Falha ao buscar pontos:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPontos();
  }, [fetchPontos]);

  const handleAddToCart = (ponto, periodo, price) => {
    const newItem = { ponto, periodo, price, id: `${ponto.id}-${periodo}` };
    if (!cartItems.some(item => item.id === newItem.id)) {
      setCartItems(prevItems => [...prevItems, newItem]);
    }
    setSelectedPonto(null);
  };

  const handleRemoveFromCart = (itemId) => {
    setCartItems(prevItems => prevItems.filter(item => item.id !== itemId));
  };

  const handleReservationSuccess = () => {
    setCartItems([]);
    fetchPontos(); // Recarrega os pontos para mostrar o status 'reservado'
  };

  const totalAmount = cartItems.reduce((sum, item) => sum + item.price, 0);

  if (loadError) {
    return <div className="flex items-center justify-center h-screen">Erro ao carregar o mapa.</div>;
  }

  if (!isLoaded || loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin" />
        <p className="ml-4 text-lg">Carregando mapa e pontos...</p>
      </div>
    );
  }

  return (
    <div>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={14}
        options={mapOptions}
      >
        {pontos.map((ponto) => (
          <MarkerF
            key={ponto.id}
            position={{ lat: ponto.latitude, lng: ponto.longitude }}
            onClick={() => setSelectedPonto(ponto)}
            icon={{
              url: ponto.status === 'disponivel' ? '/marker-green.png' : '/marker-red.png',
              scaledSize: new window.google.maps.Size(35, 35)
            }}
          />
        ))}

        {selectedPonto && (
          <InfoWindow
            position={{ lat: selectedPonto.latitude, lng: selectedPonto.longitude }}
            onCloseClick={() => setSelectedPonto(null)}
          >
            <PontoInfoWindow
              ponto={selectedPonto}
              onAddToCart={handleAddToCart}
              cartItems={cartItems}
              onRemoveFromCart={handleRemoveFromCart}
            />
          </InfoWindow>
        )}
      </GoogleMap>

      {cartItems.length > 0 && (
        <div className="fixed bottom-4 right-4 z-10 bg-white p-4 rounded-lg shadow-lg max-w-sm w-full">
          <h3 className="text-lg font-bold mb-2">Resumo da Reserva</h3>
          <ul className="space-y-2 mb-4 max-h-40 overflow-y-auto">
            {cartItems.map(item => (
              <li key={item.id} className="flex justify-between items-center text-sm">
                <span>Ponto #{item.ponto.numero_ponto} ({item.periodo} {item.periodo > 1 ? 'anos' : 'ano'})</span>
                <div className="flex items-center gap-2">
                  <span>R$ {item.price.toFixed(2)}</span>
                  <Button variant="destructive" size="icon" className="h-6 w-6" onClick={() => handleRemoveFromCart(item.id)}>X</Button>
                </div>
              </li>
            ))}
          </ul>
          <div className="border-t pt-2 flex justify-between items-center font-bold">
            <span>Total:</span>
            <span>R$ {totalAmount.toFixed(2)}</span>
          </div>
          <Button onClick={() => setReservationModalOpen(true)} className="w-full mt-4">
            Finalizar Reserva
          </Button>
        </div>
      )}

      <Dialog open={isReservationModalOpen} onOpenChange={setReservationModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalizar Reserva</DialogTitle>
            <DialogDescription>
              Preencha seus dados para garantir a reserva dos pontos selecionados.
            </DialogDescription>
          </DialogHeader>
          <ReservationForm
            cartItems={cartItems}
            onClose={() => setReservationModalOpen(false)}
            onReservationSuccess={handleReservationSuccess}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default HomePage;
