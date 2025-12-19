# Guia de Implementação - M3A Pay

## 📋 Visão Geral

Este documento descreve a implementação completa do sistema de pagamentos M3A Pay, incluindo:
- Estrutura do banco de dados MySQL
- APIs em ASP Clássico com conexão via include
- Integração direta com Asaas (frontend → Asaas)
- Armazenamento de cadastro, pagamento e confirmação

**IMPORTANTE**: O pagamento é processado diretamente pela API do Asaas no frontend, evitando recusas por bancos intermediários.

---

## 📁 Estrutura de Arquivos

```
/pay/
├── index.html (SPA React)
├── assets/ (arquivos estáticos)
└── api/
    ├── conexao.inc.asp (dados de conexão MySQL)
    ├── funcoes.inc.asp (funções auxiliares)
    ├── land_cadastro.asp (GET: config, POST: cadastro)
    ├── land_pagamento.asp (registro de pagamento)
    └── land_pagamento_status.asp (webhook e consulta)
```

---

## 🗄️ Estrutura do Banco de Dados MySQL

### Tabela: `clientes`

```sql
CREATE TABLE clientes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    cpf_cnpj VARCHAR(18) NOT NULL,
    tipo_pessoa ENUM('pf', 'pj') NOT NULL DEFAULT 'pf',
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
    slug VARCHAR(100),
    asaas_customer_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_cpf_cnpj (cpf_cnpj),
    INDEX idx_email (email),
    INDEX idx_slug (slug)
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
    dados_cartao_hash VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP NULL,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id),
    INDEX idx_asaas_payment (asaas_payment_id),
    INDEX idx_status (status),
    INDEX idx_transaction (transaction_id)
);
```

### Tabela: `configuracoes`

```sql
CREATE TABLE configuracoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(100) NOT NULL UNIQUE,
    valor DECIMAL(10,2) NOT NULL,
    destinatario VARCHAR(255) NOT NULL,
    descricao_produto TEXT,
    asaas_api_key VARCHAR(255) NOT NULL,
    asaas_environment ENUM('sandbox', 'production') DEFAULT 'sandbox',
    ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_slug (slug),
    INDEX idx_ativo (ativo)
);

-- Exemplo de inserção
INSERT INTO configuracoes (slug, valor, destinatario, descricao_produto, asaas_api_key, asaas_environment) 
VALUES ('minha-loja', 99.90, 'M3A Soluções Digitais', 'Serviço Digital Premium', 'sua_api_key_aqui', 'sandbox');
```

---

## 🔌 APIs ASP Clássico

### Arquivo de Conexão: conexao.inc.asp

```asp
<%
' ============================================
' ARQUIVO DE CONEXÃO MySQL
' Caminho: /pay/api/conexao.inc.asp
' ============================================

Const DB_SERVER = "localhost"
Const DB_NAME = "m3apay"
Const DB_USER = "usuario"
Const DB_PASSWORD = "senha"
Const DB_DRIVER = "MySQL ODBC 8.0 Driver"

Function AbrirConexao()
    Dim conn
    Set conn = Server.CreateObject("ADODB.Connection")
    conn.ConnectionTimeout = 30
    conn.CommandTimeout = 60
    conn.Open "Driver={" & DB_DRIVER & "};Server=" & DB_SERVER & ";Database=" & DB_NAME & ";Uid=" & DB_USER & ";Pwd=" & DB_PASSWORD & ";Charset=utf8mb4;"
    Set AbrirConexao = conn
End Function

Sub FecharConexao(conn)
    If Not conn Is Nothing Then
        If conn.State = 1 Then conn.Close
        Set conn = Nothing
    End If
End Sub
%>
```

### Funções Auxiliares: funcoes.inc.asp

