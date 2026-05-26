$WshShell = New-Object -comObject WScript.Shell
$DesktopPath = [System.IO.Path]::Combine($env:USERPROFILE, "Desktop")
$Shortcut = $WshShell.CreateShortcut("$DesktopPath\Hermes II - CONTROL.lnk")
$Shortcut.TargetPath = "C:\Users\Adelio\TABLET_CAMPO\launch_control.vbs"
$Shortcut.IconLocation = "C:\Users\Adelio\TABLET_CAMPO\horus_icon.ico"
$Shortcut.WorkingDirectory = "C:\Users\Adelio\TABLET_CAMPO"
$Shortcut.Description = "Hermes II - CONTROL"
$Shortcut.Save()
Write-Output "Shortcut created successfully on Desktop!"
