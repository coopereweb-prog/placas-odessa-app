import { useState } from 'react';
import { InfoWindow } from '@react-google-maps/api';
import { Badge } from '@/components/ui/badge';
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from '@/components/ui/button';
import { ShoppingCart, Eye, Clock } from 'lucide-react';
import { getStatusBadge } from '../lib/utils.js';

export function PontoInfoWindow({ ponto, onAddToCart, onClose }) {
  const [periodo, setPeriodo] = useState("2");

  const handleAddToCartClick = () => {
    onAddToCart(ponto, parseInt(periodo));
  };

  const handleStreetViewClick = () => {
    const streetViewUrl = `http://maps.google.com/maps?q=&layer=c&cbll=${ponto.lat},${ponto.lng}`;
    window.open(streetViewUrl, '_blank');
  };

  const statusInfo = getStatusBadge(ponto.status);

  return (
    <InfoWindow position={{ lat: ponto.lat, lng: ponto.lng }} onCloseClick={onClose}>
      <div className="p-2 max-w-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-lg">{ponto.endereco}</h3>
          <Badge className={`${statusInfo.className} text-white`}>{statusInfo.label}</Badge>
        </div>
        <div className="space-y-2 mb-4">
          <p className="text-sm"><strong>Descrição:</strong> {ponto.descricao}</p>
        </div>

        {ponto.status === 'disponivel' && (
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
              <Button variant="outline" size="sm" className="w-full" onClick={handleStreetViewClick}>
                <Eye className="h-4 w-4 mr-2" />Ver Street View
              </Button>
            </div>
          </div>
        )}
        {ponto.status === 'reservado' && (<div className="text-center"><p className="text-sm text-yellow-600 mb-2"><Clock className="h-4 w-4 inline mr-1" />Reservado</p></div>)}
        {ponto.status === 'vendido' && (<div className="text-center"><p className="text-sm text-red-600 mb-2">Contratado até: {ponto.sold_until ? new Date(ponto.sold_until).toLocaleDateString('pt-BR') : 'Indisponível'}</p></div>)}
      </div>
    </InfoWindow>
  );
}