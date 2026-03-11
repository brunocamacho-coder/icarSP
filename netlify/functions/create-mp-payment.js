const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');

exports.handler = async (event) => {
  try {
    const { placa } = JSON.parse(event.body);
    const accessToken = process.env.MP_ACCESS_TOKEN;

    if (!accessToken) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Access Token não configurado' })
      };
    }

    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': uuidv4()
      },
      body: JSON.stringify({
        transaction_amount: 14.90,
        description: `Consulta placa ${placa} - iCarSP`,
        payment_method_id: 'pix',
        payer: {
          email: 'cliente@email.com',
          first_name: 'Cliente',
          identification: {
            type: 'CPF',
            number: '00000000000'
          }
        },
        date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: data.message })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        payment_id: data.id,
        qr_code: data.point_of_interaction.transaction_data.qr_code,
        qr_code_base64: data.point_of_interaction.transaction_data.qr_code_base64
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};