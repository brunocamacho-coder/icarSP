import fetch from 'node-fetch';

async function fetchConsultarPlaca(path, placa, auth) {
  const response = await fetch(`https://api.consultarplaca.com.br${path}?placa=${encodeURIComponent(placa)}`, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Accept': 'application/json'
    }
  });

  let data;

  try {
    data = await response.json();
  } catch (error) {
    throw new Error(`Resposta inválida ao consultar ${path}`);
  }

  if (!response.ok) {
    throw new Error(data?.mensagem || data?.message || `Erro ao consultar ${path}`);
  }

  return data;
}

// 🆕 NOVA FUNÇÃO: Proprietário atual
async function fetchProprietarioAtual(placa, auth) {
  try {
    const response = await fetch(`https://api.consultarplaca.com.br/v2/consultarProprietarioAtual?placa=${encodeURIComponent(placa)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.warn(`[Proprietario] HTTP ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data?.dados?.proprietario_atual || null;
  } catch (error) {
    console.warn('[Proprietario] Erro na consulta:', error.message);
    return null;
  }
}

function normalizePlate(placa) {
  return String(placa || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

function buildAuth() {
  const email = process.env.CONSULTARPLACA_EMAIL;
  const apiKey = process.env.CONSULTARPLACA_API_KEY;

  if (!email || !apiKey) {
    throw new Error('Credenciais da Consultar Placa API não configuradas');
  }

  return Buffer.from(`${email}:${apiKey}`).toString('base64');
}

// Preview grátis - SÓ DADOS BÁSICOS
async function getVehicleBasicReportByPlate(placa) {
  const plate = normalizePlate(placa);
  const auth = buildAuth();

  const placaData = await fetchConsultarPlaca('/v2/consultarPlaca', plate, auth);
  const dadosVeiculo = placaData?.dados?.informacoes_veiculo?.dados_veiculo || {};

  const marcaModelo = [dadosVeiculo.marca, dadosVeiculo.modelo].filter(Boolean).join(' ').trim() || '-';
  const ano = [dadosVeiculo.ano_fabricacao, dadosVeiculo.ano_modelo].filter(Boolean).join('/') || '-';
  const cidadeRegistro = dadosVeiculo.municipio || dadosVeiculo.cidade || dadosVeiculo.local_registro || '-';
  const ufRegistro = dadosVeiculo.uf_municipio || dadosVeiculo.uf || dadosVeiculo.estado || '-';

  return {
    success: true,
    placa: dadosVeiculo.placa || plate,
    basic: {
      marca_modelo: marcaModelo,
      ano,
      combustivel: dadosVeiculo.combustivel || '-',
      cor: dadosVeiculo.cor || '-',
      cidade_registro: cidadeRegistro,
      uf_registro: ufRegistro
    },
    teaser: {
      alertCount: 12,
      message: 'Encontramos alertas e verificações adicionais para esta placa.'
    },
    offer: {
      price: 'R$ 14,99',
      cta: 'Desbloquear relatório completo'
    }
  };
}

// Relatório pago - COMPLETO (COM PROPRIETÁRIO)
async function getVehicleReportByPlate(placa) {
  const plate = normalizePlate(placa);
  const auth = buildAuth();

  // Consultas paralelas (placa + FIPE)
  const [placaData, fipeData] = await Promise.all([
    fetchConsultarPlaca('/v2/consultarPlaca', plate, auth),
    fetchConsultarPlaca('/v2/consultarPrecoFipe', plate, auth).catch((error) => {
      console.error('Erro ao consultar FIPE:', error.message);
      return null;
    })
  ]);

  // 🆕 NOVO: Consulta proprietário atual (não quebra se falhar)
  const proprietario = await fetchProprietarioAtual(plate, auth);

  const dadosVeiculo = placaData?.dados?.informacoes_veiculo?.dados_veiculo || {};
  const informacoesFipe = fipeData?.dados?.informacoes_fipe || [];
  const primeiraOpcaoFipe = Array.isArray(informacoesFipe) && informacoesFipe.length > 0 ? informacoesFipe[0] : null;
  const valorFipe = primeiraOpcaoFipe?.preco || primeiraOpcaoFipe?.valor || primeiraOpcaoFipe?.valor_fipe || 'Não localizado';

  return {
    success: true,
    placa: dadosVeiculo.placa || plate,
    vehicle: {
      marca_modelo: [dadosVeiculo.marca, dadosVeiculo.modelo].filter(Boolean).join(' ') || '-',
      ano: [dadosVeiculo.ano_fabricacao, dadosVeiculo.ano_modelo].filter(Boolean).join('/') || '-',
      cor: dadosVeiculo.cor || '-',
      combustivel: dadosVeiculo.combustivel || '-',
      fipe: valorFipe,
      chassi: dadosVeiculo.chassi || '-',
      renavam: 'Em integração'
    },
    status: {
      roubo_furto: 'Em integração',
      leilao: 'Em integração',
      debitos: 'Em integração',
      restricoes: 'Em integração',
      gravame: 'Em integração',
      licenciamento_ipva: 'Em integração'
    },
    details: {
      instituicao_credora: 'Em integração',
      detalhes_bloqueio: 'Em integração',
      proprietario_atual: proprietario // 🆕 NOVO CAMPO
    },
    summary: valorFipe !== 'Não localizado'
      ? `Consulta completa carregada com sucesso. Valor FIPE identificado: ${valorFipe}.`
      : 'Consulta completa carregada com sucesso. Valor FIPE ainda não identificado.'
  };
}

module.exports = {
  getVehicleBasicReportByPlate,
  getVehicleReportByPlate
};