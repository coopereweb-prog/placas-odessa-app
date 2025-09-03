import { useState } from 'react';
import { createOrder } from '../lib/supabase'; // Importa a nova função
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';

// Este componente recebe os itens do carrinho e funções para controlar o seu estado
export function ReservationForm({ cartItems, onClose, onReservationSuccess }) {
  const [customerData, setCustomerData] = useState({ name: '', email: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setCustomerData((prev) => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Chama a função `createOrder` que invoca a Edge Function
      const data = await createOrder(customerData, cartItems);

      // Se a chamada for bem-sucedida
      console.log('Pedido criado com sucesso! ID:', data.orderId);
      setSuccess(true);
      onReservationSuccess(); // Chama a função para limpar o carrinho no componente pai

    } catch (err) {
      // Captura erros vindos da Edge Function (ex: ponto já reservado)
      // A mensagem de erro da nossa Edge Function vem em `err.context.error`
      const friendlyMessage = err.context?.error || 'Não foi possível completar sua reserva. Por favor, tente novamente.';
      setError(friendlyMessage);
      console.error('Erro ao criar reserva:', err);
    } finally {
      setLoading(false);
    }
  };

  // Se a reserva foi bem-sucedida, mostra uma mensagem de sucesso
  if (success) {
    return (
      // A variant 'success' não é padrão no shadcn/ui. Usamos o padrão com um ícone.
      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertTitle>Reserva Realizada com Sucesso!</AlertTitle>
        <AlertDescription>
          Sua reserva foi confirmada. Entraremos em contato em breve com os próximos passos.
        </AlertDescription>
        <Button onClick={onClose} className="mt-4 w-full">Fechar</Button>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nome Completo</Label>
        <Input id="name" type="text" placeholder="Seu nome" required value={customerData.name} onChange={handleInputChange} disabled={loading} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" type="email" placeholder="seu@email.com" required value={customerData.email} onChange={handleInputChange} disabled={loading} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Telefone / WhatsApp</Label>
        <Input id="phone" type="tel" placeholder="(19) 99999-9999" required value={customerData.phone} onChange={handleInputChange} disabled={loading} />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Ocorreu um Erro</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end space-x-4">
         <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
         </Button>
         <Button type="submit" className="w-40" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : 'Confirmar Reserva'}
         </Button>
      </div>
    </form>
  );
}
