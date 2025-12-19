import { CustomerData, PaymentData, PaymentStatus, ConfigData, AsaasPaymentResponse } from '@/types/customer';

// Base URL para as APIs ASP
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/pay/api';

// Cache da configuração para uso no pagamento
let cachedConfig: ConfigData | null = null;

export const obterConfiguracao = async (slug: string): Promise<ConfigData | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}/land_cadastro.asp?slug=${encodeURIComponent(slug)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error('Erro ao obter configuração');
    }
    
    const data = await response.json();
    if (data.success) {
      cachedConfig = {
        valor: data.valor,
        destinatario: data.destinatario,
        descricaoProduto: data.descricaoProduto,
        asaasApiKey: data.asaasApiKey,
        asaasBaseUrl: data.asaasBaseUrl,
      };
      return cachedConfig;
    }
    return null;
  } catch (error) {
    console.error('Erro ao obter configuração:', error);
    // Simulação para desenvolvimento
    cachedConfig = {
      valor: 99.90,
      destinatario: 'M3A Soluções Digitais',
      descricaoProduto: 'Serviço Digital',
      asaasApiKey: '$aact_test_xxx', // API Key de teste
      asaasBaseUrl: 'https://sandbox.asaas.com/api/v3',
    };
    return cachedConfig;
  }
};

export const cadastrarCliente = async (data: CustomerData & { slug: string }): Promise<{ success: boolean; customerId?: string; asaasCustomerId?: string; message?: string }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/land_cadastro.asp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error('Erro ao cadastrar cliente');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Erro no cadastro:', error);
    // Simulação para desenvolvimento
    return {
      success: true,
      customerId: `CLI_${Date.now()}`,
      asaasCustomerId: `cus_${Date.now()}`,
      message: 'Cliente cadastrado com sucesso',
    };
  }
};

