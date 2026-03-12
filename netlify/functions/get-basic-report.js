import { getVehicleBasicReportByPlate } from './providers/vehicle-provider.js';

export const handler = async (event) => {
  try {
    const placa = event.queryStringParameters?.placa;

    if (!placa) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, message: 'Placa não informada.' })
      };
    }

    const data = await getVehicleBasicReportByPlate(placa);

    return {
      statusCode: 200,
      body: JSON.stringify(data)
    };
  } catch (error) {
    console.error('Erro em get-basic-report:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, message: error.message })
    };
  }
};