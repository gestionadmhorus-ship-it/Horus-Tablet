Set oShell = CreateObject("WScript.Shell")
Set oFSO = CreateObject("Scripting.FileSystemObject")

' Path to the project
Dim projectPath
projectPath = oFSO.GetParentFolderName(WScript.ScriptFullName)

' ── 1. Kill any existing Node processes owned by the current user to guarantee a clean start on port 5173 ──
Dim currentUser
currentUser = oShell.ExpandEnvironmentStrings("%USERNAME%")
oShell.Run "taskkill /F /IM node.exe /FI ""USERNAME eq " & currentUser & """", 0, True

' ── 2. Pre-set the role to SERVER so the app opens directly as Control Panel ──
' This writes to Chrome's localStorage via a startup URL parameter
Dim startURL
startURL = "http://localhost:5173/?force_role=server"

' ── 3. Start the Vite dev server in background (strict port 5173, exposed to network) ──
Dim serverCmd
serverCmd = "cmd /c cd /d """ & projectPath & """ && npm run dev -- --port 5173 --strictPort --host"
oShell.Run serverCmd, 0, False

' ── 4. Wait for server to be ready (poll every second, up to 15 seconds) ──
Dim i, serverReady
serverReady = False
For i = 1 To 15
    WScript.Sleep 1000
    ' Check if port 5173 is listening using netstat
    Dim objExec, strOutput
    Set objExec = oShell.Exec("cmd /c netstat -an | find ""5173""")
    strOutput = objExec.StdOut.ReadAll()
    If InStr(strOutput, "5173") > 0 Then
        serverReady = True
        Exit For
    End If
Next

' ── 5. Open in Chrome (fallback to Edge if Chrome is not found) ──
If serverReady Then
    Dim opened
    opened = False
    
    Dim profileDir
    profileDir = projectPath & "\chrome_profile"
    
    ' Try Chrome first
    Dim chromePaths(2)
    chromePaths(0) = "C:\Program Files\Google\Chrome\Application\chrome.exe"
    chromePaths(1) = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
    chromePaths(2) = oShell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Google\Chrome\Application\chrome.exe"
    
    Dim j
    For j = 0 To 2
        If oFSO.FileExists(chromePaths(j)) Then
            oShell.Run """" & chromePaths(j) & """ --user-data-dir=""" & profileDir & """ --app=" & startURL, 1, False
            opened = True
            Exit For
        End If
    Next
    
    ' Fallback to Edge if Chrome not found
    If Not opened Then
        Dim edgePath
        edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
        If oFSO.FileExists(edgePath) Then
            oShell.Run """" & edgePath & """ --user-data-dir=""" & profileDir & """ --app=" & startURL, 1, False
            opened = True
        End If
    End If
    
    ' Last resort: open via shell (default browser)
    If Not opened Then
        oShell.Run startURL, 1, False
    End If
Else
    MsgBox "El servidor Hermes II no pudo iniciar en 15 segundos." & vbCrLf & "Verifique que Node.js esté instalado y vuelva a intentarlo.", vbCritical, "Hermes II - CONTROL"
End If