```asp
<%
' ============================================
' FUNÇÕES AUXILIARES
' Caminho: /pay/api/funcoes.inc.asp
' ============================================

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
    Set stream = Nothing
End Function

Function GetJsonValue(json, key)
    Dim regex, matches
    Set regex = New RegExp
    regex.Pattern = """" & key & """:\s*""([^""]*)""|""" & key & """:\s*([0-9.]+)"
    regex.IgnoreCase = True
    regex.Global = False
    
    Set matches = regex.Execute(json)
    If matches.Count > 0 Then
        If matches(0).SubMatches(0) <> "" Then
            GetJsonValue = matches(0).SubMatches(0)
        Else
            GetJsonValue = matches(0).SubMatches(1)
        End If
    Else
        GetJsonValue = ""
    End If
    Set regex = Nothing
End Function

Function EscapeSQL(str)
    If IsNull(str) Or str = "" Then
        EscapeSQL = ""
    Else
        EscapeSQL = Replace(str, "'", "''")
    End If
End Function

Function RespostaJSON(success, data, message)
    Dim json
    json = "{""success"": " & LCase(CStr(success))
    If data <> "" Then
        json = json & ", " & data
    End If
    If message <> "" Then
        json = json & ", ""message"": """ & EscapeSQL(message) & """"
    End If
    json = json & "}"
    RespostaJSON = json
End Function

Function FormatDateISO(d)
    FormatDateISO = Year(d) & "-" & Right("0" & Month(d), 2) & "-" & Right("0" & Day(d), 2)
End Function

Sub EnviarCORS()
    Response.AddHeader "Access-Control-Allow-Origin", "*"
    Response.AddHeader "Access-Control-Allow-Methods", "GET, POST, OPTIONS"
    Response.AddHeader "Access-Control-Allow-Headers", "Content-Type, Authorization"
End Sub
%>
```

### 1. land_cadastro.asp

