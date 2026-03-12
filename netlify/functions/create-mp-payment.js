import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
process.env.SUPABASE_URL,
process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler(event) {
try {
if (event.httpMethod !== 'POST') {
return {
statusCode: 405,
body: JSON.stringify({ error: 'Método não permitido' })
};
}

const { placa, email } = JSON.parse(event.body || '{}');

if (!placa) {
return {
statusCode: 400,
body: JSON.stringify({ error: 'Placa obrigatória' })
};
}

const accessToken = process.env.MP_ACCESS_TOKEN;
const siteUrl = process.env.SITE_URL;

if (!accessToken) {
return {
statusCode: 500,
body: JSON.stringify({ error: 'MP_ACCESS_TOKEN não configurado' })
};
}

if (!siteUrl) {
return {
statusCode: 500,
body: JSON.stringify({ error: 'SITE_URL não configurado' })
};
}

if (!process.env.SUPABASE_URL) {
return {
statusCode: 500,
body: JSON.stringify({ error: 'SUPABASE_URL não configurado' })
};
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
return {
statusCode: 500,
body: JSON.stringify({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurado' })
};
}

const placaNormalizada = String(placa).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

const payload = {
transaction_amount: 19.99,
description: `Consulta veicular placa ${placaNormalizada}`,
payment_method_id: 'pix',
payer: {
email: email || 'cliente@icarsp.com.br'
},
notification_url: `${siteUrl}/.netlify/functions/mp-webhook`,
external_reference: placaNormalizada
};

const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
method: 'POST',
headers: {
Authorization: `Bearer ${accessToken}`,
'Content-Type': 'application/json'
},
body: JSON.stringify(payload)
});

const mpData = await mpResponse.json();

if (!mpResponse.ok) {
const statusCode = mpResponse.status === 429 ? 429 : 500;

return {
statusCode,
body: JSON.stringify({
error: mpResponse.status === 429
? 'Muitas tentativas de gerar PIX em pouco tempo. Aguarde alguns minutos e tente novamente.'
: 'Erro ao criar pagamento',
details: mpData
})
};
}

const paymentId = String(mpData.id);

if (!paymentId) {
return {
statusCode: 500,
body: JSON.stringify({
error: 'Mercado Pago não retornou paymentId',
details: mpData
})
};
}

const { error: insertError } = await supabase
.from('vehicle_reports')
.upsert({
payment_id: paymentId,
placa: placaNormalizada,
status: 'pending',
customer_email: email || null,
updated_at: new Date().toISOString()
});

if (insertError) {
return {
statusCode: 500,
body: JSON.stringify({
error: 'Erro ao salvar pagamento no Supabase',
details: insertError.message
})
};
}

return {
statusCode: 200,
body: JSON.stringify({
success: true,
paymentId,
payment_id: paymentId,
status: mpData.status || 'pending',
qr_code: mpData.point_of_interaction?.transaction_data?.qr_code || null,
qr_code_base64: mpData.point_of_interaction?.transaction_data?.qr_code_base64 || null,
pix_copia_e_cola: mpData.point_of_interaction?.transaction_data?.qr_code || null,
ticket_url: mpData.transaction_details?.external_resource_url || null
})
};
} catch (error) {
console.error('Erro interno create-mp-payment:', error);

return {
statusCode: 500,
body: JSON.stringify({
error: 'Erro interno ao criar pagamento',
details: error.message
})
};
}
}