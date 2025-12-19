<%
' ============================================
' ARQUIVO DE CONEXÃO MySQL
' Caminho: /pay/api/conexao.inc.asp
' ============================================
' IMPORTANTE: Configure os dados abaixo conforme seu servidor

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