```asp
<%@ Language="VBScript" %>
<%
Option Explicit
Response.ContentType = "application/json"
Response.Charset = "UTF-8"
%>
<!--#include file="conexao.inc.asp"-->
<!--#include file="funcoes.inc.asp"-->
<%
Call EnviarCORS()

' Tratar preflight CORS
If Request.ServerVariables("REQUEST_METHOD") = "OPTIONS" Then
    Response.Status = "200 OK"
    Response.End
End If

Dim conn, rs, sql, cmd
Set conn = AbrirConexao()

' ============================================
' GET: Obter configuração pelo slug
' ============================================
If Request.ServerVariables("REQUEST_METHOD") = "GET" Then
    Dim slug
    slug = EscapeSQL(Request.QueryString("slug"))
    
    If slug = "" Then
        Response.Write RespostaJSON(False, "", "Slug não informado")
        Call FecharConexao(conn)
        Response.End
    End If
    
    sql = "SELECT valor, destinatario, descricao_produto, asaas_api_key, asaas_environment FROM configuracoes WHERE slug = '" & slug & "' AND ativo = 1"
    Set rs = conn.Execute(sql)
    
    If rs.EOF Then
        Response.Write RespostaJSON(False, "", "Configuração não encontrada")
    Else
        Dim baseUrl
        If rs("asaas_environment") = "production" Then
            baseUrl = "https://api.asaas.com/v3"
        Else
            baseUrl = "https://sandbox.asaas.com/api/v3"
        End If
        
        Response.Write "{""success"": true, ""valor"": " & rs("valor") & ", ""destinatario"": """ & rs("destinatario") & """, ""descricaoProduto"": """ & rs("descricao_produto") & """, ""asaasApiKey"": """ & rs("asaas_api_key") & """, ""asaasBaseUrl"": """ & baseUrl & """}"
    End If
    rs.Close
    Set rs = Nothing

' ============================================
' POST: Cadastrar cliente
' ============================================
ElseIf Request.ServerVariables("REQUEST_METHOD") = "POST" Then
    Dim jsonString
    jsonString = BytesToStr(Request.BinaryRead(Request.TotalBytes))
    
    ' Extrair dados do JSON
    Dim nome, cpfCnpj, tipoPessoa, email, whatsapp, companhia
    Dim rua, numero, bairro, cidade, uf, cep, descricao, slugPost
    
    nome = EscapeSQL(GetJsonValue(jsonString, "nome"))
    cpfCnpj = EscapeSQL(GetJsonValue(jsonString, "cpfCnpj"))
    tipoPessoa = EscapeSQL(GetJsonValue(jsonString, "tipoPessoa"))
    email = EscapeSQL(GetJsonValue(jsonString, "email"))
    whatsapp = EscapeSQL(GetJsonValue(jsonString, "whatsapp"))
    companhia = EscapeSQL(GetJsonValue(jsonString, "companhia"))
    rua = EscapeSQL(GetJsonValue(jsonString, "rua"))
    numero = EscapeSQL(GetJsonValue(jsonString, "numero"))
    bairro = EscapeSQL(GetJsonValue(jsonString, "bairro"))
    cidade = EscapeSQL(GetJsonValue(jsonString, "cidade"))
    uf = EscapeSQL(GetJsonValue(jsonString, "uf"))
    cep = EscapeSQL(GetJsonValue(jsonString, "cep"))
    descricao = EscapeSQL(GetJsonValue(jsonString, "descricao"))
    slugPost = EscapeSQL(GetJsonValue(jsonString, "slug"))
    
    ' Obter API Key do Asaas para criar cliente
    Dim asaasApiKey, asaasEnv, asaasBaseUrl
    sql = "SELECT asaas_api_key, asaas_environment FROM configuracoes WHERE slug = '" & slugPost & "' AND ativo = 1"
    Set rs = conn.Execute(sql)
    
    If Not rs.EOF Then
        asaasApiKey = rs("asaas_api_key")
        asaasEnv = rs("asaas_environment")
        If asaasEnv = "production" Then
            asaasBaseUrl = "https://api.asaas.com/v3"
        Else
            asaasBaseUrl = "https://sandbox.asaas.com/api/v3"
        End If
    End If
    rs.Close
    
    ' Criar cliente no Asaas
    Dim http, payload, asaasResponse, asaasCustomerId
    Set http = Server.CreateObject("MSXML2.ServerXMLHTTP.6.0")
    
    payload = "{""name"": """ & nome & """, ""cpfCnpj"": """ & Replace(Replace(Replace(cpfCnpj, ".", ""), "-", ""), "/", "") & """, ""email"": """ & email & """, ""phone"": """ & Replace(Replace(Replace(whatsapp, "(", ""), ")", ""), " ", "") & """, ""postalCode"": """ & Replace(cep, "-", "") & """, ""address"": """ & rua & """, ""addressNumber"": """ & numero & """, ""complement"": """", ""province"": """ & bairro & """}"
    
    http.Open "POST", asaasBaseUrl & "/customers", False
    http.setRequestHeader "Content-Type", "application/json"
    http.setRequestHeader "access_token", asaasApiKey
    http.setRequestHeader "User-Agent", "M3APay/1.0"
    
    On Error Resume Next
    http.send payload
    
    If Err.Number = 0 Then
        asaasResponse = http.responseText
        asaasCustomerId = GetJsonValue(asaasResponse, "id")
    Else
        asaasCustomerId = ""
    End If
    On Error GoTo 0
    Set http = Nothing
    
    ' Inserir no banco de dados
    sql = "INSERT INTO clientes (nome, cpf_cnpj, tipo_pessoa, email, whatsapp, companhia, rua, numero, bairro, cidade, uf, cep, descricao, slug, asaas_customer_id) VALUES ('" & nome & "', '" & cpfCnpj & "', '" & tipoPessoa & "', '" & email & "', '" & whatsapp & "', '" & companhia & "', '" & rua & "', '" & numero & "', '" & bairro & "', '" & cidade & "', '" & uf & "', '" & cep & "', '" & descricao & "', '" & slugPost & "', '" & asaasCustomerId & "')"
    
    On Error Resume Next
    conn.Execute sql
    
    If Err.Number <> 0 Then
        Response.Write RespostaJSON(False, "", "Erro ao cadastrar: " & Err.Description)
    Else
        ' Obter ID inserido
        Dim customerId
        Set rs = conn.Execute("SELECT LAST_INSERT_ID() as id")
        customerId = rs("id")
        rs.Close
        
        Response.Write "{""success"": true, ""customerId"": """ & customerId & """, ""asaasCustomerId"": """ & asaasCustomerId & """, ""message"": ""Cliente cadastrado com sucesso""}"
    End If
    On Error GoTo 0
End If

Call FecharConexao(conn)
%>
```

### 2. land_pagamento.asp

