import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://kugysamxzumqgxzinazds.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1Z3lzYW14enVtcWd4aW5hemRzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU2NDMwNDMsImV4cCI6MjA3MTIxOTA0M30.G2ckhkGvTPX1akyRdCHkIsN6WpswmNwidyHCYo80dWg'

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

// Funções para gerenciar reservas
export const createReserva = async (pontoId, dadosCliente) => {
  const { data, error } = await supabase
    .from('reservas')
    .insert([
      {
        ponto_id: pontoId,
        nome: dadosCliente.nome,
        email: dadosCliente.email,
        telefone: dadosCliente.telefone,
        status: 'ativa',
        expira_em: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 48 horas
        created_at: new Date().toISOString()
      }
    ])
    .select()
  
  if (error) {
    console.error('Erro ao criar reserva:', error)
    return null
  }
  
  return data[0]
}

export const getReservasExpiradas = async () => {
  const { data, error } = await supabase
    .from('reservas')
    .select('*')
    .eq('status', 'ativa')
    .lt('expira_em', new Date().toISOString())
  
  if (error) {
    console.error('Erro ao buscar reservas expiradas:', error)
    return []
  }
  
  return data
}

export const expirarReserva = async (reservaId, pontoId) => {
  // Atualiza a reserva como expirada
  const { error: reservaError } = await supabase
    .from('reservas')
    .update({ status: 'expirada', updated_at: new Date().toISOString() })
    .eq('id', reservaId)
  
  if (reservaError) {
    console.error('Erro ao expirar reserva:', reservaError)
    return false
  }
  
  // Volta o ponto para disponível
  const { error: pontoError } = await supabase
    .from('pontos')
    .update({ 
      status: 'disponivel', 
      dados_cliente: null,
      reservado_em: null,
      updated_at: new Date().toISOString() 
    })
    .eq('id', pontoId)
  
  if (pontoError) {
    console.error('Erro ao atualizar ponto:', pontoError)
    return false
  }
  
  return true
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

