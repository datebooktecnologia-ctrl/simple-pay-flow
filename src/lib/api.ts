import { CustomerData, PaymentData, PaymentStatus, ConfigData } from '@/types/customer';

// Base URL para as APIs ASP
// Usa a BASE_URL do Vite (configurada como "/pay/") para funcionar em preview e produção.
const API_BASE_URL = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/api`;
// Cache da configuração para uso no pagamento
let cachedConfig: ConfigData | null = null;
let cachedSlug: string = '';

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
      };
      cachedSlug = slug;
      return cachedConfig;
    }
    return null;
  } catch (error) {
    console.error('Erro ao obter configuração:', error);
    return null;
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
    return {
      success: false,
      message: 'Erro ao cadastrar cliente',
    };
  }
};

// Processar pagamento via proxy backend (evita CORS)
export const processarPagamento = async (data: PaymentData): Promise<PaymentStatus> => {
  try {
    const payload: Record<string, unknown> = {
      asaasCustomerId: data.asaasCustomerId,
      customerId: data.customerId,
      valor: data.valor,
      metodo: data.metodo,
      slug: cachedSlug,
    };

    // Se for cartão, adicionar dados do cartão
    if (data.metodo === 'cartao' && data.cartao) {
      payload.cardNumero = data.cartao.numero;
      payload.cardNome = data.cartao.nome;
      payload.cardValidade = data.cartao.validade;
      payload.cardCvv = data.cartao.cvv;
    }

    const response = await fetch(`${API_BASE_URL}/land_pagamento_criar.asp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error('Erro ao processar pagamento');
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || 'Erro ao processar pagamento');
    }

    // Retornar status do pagamento
    if (data.metodo === 'pix') {
      return {
        status: result.status || 'pending',
        transactionId: result.asaasPaymentId,
        asaasPaymentId: result.asaasPaymentId,
        pixCode: result.pixCode,
        pixQrCode: result.pixQrCode ? `data:image/png;base64,${result.pixQrCode}` : undefined,
        message: result.message || 'PIX gerado com sucesso',
      };
    }

    // Cartão de crédito
    return {
      status: result.status === 'confirmed' ? 'confirmed' : 'failed',
      transactionId: result.asaasPaymentId,
      asaasPaymentId: result.asaasPaymentId,
      message: result.status === 'confirmed' ? 'Pagamento aprovado' : 'Pagamento não aprovado',
    };
  } catch (error) {
    console.error('Erro no pagamento:', error);
    return {
      status: 'failed',
      message: error instanceof Error ? error.message : 'Erro ao processar pagamento',
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
      status: 'pending',
      transactionId,
      message: 'Aguardando confirmação',
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
