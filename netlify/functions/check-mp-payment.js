const fetch = require('node-fetch');

exports.handler = async (event) => {
  try {
    const { payment_id } = event.queryStringParameters;
    const accessToken = process.env.MP_ACCESS_TOKEN;

    if (!accessToken) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Access Token não configurado' })
      };
    }

    const response = await fetch(`https://api.mercadopago.com/v1/payments/${payment_id}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const data = await response.json();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pago: data.status === 'approved',
        status: data.status
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};