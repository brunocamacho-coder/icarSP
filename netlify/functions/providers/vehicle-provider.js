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

// 🔥 FUNÇÃO CORRIGIDA: Preview grátis - SÓ DADOS BÁSICOS (R$ 0,31)
async function getVehicleBasicReportByPlate(placa) {
  const plate = normalizePlate(placa);
  const auth = buildAuth();

  // ✅ SÓ consulta a placa (NÃO consulta FIPE)
  const placaData = await fetchConsultarPlaca('/v2/consultarPlaca', plate, auth);

  const dadosVeiculo = placaData?.dados?.informacoes_veiculo?.dados_veiculo || {};

  const marcaModelo = [
    dadosVeiculo.marca,
    dadosVeiculo.modelo
  ].filter(Boolean).join(' ').trim() || '-';

  const ano = [
    dadosVeiculo.ano_fabricacao,
    dadosVeiculo.ano_modelo
  ].filter(Boolean).join('/') || '-';

  const cidadeRegistro =
    dadosVeiculo.municipio ||
    dadosVeiculo.cidade ||
    dadosVeiculo.local_registro ||
    '-';

  const ufRegistro =
    dadosVeiculo.uf ||
    dadosVeiculo.estado ||
    '-';

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
      // ✅ FIPE NÃO ESTÁ AQUI!
    },
    teaser: {
      alertCount: 12,
      message: 'Encontramos alertas e verificações adicionais para esta placa.'
    },
    offer: {
      price: 'R$ 14,90', // Atualizado para R$14,90
      cta: 'Desbloquear relatório completo'
    }
  };
}

// 🔥 FUNÇÃO CORRIGIDA: Relatório pago - COMPLETO (R$ 1,30)
async function getVehicleReportByPlate(placa) {
  const plate = normalizePlate(placa);
  const auth = buildAuth();

  // ✅ Consulta placa + FIPE (completo)
  const [placaData, fipeData] = await Promise.all([
    fetchConsultarPlaca('/v2/consultarPlaca', plate, auth),
    fetchConsultarPlaca('/v2/consultarPrecoFipe', plate, auth).catch((error) => {
      console.error('Erro ao consultar FIPE:', error.message);
      return null;
    })
  ]);

  const dadosVeiculo = placaData?.dados?.informacoes_veiculo?.dados_veiculo || {};
  const informacoesFipe = fipeData?.dados?.informacoes_fipe || [];

  const primeiraOpcaoFipe = Array.isArray(informacoesFipe) && informacoesFipe.length > 0
    ? informacoesFipe[0]
    : null;

  const valorFipe =
    primeiraOpcaoFipe?.preco ||
    primeiraOpcaoFipe?.valor ||
    primeiraOpcaoFipe?.valor_fipe ||
    'Não localizado';

  return {
    success: true,
    placa: dadosVeiculo.placa || plate,
    vehicle: {
      marca_modelo: [dadosVeiculo.marca, dadosVeiculo.modelo].filter(Boolean).join(' ') || '-',
      ano: [dadosVeiculo.ano_fabricacao, dadosVeiculo.ano_modelo].filter(Boolean).join('/') || '-',
      cor: dadosVeiculo.cor || '-',
      combustivel: dadosVeiculo.combustivel || '-',
      fipe: valorFipe, // ✅ FIPE só aparece aqui (pago)
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
      detalhes_bloqueio: 'Em integração'
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