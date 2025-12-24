import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PaymentData, PaymentStatus } from '@/types/customer';
import { formatCardNumber, formatExpiry, formatCurrency } from '@/lib/formatters';
import { verificarStatusPagamento, obterRedirectUrl } from '@/lib/api';
import { CreditCard, QrCode, Copy, Check, Loader2, ArrowLeft, Shield, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface PaymentFormProps {
  customerId: string;
  asaasCustomerId: string;
  valor: number;
  onSubmit: (data: PaymentData) => Promise<PaymentStatus>;
  onBack: () => void;
  onPaymentConfirmed: (redirectUrl?: string) => void;
  isLoading: boolean;
}

export const PaymentForm = ({ customerId, asaasCustomerId, valor, onSubmit, onBack, onPaymentConfirmed, isLoading }: PaymentFormProps) => {
  const [metodo, setMetodo] = useState<'pix' | 'cartao'>('pix');
  const [pixStatus, setPixStatus] = useState<PaymentStatus | null>(null);
  const [pixConfirmed, setPixConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [cardData, setCardData] = useState({
    numero: '',
    nome: '',
    validade: '',
    cvv: '',
  });
  const [processingPix, setProcessingPix] = useState(false);

  // Refs para controle do polling
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPollingRef = useRef(false);

  // Limpa polling ao desmontar componente
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  const startPolling = (transactionId: string) => {
    console.log('[Polling] Iniciando polling para transactionId:', transactionId);
    isPollingRef.current = true;

    // Polling a cada 3 segundos
    pollingIntervalRef.current = setInterval(async () => {
      try {
        console.log('[Polling] Verificando status...');
        const result = await verificarStatusPagamento(transactionId);
        console.log('[Polling] Status recebido:', result.status);

        if (result.status === 'confirmed') {
          console.log('[Polling] Pagamento confirmado!');
          stopPolling();
          setPixConfirmed(true);
          
          toast.success('✅ Pagamento confirmado!');

          // Aguarda 2 segundos e redireciona
          setTimeout(() => {
            const redirectUrl = result.redirect || obterRedirectUrl();
            console.log('[Polling] Redirecionando para:', redirectUrl);
            onPaymentConfirmed(redirectUrl);
          }, 2000);
        } else if (result.status === 'failed') {
          console.log('[Polling] Pagamento falhou');
          stopPolling();
          
          toast.error('❌ Pagamento falhou. Tente novamente.');
          setPixStatus(null);
        }
      } catch (error) {
        console.error('[Polling] Erro ao verificar status:', error);
      }
    }, 3000);

    // Timeout de segurança: 10 minutos
    pollingTimeoutRef.current = setTimeout(() => {
      console.log('[Polling] Timeout de 10 minutos atingido');
      stopPolling();
      
      toast.error('⏱️ Tempo expirado. Gere um novo QR Code.');
      setPixStatus(null);
    }, 10 * 60 * 1000);
  };

  const stopPolling = () => {
    console.log('[Polling] Parando polling...');
    isPollingRef.current = false;
    
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
  };

  const handleCardChange = (field: keyof typeof cardData, value: string) => {
    let formattedValue = value;
    
    if (field === 'numero') formattedValue = formatCardNumber(value);
    if (field === 'validade') formattedValue = formatExpiry(value);
    if (field === 'cvv') formattedValue = value.replace(/\D/g, '').slice(0, 4);
    
    setCardData(prev => ({ ...prev, [field]: formattedValue }));
  };

  const handlePixGenerate = async () => {
    console.log('[PaymentForm] Gerando QR Code PIX...');
    setProcessingPix(true);
    setPixConfirmed(false);
    
    try {
      const result = await onSubmit({
        customerId,
        asaasCustomerId,
        valor,
        metodo: 'pix',
      });
      
      console.log('[PaymentForm] Resultado PIX:', result);
      setPixStatus(result);
      
      if (result.status === 'pending' && result.transactionId) {
        console.log('[PaymentForm] Status pending, iniciando polling...');
        toast.success('PIX gerado com sucesso!');
        startPolling(result.transactionId);
      } else if (result.status === 'confirmed') {
        setPixConfirmed(true);
        toast.success('✅ Pagamento já confirmado!');
        setTimeout(() => {
          const redirectUrl = result.redirect || obterRedirectUrl();
          onPaymentConfirmed(redirectUrl);
        }, 2000);
      }
    } catch (error) {
      console.error('[PaymentForm] Erro ao gerar PIX:', error);
      toast.error('Erro ao gerar PIX');
    } finally {
      setProcessingPix(false);
    }
  };

  const handleCopyPix = () => {
    if (pixStatus?.pixCode) {
      navigator.clipboard.writeText(pixStatus.pixCode);
      setCopied(true);
      toast.success('Código PIX copiado!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (cardData.numero.replace(/\s/g, '').length !== 16) {
      toast.error('Número do cartão inválido');
      return;
    }
    if (!cardData.nome.trim()) {
      toast.error('Nome no cartão é obrigatório');
      return;
    }
    if (cardData.validade.length !== 5) {
      toast.error('Validade inválida');
      return;
    }
    if (cardData.cvv.length < 3) {
      toast.error('CVV inválido');
      return;
    }
    
    const result = await onSubmit({
      customerId,
      asaasCustomerId,
      valor,
      metodo: 'cartao',
      cartao: cardData,
    });
    
    if (result.status === 'confirmed') {
      toast.success('✅ Pagamento aprovado!');
      setTimeout(() => {
        const redirectUrl = result.redirect || obterRedirectUrl();
        onPaymentConfirmed(redirectUrl);
      }, 2000);
    } else {
      toast.error(result.message || 'Pagamento não aprovado');
    }
  };

  return (
    <Card className="w-full max-w-lg mx-auto shadow-glow animate-slide-up">
      <CardHeader className="text-center pb-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="absolute left-4 top-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Voltar
        </Button>
        <CardTitle className="text-2xl font-bold text-foreground pt-4">Pagamento</CardTitle>
        <CardDescription>Escolha a forma de pagamento</CardDescription>
        <div className="mt-4 p-4 bg-secondary rounded-lg">
          <p className="text-sm text-muted-foreground">Valor a pagar</p>
          <p className="text-3xl font-bold text-primary">{formatCurrency(valor)}</p>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={metodo} onValueChange={(v) => setMetodo(v as 'pix' | 'cartao')}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="pix" className="flex items-center gap-2">
              <QrCode className="w-4 h-4" />
              PIX
            </TabsTrigger>
            <TabsTrigger value="cartao" className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Cartão
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="pix" className="space-y-4">
            {!pixStatus ? (
              <div className="text-center space-y-4">
                <div className="p-8 border-2 border-dashed border-border rounded-lg">
                  <QrCode className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground">
                    Clique no botão abaixo para gerar o QR Code PIX
                  </p>
                </div>
                <Button
                  onClick={handlePixGenerate}
                  className="w-full h-12"
                  disabled={processingPix}
                >
                  {processingPix ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Gerando PIX...
                    </>
                  ) : (
                    'Gerar QR Code PIX'
                  )}
                </Button>
              </div>
            ) : pixConfirmed ? (
              <div className="space-y-4">
                <div className="flex flex-col items-center justify-center py-8 text-green-600 bg-green-50 rounded-lg">
                  <CheckCircle2 className="w-16 h-16 mb-3" />
                  <span className="text-xl font-bold">✅ Pagamento confirmado!</span>
                  <span className="text-sm text-muted-foreground mt-2">Você será redirecionado em alguns segundos...</span>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-secondary rounded-lg text-center">
                  <div className="w-48 h-48 mx-auto bg-card border rounded-lg flex items-center justify-center mb-4 overflow-hidden">
                    {pixStatus.pixQrCode ? (
                      <img 
                        src={pixStatus.pixQrCode} 
                        alt="QR Code PIX" 
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <QrCode className="w-32 h-32 text-foreground" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Escaneie o QR Code ou copie o código
                  </p>
                </div>
                
                <div className="relative">
                  <Input
                    value={pixStatus.pixCode ? (pixStatus.pixCode.slice(0, 40) + '...') : ''}
                    readOnly
                    className="pr-12 font-mono text-xs"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute right-1 top-1/2 -translate-y-1/2"
                    onClick={handleCopyPix}
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-success" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                
                <div className="flex items-center gap-2 p-3 bg-warning/10 rounded-lg text-sm text-warning">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Aguardando confirmação do pagamento...
                </div>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="cartao">
            <form onSubmit={handleCardSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="card-numero">Número do Cartão</Label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="card-numero"
                    value={cardData.numero}
                    onChange={e => handleCardChange('numero', e.target.value)}
                    placeholder="0000 0000 0000 0000"
                    className="pl-10 font-mono"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="card-nome">Nome no Cartão</Label>
                <Input
                  id="card-nome"
                  value={cardData.nome}
                  onChange={e => handleCardChange('nome', e.target.value.toUpperCase())}
                  placeholder="NOME COMO NO CARTÃO"
                  className="uppercase"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="card-validade">Validade</Label>
                  <Input
                    id="card-validade"
                    value={cardData.validade}
                    onChange={e => handleCardChange('validade', e.target.value)}
                    placeholder="MM/AA"
                    className="font-mono"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="card-cvv">CVV</Label>
                  <Input
                    id="card-cvv"
                    type="password"
                    value={cardData.cvv}
                    onChange={e => handleCardChange('cvv', e.target.value)}
                    placeholder="***"
                    className="font-mono"
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-2 p-3 bg-secondary rounded-lg text-sm text-muted-foreground">
                <Shield className="w-4 h-4 text-success" />
                Seus dados estão protegidos com criptografia SSL
              </div>
              
              <Button type="submit" className="w-full h-12" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  `Pagar ${formatCurrency(valor)}`
                )}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
