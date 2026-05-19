$WshShell = New-Object -comObject WScript.Shell
$DesktopPath = [Environment]::GetFolderPath('Desktop')
$Shortcut = $WshShell.CreateShortcut("$DesktopPath\Horus Tablet Campo.lnk")
$Shortcut.TargetPath = "C:\Users\Adelio\TABLET_CAMPO\Lanzar_Horus.vbs"
$Shortcut.IconLocation = "C:\Users\Adelio\TABLET_CAMPO\horus_icon.ico"
$Shortcut.WorkingDirectory = "C:\Users\Adelio\TABLET_CAMPO"
$Shortcut.Description = "Iniciar Horus Tablet Campo Táctica"
$Shortcut.Save()
