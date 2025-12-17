# Guia de Implementação - PaySimples

## 📋 Visão Geral

Este documento descreve a implementação completa do sistema de pagamentos, incluindo:
- Estrutura do banco de dados MySQL
- APIs em ASP Clássico
- Integração com Asaas

---

## 🗄️ Estrutura do Banco de Dados MySQL

### Tabela: `clientes`

```sql
CREATE TABLE clientes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    cpf VARCHAR(14) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    whatsapp VARCHAR(20) NOT NULL,
    companhia VARCHAR(255),
    rua VARCHAR(255) NOT NULL,
    numero VARCHAR(20) NOT NULL,
    bairro VARCHAR(100) NOT NULL,
    cidade VARCHAR(100) NOT NULL,
    uf CHAR(2) NOT NULL,
    cep VARCHAR(9) NOT NULL,
    descricao TEXT,
    asaas_customer_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_cpf (cpf),
    INDEX idx_email (email)
);
```

### Tabela: `pagamentos`

```sql
CREATE TABLE pagamentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cliente_id INT NOT NULL,
    asaas_payment_id VARCHAR(100),
    valor DECIMAL(10,2) NOT NULL,
    metodo ENUM('pix', 'cartao') NOT NULL,
    status ENUM('pending', 'confirmed', 'failed', 'cancelled') DEFAULT 'pending',
    pix_code TEXT,
    pix_qr_code TEXT,
    transaction_id VARCHAR(100),
    descricao TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP NULL,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id),
    INDEX idx_asaas_payment (asaas_payment_id),
    INDEX idx_status (status)
);
```

### Tabela: `configuracoes`

```sql
CREATE TABLE configuracoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    chave VARCHAR(100) NOT NULL UNIQUE,
    valor TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Inserir API Key do Asaas (criptografada)
INSERT INTO configuracoes (chave, valor) VALUES ('ASAAS_API_KEY', 'sua_api_key_aqui');
INSERT INTO configuracoes (chave, valor) VALUES ('ASAAS_ENVIRONMENT', 'sandbox'); -- ou 'production'
```

---

## 🔌 APIs ASP Clássico

### 1. land_cadastro.asp

```asp
<%@ Language="VBScript" %>
<%
Response.ContentType = "application/json"
Response.Charset = "UTF-8"

' Configuração do banco
Dim conn, rs, sql
Set conn = Server.CreateObject("ADODB.Connection")
conn.Open "Driver={MySQL ODBC 8.0 Driver};Server=localhost;Database=paysimples;Uid=user;Pwd=password;"

' Receber JSON do POST
Dim jsonString, json
jsonString = Request.BinaryRead(Request.TotalBytes)
jsonString = BytesToStr(jsonString)

' Parse do JSON (usar biblioteca JSON ASP ou parse manual)
Dim nome, cpf, email, whatsapp, companhia, rua, numero, bairro, cidade, uf, cep, descricao

' Extrair valores do JSON
nome = GetJsonValue(jsonString, "nome")
cpf = GetJsonValue(jsonString, "cpf")
email = GetJsonValue(jsonString, "email")
whatsapp = GetJsonValue(jsonString, "whatsapp")
companhia = GetJsonValue(jsonString, "companhia")
rua = GetJsonValue(jsonString, "rua")
numero = GetJsonValue(jsonString, "numero")
bairro = GetJsonValue(jsonString, "bairro")
cidade = GetJsonValue(jsonString, "cidade")
uf = GetJsonValue(jsonString, "uf")
cep = GetJsonValue(jsonString, "cep")
descricao = GetJsonValue(jsonString, "descricao")

' Criar cliente no Asaas
Dim asaasCustomerId
asaasCustomerId = CriarClienteAsaas(nome, cpf, email, whatsapp)

' Inserir no banco
sql = "INSERT INTO clientes (nome, cpf, email, whatsapp, companhia, rua, numero, bairro, cidade, uf, cep, descricao, asaas_customer_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"

Dim cmd
Set cmd = Server.CreateObject("ADODB.Command")
cmd.ActiveConnection = conn
cmd.CommandText = sql
cmd.Parameters.Append cmd.CreateParameter("nome", 200, 1, 255, nome)
cmd.Parameters.Append cmd.CreateParameter("cpf", 200, 1, 14, cpf)
cmd.Parameters.Append cmd.CreateParameter("email", 200, 1, 255, email)
cmd.Parameters.Append cmd.CreateParameter("whatsapp", 200, 1, 20, whatsapp)
cmd.Parameters.Append cmd.CreateParameter("companhia", 200, 1, 255, companhia)
cmd.Parameters.Append cmd.CreateParameter("rua", 200, 1, 255, rua)
cmd.Parameters.Append cmd.CreateParameter("numero", 200, 1, 20, numero)
cmd.Parameters.Append cmd.CreateParameter("bairro", 200, 1, 100, bairro)
cmd.Parameters.Append cmd.CreateParameter("cidade", 200, 1, 100, cidade)
cmd.Parameters.Append cmd.CreateParameter("uf", 200, 1, 2, uf)
cmd.Parameters.Append cmd.CreateParameter("cep", 200, 1, 9, cep)
cmd.Parameters.Append cmd.CreateParameter("descricao", 201, 1, -1, descricao)
cmd.Parameters.Append cmd.CreateParameter("asaas_id", 200, 1, 100, asaasCustomerId)
cmd.Execute

' Obter ID inserido
Dim customerId
Set rs = conn.Execute("SELECT LAST_INSERT_ID() as id")
customerId = rs("id")
rs.Close

' Retornar resposta
Response.Write "{""success"": true, ""customerId"": """ & customerId & """, ""message"": ""Cliente cadastrado com sucesso""}"

conn.Close
Set conn = Nothing

Function CriarClienteAsaas(nome, cpf, email, phone)
    ' Implementar chamada à API do Asaas para criar cliente
    ' Endpoint: POST https://api.asaas.com/v3/customers
    ' Retornar o ID do cliente criado
End Function

Function GetJsonValue(json, key)
    ' Função para extrair valor de JSON
End Function

Function BytesToStr(bytes)
    Dim stream
    Set stream = Server.CreateObject("ADODB.Stream")
    stream.Type = 1
    stream.Open
    stream.Write bytes
    stream.Position = 0
    stream.Type = 2
    stream.Charset = "UTF-8"
    BytesToStr = stream.ReadText
    stream.Close
End Function
%>
```

