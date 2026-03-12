import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
process.env.SUPABASE_URL,
process.env.SUPABASE_SERVICE_ROLE_KEY
);

function basicAuthHeader() {
const email = process.env.CONSULTARPLACA_EMAIL;
const apiKey = process.env.CONSULTARPLACA_API_KEY;
return 'Basic ' + Buffer.from(`${email}:${apiKey}`).toString('base64');
}

async function consultarEndpoint(endpoint, placa, authHeader) {
const response = await fetch(
`https://api.consultarplaca.com.br/v2/${endpoint}?placa=${encodeURIComponent(placa)}`,
{
method: 'GET',
headers: {
Authorization: authHeader,
'Content-Type': 'application/json'
}
}
);

const text = await response.text();
let data;

try {
data = JSON.parse(text);
} catch {
data = { raw: text };
}

if (!response.ok) {
throw new Error(`${endpoint} falhou com status ${response.status}`);
}

return data;
}

export async function handler(event) {
try {
if (event.httpMethod !== 'POST') {
return {
statusCode: 405,
body: JSON.stringify({ error: 'Método não permitido' })
};
}

const { paymentId } = JSON.parse(event.body || '{}');

if (!paymentId) {
return {
statusCode: 400,
body: JSON.stringify({ error: 'paymentId obrigatório' })
};
}

// 1. Buscar o registro atual
const { data: record, error: fetchError } = await supabase
.from('vehicle_reports')
.select('*')
.eq('payment_id', String(paymentId))
.single();

if (fetchError || !record) {
return {
statusCode: 404,
body: JSON.stringify({ error: 'Pagamento não encontrado' })
};
}

// 2. Se já está pronto, nunca consulta API novamente
if (record.status === 'ready' && record.report) {
return {
statusCode: 200,
body: JSON.stringify({
success: true,
cached: true,
status: 'ready',
report: record.report
})
};
}

// 3. Se já está processando, não dispara APIs de novo
if (record.status === 'processing') {
return {
statusCode: 200,
body: JSON.stringify({
success: true,
processing: true,
status: 'processing',
message: 'Relatório já está sendo processado'
})
};
}

// 4. Tenta travar o processamento: só continua se conseguir mudar pending -> processing
const { data: lockedRows, error: lockError } = await supabase
.from('vehicle_reports')
.update({
status: 'processing',
updated_at: new Date().toISOString()
})
.eq('payment_id', String(paymentId))
.eq('status', 'pending')
.select();

if (lockError) {
return {
statusCode: 500,
body: JSON.stringify({
error: 'Erro ao travar processamento do relatório',
details: lockError.message
})
};
}

// Se não conseguiu travar, outra execução ganhou a corrida
if (!lockedRows || lockedRows.length === 0) {
return {
statusCode: 200,
body: JSON.stringify({
success: true,
processing: true,
status: 'processing',
message: 'Outra execução já iniciou o relatório'
})
};
}

const placa = record.placa;
const authHeader = basicAuthHeader();

// 5. Agora sim só UMA execução chega aqui
const veiculo = await consultarEndpoint('consultarPlaca', placa, authHeader);

const resultados = await Promise.allSettled([
consultarEndpoint('consultarGravame', placa, authHeader),
consultarEndpoint('consultarProprietarioAtual', placa, authHeader),
consultarEndpoint('consultarPrecoFipe', placa, authHeader)
]);

const gravame = resultados[0].status === 'fulfilled' ? resultados[0].value : null;
const proprietarioAtual = resultados[1].status === 'fulfilled' ? resultados[1].value : null;
const precoFipe = resultados[2].status === 'fulfilled' ? resultados[2].value : null;

const report = {
placa,
veiculo,
gravame,
proprietarioAtual,
precoFipe,
generatedAt: new Date().toISOString(),
custoTotalEstimado: 12.80
};

const { error: updateError } = await supabase
.from('vehicle_reports')
.update({
status: 'ready',
report,
updated_at: new Date().toISOString()
})
.eq('payment_id', String(paymentId));

if (updateError) {
// se falhar ao salvar pronto, pelo menos não deixa pendente
await supabase
.from('vehicle_reports')
.update({
status: 'error',
updated_at: new Date().toISOString()
})
.eq('payment_id', String(paymentId));

return {
statusCode: 500,
body: JSON.stringify({
error: 'Erro ao salvar relatório',
details: updateError.message
})
};
}

return {
statusCode: 200,
body: JSON.stringify({
success: true,
cached: false,
status: 'ready',
report
})
};
} catch (error) {
console.error('Erro em generate-report:', error);

// tenta marcar erro para não ficar preso em processing
try {
const { paymentId } = JSON.parse(event.body || '{}');

if (paymentId) {
await supabase
.from('vehicle_reports')
.update({
status: 'error',
updated_at: new Date().toISOString()
})
.eq('payment_id', String(paymentId));
}
} catch (_) {}

return {
statusCode: 500,
body: JSON.stringify({
error: 'Erro ao gerar relatório',
details: error.message
})
};
}
}