import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Variáveis de ambiente do Supabase (VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY) não estão definidas.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Funções para gerenciar pontos
export const getPontos = async () => {
  const { data, error } = await supabase
    .from('pontos')
    .select('*')
    .order('id')
  
  if (error) {
    console.error('Erro ao buscar pontos:', error)
    return []
  }
  
  return data
}

export const updatePontoStatus = async (pontoId, status, dadosCliente = null) => {
  const updateData = {
    status,
    updated_at: new Date().toISOString()
  }
  
  if (dadosCliente) {
    updateData.dados_cliente = dadosCliente
    updateData.reservado_em = new Date().toISOString()
  }
  
  const { data, error } = await supabase
    .from('pontos')
    .update(updateData)
    .eq('id', pontoId)
    .select()
  
  if (error) {
    console.error('Erro ao atualizar ponto:', error)
    return null
  }
  
  return data[0]
}

// CORREÇÃO: A função agora recebe os itens do carrinho diretamente
// e o total é calculado no backend pela Edge Function.
export const createOrder = async (customerData, cartItems) => {
  // O formato dos 'cartItems' já é o correto vindo de HomePage.jsx
  // Ex: [{ ponto_id, periodo_anos, price }]
  const { data, error } = await supabase.functions.invoke('create-order', {
    body: {
      customerData, // { name, email, phone }
      items: cartItems,
    },
  });

  if (error) {
    console.error('Erro ao invocar a Edge Function create-order:', error);
    throw error;
  }

  return data;
}

// Função para upload de imagens
export const uploadImagem = async (file, path) => {
  const { data, error } = await supabase.storage
    .from('placas-fotos')
    .upload(path, file)
  
  if (error) {
    console.error('Erro ao fazer upload:', error)
    return null
  }
  
  return data
}

export const getImagemUrl = (path) => {
  const { data } = supabase.storage
    .from('placas-fotos')
    .getPublicUrl(path)
  
  return data.publicUrl
}
