export interface CustomerData {
  nome: string;
  cpfCnpj: string;
  tipoPessoa: 'pf' | 'pj';
  email: string;
  whatsapp: string;
  companhia: string;
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  descricao: string;
}

export interface PaymentData {
  customerId: string;
  asaasCustomerId?: string;
  valor: number;
  metodo: 'pix' | 'cartao';
  cartao?: {
    numero: string;
    nome: string;
    validade: string;
    cvv: string;
  };
}

export interface PaymentStatus {
  status: 'pending' | 'confirmed' | 'failed';
  transactionId?: string;
  asaasPaymentId?: string;
  pixCode?: string;
  pixQrCode?: string;
  message?: string;
}

export interface ConfigData {
  valor: number;
  destinatario: string;
  descricaoProduto?: string;
  asaasApiKey?: string;
  asaasBaseUrl?: string;
}

export interface AsaasPaymentResponse {
  id: string;
  customer: string;
  value: number;
  billingType: string;
  status: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  pixQrCodeUrl?: string;
  pixCopiaECola?: string;
  encodedImage?: string;
  payload?: string;
  expirationDate?: string;
}
