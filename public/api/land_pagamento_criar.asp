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
' POST: Criar pagamento no Asaas
' ============================================
If Request.ServerVariables("REQUEST_METHOD") = "POST" Then
    Dim jsonString
    jsonString = BytesToStr(Request.BinaryRead(Request.TotalBytes))
    
    ' Extrair dados do JSON
    Dim asaasCustomerId, valor, metodo, slugPost, customerId
    Dim cardNumero, cardNome, cardValidade, cardCvv
    
    asaasCustomerId = GetJsonValue(jsonString, "asaasCustomerId")
    customerId = GetJsonValue(jsonString, "customerId")
    valor = GetJsonValue(jsonString, "valor")
    metodo = GetJsonValue(jsonString, "metodo")
    slugPost = EscapeSQL(GetJsonValue(jsonString, "slug"))
    
    ' Dados do cartão (se houver)
    cardNumero = GetJsonValue(jsonString, "cardNumero")
    cardNome = GetJsonValue(jsonString, "cardNome")
    cardValidade = GetJsonValue(jsonString, "cardValidade")
    cardCvv = GetJsonValue(jsonString, "cardCvv")
    
    ' Obter API Key e dados do cliente
    Dim asaasApiKey, asaasEnv, asaasBaseUrl
    Dim clienteCpf, clienteEmail, clienteTelefone, clienteCep, clienteNumero
    
    sql = "SELECT asaas_api_key, asaas_environment FROM configuracoes WHERE slug = '" & slugPost & "' AND ativo = 1"
    Set rs = conn.Execute(sql)
    
    If rs.EOF Then
        Response.Write RespostaJSON(False, "", "Configuração não encontrada")
        Call FecharConexao(conn)
        Response.End
    End If
    
    asaasApiKey = rs("asaas_api_key")
    asaasEnv = rs("asaas_environment")
    If asaasEnv = "production" Then
        asaasBaseUrl = "https://api.asaas.com/v3"
    Else
        asaasBaseUrl = "https://sandbox.asaas.com/api/v3"
    End If
    rs.Close
    
    ' Buscar dados do cliente para cartão
    sql = "SELECT cpf_cnpj, email, whatsapp, cep, numero FROM clientes WHERE id = " & EscapeSQL(customerId)
    Set rs = conn.Execute(sql)
    If Not rs.EOF Then
        clienteCpf = LimparDocumento(rs("cpf_cnpj"))
        clienteEmail = rs("email")
        clienteTelefone = LimparTelefone(rs("whatsapp"))
        clienteCep = Replace(rs("cep"), "-", "")
        clienteNumero = rs("numero")
    End If
    rs.Close
    
    ' Calcular data de vencimento (amanhã)
    Dim dueDate
    dueDate = FormatDateISO(DateAdd("d", 1, Date))
    
    ' Montar payload para Asaas
    Dim payload, billingType
    If UCase(metodo) = "PIX" Then
        billingType = "PIX"
    Else
        billingType = "CREDIT_CARD"
    End If
    
    payload = "{""customer"": """ & asaasCustomerId & """, ""billingType"": """ & billingType & """, ""value"": " & Replace(valor, ",", ".") & ", ""dueDate"": """ & dueDate & """, ""description"": ""Pagamento M3A Pay"""
    
    ' Se for cartão, adicionar dados
    If UCase(metodo) = "CARTAO" And cardNumero <> "" Then
        Dim expiryMonth, expiryYear
        If InStr(cardValidade, "/") > 0 Then
            expiryMonth = Left(cardValidade, InStr(cardValidade, "/") - 1)
            expiryYear = "20" & Mid(cardValidade, InStr(cardValidade, "/") + 1)
        Else
            expiryMonth = Left(cardValidade, 2)
            expiryYear = "20" & Right(cardValidade, 2)
        End If
        
        payload = payload & ", ""creditCard"": {""holderName"": """ & cardNome & """, ""number"": """ & Replace(Replace(cardNumero, " ", ""), "-", "") & """, ""expiryMonth"": """ & expiryMonth & """, ""expiryYear"": """ & expiryYear & """, ""ccv"": """ & cardCvv & """}"
        
        payload = payload & ", ""creditCardHolderInfo"": {""name"": """ & cardNome & """, ""cpfCnpj"": """ & clienteCpf & """, ""email"": """ & clienteEmail & """, ""phone"": """ & clienteTelefone & """, ""postalCode"": """ & clienteCep & """, ""addressNumber"": """ & clienteNumero & """}"
    End If
    
    payload = payload & "}"
    
    ' Criar pagamento no Asaas
    Dim http, asaasResponse, asaasPaymentId, asaasStatus
    Set http = Server.CreateObject("MSXML2.ServerXMLHTTP.6.0")
    
    http.Open "POST", asaasBaseUrl & "/payments", False
    http.setRequestHeader "Content-Type", "application/json"
    http.setRequestHeader "access_token", asaasApiKey
    http.setRequestHeader "User-Agent", "M3APay/1.0"
    
    On Error Resume Next
    http.send payload
    
    Dim httpStatus
    httpStatus = http.Status
    
    If Err.Number <> 0 Or httpStatus >= 400 Then
        Dim errorMsg
        If Err.Number <> 0 Then
            errorMsg = Err.Description
        Else
            errorMsg = http.responseText
        End If
        Response.Write "{""success"": false, ""message"": ""Erro ao criar pagamento: " & Replace(Replace(errorMsg, """", "'"), vbCrLf, " ") & """}"
        Set http = Nothing
        Call FecharConexao(conn)
        Response.End
    End If
    
    asaasResponse = http.responseText
    asaasPaymentId = GetJsonValue(asaasResponse, "id")
    asaasStatus = GetJsonValue(asaasResponse, "status")
    
    Dim pixCode, pixQrCode
    pixCode = ""
    pixQrCode = ""
    
    ' Se for PIX, buscar QR Code
    If UCase(metodo) = "PIX" And asaasPaymentId <> "" Then
        http.Open "GET", asaasBaseUrl & "/payments/" & asaasPaymentId & "/pixQrCode", False
        http.setRequestHeader "Content-Type", "application/json"
        http.setRequestHeader "access_token", asaasApiKey
        http.setRequestHeader "User-Agent", "M3APay/1.0"
        
        http.send
        
        If http.Status = 200 Then
            Dim pixResponse
            pixResponse = http.responseText
            pixCode = GetJsonValue(pixResponse, "payload")
            pixQrCode = GetJsonValue(pixResponse, "encodedImage")
        End If
    End If
    
    On Error GoTo 0
    Set http = Nothing
    
    ' Registrar pagamento no banco
    Dim dbStatus
    If asaasStatus = "CONFIRMED" Or asaasStatus = "RECEIVED" Then
        dbStatus = "confirmed"
    ElseIf asaasStatus = "PENDING" Then
        dbStatus = "pending"
    Else
        dbStatus = "pending"
    End If
    
    sql = "INSERT INTO pagamentos (cliente_id, asaas_payment_id, valor, metodo, status, pix_code, pix_qrcode, transaction_id, descricao) VALUES (" & EscapeSQL(customerId) & ", '" & EscapeSQL(asaasPaymentId) & "', " & Replace(valor, ",", ".") & ", '" & EscapeSQL(metodo) & "', '" & dbStatus & "', '" & EscapeSQL(Left(pixCode, 1000)) & "', '" & EscapeSQL(Left(pixQrCode, 5000)) & "', '" & EscapeSQL(asaasPaymentId) & "', 'Pagamento M3A Pay')"
    
    On Error Resume Next
    conn.Execute sql
    On Error GoTo 0
    
    ' Retornar resposta
    Dim responseJson
    responseJson = "{""success"": true, ""asaasPaymentId"": """ & asaasPaymentId & """, ""status"": """ & dbStatus & """"
    
    If pixCode <> "" Then
        responseJson = responseJson & ", ""pixCode"": """ & Replace(pixCode, """", "\""") & """"
    End If
    
    If pixQrCode <> "" Then
        responseJson = responseJson & ", ""pixQrCode"": """ & pixQrCode & """"
    End If
    
    responseJson = responseJson & ", ""message"": ""Pagamento criado com sucesso""}"
    
    Response.Write responseJson

Else
    Response.Write RespostaJSON(False, "", "Método não permitido")
End If

Call FecharConexao(conn)
%>
