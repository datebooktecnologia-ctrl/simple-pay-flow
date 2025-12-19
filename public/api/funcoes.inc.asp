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
    Response.AddHeader "Access-Control-Allow-Headers", "Content-Type, Authorization, access_token"
End Sub

Function LimparDocumento(doc)
    LimparDocumento = Replace(Replace(Replace(doc, ".", ""), "-", ""), "/", "")
End Function

Function LimparTelefone(tel)
    Dim result
    result = Replace(Replace(Replace(Replace(tel, "(", ""), ")", ""), " ", ""), "-", "")
    LimparTelefone = result
End Function
%>