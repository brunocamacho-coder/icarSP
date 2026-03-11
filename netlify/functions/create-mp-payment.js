const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');

exports.handler = async (event) => {
  try {
    const { placa, email = 'cliente@email.com', nome = 'Cliente', cpf = '00000000000' } = JSON.parse(event.body);
    const accessToken = process.env.MP_ACCESS_TOKEN;

    if (!accessToken) {
      throw new Error('Access Token não configurado no Netlify');
    }

    const response = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': uuidv4()
      },
      body: JSON.stringify({
        transaction_amount: 14.90, // ✅ VALOR CORRETO
        description: `Consulta placa ${placa} - iCarSP`,
        payment_method_id: 'pix',
        payer: {
          email: email,
          first_name: nome,
          identification: {
            type: 'CPF',
            number: cpf
          }
        },
        date_of_expiration: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      })
    });

    const data = await response.json();

    if (data.id) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          payment_id: data.id,
          qr_code: data.point_of_interaction.transaction_data.qr_code,
          qr_code_base64: data.point_of_interaction.transaction_data.qr_code_base64,
          expiration: data.date_of_expiration
        })
      };
    } else {
      throw new Error(data.message || 'Erro ao criar pagamento');
    }

  } catch (error) {
    console.error('Erro no pagamento:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};