### 2. land_pagamento.asp

```asp
<%@ Language="VBScript" %>
<%
Response.ContentType = "application/json"
Response.Charset = "UTF-8"

Dim conn, rs
Set conn = Server.CreateObject("ADODB.Connection")
conn.Open "Driver={MySQL ODBC 8.0 Driver};Server=localhost;Database=paysimples;Uid=user;Pwd=password;"

' Obter API Key do banco
Dim apiKey, environment
Set rs = conn.Execute("SELECT valor FROM configuracoes WHERE chave = 'ASAAS_API_KEY'")
apiKey = rs("valor")
rs.Close

Set rs = conn.Execute("SELECT valor FROM configuracoes WHERE chave = 'ASAAS_ENVIRONMENT'")
environment = rs("valor")
rs.Close

' Base URL
Dim baseUrl
If environment = "production" Then
    baseUrl = "https://api.asaas.com/v3"
Else
    baseUrl = "https://sandbox.asaas.com/api/v3"
End If

' Receber dados do POST
Dim jsonString
jsonString = BytesToStr(Request.BinaryRead(Request.TotalBytes))

Dim customerId, valor, metodo
customerId = GetJsonValue(jsonString, "customerId")
valor = GetJsonValue(jsonString, "valor")
metodo = GetJsonValue(jsonString, "metodo")

' Obter asaas_customer_id do cliente
Dim asaasCustomerId
Set rs = conn.Execute("SELECT asaas_customer_id FROM clientes WHERE id = " & customerId)
asaasCustomerId = rs("asaas_customer_id")
rs.Close

' Criar cobrança no Asaas
Dim asaasResponse
asaasResponse = ChamarAsaas(baseUrl, apiKey, asaasCustomerId, valor, metodo)

' Inserir pagamento no banco
Dim sql, cmd
sql = "INSERT INTO pagamentos (cliente_id, asaas_payment_id, valor, metodo, status, pix_code, pix_qr_code) VALUES (?, ?, ?, ?, ?, ?, ?)"

Set cmd = Server.CreateObject("ADODB.Command")
cmd.ActiveConnection = conn
cmd.CommandText = sql
' ... parametros

Response.Write asaasResponse

conn.Close
Set conn = Nothing

Function ChamarAsaas(baseUrl, apiKey, customerId, valor, metodo)
    Dim http, payload, response
    Set http = Server.CreateObject("MSXML2.ServerXMLHTTP")
    
    ' Montar payload
    If metodo = "pix" Then
        payload = "{""customer"": """ & customerId & """, ""billingType"": ""PIX"", ""value"": " & valor & ", ""dueDate"": """ & FormatDate(Date + 1) & """}"
    Else
        ' Para cartão, incluir dados do cartão
        payload = "{""customer"": """ & customerId & """, ""billingType"": ""CREDIT_CARD"", ""value"": " & valor & ", ""dueDate"": """ & FormatDate(Date) & """}"
    End If
    
    http.Open "POST", baseUrl & "/payments", False
    http.setRequestHeader "Content-Type", "application/json"
    http.setRequestHeader "access_token", apiKey
    http.send payload
    
    ChamarAsaas = http.responseText
End Function
%>
```

