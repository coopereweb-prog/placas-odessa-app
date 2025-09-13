// supabase/functions/create-order/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

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
    const { customerData, items, totalAmount } = await req.json()

    // Validação básica dos dados recebidos
    if (!customerData || !items || !totalAmount) {
      throw new Error('Dados do cliente, itens e valor total são obrigatórios.')
    }

    // Chama a função RPC no banco de dados para criar o pedido
    const { data: newOrderId, error: rpcError } = await supabaseAdmin.rpc('create_new_order', {
      customer_name: customerData.name,
      customer_email: customerData.email,
      customer_phone: customerData.phone,
      total_amount: totalAmount,
      items: items, // O array de itens deve corresponder ao tipo 'order_item_input'
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
