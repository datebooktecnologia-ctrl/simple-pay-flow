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
  pixCode?: string;
  pixQrCode?: string;
  message?: string;
}

export interface ConfigData {
  valor: number;
  destinatario: string;
  descricaoProduto?: string;
}