```asp
<%@ Language="VBScript" %>
<%
Option Explicit
Response.ContentType = "application/json"
Response.Charset = "UTF-8"
%>
<!--#include file="conexao.inc.asp"-->
<!--#include file="funcoes.inc.asp"-->
<%
Call EnviarCORS()

If Request.ServerVariables("REQUEST_METHOD") = "OPTIONS" Then
    Response.Status = "200 OK"
    Response.End
End If

Dim conn, rs, sql
Set conn = AbrirConexao()

If Request.ServerVariables("REQUEST_METHOD") = "POST" Then
    Dim jsonString
    jsonString = BytesToStr(Request.BinaryRead(Request.TotalBytes))
    
    ' Extrair dados
    Dim customerId, asaasPaymentId, valor, metodo, status
    Dim pixCode, pixQrCode, transactionId, descricao
    
    customerId = EscapeSQL(GetJsonValue(jsonString, "customerId"))
    asaasPaymentId = EscapeSQL(GetJsonValue(jsonString, "asaasPaymentId"))
    valor = GetJsonValue(jsonString, "valor")
    metodo = EscapeSQL(GetJsonValue(jsonString, "metodo"))
    status = EscapeSQL(GetJsonValue(jsonString, "status"))
    pixCode = EscapeSQL(GetJsonValue(jsonString, "pixCode"))
    pixQrCode = EscapeSQL(GetJsonValue(jsonString, "pixQrCode"))
    transactionId = EscapeSQL(GetJsonValue(jsonString, "transactionId"))
    descricao = EscapeSQL(GetJsonValue(jsonString, "descricao"))
    
    If status = "" Then status = "pending"
    
    ' Inserir pagamento no banco
    sql = "INSERT INTO pagamentos (cliente_id, asaas_payment_id, valor, metodo, status, pix_code, pix_qr_code, transaction_id, descricao) VALUES (" & customerId & ", '" & asaasPaymentId & "', " & valor & ", '" & metodo & "', '" & status & "', '" & pixCode & "', '" & pixQrCode & "', '" & transactionId & "', '" & descricao & "')"
    
    On Error Resume Next
    conn.Execute sql
    
    If Err.Number <> 0 Then
        Response.Write RespostaJSON(False, "", "Erro ao registrar pagamento: " & Err.Description)
    Else
        Dim paymentId
        Set rs = conn.Execute("SELECT LAST_INSERT_ID() as id")
        paymentId = rs("id")
        rs.Close
        
        Response.Write "{""success"": true, ""paymentId"": """ & paymentId & """, ""message"": ""Pagamento registrado com sucesso""}"
    End If
    On Error GoTo 0
End If

Call FecharConexao(conn)
%>
```

### 3. land_pagamento_status.asp

```asp
<%@ Language="VBScript" %>
<%
Option Explicit
Response.ContentType = "application/json"
Response.Charset = "UTF-8"
%>
<!--#include file="conexao.inc.asp"-->
<!--#include file="funcoes.inc.asp"-->
<%
Call EnviarCORS()

If Request.ServerVariables("REQUEST_METHOD") = "OPTIONS" Then
    Response.Status = "200 OK"
    Response.End
End If

Dim conn, rs, sql
Set conn = AbrirConexao()

' ============================================
' GET: Consultar status do pagamento
' ============================================
If Request.ServerVariables("REQUEST_METHOD") = "GET" Then
    Dim transactionId
    transactionId = EscapeSQL(Request.QueryString("transactionId"))
    
    If transactionId <> "" Then
        sql = "SELECT p.status, p.transaction_id, p.asaas_payment_id, p.confirmed_at, c.nome, c.email FROM pagamentos p INNER JOIN clientes c ON p.cliente_id = c.id WHERE p.transaction_id = '" & transactionId & "' OR p.asaas_payment_id = '" & transactionId & "'"
        Set rs = conn.Execute(sql)
        
        If rs.EOF Then
            Response.Write "{""status"": ""not_found"", ""message"": ""Pagamento não encontrado""}"
        Else
            Response.Write "{""status"": """ & rs("status") & """, ""transactionId"": """ & rs("transaction_id") & """, ""asaasPaymentId"": """ & rs("asaas_payment_id") & """, ""clienteNome"": """ & rs("nome") & """}"
        End If
        rs.Close
    Else
        Response.Write RespostaJSON(False, "", "TransactionId não informado")
    End If

' ============================================
' POST: Webhook do Asaas / Atualização de status
' ============================================
ElseIf Request.ServerVariables("REQUEST_METHOD") = "POST" Then
    Dim jsonString
    jsonString = BytesToStr(Request.BinaryRead(Request.TotalBytes))
    
    Dim event, paymentId, newStatus
    event = GetJsonValue(jsonString, "event")
    paymentId = EscapeSQL(GetJsonValue(jsonString, "id"))
    
    ' Se não tem event, é uma atualização direta
    If event = "" Then
        paymentId = EscapeSQL(GetJsonValue(jsonString, "asaasPaymentId"))
        newStatus = EscapeSQL(GetJsonValue(jsonString, "status"))
    Else
        ' Mapear eventos do Asaas
        Select Case event
            Case "PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"
                newStatus = "confirmed"
            Case "PAYMENT_OVERDUE", "PAYMENT_DELETED", "PAYMENT_REFUNDED"
                newStatus = "failed"
            Case "PAYMENT_CREATED", "PAYMENT_AWAITING_RISK_ANALYSIS", "PAYMENT_PENDING"
                newStatus = "pending"
            Case Else
                newStatus = "pending"
        End Select
    End If
    
    ' Atualizar banco
    If newStatus = "confirmed" Then
        sql = "UPDATE pagamentos SET status = '" & newStatus & "', confirmed_at = NOW(), updated_at = NOW() WHERE asaas_payment_id = '" & paymentId & "'"
    Else
        sql = "UPDATE pagamentos SET status = '" & newStatus & "', updated_at = NOW() WHERE asaas_payment_id = '" & paymentId & "'"
    End If
    
    On Error Resume Next
    conn.Execute sql
    
    If Err.Number <> 0 Then
        Response.Write RespostaJSON(False, "", "Erro ao atualizar: " & Err.Description)
    Else
        Response.Write "{""success"": true, ""status"": """ & newStatus & """, ""message"": ""Status atualizado""}"
    End If
    On Error GoTo 0
End If

Call FecharConexao(conn)
%>
```

