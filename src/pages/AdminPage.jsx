import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from '@/components/ui/input';
import { User, Mail, Phone, MapPin, Calendar, CheckCircle, XCircle, LogOut, Paperclip, UploadCloud } from 'lucide-react';

function AdminPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedFiles, setSelectedFiles] = useState({});
  const [uploading, setUploading] = useState({});
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const checkUserAndFetchOrders = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
        return;
      }
      setUser(session.user);
      fetchOrders(activeTab);
    };
    checkUserAndFetchOrders();
  }, [navigate, activeTab]);

  const fetchOrders = async (status) => {
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id, created_at, updated_at, customer_name, customer_email, customer_phone, total_amount, payment_receipt_url,
        order_items (
          id, price, periodo_anos,
          points (id, rua_principal)
        )
      `)
      .eq('status', status)
      .order('created_at', { ascending: true });

    if (error) {
      console.error("Erro ao buscar pedidos:", error);
      alert("Não foi possível carregar os pedidos pendentes.");
    } else {
      setOrders(data);
    }
    setLoading(false);
  };

  const handleFileChange = (orderId, file) => {
    setSelectedFiles(prev => ({ ...prev, [orderId]: file }));
  };

  const handleUploadReceipt = async (order) => {
    const file = selectedFiles[order.id];
    if (!file) {
      alert('Por favor, selecione um arquivo primeiro.');
      return;
    }

    setUploading(prev => ({ ...prev, [order.id]: true }));

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${order.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('order-receipts')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('order-receipts')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('orders')
        .update({ payment_receipt_url: urlData.publicUrl })
        .eq('id', order.id);

      if (updateError) throw updateError;

      alert('Comprovante enviado com sucesso!');
      fetchOrders(activeTab);
    } catch (error) {
      console.error("Erro no upload do comprovante:", error);
      alert(`Falha ao enviar comprovante: ${error.message}`);
    } finally {
      setUploading(prev => ({ ...prev, [order.id]: false }));
    }
  };

  const handleConfirmVenda = async (order) => {
    if (!window.confirm(`Confirmar a venda para ${order.customer_name}?`)) return;

    try {
      // 1. Atualizar o status dos pontos para 'vendido' e definir a data de expiração
      for (const item of order.order_items) {
        const soldUntil = new Date();
        soldUntil.setFullYear(soldUntil.getFullYear() + item.periodo_anos);
        
        const { error: pointError } = await supabase
          .from('points')
          .update({ status: 'vendido', sold_until: soldUntil.toISOString() })
          .eq('id', item.points.id);

        if (pointError) throw new Error(`Erro ao atualizar ponto ${item.points.id}: ${pointError.message}`);
      }

      // 2. Atualizar o status do pedido para 'completed'
      const { error: orderError } = await supabase
        .from('orders')
        .update({ status: 'completed' })
        .eq('id', order.id);

      if (orderError) throw new Error(`Erro ao atualizar pedido: ${orderError.message}`);

      alert('Venda confirmada com sucesso!');
      fetchOrders(activeTab); // Recarrega a lista de pedidos pendentes
    } catch (error) {
      console.error(error);
      alert(`Falha ao confirmar venda: ${error.message}`);
    }
  };

  const handleCancelReserva = async (order) => {
    if (!window.confirm(`Cancelar a reserva para ${order.customer_name}?`)) return;

    try {
      // 1. Reverter o status dos pontos para 'disponivel'
      const pointIds = order.order_items.map(item => item.points.id);
      const { error: pointError } = await supabase
        .from('points')
        .update({ status: 'disponivel' })
        .in('id', pointIds);

      if (pointError) throw new Error(`Erro ao reverter pontos: ${pointError.message}`);

      // 2. Atualizar o status do pedido para 'cancelled'
      const { error: orderError } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', order.id);

      if (orderError) throw new Error(`Erro ao cancelar pedido: ${orderError.message}`);

      alert('Reserva cancelada com sucesso!');
      fetchOrders(activeTab); // Recarrega a lista de pedidos pendentes
    } catch (error) {
      console.error(error);
      alert(`Falha ao cancelar reserva: ${error.message}`);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Painel Administrativo</h1>
          <p className="text-gray-600">Gerenciamento de Pedidos</p>
        </div>
        <Button onClick={handleLogout} variant="outline">
          <LogOut className="h-4 w-4 mr-2" /> Sair
        </Button>
      </header>

      <main>
        <Tabs defaultValue="pending" onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending">Pendentes</TabsTrigger>
            <TabsTrigger value="completed">Concluídos</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelados</TabsTrigger>
          </TabsList>

          {['pending', 'completed', 'cancelled'].map(status => (
            <TabsContent key={status} value={status}>
              {orders.length === 0 ? (
                <p className="text-center text-gray-500 mt-16">Nenhum pedido com status '{status}'.</p>
              ) : (
                <div className="space-y-6 mt-6">
                  {orders.map(order => (
                    <Card key={order.id}>
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle>Pedido #{order.id}</CardTitle>
                            <CardDescription>
                              {status === 'pending' && `Recebido em: ${new Date(order.created_at).toLocaleString('pt-BR')}`}
                              {status === 'completed' && `Concluído em: ${new Date(order.updated_at).toLocaleString('pt-BR')}`}
                              {status === 'cancelled' && `Cancelado em: ${new Date(order.updated_at).toLocaleString('pt-BR')}`}
                            </CardDescription>
                          </div>
                          <Badge variant="secondary">Total: R$ {order.total_amount.toFixed(2)}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <h4 className="font-semibold">Dados do Cliente</h4>
                          <p className="text-sm flex items-center"><User className="h-4 w-4 mr-2 text-gray-500" /> {order.customer_name}</p>
                          <p className="text-sm flex items-center"><Mail className="h-4 w-4 mr-2 text-gray-500" /> {order.customer_email}</p>
                          <p className="text-sm flex items-center"><Phone className="h-4 w-4 mr-2 text-gray-500" /> {order.customer_phone}</p>
                        </div>
                        <div className="space-y-3">
                          <h4 className="font-semibold">Itens do Pedido</h4>
                          {order.order_items.map(item => (
                            <div key={item.id} className="text-sm flex justify-between items-center bg-gray-50 p-2 rounded-md">
                              <span className="flex items-center"><MapPin className="h-4 w-4 mr-2 text-gray-500" /> {item.points.rua_principal}</span>
                              <span className="flex items-center font-medium"><Calendar className="h-4 w-4 mr-2 text-gray-500" /> {item.periodo_anos} ano(s)</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>

                      {(status === 'pending' || order.payment_receipt_url) && (
                        <CardContent className="border-t pt-4">
                          <h4 className="font-semibold mb-3">Comprovante de Pagamento</h4>
                          {order.payment_receipt_url ? (
                            <a
                              href={order.payment_receipt_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center text-sm text-blue-600 hover:underline"
                            >
                              <Paperclip className="h-4 w-4 mr-2" /> Ver Comprovante Anexado
                            </a>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Input
                                type="file"
                                className="flex-1"
                                onChange={(e) => handleFileChange(order.id, e.target.files[0])}
                                disabled={uploading[order.id]}
                              />
                              <Button onClick={() => handleUploadReceipt(order)} disabled={!selectedFiles[order.id] || uploading[order.id]}>
                                <UploadCloud className="h-4 w-4 mr-2" /> {uploading[order.id] ? 'Enviando...' : 'Anexar'}
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      )}

                      {status === 'pending' && (
                        <div className="p-6 pt-4 flex gap-4">
                          <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => handleConfirmVenda(order)}>
                            <CheckCircle className="h-4 w-4 mr-2" /> Confirmar Venda
                          </Button>
                          <Button className="flex-1" variant="destructive" onClick={() => handleCancelReserva(order)}>
                            <XCircle className="h-4 w-4 mr-2" /> Cancelar Reserva
                          </Button>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </main>
    </div>
  );
}

export default AdminPage;