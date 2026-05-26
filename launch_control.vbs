Set oShell = CreateObject("WScript.Shell")
Set oFSO = CreateObject("Scripting.FileSystemObject")

' Path to the project
Dim projectPath
projectPath = "C:\Users\Adelio\TABLET_CAMPO"

' Launch the dev server in background
Dim serverCmd
serverCmd = "cmd /c cd /d """ & projectPath & """ && npm run dev"
oShell.Run serverCmd, 0, False

' Wait 3 seconds for server to start
WScript.Sleep 3000

' Open in Chrome
oShell.Run "chrome.exe http://localhost:5173", 1, False
