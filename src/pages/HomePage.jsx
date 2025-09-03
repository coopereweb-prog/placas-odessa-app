import { useState, useCallback, useEffect, useRef } from 'react'
import { GoogleMap, LoadScript, Marker, InfoWindow } from '@react-google-maps/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Clock, Eye, Phone, Mail, User, ShoppingCart, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import '../App.css'

const mapContainerStyle = {
  width: '100%',
  height: '600px'
}

const center = {
  lat: -22.7856,
  lng: -47.2975
}

const mapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: true,
  mapTypeControl: true,
  fullscreenControl: true,
}

const markerIcons = {
  available: {
    url: 'data:image/svg+xml;base64,' + btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#22c55e"><circle cx="12" cy="12" r="10" stroke="white" stroke-width="2"/></svg>`),
    scaledSize: { width: 32, height: 32 }
  },
  reserved: {
    url: 'data:image/svg+xml;base64,' + btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#eab308"><circle cx="12" cy="12" r="10" stroke="white" stroke-width="2"/></svg>`),
    scaledSize: { width: 32, height: 32 }
  },
  sold: {
    url: 'data:image/svg+xml;base64,' + btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#ef4444"><circle cx="12" cy="12" r="10" stroke="white" stroke-width="2"/></svg>`),
    scaledSize: { width: 32, height: 32 }
  }
}

const getStatusBadge = (status) => {
  const statusConfig = {
    available: { label: 'Disponível', className: 'bg-green-500 hover:bg-green-600' },
    reserved: { label: 'Reservado', className: 'bg-yellow-500 hover:bg-yellow-600' },
    sold: { label: 'Vendido', className: 'bg-red-500 hover:bg-red-600' }
  };
  return statusConfig[status] || statusConfig.available;
};

function PontoInfoWindow({ ponto, onAddToCart, onClose }) {
  const [periodo, setPeriodo] = useState("2");

  const handleAddToCartClick = () => {
    onAddToCart(ponto, parseInt(periodo));
  };

  return (
    <InfoWindow position={{ lat: ponto.lat, lng: ponto.lng }} onCloseClick={onClose}>
      <div className="p-2 max-w-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-lg">{ponto.endereco}</h3>
          <Badge className={`${getStatusBadge(ponto.status).className} text-white`}>{getStatusBadge(ponto.status).label}</Badge>
        </div>
        <div className="space-y-2 mb-4">
          <p className="text-sm"><strong>Descrição:</strong> {ponto.descricao}</p>
        </div>
        {ponto.status === 'available' && (
          <div className="space-y-4">
            <div>
              <Label className="font-semibold">Período de Veiculação:</Label>
              <RadioGroup defaultValue="2" onValueChange={setPeriodo} className="mt-2">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="2" id={`p${ponto.id}-2y`} />
                  <Label htmlFor={`p${ponto.id}-2y`}>2 Anos - R$ {ponto.price_2y?.toFixed(2) || 'N/A'}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="3" id={`p${ponto.id}-3y`} />
                  <Label htmlFor={`p${ponto.id}-3y`}>3 Anos - R$ {ponto.price_3y?.toFixed(2) || 'N/A'}</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Button onClick={handleAddToCartClick} className="w-full bg-green-600 hover:bg-green-700">
                <ShoppingCart className="h-4 w-4 mr-2" />
                Adicionar ao Carrinho
              </Button>
              <Button variant="outline" size="sm" className="w-full" onClick={() => {
                const streetViewUrl = `https://www.google.com/maps?q&layer=c&cbll=${ponto.lat},${ponto.lng}`;
                window.open(streetViewUrl, '_blank');
              }}><Eye className="h-4 w-4 mr-2" />Ver Street View</Button>
            </div>
          </div>
        )}
        {ponto.status === 'reserved' && (<div className="text-center"><p className="text-sm text-yellow-600 mb-2"><Clock className="h-4 w-4 inline mr-1" />Reservado</p></div>)}
{ponto.status === 'sold' && (
  <div className="text-center">
    <p className="text-sm text-red-600 mb-2">
  Contratado até: {ponto.sold_until ? new Date(ponto.sold_until).toLocaleDateString('pt-BR') : 'Indisponível'}
</p>
  </div>
)}      </div>
    </InfoWindow>
  );
}


