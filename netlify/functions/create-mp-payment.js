const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');

exports.handler = async (event) => {
  try {
    const { placa } = JSON.parse(event.body);
    const accessToken = process.env.MP_ACCESS_TOKEN;

    if (!accessToken) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Access Token não configurado no Netlify.' })
      };
    }

    const payload = {
      transaction_amount: 14.90,
      description: `Consulta placa ${placa} - iCarSP`,
      payment_method_id: 'pix',
      payer: { email: 'cliente@email.com' },
      date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString()
    };

    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': uuidv4()
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    // Se a resposta não for OK (código 2xx), retorna o erro detalhado do Mercado Pago
    if (!response.ok) {
      return {
        statusCode: 200, // Mantemos 200 para ver o erro no frontend
        body: JSON.stringify({
          success: false,
          error: data.message || 'Erro na API do Mercado Pago',
          detalhes: data
        })
      };
    }

    // Se deu tudo certo, retorna os dados do PIX
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        qr_code: data.point_of_interaction?.transaction_data?.qr_code,
        qr_code_base64: data.point_of_interaction?.transaction_data?.qr_code_base64,
        payment_id: data.id
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Erro interno: ${error.message}` })
    };
  }
};