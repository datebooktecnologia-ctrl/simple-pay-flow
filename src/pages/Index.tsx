import { useState } from 'react';
import { StepIndicator } from '@/components/StepIndicator';
import { RegistrationForm } from '@/components/RegistrationForm';
import { PaymentForm } from '@/components/PaymentForm';
import { PaymentSuccess } from '@/components/PaymentSuccess';
import { CustomerData, PaymentStatus } from '@/types/customer';
import { cadastrarCliente, processarPagamento } from '@/lib/api';
import { toast } from 'sonner';
import { Shield } from 'lucide-react';

const STEPS = ['Cadastro', 'Pagamento', 'Confirmação'];
const VALOR_PAGAMENTO = 99.90; // Valor de exemplo

const Index = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [customerId, setCustomerId] = useState<string>('');
  const [transactionId, setTransactionId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRegistration = async (data: CustomerData) => {
    setIsLoading(true);
    try {
      const result = await cadastrarCliente(data);
      
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">PaySimples</span>
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
            <RegistrationForm onSubmit={handleRegistration} isLoading={isLoading} />
          )}
          
          {currentStep === 1 && (
            <PaymentForm
              customerId={customerId}
              valor={VALOR_PAGAMENTO}
              onSubmit={handlePayment}
              onBack={() => setCurrentStep(0)}
              isLoading={isLoading}
            />
          )}
          
          {currentStep === 2 && (
            <PaymentSuccess
              transactionId={transactionId}
              valor={VALOR_PAGAMENTO}
              onNewPayment={handleNewPayment}
            />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-auto py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© 2024 PaySimples. Todos os direitos reservados.</p>
          <p className="mt-1">Pagamentos processados com segurança via Asaas</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
