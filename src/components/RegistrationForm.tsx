import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CustomerData } from '@/types/customer';
import { formatCPFCNPJ, formatPhone, formatCEP, validateCPFCNPJ, validateEmail, detectTipoPessoa } from '@/lib/formatters';
import { User, Mail, Phone, Building2, MapPin, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface RegistrationFormProps {
  onSubmit: (data: CustomerData) => Promise<void>;
  isLoading: boolean;
  destinatario: string;
  valor: number;
}

const UF_OPTIONS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

export const RegistrationForm = ({ onSubmit, isLoading, destinatario, valor }: RegistrationFormProps) => {
  const [formData, setFormData] = useState<CustomerData>({
    nome: '',
    cpfCnpj: '',
    tipoPessoa: 'pf',
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
    let updates: Partial<CustomerData> = {};
    
    if (field === 'cpfCnpj') {
      formattedValue = formatCPFCNPJ(value);
      updates.tipoPessoa = detectTipoPessoa(value);
    }
    if (field === 'whatsapp') formattedValue = formatPhone(value);
    if (field === 'cep') formattedValue = formatCEP(value);
    
    setFormData(prev => ({ ...prev, [field]: formattedValue, ...updates }));
    setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof CustomerData, string>> = {};
    
    if (!formData.nome.trim()) newErrors.nome = 'Nome é obrigatório';
    else if (formData.nome.trim().length < 3) newErrors.nome = 'Nome deve ter pelo menos 3 caracteres';
    
    if (!validateCPFCNPJ(formData.cpfCnpj)) {
      newErrors.cpfCnpj = formData.tipoPessoa === 'pj' ? 'CNPJ inválido' : 'CPF inválido';
    }
    
    if (!validateEmail(formData.email)) newErrors.email = 'E-mail inválido';
    
    const phoneNumbers = formData.whatsapp.replace(/\D/g, '');
    if (phoneNumbers.length < 10 || phoneNumbers.length > 11) {
      newErrors.whatsapp = 'WhatsApp inválido';
    }
    
    if (!formData.rua.trim()) newErrors.rua = 'Rua é obrigatória';
    if (!formData.numero.trim()) newErrors.numero = 'Número é obrigatório';
    if (!formData.bairro.trim()) newErrors.bairro = 'Bairro é obrigatório';
    if (!formData.cidade.trim()) newErrors.cidade = 'Cidade é obrigatória';
    if (!formData.uf) newErrors.uf = 'UF é obrigatório';
    
    const cepNumbers = formData.cep.replace(/\D/g, '');
    if (cepNumbers.length !== 8) newErrors.cep = 'CEP inválido';
    
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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-glow animate-slide-up">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-2xl font-bold text-foreground">Cadastro</CardTitle>
        <CardDescription>Preencha seus dados para continuar</CardDescription>
        <div className="mt-4 p-4 rounded-lg bg-muted/50 border border-border">
          <p className="text-sm text-muted-foreground">Pagamento para:</p>
          <p className="font-semibold text-foreground">{destinatario}</p>
          <p className="text-2xl font-bold text-primary mt-1">{formatCurrency(valor)}</p>
        </div>
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
                  maxLength={100}
                />
                {errors.nome && <p className="text-xs text-destructive">{errors.nome}</p>}
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="cpfCnpj">CPF / CNPJ *</Label>
                  <Badge variant={formData.tipoPessoa === 'pj' ? 'default' : 'secondary'} className="text-xs">
                    {formData.tipoPessoa === 'pj' ? 'Pessoa Jurídica' : 'Pessoa Física'}
                  </Badge>
                </div>
                <Input
                  id="cpfCnpj"
                  value={formData.cpfCnpj}
                  onChange={e => handleChange('cpfCnpj', e.target.value)}
                  placeholder="000.000.000-00 ou 00.000.000/0000-00"
                  className={errors.cpfCnpj ? 'border-destructive' : ''}
                />
                {errors.cpfCnpj && <p className="text-xs text-destructive">{errors.cpfCnpj}</p>}
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
                  maxLength={255}
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
                maxLength={100}
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
                  maxLength={200}
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
                  maxLength={20}
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
                  maxLength={100}
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
                  maxLength={100}
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
                maxLength={500}
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