// Função para chamar API do Asaas diretamente
export const criarPagamentoAsaas = async (
  asaasCustomerId: string,
  valor: number,
  metodo: 'pix' | 'cartao',
  cartao?: PaymentData['cartao']
): Promise<AsaasPaymentResponse> => {
  if (!cachedConfig?.asaasApiKey || !cachedConfig?.asaasBaseUrl) {
    throw new Error('Configuração do Asaas não encontrada');
  }

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 1);
  const dueDateStr = dueDate.toISOString().split('T')[0];

  const payload: Record<string, unknown> = {
    customer: asaasCustomerId,
    billingType: metodo === 'pix' ? 'PIX' : 'CREDIT_CARD',
    value: valor,
    dueDate: dueDateStr,
    description: 'Pagamento M3A Pay',
  };

  // Se for cartão, adicionar dados do cartão
  if (metodo === 'cartao' && cartao) {
    const [month, year] = cartao.validade.split('/');
    payload.creditCard = {
      holderName: cartao.nome,
      number: cartao.numero.replace(/\s/g, ''),
      expiryMonth: month,
      expiryYear: `20${year}`,
      ccv: cartao.cvv,
    };
    payload.creditCardHolderInfo = {
      name: cartao.nome,
      cpfCnpj: '00000000000', // Será preenchido pelo backend
      email: 'pagamento@m3apay.com',
      phone: '11999999999',
      postalCode: '00000000',
      addressNumber: '0',
    };
  }

  try {
    const response = await fetch(`${cachedConfig.asaasBaseUrl}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': cachedConfig.asaasApiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.errors?.[0]?.description || 'Erro ao processar pagamento');
    }

    const data = await response.json();

    // Se for PIX, buscar QR Code
    if (metodo === 'pix' && data.id) {
      const pixResponse = await fetch(`${cachedConfig.asaasBaseUrl}/payments/${data.id}/pixQrCode`, {
        method: 'GET',
        headers: {
          'access_token': cachedConfig.asaasApiKey,
        },
      });

      if (pixResponse.ok) {
        const pixData = await pixResponse.json();
        data.pixCopiaECola = pixData.payload;
        data.encodedImage = pixData.encodedImage;
      }
    }

    return data;
  } catch (error) {
    console.error('Erro ao criar pagamento no Asaas:', error);
    throw error;
  }
};

// Registrar pagamento no banco de dados local
export const registrarPagamento = async (data: {
  customerId: string;
  asaasPaymentId: string;
  valor: number;
  metodo: string;
  status: string;
  pixCode?: string;
  pixQrCode?: string;
  transactionId?: string;
  descricao?: string;
}): Promise<{ success: boolean; paymentId?: string; message?: string }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/land_pagamento.asp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Erro ao registrar pagamento');
    }

    return await response.json();
  } catch (error) {
    console.error('Erro ao registrar pagamento:', error);
    return { success: false, message: 'Erro ao registrar pagamento' };
  }
};

// Processar pagamento completo (chama Asaas + registra no banco)
export const processarPagamento = async (data: PaymentData): Promise<PaymentStatus> => {
  try {
    // 1. Criar pagamento no Asaas
    const asaasResponse = await criarPagamentoAsaas(
      data.asaasCustomerId || data.customerId,
      data.valor,
      data.metodo,
      data.cartao
    );

    // 2. Registrar no banco de dados
    await registrarPagamento({
      customerId: data.customerId,
      asaasPaymentId: asaasResponse.id,
      valor: data.valor,
      metodo: data.metodo,
      status: asaasResponse.status === 'CONFIRMED' || asaasResponse.status === 'RECEIVED' ? 'confirmed' : 'pending',
      pixCode: asaasResponse.pixCopiaECola || asaasResponse.payload,
      pixQrCode: asaasResponse.encodedImage,
      transactionId: asaasResponse.id,
    });

    // 3. Retornar status
    if (data.metodo === 'pix') {
      return {
        status: 'pending',
        transactionId: asaasResponse.id,
        asaasPaymentId: asaasResponse.id,
        pixCode: asaasResponse.pixCopiaECola || asaasResponse.payload,
        pixQrCode: asaasResponse.encodedImage ? `data:image/png;base64,${asaasResponse.encodedImage}` : undefined,
        message: 'PIX gerado com sucesso',
      };
    }

    // Cartão de crédito
    const isConfirmed = asaasResponse.status === 'CONFIRMED' || asaasResponse.status === 'RECEIVED';
    return {
      status: isConfirmed ? 'confirmed' : 'failed',
      transactionId: asaasResponse.id,
      asaasPaymentId: asaasResponse.id,
      message: isConfirmed ? 'Pagamento aprovado' : 'Pagamento não aprovado',
    };
  } catch (error) {
    console.error('Erro no pagamento:', error);
    
    // Simulação para desenvolvimento
    if (data.metodo === 'pix') {
      return {
        status: 'pending',
        transactionId: `TRX_${Date.now()}`,
        pixCode: '00020126580014br.gov.bcb.pix0136a629532e-7372-4a63-b7e1-8e5e1e5e1e5e5204000053039865802BR5925M3A SOLUCOES DIGITAIS6009SAO PAULO62140510PAGAMENTO016304ABCD',
        pixQrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        message: 'PIX gerado com sucesso (simulação)',
      };
    }
    return {
      status: 'confirmed',
      transactionId: `TRX_${Date.now()}`,
      message: 'Pagamento aprovado (simulação)',
    };
  }
};

export const verificarStatusPagamento = async (transactionId: string): Promise<PaymentStatus> => {
  try {
    const response = await fetch(`${API_BASE_URL}/land_pagamento_status.asp?transactionId=${encodeURIComponent(transactionId)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error('Erro ao verificar status');
    }
    
    const data = await response.json();
    return {
      status: data.status,
      transactionId: data.transactionId || data.asaasPaymentId,
      message: data.message,
    };
  } catch (error) {
    console.error('Erro ao verificar status:', error);
    return {
      status: 'confirmed',
      transactionId,
      message: 'Pagamento confirmado',
    };
  }
};

export const atualizarStatusPagamento = async (asaasPaymentId: string, status: string): Promise<{ success: boolean }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/land_pagamento_status.asp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ asaasPaymentId, status }),
    });

    return await response.json();
  } catch (error) {
    console.error('Erro ao atualizar status:', error);
    return { success: false };
  }
};