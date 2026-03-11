const fetch = require('node-fetch');

exports.handler = async (event) => {
  try {
    const { payment_id } = event.queryStringParameters;
    const accessToken = process.env.MP_ACCESS_TOKEN;

    if (!accessToken) {
      throw new Error('Access Token não configurado');
    }

    const response = await fetch(`https://api.mercadopago.com/v1/payments/${payment_id}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const data = await response.json();

    const pago = data.status === 'approved';

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pago,
        status: data.status,
        payment_id: data.id,
        status_detail: data.status_detail
      })
    };

  } catch (error) {
    console.error('Erro ao verificar pagamento:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};