---

## 🔄 Fluxo de Integração

### Fluxo Completo

```
1. Frontend carrega → GET /pay/api/land_cadastro.asp?slug=xxx
   ↓
   Retorna: valor, destinatário, asaasApiKey, asaasBaseUrl

2. Usuário preenche cadastro → POST /pay/api/land_cadastro.asp
   ↓
   Backend cria cliente no Asaas
   ↓
   Grava cliente no MySQL
   ↓
   Retorna: customerId, asaasCustomerId

3. Usuário escolhe pagamento → Frontend chama API Asaas DIRETAMENTE
   ↓
   POST https://api.asaas.com/v3/payments (com asaasApiKey)
   ↓
   Asaas retorna: paymentId, pixCode, qrCode

4. Frontend registra pagamento → POST /pay/api/land_pagamento.asp
   ↓
   Grava pagamento no MySQL

5. Asaas confirma pagamento → POST /pay/api/land_pagamento_status.asp (webhook)
   ↓
   Atualiza status no MySQL

6. Frontend consulta status → GET /pay/api/land_pagamento_status.asp?transactionId=xxx
```

### Por que chamar Asaas diretamente?

- **Evita bloqueios**: Bancos e antifraudes podem recusar transações que passam por proxies
- **Mais rápido**: Menos hops de rede
- **Certificação PCI**: O Asaas é certificado, você não precisa se preocupar com dados de cartão
- **Tokenização**: Cartões são tokenizados antes de enviar

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
   - **URL**: `https://seu-dominio.com/pay/api/land_pagamento_status.asp`
   - **Eventos**: 
     - PAYMENT_CONFIRMED
     - PAYMENT_RECEIVED
     - PAYMENT_OVERDUE
     - PAYMENT_REFUNDED
     - PAYMENT_DELETED

### Passo 4: Testar em Sandbox

1. Use o ambiente Sandbox para testes
2. Cartões de teste:
   - **Aprovado**: 5162 3063 9482 9407
   - **Recusado**: 5184 0190 0017 5765
3. PIX de teste gera QR Code funcional no sandbox

---

## 🔒 Segurança

### Recomendações

1. **API Key no Backend**
   - A API Key só é exposta temporariamente para o frontend
   - Considere usar tokens de sessão curtos

2. **Validação de Webhook**
   - Valide assinatura do webhook do Asaas
   - Verifique IP de origem (IPs do Asaas)

3. **HTTPS Obrigatório**
   - Todas as comunicações devem usar HTTPS
   - Certificado SSL válido obrigatório

4. **Sanitização de Input**
   - Todas as entradas são sanitizadas com EscapeSQL
   - Previne SQL Injection

5. **CORS Configurado**
   - Headers CORS configurados nas APIs
   - Ajuste para seu domínio em produção

---

## 📞 Suporte

- **Asaas**: suporte@asaas.com
- **Documentação API**: [docs.asaas.com](https://docs.asaas.com)

---

## ✅ Checklist de Implementação

- [ ] Criar banco de dados MySQL
- [ ] Executar scripts de criação das tabelas
- [ ] Configurar conexao.inc.asp com dados do servidor
- [ ] Fazer upload das APIs para /pay/api/
- [ ] Criar conta no Asaas
- [ ] Obter e configurar API Key
- [ ] Inserir configuração na tabela configuracoes
- [ ] Configurar webhook no Asaas
- [ ] Fazer build do frontend e upload para /pay/
- [ ] Testar fluxo completo em Sandbox
- [ ] Validar segurança
- [ ] Mudar para API Key de produção
- [ ] Monitoramento e logs