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

Dim conn, rs, sql
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
    
    payload = "{""name"": """ & nome & """, ""cpfCnpj"": """ & LimparDocumento(cpfCnpj) & """, ""email"": """ & email & """, ""phone"": """ & LimparTelefone(whatsapp) & """, ""postalCode"": """ & Replace(cep, "-", "") & """, ""address"": """ & rua & """, ""addressNumber"": """ & numero & """, ""complement"": """", ""province"": """ & bairro & """}"
    
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