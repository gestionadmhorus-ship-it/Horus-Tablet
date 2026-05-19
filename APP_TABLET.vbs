Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

Dim appPath
appPath = "c:\Users\Adelio\TABLET_CAMPO"

' Iniciar el servidor de desarrollo en segundo plano
objShell.Run "cmd /c cd /d """ & appPath & """ && npm run dev", 0, False

' Esperar que el servidor arranque
WScript.Sleep 4000

' Abrir el navegador en la direccion local
objShell.Run "http://localhost:5173", 1, False
