import fetch from 'node-fetch';

function buildAuth() {
  const email = process.env.CONSULTARPLACA_EMAIL;
  const apiKey = process.env.CONSULTARPLACA_API_KEY;

  if (!email || !apiKey) {
    throw new Error('Credenciais da API não configuradas');
  }

  return Buffer.from(`${email}:${apiKey}`).toString('base64');
}

async function consultarProtocolo(protocolo) {
  const auth = buildAuth();
  const response = await fetch(`https://api.consultarplaca.com.br/v2/consultarProtocolo?protocolo=${protocolo}&tipo_retorno=JSON`, {
    headers: {
      'Authorization': `Basic ${auth}`,
      'Accept': 'application/json'
    }
  });
  return await response.json();
}

export const handler = async (event) => {
  try {
    const { placa } = JSON.parse(event.body);

    // 1. Solicitar relatório para obter protocolo
    const solicitacao = await fetch(`https://api.consultarplaca.com.br/v2/solicitarRelatorio?placa=${placa}`, {
      headers: {
        'Authorization': `Basic ${buildAuth()}`,
        'Accept': 'application/json'
      }
    });
    const protocoloData = await solicitacao.json();
    const protocolo = protocoloData.protocolo;

    if (!protocolo) {
      throw new Error('Não foi possível gerar protocolo');
    }

    // 2. Consultar protocolo (pode levar tempo)
    let dadosCompletos = null;
    let tentativas = 0;
    while (tentativas < 10) {
      await new Promise(resolve => setTimeout(resolve, 3000)); // espera 3s
      const resultado = await consultarProtocolo(protocolo);
      
      if (resultado.situacao_consulta === 'finalizada' || resultado.situacao_consulta === 'parcialmente_finalizada') {
        dadosCompletos = resultado;
        break;
      }
      tentativas++;
    }

    if (!dadosCompletos) {
      throw new Error('Tempo limite excedido para processamento do relatório');
    }

    // 3. Mapear dados para o formato esperado pelo frontend
    const dadosVeiculo = dadosCompletos.dados?.[0]?.informacoes_veiculo?.dados_veiculo || {};
    const rouboFurto = dadosCompletos.dados?.find(d => d.historico_roubo_furto)?.historico_roubo_furto || {};
    const debitos = dadosCompletos.dados?.find(d => d.registro_debitos_por_infracoes_renainf)?.registro_debitos_por_infracoes_renainf || {};
    const restricoes = dadosCompletos.dados?.find(d => d.informacoes_do_detran)?.informacoes_do_detran || {};

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        placa,
        vehicle: {
          marca_modelo: `${dadosVeiculo.marca || ''} ${dadosVeiculo.modelo || ''}`.trim() || '-',
          ano: dadosVeiculo.ano_fabricacao && dadosVeiculo.ano_modelo ? `${dadosVeiculo.ano_fabricacao}/${dadosVeiculo.ano_modelo}` : '-',
          cor: dadosVeiculo.cor || '-',
          combustivel: dadosVeiculo.combustivel || '-',
          chassi: dadosVeiculo.chassi || '-',
          renavam: restricoes?.numero_renavam || '-',
          fipe: dadosCompletos.dados?.find(d => d.referencia_precificador)?.referencia_precificador?.desvalorizacao?.[0]?.valor || 'Não localizado'
        },
        status: {
          roubo_furto: rouboFurto?.registros_roubo_furto?.possui_registro === 'sim' ? 'Consta registro' : 'Sem registro',
          leilao: dadosCompletos.dados?.find(d => d.informacoes_sobre_leilao)?.informacoes_sobre_leilao?.possui_registro === 'sim' ? 'Consta registro' : 'Não consta',
          debitos: debitos?.infracoes_renainf?.possui_infracoes === 'sim' ? 'Constam pendências' : 'Não constam',
          restricoes: restricoes?.restricoes_detran?.restricao_judicial?.possui_restricao === 'sim' ? 'Constam restrições' : 'Não constam',
          gravame: dadosCompletos.dados?.find(d => d.registro_de_bloqueio_judicial_renajud)?.registro_de_bloqueio_judicial_renajud?.possui_bloqueio === 'sim' ? 'Ativo' : 'Não consta',
          licenciamento_ipva: restricoes?.debitos_detran?.debitos_licenciamento?.possui_debido === 'sim' ? 'Pendente' : 'Regular'
        },
        details: {
          instituicao_credora: dadosCompletos.dados?.find(d => d.registro_de_bloqueio_judicial_renajud)?.registro_de_bloqueio_judicial_renajud?.bloqueios?.[0]?.tribunal || 'Não informado',
          detalhes_bloqueio: restricoes?.restricoes_detran?.restricao_judicial?.restricao || 'Nenhum'
        }
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};