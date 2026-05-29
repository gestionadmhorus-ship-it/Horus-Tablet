$WshShell = New-Object -comObject WScript.Shell
$DesktopPath = [Environment]::GetFolderPath('Desktop')
$Shortcut = $WshShell.CreateShortcut("$DesktopPath\Hermes II.lnk")
$Shortcut.TargetPath = "C:\Users\Adelio\TABLET_CAMPO\release-electron\win-unpacked\Hermes II.exe"
$Shortcut.WorkingDirectory = "C:\Users\Adelio\TABLET_CAMPO\release-electron\win-unpacked"
$Shortcut.IconLocation = "C:\Users\Adelio\TABLET_CAMPO\horus_icon.ico"
$Shortcut.Description = "Iniciar Hermes II"
$Shortcut.Save()
