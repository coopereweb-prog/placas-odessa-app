import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
import { supabase, createOrder } from '../lib/supabase.js';
import { PontoInfoWindow } from '../components/PontoInfoWindow.jsx';
import { ReservationForm } from '../components/ReservationForm.jsx';
import Header from '../components/Header.jsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, ShoppingCart, Trash2 } from 'lucide-react';

// --- Constantes do Componente ---
const containerStyle = {
  width: '100%',
  height: '600px',
};

const mapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  streetViewControl: true,
  mapTypeControl: false,
  fullscreenControl: false,
};

const center = {
  lat: -22.7799, // Coordenadas de Nova Odessa
  lng: -47.2946,
};

const markerIcons = {
  available: {
    path: 'M-8,0a8,8 0 1,0 16,0a8,8 0 1,0 -16,0',
    fillColor: '#22c55e', // Verde
    fillOpacity: 0.9,
    scale: 1,
    strokeColor: 'white',
    strokeWeight: 2,
  },
  reserved: {
    path: 'M-8,0a8,8 0 1,0 16,0a8,8 0 1,0 -16,0',
    fillColor: '#eab308', // Amarelo
    fillOpacity: 0.9,
    scale: 1,
    strokeColor: 'white',
    strokeWeight: 2,
  },
  sold: {
    path: 'M-8,0a8,8 0 1,0 16,0a8,8 0 1,0 -16,0',
    fillColor: '#ef4444', // Vermelho
    fillOpacity: 0.9,
    scale: 1,
    strokeColor: 'white',
    strokeWeight: 2,
  },
};

