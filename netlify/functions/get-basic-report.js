import { getVehicleBasicReportByPlate } from './providers/vehicle-provider.js';

export const handler = async (event) => {
  try {
    const placa = event.queryStringParameters?.placa;

    if (!placa) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          message: 'Placa não informada.'
        })
      };
    }

    const data = await getVehicleBasicReportByPlate(placa);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error('Erro em get-basic-report:', error);

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        message: error.message || 'Erro interno ao consultar placa.'
      })
    };
  }
};