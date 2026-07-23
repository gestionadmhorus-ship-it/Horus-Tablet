$WshShell = New-Object -comObject WScript.Shell
$DesktopPath = [System.IO.Path]::Combine($env:USERPROFILE, "Desktop")

# Remove old shortcuts first if they exist to keep desktop clean
$OldShortcuts = @("Horus Tablet Campo.lnk", "Hermes II - CONTROL.lnk", "Hermes CONTROL.lnk")
foreach ($Old in $OldShortcuts) {
    $Path = Join-Path $DesktopPath $Old
    if (Test-Path $Path) {
        Remove-Item $Path -Force
        Write-Output "Removed old shortcut: $Path"
    }
}

# Create the fresh shortcut pointing to the latest version in C:\Users\Adelio\TABLET_CAMPO
$ShortcutPath = Join-Path $DesktopPath "Hermes II - CONTROL.lnk"
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = "C:\Users\Adelio\TABLET_CAMPO\Lanzar_Horus.vbs"
$Shortcut.IconLocation = "C:\Users\Adelio\TABLET_CAMPO\horus_icon.ico"
$Shortcut.WorkingDirectory = "C:\Users\Adelio\TABLET_CAMPO"
$Shortcut.Description = "Hermes II - CONTROL (Latest Version)"
$Shortcut.Save()

Write-Output "Shortcut updated successfully to point to C:\Users\Adelio\TABLET_CAMPO\launch_control.vbs"
