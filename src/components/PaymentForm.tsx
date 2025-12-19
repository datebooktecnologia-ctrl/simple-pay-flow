import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PaymentData, PaymentStatus } from '@/types/customer';
import { formatCardNumber, formatExpiry, formatCurrency } from '@/lib/formatters';
import { CreditCard, QrCode, Copy, Check, Loader2, ArrowLeft, Shield } from 'lucide-react';
import { toast } from 'sonner';

interface PaymentFormProps {
  customerId: string;
  asaasCustomerId: string;
  valor: number;
  onSubmit: (data: PaymentData) => Promise<PaymentStatus>;
  onBack: () => void;
  isLoading: boolean;
}

export const PaymentForm = ({ customerId, asaasCustomerId, valor, onSubmit, onBack, isLoading }: PaymentFormProps) => {
  const [metodo, setMetodo] = useState<'pix' | 'cartao'>('pix');
  const [pixStatus, setPixStatus] = useState<PaymentStatus | null>(null);
  const [copied, setCopied] = useState(false);
  const [cardData, setCardData] = useState({
    numero: '',
    nome: '',
    validade: '',
    cvv: '',
  });
  const [processingPix, setProcessingPix] = useState(false);

  const handleCardChange = (field: keyof typeof cardData, value: string) => {
    let formattedValue = value;
    
    if (field === 'numero') formattedValue = formatCardNumber(value);
    if (field === 'validade') formattedValue = formatExpiry(value);
    if (field === 'cvv') formattedValue = value.replace(/\D/g, '').slice(0, 4);
    
    setCardData(prev => ({ ...prev, [field]: formattedValue }));
  };

  const handlePixGenerate = async () => {
    setProcessingPix(true);
    try {
      const result = await onSubmit({
        customerId,
        asaasCustomerId,
        valor,
        metodo: 'pix',
      });
      setPixStatus(result);
      if (result.status === 'pending') {
        toast.success('PIX gerado com sucesso!');
      }
    } catch {
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
      toast.success('Pagamento aprovado!');
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
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-secondary rounded-lg text-center">
                  <div className="w-48 h-48 mx-auto bg-card border rounded-lg flex items-center justify-center mb-4">
                    <QrCode className="w-32 h-32 text-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Escaneie o QR Code ou copie o código
                  </p>
                </div>
                
                <div className="relative">
                  <Input
                    value={pixStatus.pixCode?.slice(0, 40) + '...'}
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
