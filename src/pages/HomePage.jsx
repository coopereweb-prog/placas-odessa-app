import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
import { supabase, createOrder } from '../lib/supabase.js'; // Usando o createOrder que criamos
import { PontoInfoWindow } from '../components/PontoInfoWindow.jsx';
import Header from '../components/Header.jsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, ShoppingCart, Trash2, User, Mail, Phone } from 'lucide-react';

// --- Constantes do Componente (definidas uma vez) ---
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
  disponivel: {
    path: 'M-8,0a8,8 0 1,0 16,0a8,8 0 1,0 -16,0',
    fillColor: '#22c55e', // Verde
    fillOpacity: 0.9,
    scale: 1,
    strokeColor: 'white',
    strokeWeight: 2,
  },
  reservado: {
    path: 'M-8,0a8,8 0 1,0 16,0a8,8 0 1,0 -16,0',
    fillColor: '#eab308', // Amarelo
    fillOpacity: 0.9,
    scale: 1,
    strokeColor: 'white',
    strokeWeight: 2,
  },
  vendido: {
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
  const [pontos, setPontos] = useState([]);
  const [tags, setTags] = useState([]);
  const [pointTags, setPointTags] = useState([]);
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [carrinho, setCarrinho] = useState([]);
  const [showReserveModal, setShowReserveModal] = useState(false);
  const [reserveData, setReserveData] = useState({ nome: '', email: '', telefone: '' });
  const [filterTagId, setFilterTagId] = useState('all');
  const mapRef = useRef(null);

  // --- Efeito para Carregar Dados Iniciais ---
  useEffect(() => {
    async function getInitialData() {
      // Usando Promise.all para carregar dados em paralelo
      const [pointsResponse, tagsResponse, pointTagsResponse] = await Promise.all([
        supabase.from('pontos').select('*'), // CORRIGIDO: nome da tabela para 'pontos'
        supabase.from('tags').select('*').order('name', { ascending: true }),
        supabase.from('point_tags').select('*')
      ]);

      if (pointsResponse.error) {
        console.error("Erro ao buscar pontos:", pointsResponse.error);
        alert("Não foi possível carregar os pontos do mapa.");
      } else {
        const pontosFormatados = pointsResponse.data
          .filter(p => p.latitude && p.longitude)
          .map(p => ({
            ...p,
            lat: parseFloat(p.latitude),
            lng: parseFloat(p.longitude),
            endereco: p.name,
            descricao: p.description,
            // Garantindo que o status seja um dos esperados
            status: p.status ? p.status : 'disponivel', 
          }));
        setPontos(pontosFormatados);
      }

      if (tagsResponse.error) console.error("Erro ao buscar tags:", tagsResponse.error);
      else setTags(tagsResponse.data);

      if (pointTagsResponse.error) console.error("Erro ao buscar point_tags:", pointTagsResponse.error);
      else setPointTags(pointTagsResponse.data);
    }
    getInitialData();
  }, []);

  // --- Lógica de Filtro e Mapa ---
  const displayedPontos = pontos.filter(ponto => {
    if (filterTagId === 'all') return true;
    return pointTags.some(pt => pt.point_id === ponto.id && String(pt.tag_id) === String(filterTagId));
  });

  const onLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);
  
  // --- Lógica do Carrinho ---
  const handleAdicionarAoCarrinho = (ponto, periodo) => {
    if (carrinho.some(item => item.id === ponto.id)) {
      alert("Este ponto já está no seu carrinho.");
      return;
    }
    const preco = periodo === 2 ? ponto.price_2y : ponto.price_3y;
    setCarrinho([...carrinho, { ...ponto, periodo, preco }]);
    setSelectedMarker(null);
  };

  const handleRemoverDoCarrinho = (pontoId) => {
    setCarrinho(carrinho.filter(item => item.id !== pontoId));
  };

  const handleUpdatePeriodoCarrinho = (pontoId, novoPeriodo) => {
    setCarrinho(carrinho.map(item => {
      if (item.id === pontoId) {
        const novoPreco = novoPeriodo === 2 ? item.price_2y : item.price_3y;
        return { ...item, periodo: novoPeriodo, preco: novoPreco };
      }
      return item;
    }));
  };

  // --- Submissão da Reserva (LÓGICA NOVA E SEGURA) ---
  const handleReserveSubmit = async (e) => {
    e.preventDefault();
    if (carrinho.length === 0) return;

    const customerData = {
      name: reserveData.nome,
      email: reserveData.email,
      phone: reserveData.telefone,
    };
    
    // Formata os itens para a Edge Function
    const cartItems = carrinho.map(item => ({
      ponto_id: item.id,
      periodo_anos: item.periodo,
      price: item.preco,
    }));

    try {
      // Chama a nova função segura que criamos
      const result = await createOrder(customerData, cartItems);
      console.log('Pedido criado com sucesso!', result);

      // Atualiza a interface para o usuário ver os pontos como 'reservado'
      const pontosIdsReservados = carrinho.map(p => p.id);
      setPontos(pontos.map(p => pontosIdsReservados.includes(p.id) ? { ...p, status: 'reservado' } : p));
      
      // Limpa o formulário e o carrinho
      setShowReserveModal(false);
      setCarrinho([]);
      setReserveData({ nome: '', email: '', telefone: '' });
      alert('Pedido de reserva enviado com sucesso! Entraremos em contato em breve.');

    } catch (error) {
      alert(`Falha ao criar o pedido: ${error.message}`);
      console.error("Erro detalhado ao chamar createOrder:", error);
    }
  };
  
  // --- Cálculos para Exibição ---
  const totalCarrinho = carrinho.reduce((total, item) => total + (item.preco || 0), 0);
  const totalPontosDisponiveis = pontos.filter(p => p.status === 'disponivel').length;
  const totalPontosReservados = pontos.filter(p => p.status === 'reservado').length;
  const totalPontosVendidos = pontos.filter(p => p.status === 'vendido').length;

  // --- Renderização do Componente ---
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1 space-y-8">
            {/* Card de Informações */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" />Informações Gerais</CardTitle>
                <CardDescription>
                  Disponibilidade dos pontos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                 <div className="space-y-2">
                    <div className="flex items-center justify-between"><span className="text-sm">Total de pontos:</span><span className="font-semibold">{pontos.length}</span></div>
                    <div className="flex items-center justify-between"><span className="text-sm flex items-center gap-1.5"><div className="w-3 h-3 bg-green-500 rounded-full"></div>Disponíveis:</span><span className="font-semibold text-green-600">{totalPontosDisponiveis}</span></div>
                    <div className="flex items-center justify-between"><span className="text-sm flex items-center gap-1.5"><div className="w-3 h-3 bg-yellow-500 rounded-full"></div>Reservados:</span><span className="font-semibold text-yellow-600">{totalPontosReservados}</span></div>
                    <div className="flex items-center justify-between"><span className="text-sm flex items-center gap-1.5"><div className="w-3 h-3 bg-red-500 rounded-full"></div>Vendidos:</span><span className="font-semibold text-red-600">{totalPontosVendidos}</span></div>
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
            
            {/* Card do Carrinho */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5" />Carrinho de Reservas</CardTitle>
                <CardDescription>{carrinho.length === 0 ? "Seu carrinho está vazio." : `Você tem ${carrinho.length} ponto(s) no carrinho.`}</CardDescription>
              </CardHeader>
              <CardContent>
                {carrinho.length > 0 && (
                  <div className="space-y-4">
                    <div className="max-h-60 overflow-y-auto space-y-3 pr-2">
                      {carrinho.map(ponto => (
                        <div key={ponto.id} className="flex items-start justify-between text-sm p-2 bg-gray-100 rounded-md">
                          <div className="flex-1">
                            <p className="font-medium">{ponto.endereco}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <select value={ponto.periodo} onChange={(e) => handleUpdatePeriodoCarrinho(ponto.id, parseInt(e.target.value))} className="text-xs border-gray-300 rounded-md">
                                <option value="2">2 Anos</option>
                                <option value="3">3 Anos</option>
                              </select>
                              <p className="font-semibold">R$ {ponto.preco?.toFixed(2)}</p>
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => handleRemoverDoCarrinho(ponto.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
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

          {/* Mapa Interativo */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader><CardTitle>Mapa Interativo - Pontos de Instalação</CardTitle><CardDescription>Clique nos marcadores para ver detalhes e adicionar ao carrinho</CardDescription></CardHeader>
              <CardContent>
                <LoadScript googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
                  <GoogleMap mapContainerStyle={containerStyle} center={center} zoom={15} onLoad={onLoad} options={mapOptions}>
                    {displayedPontos.map((ponto) => (
                      <Marker 
                        key={ponto.id} 
                        position={{ lat: ponto.lat, lng: ponto.lng }} 
                        icon={markerIcons[ponto.status] || markerIcons.disponivel} 
                        onClick={() => setSelectedMarker(ponto)} 
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

      {/* Modal de Reserva */}
      {showReserveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader><CardTitle>Finalizar Reserva</CardTitle><CardDescription>Preencha seus dados para reservar {carrinho.length} ponto(s)</CardDescription></CardHeader>
            <CardContent>
              <form onSubmit={handleReserveSubmit} className="space-y-4">
                <div><label className="block text-sm font-medium mb-1.5"><User className="h-4 w-4 inline mr-1" />Nome Completo</label><input type="text" required className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" value={reserveData.nome} onChange={(e) => setReserveData({...reserveData, nome: e.target.value})} placeholder="Seu nome completo" /></div>
                <div><label className="block text-sm font-medium mb-1.5"><Mail className="h-4 w-4 inline mr-1" />E-mail</label><input type="email" required className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" value={reserveData.email} onChange={(e) => setReserveData({...reserveData, email: e.target.value})} placeholder="seu@email.com" /></div>
                <div><label className="block text-sm font-medium mb-1.5"><Phone className="h-4 w-4 inline mr-1" />Telefone</label><input type="tel" required className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500" value={reserveData.telefone} onChange={(e) => setReserveData({...reserveData, telefone: e.target.value})} placeholder="(00) 00000-0000" /></div>
                <div className="flex gap-3 pt-4"><Button type="button" variant="outline" className="flex-1" onClick={() => setShowReserveModal(false)}>Cancelar</Button><Button type="submit" className="flex-1 bg-green-600 hover:bg-green-700">Confirmar Reserva</Button></div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default HomePage;