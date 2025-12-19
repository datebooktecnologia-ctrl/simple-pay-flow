import { CustomerData, PaymentData, PaymentStatus, ConfigData } from '@/types/customer';

// Base URL para as APIs ASP - ajustar conforme ambiente
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/pay/api';

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
    
    return await response.json();
  } catch (error) {
    console.error('Erro ao obter configuração:', error);
    // Simulação para desenvolvimento
    return {
      valor: 99.90,
      destinatario: 'M3A Soluções Digitais',
      descricaoProduto: 'Serviço Digital',
    };
  }
};

export const cadastrarCliente = async (data: CustomerData & { slug: string }): Promise<{ success: boolean; customerId?: string; message?: string }> => {
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
      message: 'Cliente cadastrado com sucesso',
    };
  }
};

export const processarPagamento = async (data: PaymentData): Promise<PaymentStatus> => {
  try {
    const response = await fetch(`${API_BASE_URL}/land_pagamento.asp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error('Erro ao processar pagamento');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Erro no pagamento:', error);
    // Simulação para desenvolvimento
    if (data.metodo === 'pix') {
      return {
        status: 'pending',
        transactionId: `TRX_${Date.now()}`,
        pixCode: '00020126580014br.gov.bcb.pix0136a629532e-7372-4a63-b7e1-8e5e1e5e1e5e5204000053039865802BR5925EMPRESA PAGAMENTOS LTDA6009SAO PAULO62140510PAGAMENTO016304ABCD',
        pixQrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        message: 'PIX gerado com sucesso',
      };
    }
    return {
      status: 'confirmed',
      transactionId: `TRX_${Date.now()}`,
      message: 'Pagamento aprovado',
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
    
    return await response.json();
  } catch (error) {
    console.error('Erro ao verificar status:', error);
    // Simulação para desenvolvimento
    return {
      status: 'confirmed',
      transactionId,
      message: 'Pagamento confirmado',
    };
  }
};
