import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { StepIndicator } from '@/components/StepIndicator';
import { RegistrationForm } from '@/components/RegistrationForm';
import { PaymentForm } from '@/components/PaymentForm';
import { PaymentSuccess } from '@/components/PaymentSuccess';
import { CustomerData, PaymentStatus, ConfigData } from '@/types/customer';
import { cadastrarCliente, processarPagamento, obterConfiguracao } from '@/lib/api';
import { toast } from 'sonner';
import { Shield, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const STEPS = ['Cadastro', 'Pagamento', 'Confirmação'];

const Index = () => {
  const [searchParams] = useSearchParams();
  const slug = searchParams.get('slug') || '';
  
  const [currentStep, setCurrentStep] = useState(0);
  const [customerId, setCustomerId] = useState<string>('');
  const [transactionId, setTransactionId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [config, setConfig] = useState<ConfigData | null>(null);

  useEffect(() => {
    const carregarConfiguracao = async () => {
      setConfigLoading(true);
      const data = await obterConfiguracao(slug);
      setConfig(data);
      setConfigLoading(false);
    };
    
    carregarConfiguracao();
  }, [slug]);

  const handleRegistration = async (data: CustomerData) => {
    setIsLoading(true);
    try {
      const result = await cadastrarCliente({ ...data, slug });
      
      if (result.success && result.customerId) {
        setCustomerId(result.customerId);
        setCurrentStep(1);
        toast.success('Cadastro realizado com sucesso!');
      } else {
        toast.error(result.message || 'Erro ao realizar cadastro');
      }
    } catch {
      toast.error('Erro ao processar cadastro');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayment = async (data: Parameters<typeof processarPagamento>[0]): Promise<PaymentStatus> => {
    setIsLoading(true);
    try {
      const result = await processarPagamento(data);
      
      if (result.status === 'confirmed') {
        setTransactionId(result.transactionId || '');
        setCurrentStep(2);
      }
      
      return result;
    } catch {
      return { status: 'failed', message: 'Erro ao processar pagamento' };
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewPayment = () => {
    setCurrentStep(0);
    setCustomerId('');
    setTransactionId('');
  };

  if (configLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
            <h2 className="mt-4 text-xl font-semibold text-foreground">Link inválido</h2>
            <p className="mt-2 text-muted-foreground">
              O link de pagamento não foi encontrado ou expirou.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">M3A Pay</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="w-4 h-4 text-success" />
            Ambiente Seguro
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <StepIndicator currentStep={currentStep} steps={STEPS} />
        
        <div className="mt-8">
          {currentStep === 0 && (
            <RegistrationForm 
              onSubmit={handleRegistration} 
              isLoading={isLoading}
              destinatario={config.destinatario}
              valor={config.valor}
            />
          )}
          
          {currentStep === 1 && (
            <PaymentForm
              customerId={customerId}
              valor={config.valor}
              onSubmit={handlePayment}
              onBack={() => setCurrentStep(0)}
              isLoading={isLoading}
            />
          )}
          
          {currentStep === 2 && (
            <PaymentSuccess
              transactionId={transactionId}
              valor={config.valor}
              onNewPayment={handleNewPayment}
            />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-auto py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2024 M3A Pay. Todos os direitos reservados.</p>
          <p className="mt-1">Pagamentos processados com segurança via Asaas</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
