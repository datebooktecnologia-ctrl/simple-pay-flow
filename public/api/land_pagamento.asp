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
' POST: Registrar pagamento no banco
' O pagamento já foi processado diretamente no Asaas
' Esta API apenas grava o registro
' ============================================
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
    If valor = "" Then valor = "0"
    
    ' Validar customerId
    If customerId = "" Then
        Response.Write RespostaJSON(False, "", "CustomerId não informado")
        Call FecharConexao(conn)
        Response.End
    End If
    
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