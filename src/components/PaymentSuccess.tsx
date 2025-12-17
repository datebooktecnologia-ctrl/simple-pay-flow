import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

interface PaymentSuccessProps {
  transactionId: string;
  valor: number;
  onNewPayment: () => void;
}

export const PaymentSuccess = ({ transactionId, valor, onNewPayment }: PaymentSuccessProps) => {
  return (
    <Card className="w-full max-w-lg mx-auto shadow-glow animate-slide-up">
      <CardContent className="pt-12 pb-8 text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-success/10 flex items-center justify-center">
          <CheckCircle2 className="w-12 h-12 text-success" />
        </div>
        
        <h2 className="text-2xl font-bold text-foreground mb-2">
          Pagamento Confirmado!
        </h2>
        
        <p className="text-muted-foreground mb-6">
          Seu pagamento foi processado com sucesso
        </p>
        
        <div className="p-4 bg-secondary rounded-lg mb-6">
          <p className="text-sm text-muted-foreground">Valor pago</p>
          <p className="text-3xl font-bold text-success">{formatCurrency(valor)}</p>
        </div>
        
        <div className="p-3 bg-muted rounded-lg mb-8">
          <p className="text-xs text-muted-foreground">ID da Transação</p>
          <p className="text-sm font-mono text-foreground">{transactionId}</p>
        </div>
        
        <Button onClick={onNewPayment} variant="outline" className="w-full">
          Realizar Novo Pagamento
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
};
