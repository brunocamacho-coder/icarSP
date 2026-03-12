import fetch from 'node-fetch';

function buildAuth() {
  const email = process.env.CONSULTARPLACA_EMAIL;
  const apiKey = process.env.CONSULTARPLACA_API_KEY;

  if (!email || !apiKey) {
    throw new Error('Credenciais da API não configuradas');
  }

  return Buffer.from(`${email}:${apiKey}`).toString('base64');
}

export const handler = async (event) => {
  try {
    const { placa } = JSON.parse(event.body);
    const auth = buildAuth();

    const response = await fetch(`https://api.consultarplaca.com.br/v2/solicitarRelatorio?placa=${placa}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    });

    const data = await response.json();

    return {
      statusCode: 200,
      body: JSON.stringify(data)
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};