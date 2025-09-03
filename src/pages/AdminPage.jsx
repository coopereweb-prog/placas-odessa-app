import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LogOut, PlusCircle, Edit, Trash2, Inbox } from 'lucide-react';


const getStatusBadge = (status) => {
  const statusConfig = {
    available: { label: 'Disponível', className: 'bg-green-500 hover:bg-green-600' },
    reserved: { label: 'Reservado', className: 'bg-yellow-500 hover:bg-yellow-600' },
    sold: { label: 'Vendido', className: 'bg-red-500 hover:bg-red-600' }
  };
  return statusConfig[status] || statusConfig.available;
};

const formatDateForInput = (dateString) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return '';
    }
    return date.toISOString().slice(0, 10);
  } catch (error) {
    return '';
  }
};

const parseCurrency = (value) => parseFloat(String(value || '0').replace(',', '.'));

function AdminPage() {
  const [user, setUser] = useState(null);
  const [pontos, setPontos] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // State refatorado para o modal e formulário de ponto
  const initialPointState = { name: '', latitude: '', longitude: '', description: '', price_2y: '', price_3y: '', status: 'available', sold_until: null };
  const [activePoint, setActivePoint] = useState(null);

  const [tags, setTags] = useState([]);
  const [newTagName, setNewTagName] = useState('');
  const [selectedTags, setSelectedTags] = useState(new Set());

  const [filterTagId, setFilterTagId] = useState('all');
  const [pointTags, setPointTags] = useState([]);

  const [orders, setOrders] = useState([]);
  const [orderStatusFilter, setOrderStatusFilter] = useState('pending');

  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      navigate('/login');
      setLoading(false);
      return;
    }
    setUser(currentUser);

    const [pointsResponse, tagsResponse, pointTagsResponse, ordersResponse] = await Promise.all([
      supabase.from('points').select('*').order('created_at', { ascending: false }),
      supabase.from('tags').select('*').order('name', { ascending: true }),
      supabase.from('point_tags').select('*'),
      supabase.from('orders').select('*, order_items(*, points(name))').order('created_at', { ascending: false })
    ]);

    if (pointsResponse.error) console.error('Erro ao buscar pontos:', pointsResponse.error);
    else setPontos(pointsResponse.data);

    if (tagsResponse.error) console.error('Erro ao buscar tags:', tagsResponse.error);
    else setTags(tagsResponse.data);

    if (pointTagsResponse.error) console.error('Erro ao buscar point_tags:', pointTagsResponse.error);
    else setPointTags(pointTagsResponse.data);

    if (ordersResponse.error) console.error('Erro ao buscar orders:', ordersResponse.error);
    else setOrders(ordersResponse.data);

    setLoading(false);
  }, [navigate]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const savePointTags = async (pointId, currentSelectedTags) => {
    const { error: deleteError } = await supabase.from('point_tags').delete().eq('point_id', pointId);
    if (deleteError) {
      console.error('Erro ao apagar tags antigas:', deleteError);
      return;
    }
    if (currentSelectedTags.size > 0) {
      const tagsToInsert = Array.from(currentSelectedTags).map(tagId => ({
        point_id: pointId,
        tag_id: tagId,
      }));
      const { error: insertError } = await supabase.from('point_tags').insert(tagsToInsert);
      if (insertError) {
        console.error('Erro ao inserir novas tags:', insertError);
      }
    }
  };

  const handleAddPointSubmit = async (e) => {
    e.preventDefault();
    const pointToInsert = {
      name: activePoint.name,
      latitude: parseCurrency(activePoint.latitude),
      longitude: parseCurrency(activePoint.longitude),
      description: activePoint.description,
      price_2y: parseCurrency(activePoint.price_2y),
      price_3y: parseCurrency(activePoint.price_3y),
      status: 'available'
    };
    const { data, error } = await supabase.from('points').insert([pointToInsert]).select();
    if (error) {
      console.error('Erro ao adicionar novo ponto:', error);
      alert('Falha ao adicionar o ponto.');
    } else if (data) {
      const newPointData = data[0];
      await savePointTags(newPointData.id, selectedTags);
      
      // Atualiza o estado local em vez de refazer o fetch de tudo
      setPontos(prevPontos => [newPointData, ...prevPontos]);
      const { data: updatedPointTags, error: ptError } = await supabase.from('point_tags').select('*');
      if (ptError) console.error('Erro ao buscar point_tags:', ptError);
      else setPointTags(updatedPointTags);

      closeModal();
    }
  };

  const handleUpdatePointSubmit = async (e) => {
    e.preventDefault();
    if (!activePoint?.id) return;
    const pointToUpdate = { 
      name: activePoint.name, 
      latitude: parseCurrency(activePoint.latitude), 
      longitude: parseCurrency(activePoint.longitude), 
      description: activePoint.description, 
      price_2y: parseCurrency(activePoint.price_2y), 
      price_3y: parseCurrency(activePoint.price_3y),
      status: activePoint.status,
      sold_until: activePoint.status === 'sold' ? activePoint.sold_until : null,
    };
    const { data, error } = await supabase.from('points').update(pointToUpdate).eq('id', activePoint.id).select();

    if (error) {
      console.error('Erro ao atualizar o ponto:', error);
      alert('Falha ao atualizar o ponto.');
    } else if (data) {
      await savePointTags(activePoint.id, selectedTags);

      if (activePoint.status === 'sold') {
        const orderToUpdate = orders.find(o => o.order_items.some(item => item.point_id === activePoint.id));
        if (orderToUpdate) {
          await supabase.from('orders').update({ status: 'active' }).eq('id', orderToUpdate.id);
        }
      }

      const updatedPoint = data[0];
      setPontos(prevPontos => prevPontos.map(p => p.id === activePoint.id ? updatedPoint : p));
      const { data: updatedPointTags, error: ptError } = await supabase.from('point_tags').select('*');
      if (ptError) console.error('Erro ao buscar point_tags:', ptError);
      else setPointTags(updatedPointTags);

      closeModal();
    }
  };

  const handleEditClick = async (ponto) => {
    const { data, error } = await supabase.from('point_tags').select('tag_id').eq('point_id', ponto.id);
    if (!error) {
      const tagIds = new Set(data.map(item => item.tag_id));
      setSelectedTags(tagIds);
    }
    setActivePoint(ponto);
  };
  
  const handleAnalisarPedido = (orderItem) => {
    if (!orderItem || !orderItem.point_id) {
      alert("Este pedido não contém itens válidos para analisar.");
      return;
    }
    const pontoDoPedido = pontos.find(p => p.id === orderItem.point_id);
    if (pontoDoPedido) {
      handleEditClick(pontoDoPedido);
    } else {
      alert('Ponto não encontrado. Pode ter sido apagado.');
    }
  };

  const closeModal = () => {
    setActivePoint(null);
    setSelectedTags(new Set());
  };

  const handleFormChange = (e, field) => {
    const value = e.target.value;
    setActivePoint(prev => ({ ...prev, [field]: value }));
  };
  
  const handleStatusChange = (newStatus) => {
    if (activePoint) {
      setActivePoint(prev => ({ ...prev, status: newStatus }));
    }
  };

  const handleTagCheckboxChange = (tagId) => {
    const newSelectedTags = new Set(selectedTags);
    if (newSelectedTags.has(tagId)) {
      newSelectedTags.delete(tagId);
    } else {
      newSelectedTags.add(tagId);
    }
    setSelectedTags(newSelectedTags);
  };
  
  const handleAddNewTag = async () => {
    if (!newTagName.trim()) return alert('O nome da tag não pode estar vazio.');
    const { data, error } = await supabase.from('tags').insert({ name: newTagName.trim() }).select();
    if (error) {
      console.error('Erro ao adicionar tag:', error);
      alert('Falha ao adicionar a tag. Verifique se ela já existe.');
    } else if (data) {
      setTags([...tags, data[0]].sort((a, b) => a.name.localeCompare(b.name)));
      setNewTagName('');
    }
  };

  const handleDeletePoint = async (pointId) => {
    if (window.confirm('Tem a certeza de que deseja apagar este ponto? Esta ação não pode ser desfeita.')) {
      const { error } = await supabase.from('points').delete().eq('id', pointId);
      if (error) {
        console.error('Erro ao apagar o ponto:', error);
        alert('Falha ao apagar o ponto.');
      } else {
        setPontos(pontos.filter(p => p.id !== pointId));
        setPointTags(prev => prev.filter(pt => pt.point_id !== pointId));
      }
    }
  };

  const handleDeleteOrder = async (orderId) => {
    if (window.confirm('Tem a certeza de que deseja apagar este pedido? Os pontos voltarão a ficar disponíveis.')) {
      const { error } = await supabase.rpc('delete_order_and_revert_points', {
        order_id_to_delete: orderId
      });
      if (error) {
        console.error('Erro ao apagar o pedido:', error);
        alert('Falha ao apagar o pedido.');
      } else {
        setOrders(orders.filter(o => o.id !== orderId));
        const { data: pointsData, error: pointsError } = await supabase.from('points').select('*').order('created_at', { ascending: false });
        if (pointsError) console.error('Erro ao buscar pontos:', pointsError);
        else setPontos(pointsData);
      }
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const displayedPontos = useMemo(() => pontos.filter(ponto => {
    if (filterTagId === 'all') {
      return true;
    }
    return pointTags.some(pt => pt.point_id === ponto.id && pt.tag_id === filterTagId);
  }), [pontos, filterTagId, pointTags]);

  const displayedOrders = useMemo(() => orders.filter(order => {
    if (orderStatusFilter === 'all') return true;
    return order.status === orderStatusFilter;
  }), [orders, orderStatusFilter]);

  if (loading) return <div className="flex items-center justify-center min-h-screen">A carregar dados do painel...</div>;

  return (
    <>
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <header className="flex items-center justify-between mb-8">
             <div><h1 className="text-3xl font-bold text-gray-800">Painel de Administração</h1><p className="text-gray-500 mt-1">Bem-vindo, {user?.email}</p></div><Button onClick={handleLogout} variant="outline"><LogOut className="h-4 w-4 mr-2" />Sair</Button>
          </header>
          
          <main className="space-y-8">
            <Card>
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2"><Inbox className="h-5 w-5" /> Gestão de Pedidos (CRM)</CardTitle>
                  <CardDescription>Visualize e gira os pedidos pendentes e contratos ativos.</CardDescription>
                </div>
                <Select value={orderStatusFilter} onValueChange={setOrderStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="pending">Pendentes</SelectItem>
                        <SelectItem value="active">Contratos Ativos</SelectItem>
                        <SelectItem value="all">Todos os Pedidos</SelectItem>
                    </SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Pontos</TableHead>
                      <TableHead>Valor Total</TableHead>
                      <TableHead>Data do Pedido</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedOrders && displayedOrders.length > 0 ? (
                      displayedOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell>
                            <div className="font-medium">{order.customer_name}</div>
                            <div className="text-sm text-gray-500">{order.customer_email}</div>
                          </TableCell>
                          <TableCell>
                            <ul className="list-disc list-inside text-sm">
                              {order.order_items.map(item => (
                                <li key={item.point_id}>{item.points?.name || 'Ponto indisponível'}</li>
                              ))}
                            </ul>
                          </TableCell>
                          <TableCell>R$ {order.total_amount?.toFixed(2)}</TableCell>
                          <TableCell>{new Date(order.created_at).toLocaleString('pt-BR')}</TableCell>
                          <TableCell><Badge variant={order.status === 'active' ? 'default' : 'secondary'}>{order.status}</Badge></TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleAnalisarPedido(order.order_items[0])}
                              disabled={!order.order_items || order.order_items.length === 0}
                            >
                              Analisar
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteOrder(order.id)}>
                                <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center">Nenhum pedido encontrado para este status.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Gestão de Pontos</CardTitle>
                  <CardDescription>Adicione, edite ou remova os pontos de logradouros.</CardDescription>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Select value={filterTagId} onValueChange={setFilterTagId}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Filtrar por tag..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as Tags</SelectItem>
                      {tags.map(tag => (
                        <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={() => setActivePoint(initialPointState)}>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Adicionar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead className="w-[80px]">ID</TableHead>
                        <TableHead>Endereço</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Contrato Até</TableHead>
                        <TableHead>Preço (2 Anos)</TableHead>
                        <TableHead>Preço (3 Anos)</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {displayedPontos.map((ponto) => { 
                        const statusInfo = getStatusBadge(ponto.status); 
                        return (
                            <TableRow key={ponto.id}>
                                <TableCell className="font-medium">{ponto.id.substring(0, 5)}...</TableCell>
                                <TableCell>{ponto.name}</TableCell>
                                <TableCell><Badge className={statusInfo.className}>{statusInfo.label}</Badge></TableCell>
                                <TableCell>
                                {ponto.status === 'sold' && ponto.sold_until 
                                    ? new Date(ponto.sold_until).toLocaleDateString('pt-BR') 
                                    : '—'}
                                </TableCell>
                                <TableCell>R$ {ponto.price_2y?.toFixed(2)}</TableCell>
                                <TableCell>R$ {ponto.price_3y?.toFixed(2)}</TableCell>
                                <TableCell className="text-right space-x-2">
                                <Button variant="ghost" size="icon" onClick={() => handleEditClick(ponto)}><Edit className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDeletePoint(ponto.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                                </TableCell>
                            </TableRow>
                        );
                        })}
                    </TableBody>
                </Table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Gestão de Tags</CardTitle><CardDescription>Adicione ou remova as tags que podem ser associadas aos pontos.</CardDescription></CardHeader>
              <CardContent><div className="flex items-start gap-4"><div className="flex-1"><Label htmlFor="new-tag">Nova Tag</Label><div className="flex gap-2 mt-2"><Input id="new-tag" placeholder="Ex: Perto de Escola" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} /><Button onClick={handleAddNewTag}><PlusCircle className="h-4 w-4" /></Button></div></div><div className="flex-1"><Label>Tags Existentes</Label><div className="mt-2 p-3 border rounded-md min-h-[40px] bg-gray-50">{tags.length > 0 ? (<div className="flex flex-wrap gap-2">{tags.map(tag => (<Badge key={tag.id} variant="secondary">{tag.name}</Badge>))}</div>) : (<p className="text-sm text-gray-500">Nenhuma tag adicionada ainda.</p>)}</div></div></div></CardContent>
            </Card>
          </main>
        </div>
      </div>
      
      {activePoint && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg">
            <CardHeader><CardTitle>{activePoint.id ? 'Editar Ponto' : 'Adicionar Novo Ponto'}</CardTitle><CardDescription>{activePoint.id ? 'Altere os dados do ponto de logradouro.' : 'Preencha os dados do novo ponto de logradouro.'}</CardDescription></CardHeader>
            <CardContent>
              <form onSubmit={activePoint.id ? handleUpdatePointSubmit : handleAddPointSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2"><Label htmlFor="name">Endereço Completo</Label><Input id="name" value={activePoint.name || ''} onChange={(e) => handleFormChange(e, 'name')} required /></div>
                  <div><Label htmlFor="latitude">Latitude</Label><Input id="latitude" type="text" value={activePoint.latitude || ''} onChange={(e) => handleFormChange(e, 'latitude')} required /></div>
                  <div><Label htmlFor="longitude">Longitude</Label><Input id="longitude" type="text" value={activePoint.longitude || ''} onChange={(e) => handleFormChange(e, 'longitude')} required /></div>
                  <div className="sm:col-span-2"><Label htmlFor="description">Descrição (Opcional)</Label><Input id="description" value={activePoint.description || ''} onChange={(e) => handleFormChange(e, 'description')} /></div>
                  <div><Label htmlFor="price_2y">Preço (2 Anos)</Label><Input id="price_2y" type="text" value={activePoint.price_2y || ''} onChange={(e) => handleFormChange(e, 'price_2y')} required /></div>
                  <div><Label htmlFor="price_3y">Preço (3 Anos)</Label><Input id="price_3y" type="text" value={activePoint.price_3y || ''} onChange={(e) => handleFormChange(e, 'price_3y')} required /></div>
                
                  {activePoint.id && (
                    <>
                      <div className="sm:col-span-2 pt-4 border-t">
                        <Label htmlFor="status">Status do Ponto</Label>
                        <Select value={activePoint.status} onValueChange={handleStatusChange}>
                            <SelectTrigger className="w-full mt-2">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="available">Disponível</SelectItem>
                                <SelectItem value="reserved">Reservado</SelectItem>
                                <SelectItem value="sold">Vendido</SelectItem> 
                            </SelectContent>
                        </Select>
                      </div>

                      {activePoint.status === 'sold' && (
                        <div className="sm:col-span-2">
                          <Label htmlFor="sold_until">Contrato Válido Até</Label>
                          <Input 
                            id="sold_until" 
                            type="date"
                            value={formatDateForInput(activePoint.sold_until)}
                            onChange={(e) => handleFormChange(e, 'sold_until')}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="pt-4 border-t">
                  <Label className="font-semibold">Tags</Label>
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {tags.map((tag) => (
                      <div key={tag.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`tag-${tag.id}`}
                          checked={selectedTags.has(tag.id)}
                          onCheckedChange={() => handleTagCheckboxChange(tag.id)}
                        />
                        <Label htmlFor={`tag-${tag.id}`} className="font-normal">{tag.name}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={closeModal}>Cancelar</Button>
                  <Button type="submit">{activePoint.id ? 'Salvar Alterações' : 'Salvar Ponto'}</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

export default AdminPage;
