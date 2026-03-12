import fetch from 'node-fetch';

const API_KEY = process.env.CONSULTARPLACA_API_KEY;
const EMAIL = process.env.CONSULTARPLACA_EMAIL;

function normalizarPlaca(placa = '') {
return String(placa)
.replace(/[^A-Za-z0-9]/g, '')
.toUpperCase()
.trim();
}

function safe(value, fallback = '-') {
return value ?? fallback;
}

function formatarPrecoFipe(valor) {
if (!valor || isNaN(Number(valor))) return '-';

return Number(valor).toLocaleString('pt-BR', {
style: 'currency',
currency: 'BRL'
});
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
valor.includes('inexistente') ||
valor.includes('não possui') ||
valor.includes('nao possui');

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

async function consultarEndpoint(url) {
if (!API_KEY || !EMAIL) {
throw new Error('CONSULTARPLACA_API_KEY ou CONSULTARPLACA_EMAIL não configurados.');
}

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

async function consultarDadosBasicos(placa) {
const url = `https://api.consultarplaca.com.br/v2/consultarPlaca?placa=${encodeURIComponent(placa)}`;
return consultarEndpoint(url);
}

async function consultarPrecoFipe(placa) {
const url = `https://api.consultarplaca.com.br/v2/consultarPrecoFipe?placa=${encodeURIComponent(placa)}`;
return consultarEndpoint(url);
}

async function consultarProprietarioAtual(placa) {
const url = `https://api.consultarplaca.com.br/v2/consultarProprietarioAtual?placa=${encodeURIComponent(placa)}`;
return consultarEndpoint(url);
}

async function consultarGravame(placa) {
const url = `https://api.consultarplaca.com.br/v2/consultarGravame?placa=${encodeURIComponent(placa)}`;
return consultarEndpoint(url);
}

async function consultarRenainf(placa) {
const url = `https://api.consultarplaca.com.br/v2/consultarRegistrosInfracoesRenainf?placa=${encodeURIComponent(placa)}`;
return consultarEndpoint(url);
}

function mapearDadosBasicos(placa, apiData) {
const dadosVeiculo = apiData?.dados?.informacoes_veiculo?.dados_veiculo || {};

const marca = safe(dadosVeiculo?.marca);
const modelo = safe(dadosVeiculo?.modelo);

const marcaModelo =
marca !== '-' && modelo !== '-'
? `${marca} / ${modelo}`
: safe(modelo !== '-' ? modelo : marca);

const anoFabricacao = safe(dadosVeiculo?.ano_fabricacao || dadosVeiculo?.ano_frabricacao);
const anoModelo = safe(dadosVeiculo?.ano_modelo);

const ano =
anoFabricacao !== '-' && anoModelo !== '-'
? `${anoFabricacao}/${anoModelo}`
: safe(anoModelo !== '-' ? anoModelo : anoFabricacao);

return {
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
renavam: 'Disponível no relatório completo'
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
detalhes_bloqueio: 'Disponível no relatório completo',
proprietario_atual: 'Disponível no relatório completo',
documento_proprietario: 'Disponível no relatório completo',
tipo_documento_proprietario: 'Disponível no relatório completo',
data_registro_gravame: 'Disponível no relatório completo',
codigo_fipe: 'Disponível no relatório completo',
modelo_versao_fipe: 'Disponível no relatório completo',
mes_referencia_fipe: 'Disponível no relatório completo',
quantidade_infracoes_renainf: 'Disponível no relatório completo',
valor_total_infracoes_renainf: 'Disponível no relatório completo',
resumo_infracoes_renainf: 'Disponível no relatório completo'
},
offer: {
price: 'R$ 14,99'
}
};
}

function aplicarDadosFipe(report, fipeData) {
const informacoesFipe = fipeData?.dados?.informacoes_fipe;

if (Array.isArray(informacoesFipe) && informacoesFipe.length > 0) {
const primeiro = informacoesFipe[0];

report.vehicle.fipe = formatarPrecoFipe(primeiro?.preco);
report.details.codigo_fipe = safe(primeiro?.codigo_fipe);
report.details.modelo_versao_fipe = safe(primeiro?.modelo_versao);
report.details.mes_referencia_fipe = safe(primeiro?.mes_referencia);
}

return report;
}

function aplicarDadosProprietario(report, proprietarioData) {
const proprietario = proprietarioData?.dados?.proprietario_atual || {};

report.details.proprietario_atual = safe(proprietario?.nome, 'Não informado');
report.details.documento_proprietario = safe(proprietario?.documento, 'Não informado');
report.details.tipo_documento_proprietario = safe(proprietario?.tipo_documento, 'Não informado');

return report;
}

function aplicarDadosGravame(report, gravameData) {
const gravame = gravameData?.dados?.gravame || {};
const possuiGravame = String(gravame?.possui_gravame || '').toLowerCase();
const registro = gravame?.registro || null;

if (possuiGravame === 'sim') {
report.status.gravame = 'Gravame ativo';
report.details.instituicao_credora = safe(registro?.agente_financeiro?.nome, 'Não informado');
report.details.data_registro_gravame = safe(registro?.data_registro, 'Não informado');
report.details.detalhes_bloqueio = safe(registro?.situacao, 'Não informado');
} else if (possuiGravame === 'nao') {
report.status.gravame = 'Não possui gravame';
report.details.instituicao_credora = 'Não consta';
report.details.data_registro_gravame = 'Não consta';
report.details.detalhes_bloqueio = 'Não consta';
} else {
report.status.gravame = 'Indisponível no momento';
report.details.instituicao_credora = 'Indisponível';
report.details.data_registro_gravame = 'Indisponível';
report.details.detalhes_bloqueio = 'Indisponível';
}

return report;
}

function aplicarDadosRenainf(report, renainfData) {
const infracoesData =
renainfData?.dados?.registro_debitos_por_infracoes_renainf?.infracoes_renainf || {};

const possuiInfracoes = String(infracoesData?.possui_infracoes || '').toLowerCase();
const infracoes = Array.isArray(infracoesData?.infracoes) ? infracoesData.infracoes : [];

if (possuiInfracoes === 'sim' && infracoes.length > 0) {
report.status.debitos = `Constam ${infracoes.length} infração(ões) RENAINF`;

let total = 0;

const resumo = infracoes.slice(0, 3).map((item) => {
const dados = item?.dados_infracao || {};
const valorAplicado = String(dados?.valor_aplicado || '0').replace(',', '.');
const valorNumero = parseFloat(valorAplicado);

if (!isNaN(valorNumero)) {
total += valorNumero;
}

return `${safe(dados?.infracao, 'Infração não identificada')} (${safe(dados?.municipio, 'Município não informado')})`;
});

report.details.quantidade_infracoes_renainf = String(infracoes.length);
report.details.valor_total_infracoes_renainf = total.toLocaleString('pt-BR', {
style: 'currency',
currency: 'BRL'
});
report.details.resumo_infracoes_renainf = resumo.join(' | ');
} else if (possuiInfracoes === 'nao') {
report.status.debitos = 'Não consta';
report.details.quantidade_infracoes_renainf = '0';
report.details.valor_total_infracoes_renainf = 'R$ 0,00';
report.details.resumo_infracoes_renainf = 'Não consta';
} else {
report.status.debitos = 'Indisponível no momento';
report.details.quantidade_infracoes_renainf = '-';
report.details.valor_total_infracoes_renainf = '-';
report.details.resumo_infracoes_renainf = 'Indisponível';
}

return report;
}

export async function getVehicleBasicReportByPlate(placaInformada) {
const placa = normalizarPlaca(placaInformada);

if (!placa || placa.length < 7) {
throw new Error('Placa inválida.');
}

const apiData = await consultarDadosBasicos(placa);
const report = mapearDadosBasicos(placa, apiData);

report.teaser = {
alertCount: 12,
message: 'Identificamos verificações adicionais, possíveis pendências e dados complementares liberados somente no relatório completo.'
};

return {
success: true,
placa: report.placa,
basic: report.basic,
teaser: report.teaser,
offer: report.offer
};
}

export async function getVehicleReportByPlate(placaInformada) {
const placa = normalizarPlaca(placaInformada);

if (!placa || placa.length < 7) {
throw new Error('Placa inválida.');
}

const apiData = await consultarDadosBasicos(placa);
const report = mapearDadosBasicos(placa, apiData);

try {
const fipeData = await consultarPrecoFipe(placa);
aplicarDadosFipe(report, fipeData);
} catch (error) {
console.warn('FIPE não disponível para esta placa:', error.message);
}

try {
const proprietarioData = await consultarProprietarioAtual(placa);
aplicarDadosProprietario(report, proprietarioData);
} catch (error) {
console.warn('Proprietário atual não disponível para esta placa:', error.message);
}

try {
const gravameData = await consultarGravame(placa);
aplicarDadosGravame(report, gravameData);
} catch (error) {
console.warn('Gravame não disponível para esta placa:', error.message);
}

try {
const renainfData = await consultarRenainf(placa);
aplicarDadosRenainf(report, renainfData);
} catch (error) {
console.warn('RENAINF não disponível para esta placa:', error.message);
}

report.teaser = montarTeaser(report);

return report;
}