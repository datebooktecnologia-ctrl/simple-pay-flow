import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CustomerData } from '@/types/customer';
import { formatCPF, formatPhone, formatCEP, validateCPF, validateEmail } from '@/lib/formatters';
import { User, Mail, Phone, Building2, MapPin, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface RegistrationFormProps {
  onSubmit: (data: CustomerData) => Promise<void>;
  isLoading: boolean;
}

const UF_OPTIONS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

export const RegistrationForm = ({ onSubmit, isLoading }: RegistrationFormProps) => {
  const [formData, setFormData] = useState<CustomerData>({
    nome: '',
    cpf: '',
    email: '',
    whatsapp: '',
    companhia: '',
    rua: '',
    numero: '',
    bairro: '',
    cidade: '',
    uf: '',
    cep: '',
    descricao: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof CustomerData, string>>>({});

  const handleChange = (field: keyof CustomerData, value: string) => {
    let formattedValue = value;
    
    if (field === 'cpf') formattedValue = formatCPF(value);
    if (field === 'whatsapp') formattedValue = formatPhone(value);
    if (field === 'cep') formattedValue = formatCEP(value);
    
    setFormData(prev => ({ ...prev, [field]: formattedValue }));
    setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof CustomerData, string>> = {};
    
    if (!formData.nome.trim()) newErrors.nome = 'Nome é obrigatório';
    if (!validateCPF(formData.cpf)) newErrors.cpf = 'CPF inválido';
    if (!validateEmail(formData.email)) newErrors.email = 'E-mail inválido';
    if (formData.whatsapp.replace(/\D/g, '').length < 10) newErrors.whatsapp = 'WhatsApp inválido';
    if (!formData.rua.trim()) newErrors.rua = 'Rua é obrigatória';
    if (!formData.numero.trim()) newErrors.numero = 'Número é obrigatório';
    if (!formData.bairro.trim()) newErrors.bairro = 'Bairro é obrigatório';
    if (!formData.cidade.trim()) newErrors.cidade = 'Cidade é obrigatória';
    if (!formData.uf) newErrors.uf = 'UF é obrigatório';
    if (formData.cep.replace(/\D/g, '').length !== 8) newErrors.cep = 'CEP inválido';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) {
      toast.error('Por favor, corrija os erros no formulário');
      return;
    }
    
    await onSubmit(formData);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-glow animate-slide-up">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-2xl font-bold text-foreground">Cadastro</CardTitle>
        <CardDescription>Preencha seus dados para continuar</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dados Pessoais */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <User className="w-4 h-4" />
              Dados Pessoais
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome Completo *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={e => handleChange('nome', e.target.value)}
                  placeholder="Seu nome completo"
                  className={errors.nome ? 'border-destructive' : ''}
                />
                {errors.nome && <p className="text-xs text-destructive">{errors.nome}</p>}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF *</Label>
                <Input
                  id="cpf"
                  value={formData.cpf}
                  onChange={e => handleChange('cpf', e.target.value)}
                  placeholder="000.000.000-00"
                  className={errors.cpf ? 'border-destructive' : ''}
                />
                {errors.cpf && <p className="text-xs text-destructive">{errors.cpf}</p>}
              </div>
            </div>
          </div>

          {/* Contato */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Contato
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={e => handleChange('email', e.target.value)}
                  placeholder="seu@email.com"
                  className={errors.email ? 'border-destructive' : ''}
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp *</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="whatsapp"
                    value={formData.whatsapp}
                    onChange={e => handleChange('whatsapp', e.target.value)}
                    placeholder="(00) 00000-0000"
                    className={`pl-10 ${errors.whatsapp ? 'border-destructive' : ''}`}
                  />
                </div>
                {errors.whatsapp && <p className="text-xs text-destructive">{errors.whatsapp}</p>}
              </div>
            </div>
          </div>

          {/* Empresa */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Empresa
            </h3>
            
            <div className="space-y-2">
              <Label htmlFor="companhia">Companhia</Label>
              <Input
                id="companhia"
                value={formData.companhia}
                onChange={e => handleChange('companhia', e.target.value)}
                placeholder="Nome da empresa (opcional)"
              />
            </div>
          </div>

          {/* Endereço */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Endereço
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="rua">Rua *</Label>
                <Input
                  id="rua"
                  value={formData.rua}
                  onChange={e => handleChange('rua', e.target.value)}
                  placeholder="Nome da rua"
                  className={errors.rua ? 'border-destructive' : ''}
                />
                {errors.rua && <p className="text-xs text-destructive">{errors.rua}</p>}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="numero">Número *</Label>
                <Input
                  id="numero"
                  value={formData.numero}
                  onChange={e => handleChange('numero', e.target.value)}
                  placeholder="Nº"
                  className={errors.numero ? 'border-destructive' : ''}
                />
                {errors.numero && <p className="text-xs text-destructive">{errors.numero}</p>}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bairro">Bairro *</Label>
                <Input
                  id="bairro"
                  value={formData.bairro}
                  onChange={e => handleChange('bairro', e.target.value)}
                  placeholder="Bairro"
                  className={errors.bairro ? 'border-destructive' : ''}
                />
                {errors.bairro && <p className="text-xs text-destructive">{errors.bairro}</p>}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="cep">CEP *</Label>
                <Input
                  id="cep"
                  value={formData.cep}
                  onChange={e => handleChange('cep', e.target.value)}
                  placeholder="00000-000"
                  className={errors.cep ? 'border-destructive' : ''}
                />
                {errors.cep && <p className="text-xs text-destructive">{errors.cep}</p>}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cidade">Cidade *</Label>
                <Input
                  id="cidade"
                  value={formData.cidade}
                  onChange={e => handleChange('cidade', e.target.value)}
                  placeholder="Cidade"
                  className={errors.cidade ? 'border-destructive' : ''}
                />
                {errors.cidade && <p className="text-xs text-destructive">{errors.cidade}</p>}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="uf">UF *</Label>
                <Select value={formData.uf} onValueChange={value => handleChange('uf', value)}>
                  <SelectTrigger className={errors.uf ? 'border-destructive' : ''}>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {UF_OPTIONS.map(uf => (
                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.uf && <p className="text-xs text-destructive">{errors.uf}</p>}
              </div>
            </div>
          </div>

          {/* Descrição */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Descrição
            </h3>
            
            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição do Pagamento</Label>
              <Textarea
                id="descricao"
                value={formData.descricao}
                onChange={e => handleChange('descricao', e.target.value)}
                placeholder="Descreva o motivo do pagamento..."
                rows={3}
              />
            </div>
          </div>

          <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              'Continuar para Pagamento'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
