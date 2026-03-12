export async function handler(event) {
try {
let paymentId = null;

if (event.httpMethod === 'POST') {
const body = JSON.parse(event.body || '{}');
paymentId = body?.data?.id || body?.id || null;
}

if (!paymentId && event.queryStringParameters) {
paymentId =
event.queryStringParameters['data.id'] ||
event.queryStringParameters.id ||
null;
}

return {
statusCode: 200,
body: JSON.stringify({
received: true,
paymentId: paymentId || null,
message: 'Webhook recebido com sucesso'
})
};
} catch (error) {
return {
statusCode: 500,
body: JSON.stringify({
error: 'Erro no webhook',
details: error.message
})
};
}
}