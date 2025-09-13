// supabase/functions/create-order/index.ts

/// <reference types="https://deno.land/x/deno/runtime/mod.ts" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface PointPriceData {
  id: number;
  price_2y: number;
  price_3y: number;
}

Deno.serve(async (req) => {
  // Trata a requisição pre-flight do CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Cria um cliente Supabase com privilégios de administrador para usar dentro da função
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Extrai os dados do corpo da requisição
    const { customerData, items } = await req.json()

    // Validação básica dos dados recebidos
    if (!customerData || !items || !Array.isArray(items) || items.length === 0) {
      throw new Error('Dados do cliente e itens são obrigatórios.')
    }

    // --- Lógica de Segurança: Calcular o total no servidor ---
    const pointIds = items.map(item => item.point_id);
    const { data: pointsData, error: pointsError } = await supabaseAdmin
      .from('points')
      .select('id, price_2y, price_3y')
      .in('id', pointIds);

    if (pointsError) throw new Error('Erro ao buscar preços dos pontos.');
    if (!pointsData || pointsData.length !== pointIds.length) throw new Error('Um ou mais pontos selecionados são inválidos.');

    // Adicionada a asserção de tipo para garantir que o TypeScript conheça a estrutura dos dados
    const priceMap = new Map((pointsData as PointPriceData[]).map(p => [p.id, { price_2y: p.price_2y, price_3y: p.price_3y }]));

    let calculatedTotalAmount = 0;
    const validatedItems = items.map(item => {
      const prices = priceMap.get(item.point_id);
      if (!prices) throw new Error(`Preço não encontrado para o ponto ${item.point_id}`);

      const price = item.periodo_anos === 2 ? prices.price_2y : prices.price_3y;
      if (typeof price !== 'number') throw new Error(`Período inválido para o ponto ${item.point_id}`);
      
      calculatedTotalAmount += price;

      // Retorna o item com o preço validado pelo servidor
      return {
        ...item,
        price: price,
      };
    });
    // --- Fim da Lógica de Segurança ---

    // Chama a função RPC no banco de dados para criar o pedido
    const { data: newOrderId, error: rpcError } = await supabaseAdmin.rpc('create_new_order', {
      customer_name: customerData.name,
      customer_email: customerData.email,
      customer_phone: customerData.phone,
      total_amount: calculatedTotalAmount, // Usa o total calculado no servidor
      items: validatedItems, // Usa os itens com preços validados pelo servidor
    })

    if (rpcError) {
      // Se a função do banco de dados retornar um erro (ex: ponto não disponível)
      throw rpcError
    }

    return new Response(JSON.stringify({ orderId: newOrderId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