// --- Componente Principal ---
function HomePage() {
  // --- Estados do Componente ---
  const [points, setPoints] = useState([]);
  const [tags, setTags] = useState([]);
  const [pointTags, setPointTags] = useState([]);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [carrinho, setCarrinho] = useState([]);
  const [showReserveModal, setShowReserveModal] = useState(false);
  const [filterTagId, setFilterTagId] = useState('all');
  const mapRef = useRef(null);

  // --- Efeito para Carregar Dados Iniciais ---
  useEffect(() => {
    async function getInitialData() {
      // CORREÇÃO APLICADA AQUI: O nome da tabela foi corrigido de 'pontos' para 'points'.
      const [pointsResponse, tagsResponse, pointTagsResponse] = await Promise.all([
        supabase.from('points').select('*'),
        supabase.from('tags').select('*').order('name', { ascending: true }),
        supabase.from('point_tags').select('*')
      ]);

      if (pointsResponse.error) {
        console.error("Erro ao buscar pontos:", pointsResponse.error);
        alert("Não foi possível carregar os pontos do mapa.");
      } else {
        const formattedPoints = pointsResponse.data
          .filter(p => p.latitude && p.longitude)
          .map(p => ({
            ...p,
            lat: parseFloat(p.latitude),
            lng: parseFloat(p.longitude),
            endereco: p.name,
            descricao: p.description, // Mantido em português por ser exibido na UI
            status: p.status,
          }));
        setPoints(formattedPoints);
      }

      if (tagsResponse.error) console.error("Erro ao buscar tags:", tagsResponse.error);
      else setTags(tagsResponse.data || []); // Garante que o estado seja um array

      if (pointTagsResponse.error) console.error("Erro ao buscar point_tags:", pointTagsResponse.error);
      else setPointTags(pointTagsResponse.data || []); // Garante que o estado seja um array
    }
    getInitialData();
  }, []);

  // --- Lógica de Filtro ---
  const displayedPoints = points.filter(point => {
    if (filterTagId === 'all') return true;
    return pointTags.some(pt => pt.point_id === point.id && String(pt.tag_id) === String(filterTagId));
  });

  const onLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);

  // --- EFEITO PARA AUTO-ZOOM E CENTRALIZAÇÃO DO MAPA ---
  useEffect(() => {
    if (!mapRef.current || typeof window.google === 'undefined' || !window.google.maps) {
      return;
    }

    if (displayedPoints.length === 0) {
      mapRef.current.panTo(center);
      mapRef.current.setZoom(15);
      return;
    }

    if (displayedPoints.length === 1) {
      mapRef.current.panTo({
        lat: displayedPoints[0].lat,
        lng: displayedPoints[0].lng,
      });
      mapRef.current.setZoom(17);
      return;
    }

    const bounds = new window.google.maps.LatLngBounds();
    displayedPoints.forEach(point => {
      bounds.extend(new window.google.maps.LatLng(point.lat, point.lng));
    });
    mapRef.current.fitBounds(bounds);
  }, [displayedPoints]);

  // --- Lógica do Carrinho ---
  const handleAdicionarAoCarrinho = (point, periodo) => {
    if (carrinho.some(item => item.id === point.id)) {
      alert("Este ponto já está no seu carrinho.");
      return;
    }
    const preco = periodo === 2 ? point.price_2y : point.price_3y;
    setCarrinho([...carrinho, { ...point, periodo, preco }]);
    setSelectedMarker(null);
  };

  const handleRemoverDoCarrinho = (pointId) => {
    setCarrinho(carrinho.filter(item => item.id !== pointId));
  };

  const handleUpdatePeriodoCarrinho = (pointId, novoPeriodo) => {
    setCarrinho(carrinho.map(item => {
      if (item.id === pointId) {
        const novoPreco = novoPeriodo === 2 ? item.price_2y : item.price_3y;
        return { ...item, periodo: novoPeriodo, preco: novoPreco };
      }
      return item;
    }));
  };

  // --- Lógica da Reserva ---
  // Esta função é chamada pelo componente ReservationForm após um pedido ser criado com sucesso.
  const handleReservationSuccess = () => {
    // Atualiza o status dos pontos no carrinho para 'reserved' na interface
    const reservedPointIds = carrinho.map(p => p.id);
    setPoints(points.map(p => 
      reservedPointIds.includes(p.id) ? { ...p, status: 'reserved' } : p
    ));
    
    // Limpa o carrinho e fecha o modal
    setCarrinho([]);
    setShowReserveModal(false);
    
    // O componente ReservationForm já exibe uma mensagem de sucesso,
    // então um 'alert' aqui seria redundante.
  };
  
  // --- Cálculos para Exibição ---
  const totalAvailablePoints = points.filter(p => p.status === 'available').length;
  const totalReservedPoints = points.filter(p => p.status === 'reserved').length;
  const totalSoldPoints = points.filter(p => p.status === 'sold').length;
  const totalCarrinho = carrinho.reduce((acc, item) => acc + (item.preco || 0), 0);

  // --- Renderização do Componente ---
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1 space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" />Informações Gerais</CardTitle>
                <CardDescription>
                  Disponibilidade dos pontos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                 <div className="space-y-2">
                    <div className="flex items-center justify-between"><span className="text-sm">Total de pontos:</span><span className="font-semibold">{points.length}</span></div>
                    <div className="flex items-center justify-between"><span className="text-sm flex items-center gap-1.5"><div className="w-3 h-3 bg-green-500 rounded-full"></div>Disponíveis:</span><span className="font-semibold text-green-600">{totalAvailablePoints}</span></div>
                    <div className="flex items-center justify-between"><span className="text-sm flex items-center gap-1.5"><div className="w-3 h-3 bg-yellow-500 rounded-full"></div>Reservados:</span><span className="font-semibold text-yellow-600">{totalReservedPoints}</span></div>
                    <div className="flex items-center justify-between"><span className="text-sm flex items-center gap-1.5"><div className="w-3 h-3 bg-red-500 rounded-full"></div>Vendidos:</span><span className="font-semibold text-red-600">{totalSoldPoints}</span></div>
                  </div>
                <div className="pt-4 border-t">
                    <Label className="font-semibold">Filtrar por característica:</Label>
                    <Select value={filterTagId} onValueChange={setFilterTagId}>
                        <SelectTrigger className="w-full mt-2">
                            <SelectValue placeholder="Selecionar..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Mostrar Todos os Pontos</SelectItem>
                            {tags.map(tag => (
                                <SelectItem key={tag.id} value={String(tag.id)}>{tag.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5" />Carrinho de Reservas</CardTitle>
                <CardDescription>{carrinho.length === 0 ? "Seu carrinho está vazio." : `Você tem ${carrinho.length} ponto(s) no carrinho.`}</CardDescription>
              </CardHeader>
              <CardContent>
                {carrinho.length > 0 && (
                  <div className="space-y-4">
                    <div className="max-h-60 overflow-y-auto space-y-3 pr-2">
                      {carrinho.map(point => (
                        <div key={point.id} className="flex items-start justify-between text-sm p-2 bg-gray-100 rounded-md">
                          <div className="flex-1">
                            <p className="font-medium">{point.endereco}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <select value={point.periodo} onChange={(e) => handleUpdatePeriodoCarrinho(point.id, parseInt(e.target.value))} className="text-xs border-gray-300 rounded-md">
                                <option value="2">2 Anos</option>
                                <option value="3">3 Anos</option>
                              </select>
                              <p className="font-semibold">R$ {point.preco?.toFixed(2)}</p>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => handleRemoverDoCarrinho(point.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                        </div>
                      ))}
                    </div>
                    <div className="border-t pt-4 space-y-4">
                      <div className="flex justify-between font-bold text-lg">
                        <span>Total:</span>
                        <span>R$ {totalCarrinho.toFixed(2)}</span>
                      </div>
                      <Button className="w-full" onClick={() => setShowReserveModal(true)}>Finalizar Pedido</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3">
            <Card>
              <CardHeader><CardTitle>Mapa Interativo - Pontos de Instalação</CardTitle><CardDescription>Clique nos marcadores para ver detalhes e adicionar ao carrinho</CardDescription></CardHeader>
              <CardContent>
                <LoadScript googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
                  <GoogleMap mapContainerStyle={containerStyle} center={center} zoom={15} onLoad={onLoad} options={mapOptions}>
                    {displayedPoints.map((point) => (
                      <Marker 
                        key={point.id} 
                        position={{ lat: point.lat, lng: point.lng }} 
                        icon={markerIcons[point.status] || markerIcons.available} 
                        onClick={() => setSelectedMarker(point)} 
                      />
                    ))}
                    {selectedMarker && <PontoInfoWindow ponto={selectedMarker} onAddToCart={handleAdicionarAoCarrinho} onClose={() => setSelectedMarker(null)} />}
                  </GoogleMap>
                </LoadScript>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {showReserveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Finalizar Reserva</CardTitle>
              <CardDescription>Preencha seus dados para reservar {carrinho.length} ponto(s). O valor total é de R$ {totalCarrinho.toFixed(2)}.</CardDescription>
            </CardHeader>
            <CardContent>
              <ReservationForm 
                cartItems={carrinho.map(item => ({ point_id: item.id, periodo_anos: item.periodo }))}
                onClose={() => setShowReserveModal(false)}
                onReservationSuccess={handleReservationSuccess}
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default HomePage;
