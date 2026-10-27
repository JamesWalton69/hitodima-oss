param([int]$Dark)
$val = if ($Dark -eq 1) { 0 } else { 1 }
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize" -Name "AppsUseLightTheme" -Value $val -Type DWord
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize" -Name "SystemUsesLightTheme" -Value $val -Type DWord

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class WinTheme {
    [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, UIntPtr wParam, string lParam, uint fuFlags, uint uTimeout, out UIntPtr lpdwResult);
}
"@
$res = [UIntPtr]::Zero
[WinTheme]::SendMessageTimeout([IntPtr]0xffff, 0x001A, [UIntPtr]::Zero, "ImmersiveColorSet", 2, 200, [ref]$res) | Out-Null
Write-Output $Dark
