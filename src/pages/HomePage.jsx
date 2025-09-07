import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
import { supabase, createOrder } from '../lib/supabase.js';
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
        supabase.from('pontos').select('*'),
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
            status: p.status, 
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

  // --- Lógica de Filtro ---
  const displayedPontos = pontos.filter(ponto => {
    if (filterTagId === 'all') return true;
    return pointTags.some(pt => pt.point_id === ponto.id && String(pt.tag_id) === String(filterTagId));
  });

  const onLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);

  // --- EFEITO CORRIGIDO PARA CONTROLAR O MAPA ---
  useEffect(() => {
    if (!mapRef.current) return;

    // Se o filtro for limpo para "todos", ajusta o mapa para todos os pontos
    if (filterTagId === 'all' && pontos.length > 0) {
        const bounds = new window.google.maps.LatLngBounds();
        pontos.forEach(ponto => {
            bounds.extend({ lat: ponto.lat, lng: ponto.lng });
        });
        mapRef.current.fitBounds(bounds);
        return;
    }

    // Se a lista de pontos filtrados está vazia, reseta para o centro
    if (displayedPontos.length === 0 && filterTagId !== 'all') {
        mapRef.current.panTo(center);
        mapRef.current.setZoom(15);
        return;
    }

    // Se há apenas um ponto, centraliza nele
    if (displayedPontos.length === 1) {
        mapRef.current.panTo({ lat: displayedPontos[0].lat, lng: displayedPontos[0].lng });
        mapRef.current.setZoom(17);
        return;
    }

    // Se há múltiplos pontos, ajusta para mostrar todos
    if (displayedPontos.length > 1) {
        const bounds = new window.google.maps.LatLngBounds();
        displayedPontos.forEach(ponto => {
            bounds.extend({ lat: ponto.lat, lng: ponto.lng });
        });
        mapRef.current.fitBounds(bounds);
    }
  }, [displayedPontos, filterTagId, pontos, center]);


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

  // --- Submissão da Reserva ---
  const handleReserveSubmit = async (e) => {
    e.preventDefault();
    if (carrinho.length === 0) return;

    const customerData = {
      name: reserveData.nome,
      email: reserveData.email,
      phone: reserveData.telefone,
    };
    
    const cartItems = carrinho.map(item => ({
      ponto_id: item.id,
      periodo_anos: item.periodo,
      price: item.preco,
    }));

    try {
      const result = await createOrder(customerData, cartItems);
      console.log('Pedido criado com sucesso!', result);

      const pontosIdsReservados = carrinho.map(p => p.id);
      setPontos(pontos.map(p => pontosIdsReservados.includes(p.id) ? { ...p, status: 'reserved' } : p));
      
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
  const totalPontosDisponiveis = pontos.filter(p => p.status === 'available').length;
  const totalPontosReservados = pontos.filter(p => p.status === 'reserved').length;
  const totalPontosVendidos = pontos.filter(p => p.status === 'sold').length;

  // --- Renderização do Componente ---
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg-col-span-1 space-y-8">
            {/* Cards de Informação e Carrinho */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" />Informações Gerais</CardTitle>
                <CardDescription>Disponibilidade dos pontos</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                 <div className="space-y-2">
                    <div className="flex items-center justify-between"><span className="text-sm">Total de pontos:</span><span className="font-semibold">{pontos.length}</span></div>
                    <div className="flex items-center justify-between"><span className="text-sm flex items-center gap-1.5"><div className="w-3 h-3 bg-green-500 rounded-full"></div>Disponíveis:</span><span className="font-semibold text-green-600">{totalPontosDisponiveis}</span></div>
                    <div className="flex items-center justify-between"><span className="text-sm flex items-center gap-1.5"><div className="w-3 h-3 bg-yellow-500 rounded-full"></div>Reservados:</span><span className="font-semibold text-yellow-600">{totalPontosReservados}</span></div>
                    <div className="flex items-center justify-between"><span className="text-sm flex