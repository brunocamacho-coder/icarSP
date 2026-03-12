import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';

export const handler = async (event) => {
try {
if (event.httpMethod !== 'POST') {
return {
statusCode: 405,
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ success: false, erro: 'Método não permitido' })
};
}

const token = process.env.MP_ACCESS_TOKEN;

if (!token) {
return {
statusCode: 500,
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ success: false, erro: 'MP_ACCESS_TOKEN não configurado' })
};
}

const body = JSON.parse(event.body || '{}');
const placa = String(body.placa || '').trim().toUpperCase();

if (!placa) {
return {
statusCode: 400,
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ success: false, erro: 'Placa não informada' })
};
}

const payload = {
transaction_amount: 19.99,
description: `Consulta placa ${placa} - iCarSP`,
payment_method_id: 'pix',
payer: {
email: 'cliente@email.com'
}
};

const res = await fetch('https://api.mercadopago.com/v1/payments', {
method: 'POST',
headers: {
Authorization: `Bearer ${token}`,
'Content-Type': 'application/json',
'X-Idempotency-Key': uuidv4()
},
body: JSON.stringify(payload)
});

const data = await res.json();

if (!res.ok) {
console.error('Erro Mercado Pago:', data);

return {
statusCode: 500,
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
success: false,
erro: data
})
};
}

const transactionData = data?.point_of_interaction?.transaction_data || {};

return {
statusCode: 200,
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
success: true,
payment_id: data.id,
qr_code: transactionData.qr_code || '',
qr_code_base64: transactionData.qr_code_base64 || ''
})
};
} catch (err) {
console.error('Erro em create-mp-payment:', err);

return {
statusCode: 500,
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
success: false,
erro: err.message
})
};
}
};