function HomePage() {
  const [selectedMarker, setSelectedMarker] = useState(null)
  const [pontos, setPontos] = useState([])
  const [showReserveModal, setShowReserveModal] = useState(false)
  const [reserveData, setReserveData] = useState({ nome: '', email: '', telefone: '' })
  const [carrinho, setCarrinho] = useState([])
  
  const [tags, setTags] = useState([]);
  const [pointTags, setPointTags] = useState([]);
  const [filterTagId, setFilterTagId] = useState('all');
  
  const mapRef = useRef(null);

  useEffect(() => {
    async function getInitialData() {
      const [pointsResponse, tagsResponse, pointTagsResponse] = await Promise.all([
        supabase.from('points').select('*'),
        supabase.from('tags').select('*').order('name', { ascending: true }),
        supabase.from('point_tags').select('*')
      ]);

      if (pointsResponse.error) {
        console.error("Erro ao buscar pontos do Supabase:", pointsResponse.error);
        alert("Não foi possível carregar os pontos do mapa.");
      } else {
        const pontosValidos = pointsResponse.data.filter(p => p.latitude && p.longitude);
        const pontosFormatados = pontosValidos.map(p => ({
          ...p,
          lat: parseFloat(p.latitude),
          lng: parseFloat(p.longitude),
          endereco: p.name,
          descricao: p.description
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

  const displayedPontos = pontos.filter(ponto => {
    if (filterTagId === 'all') {
      return true;
    }
    return pointTags.some(pt => pt.point_id === ponto.id && pt.tag_id === filterTagId);
  });
  
  const onLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);
  
  useEffect(() => {
    if (mapRef.current && displayedPontos.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      displayedPontos.forEach(p => bounds.extend({ lat: p.lat, lng: p.lng }));
      mapRef.current.fitBounds(bounds);
      
      const listener = window.google.maps.event.addListener(mapRef.current, "idle", function() {
        if (mapRef.current.getZoom() > 17) mapRef.current.setZoom(17);
        window.google.maps.event.removeListener(listener);
      });
    } else if (mapRef.current && displayedPontos.length === 0 && filterTagId !== 'all') {
        mapRef.current.panTo(center);
        mapRef.current.setZoom(15);
    }
  }, [displayedPontos, filterTagId]);

  const handleMarkerClick = (ponto) => {
    setSelectedMarker(ponto);
  };

  const handleAdicionarAoCarrinho = (ponto, periodo) => {
    if (carrinho.find(item => item.id === ponto.id)) {
      alert("Este ponto já está no seu carrinho.");
      return;
    }
    const preco = periodo === 2 ? ponto.price_2y : ponto.price_3y;
    setCarrinho([...carrinho, { ...ponto, periodo, preco }]);
    setSelectedMarker(null);
  }
  
  const handleRemoverDoCarrinho = (pontoId) => {
    setCarrinho(carrinho.filter(item => item.id !== pontoId));
  }

  const handleUpdatePeriodoCarrinho = (pontoId, novoPeriodo) => {
    setCarrinho(carrinho.map(item => {
      if (item.id === pontoId) {
        const novoPreco = novoPeriodo === 2 ? item.price_2y : item.price_3y;
        return { ...item, periodo: novoPeriodo, preco: novoPreco };
      }
      return item;
    }));
  }

  const handleReserveSubmit = async (e) => {
    e.preventDefault();
    if (carrinho.length === 0) return;

    const totalAmount = carrinho.reduce((total, item) => total + (item.preco || 0), 0);
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_name: reserveData.nome,
        customer_email: reserveData.email,
        customer_phone: reserveData.telefone,
        total_amount: totalAmount,
        status: 'pending',
      })
      .select()
      .single();

    if (orderError || !orderData) {
      alert("Ocorreu um erro ao criar o seu pedido.");
      console.error("Erro ao inserir order:", orderError);
      return;
    }

    const orderItems = carrinho.map(ponto => ({
      order_id: orderData.id,
      point_id: ponto.id,
      price: ponto.preco,
    }));

    const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
    
    if (itemsError) {
      alert("Ocorreu um erro ao salvar os itens do seu pedido.");
      console.error("Erro ao inserir order_items:", itemsError);
      return;
    }

    const pontosIds = carrinho.map(p => p.id);
    const { error: updateError } = await supabase
      .from('points')
      .update({ status: 'reserved' })
      .in('id', pontosIds);
    
    if (updateError) {
      alert("Ocorreu um erro ao atualizar o status dos pontos.");
      console.error("Erro ao atualizar pontos:", updateError);
      return;
    }
    
    setPontos(pontos.map(p => pontosIds.includes(p.id) ? { ...p, status: 'reserved' } : p));
    setShowReserveModal(false);
    setCarrinho([]);
    setReserveData({ nome: '', email: '', telefone: '' });
    alert('Pedido de reserva enviado com sucesso!');
  }
  
  const totalCarrinho = carrinho.reduce((total, item) => total + (item.preco || 0), 0);
  
  const totalPontosDisponiveis = pontos.filter(p => p.status === 'available').length;
  const totalPontosReservados = pontos.filter(p => p.status === 'reserved').length;
  const totalPontosVendidos = pontos.filter(p => p.status === 'sold').length;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-md border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div><h1 className="text-3xl font-bold text-gray-800">Placas Nova Odessa</h1><p className="text-gray-500 mt-1">Sistema de Gestão de Placas de Logradouros</p></div>
            <div className="flex items-center space-x-6">
              <div className="text-center"><div className="text-2xl font-bold text-green-600">{totalPontosDisponiveis}</div><div className="text-sm text-gray-500">Disponíveis</div></div>
              <div className="text-center"><div className="text-2xl font-bold text-yellow-600">{totalPontosReservados}</div><div className="text-sm text-gray-500">Reservados</div></div>
              <div className="text-center"><div className="text-2xl font-bold text-red-600">{totalPontosVendidos}</div><div className="text-sm text-gray-500">Vendidos</div></div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1 space-y-8">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" />Bairro São Jorge</CardTitle><CardDescription>Prova de conceito do sistema de placas</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between"><span className="text-sm">Total de pontos:</span><span className="font-semibold">{displayedPontos.length}</span></div>
                  <div className="flex items-center justify-between"><span className="text-sm flex items-center gap-1.5"><div className="w-3 h-3 bg-green-500 rounded-full"></div>Disponíveis:</span><span className="font-semibold text-green-600">{displayedPontos.filter(p => p.status === 'available').length}</span></div>
                  <div className="flex items-center justify-between"><span className="text-sm flex items-center gap-1.5"><div className="w-3 h-3 bg-yellow-500 rounded-full"></div>Reservados:</span><span className="font-semibold text-yellow-600">{displayedPontos.filter(p => p.status === 'reserved').length}</span></div>
                  <div className="flex items-center justify-between"><span className="text-sm flex items-center gap-1.5"><div className="w-3 h-3 bg-red-500 rounded-full"></div>Vendidos:</span><span className="font-semibold text-red-600">{displayedPontos.filter(p => p.status === 'sold').length}</span></div>
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
                                <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>
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

          <div className="lg:col-span-3">
            <Card>
              <CardHeader><CardTitle>Mapa Interativo - Pontos de Instalação</CardTitle><CardDescription>Clique nos marcadores para ver detalhes e adicionar ao carrinho</CardDescription></CardHeader>
              <CardContent>
                <LoadScript googleMapsApiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}>
                  <GoogleMap mapContainerStyle={mapContainerStyle} center={center} zoom={15} onLoad={onLoad} options={mapOptions}>
                    {displayedPontos.map((ponto) => (
                      <Marker key={ponto.id} position={{ lat: ponto.lat, lng: ponto.lng }} icon={markerIcons[ponto.status]} onClick={() => handleMarkerClick(ponto)} />
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
  )
}

export default HomePage