### 3. land_pagamento_status.asp

```asp
<%@ Language="VBScript" %>
<%
Response.ContentType = "application/json"
Response.Charset = "UTF-8"

Dim conn
Set conn = Server.CreateObject("ADODB.Connection")
conn.Open "Driver={MySQL ODBC 8.0 Driver};Server=localhost;Database=paysimples;Uid=user;Pwd=password;"

' Este endpoint pode ser chamado:
' 1. Pelo frontend para verificar status
' 2. Pelo webhook do Asaas para atualizar status

Dim requestMethod
requestMethod = Request.ServerVariables("REQUEST_METHOD")

If requestMethod = "GET" Then
    ' Consulta de status pelo frontend
    Dim transactionId
    transactionId = Request.QueryString("transactionId")
    
    Dim rs
    Set rs = conn.Execute("SELECT status, transaction_id FROM pagamentos WHERE id = " & transactionId)
    
    If Not rs.EOF Then
        Response.Write "{""status"": """ & rs("status") & """, ""transactionId"": """ & rs("transaction_id") & """}"
    Else
        Response.Write "{""status"": ""not_found""}"
    End If
    rs.Close
    
ElseIf requestMethod = "POST" Then
    ' Webhook do Asaas
    Dim jsonString
    jsonString = BytesToStr(Request.BinaryRead(Request.TotalBytes))
    
    Dim event, paymentId, status
    event = GetJsonValue(jsonString, "event")
    paymentId = GetJsonValue(jsonString, "payment.id")
    
    ' Mapear status do Asaas
    Select Case event
        Case "PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"
            status = "confirmed"
        Case "PAYMENT_OVERDUE"
            status = "failed"
        Case Else
            status = "pending"
    End Select
    
    ' Atualizar banco
    conn.Execute "UPDATE pagamentos SET status = '" & status & "', confirmed_at = NOW() WHERE asaas_payment_id = '" & paymentId & "'"
    
    Response.Write "{""received"": true}"
End If

conn.Close
Set conn = Nothing
%>
```

---

## 🔧 Configuração do Asaas

### Passo 1: Criar Conta no Asaas

1. Acesse [asaas.com](https://www.asaas.com)
2. Crie uma conta empresarial
3. Complete a verificação de identidade
4. Aguarde aprovação (1-3 dias úteis)

### Passo 2: Obter API Keys

1. Acesse o painel do Asaas
2. Vá em **Configurações > Integrações > API**
3. Copie a **API Key** (Sandbox para testes, Produção para uso real)

### Passo 3: Configurar Webhook

1. No painel Asaas, vá em **Configurações > Integrações > Webhooks**
2. Adicione um novo webhook:
   - **URL**: `https://seu-dominio.com/land_pagamento_status.asp`
   - **Eventos**: 
     - PAYMENT_CONFIRMED
     - PAYMENT_RECEIVED
     - PAYMENT_OVERDUE
     - PAYMENT_REFUNDED

### Passo 4: Testar em Sandbox

1. Use o ambiente Sandbox para testes
2. Cartões de teste:
   - **Aprovado**: 5162 3063 9482 9407
   - **Recusado**: 5184 0190 0017 5765
3. PIX de teste gera QR Code funcional no sandbox

---

## 🔒 Segurança

### Recomendações

1. **Criptografia da API Key**
   - Nunca exponha a API Key no frontend
   - Armazene criptografada no banco
   - Use variáveis de ambiente no servidor

2. **Validação de Webhook**
   - Valide assinatura do webhook do Asaas
   - Verifique IP de origem

3. **HTTPS**
   - Todas as comunicações devem usar HTTPS
   - Certificado SSL válido obrigatório

4. **Rate Limiting**
   - Implemente limite de requisições
   - Bloqueie IPs suspeitos

5. **Logs**
   - Registre todas as transações
   - Monitore tentativas de fraude

---

## 📞 Suporte

- **Asaas**: suporte@asaas.com
- **Documentação API**: [docs.asaas.com](https://docs.asaas.com)

---

## ✅ Checklist de Implementação

- [ ] Criar banco de dados MySQL
- [ ] Executar scripts de criação das tabelas
- [ ] Configurar conexão do banco nas APIs
- [ ] Criar conta no Asaas
- [ ] Obter e configurar API Key
- [ ] Configurar webhook no Asaas
- [ ] Testar fluxo completo em Sandbox
- [ ] Validar segurança
- [ ] Deploy em produção
- [ ] Mudar para API Key de produção
- [ ] Monitoramento e logs
