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
        sql = "SELECT p.id, p.status, p.transaction_id, p.asaas_payment_id, p.valor, p.metodo, p.confirmed_at, c.nome, c.email FROM pagamentos p INNER JOIN clientes c ON p.cliente_id = c.id WHERE p.transaction_id = '" & transactionId & "' OR p.asaas_payment_id = '" & transactionId & "' ORDER BY p.id DESC LIMIT 1"
        Set rs = conn.Execute(sql)
        
        If rs.EOF Then
            Response.Write "{""status"": ""not_found"", ""message"": ""Pagamento não encontrado""}"
        Else
            Dim confirmedAt
            If IsNull(rs("confirmed_at")) Then
                confirmedAt = ""
            Else
                confirmedAt = FormatDateISO(rs("confirmed_at"))
            End If
            
            Response.Write "{""status"": """ & rs("status") & """, ""transactionId"": """ & rs("transaction_id") & """, ""asaasPaymentId"": """ & rs("asaas_payment_id") & """, ""valor"": " & rs("valor") & ", ""metodo"": """ & rs("metodo") & """, ""clienteNome"": """ & rs("nome") & """, ""confirmedAt"": """ & confirmedAt & """}"
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
    
    ' Se tem event, é webhook do Asaas
    If event <> "" Then
        ' Webhook do Asaas - o payment vem em payment.id
        ' O Asaas envia: {"event": "PAYMENT_CONFIRMED", "payment": {"id": "xxx", ...}}
        Dim paymentJson
        paymentJson = GetJsonValue(jsonString, "payment")
        If paymentJson = "" Then
            ' Tentar pegar direto
            paymentId = EscapeSQL(GetJsonValue(jsonString, "id"))
        Else
            ' Precisa parsear o objeto payment
            paymentId = EscapeSQL(GetJsonValue(jsonString, "id"))
        End If
        
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
    Else
        ' Atualização direta do frontend
        paymentId = EscapeSQL(GetJsonValue(jsonString, "asaasPaymentId"))
        newStatus = EscapeSQL(GetJsonValue(jsonString, "status"))
    End If
    
    If paymentId = "" Then
        Response.Write RespostaJSON(False, "", "PaymentId não informado")
        Call FecharConexao(conn)
        Response.End
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