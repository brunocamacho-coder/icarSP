import fetch from 'node-fetch';

const API_KEY = process.env.CONSULTARPLACA_API_KEY;
const EMAIL = process.env.CONSULTARPLACA_EMAIL;

function normalizarPlaca(placa = '') {
return String(placa).replace(/[^A-Za-z0-9]/g, '').toUpperCase().trim();
}

function safe(value, fallback = '-') {
return value ?? fallback;
}

function montarTeaser(report) {
let alertCount = 0;
const alertas = [];

const status = report?.status || {};

const campos = [
['roubo_furto', 'Roubo/furto'],
['leilao', 'Leilão'],
['debitos', 'Débitos'],
['restricoes', 'Restrições'],
['gravame', 'Gravame'],
['licenciamento_ipva', 'Licenciamento/IPVA']
];

for (const [key, label] of campos) {
const valor = String(status[key] || '').toLowerCase();

const ok =
valor.includes('sem registro') ||
valor.includes('não consta') ||
valor.includes('nao consta') ||
valor.includes('regular') ||
valor.includes('inexistente');

if (!ok && valor && valor !== '-') {
alertCount += 1;
alertas.push(label);
}
}

const message =
alertCount > 0
? `Encontramos ${alertCount} alerta(s) ou verificação(ões) adicionais para esta placa.`
: 'Encontramos dados básicos do veículo e verificações adicionais disponíveis no relatório completo.';

return {
alertCount,
message,
itens: alertas
};
}

async function consultarApiExterna(placa) {
if (!API_KEY || !EMAIL) {
throw new Error('CONSULTARPLACA_API_KEY ou CONSULTARPLACA_EMAIL não configurados.');
}

const url = `https://api.consultarplaca.com.br/v2/consultarPlaca?placa=${encodeURIComponent(placa)}`;
const basicAuth = Buffer.from(`${EMAIL}:${API_KEY}`).toString('base64');

const response = await fetch(url, {
method: 'GET',
headers: {
Accept: 'application/json',
Authorization: `Basic ${basicAuth}`
}
});

const text = await response.text();

let data;
try {
data = JSON.parse(text);
} catch {
throw new Error(`Resposta inválida da API Consultar Placa: ${text?.slice(0, 300) || 'vazia'}`);
}

if (!response.ok) {
throw new Error(data?.mensagem || data?.message || `Falha na API externa (${response.status})`);
}

if (data?.status !== 'ok') {
throw new Error(data?.mensagem || 'A API retornou erro ao consultar a placa.');
}

return data;
}

function mapearDados(placa, apiData) {
const dadosVeiculo = apiData?.dados?.informacoes_veiculo?.dados_veiculo || {};

const marca = safe(dadosVeiculo?.marca);
const modelo = safe(dadosVeiculo?.modelo);

const marcaModelo =
marca !== '-' && modelo !== '-'
? `${marca} / ${modelo}`
: safe(modelo !== '-' ? modelo : marca);

const anoFabricacao = safe(dadosVeiculo?.ano_fabricacao);
const anoModelo = safe(dadosVeiculo?.ano_modelo);
const ano =
anoFabricacao !== '-' && anoModelo !== '-'
? `${anoFabricacao}/${anoModelo}`
: safe(anoModelo !== '-' ? anoModelo : anoFabricacao);

const report = {
placa,
basic: {
marca_modelo: marcaModelo,
ano,
combustivel: safe(dadosVeiculo?.combustivel),
cidade_registro: safe(dadosVeiculo?.municipio),
uf_registro: safe(dadosVeiculo?.uf_municipio),
cor: safe(dadosVeiculo?.cor)
},
vehicle: {
marca_modelo: marcaModelo,
ano,
cor: safe(dadosVeiculo?.cor),
combustivel: safe(dadosVeiculo?.combustivel),
fipe: '-',
chassi: safe(dadosVeiculo?.chassi),
renavam: '-'
},
status: {
roubo_furto: 'Não consta',
leilao: 'Não consta',
debitos: 'Verificação disponível no relatório completo',
restricoes: 'Verificação disponível no relatório completo',
gravame: 'Verificação disponível no relatório completo',
licenciamento_ipva: 'Verificação disponível no relatório completo'
},
details: {
instituicao_credora: 'Disponível no relatório completo',
detalhes_bloqueio: 'Disponível no relatório completo'
},
offer: {
price: 'R$ 14,99'
}
};

report.teaser = montarTeaser(report);

return report;
}

export async function getVehicleBasicReportByPlate(placaInformada) {
const placa = normalizarPlaca(placaInformada);

if (!placa || placa.length < 7) {
throw new Error('Placa inválida.');
}

const apiData = await consultarApiExterna(placa);
const report = mapearDados(placa, apiData);

return {
success: true,
...report
};
}

export async function getVehicleReportByPlate(placaInformada) {
const placa = normalizarPlaca(placaInformada);

if (!placa || placa.length < 7) {
throw new Error('Placa inválida.');
}

const apiData = await consultarApiExterna(placa);
const report = mapearDados(placa, apiData);

return report;
}