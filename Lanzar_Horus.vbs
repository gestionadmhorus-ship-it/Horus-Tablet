Set WshShell = CreateObject("WScript.Shell")
scriptDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
' Run the batch file silently (0 means hidden window)
WshShell.Run "cmd.exe /c """ & scriptDir & "\horus_boot.bat""", 0, False
