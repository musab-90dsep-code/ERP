Add-Type -AssemblyName System.Drawing
function Resize-Image($InputFile, $OutputFile, $Width, $Height) {
    if (-not (Test-Path $InputFile)) { Write-Host "File not found: $InputFile"; return }
    $Image = [System.Drawing.Image]::FromFile($InputFile)
    $Bitmap = New-Object System.Drawing.Bitmap($Width, $Height)
    $Graphics = [System.Drawing.Graphics]::FromImage($Bitmap)
    $Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $Graphics.DrawImage($Image, 0, 0, $Width, $Height)
    $Graphics.Dispose()
    $Bitmap.Save($OutputFile, [System.Drawing.Imaging.ImageFormat]::Png)
    $Bitmap.Dispose()
    $Image.Dispose()
    Write-Host "Created $OutputFile"
}

$basePath = "c:\Users\binkh\Downloads\erp-business-manager\public"
$icon192 = "$basePath\icon-192.png"
$icon512 = "$basePath\icon-512.png"

Copy-Item $icon192 "$basePath\icon-original.png" -ErrorAction Ignore
Resize-Image "$basePath\icon-original.png" $icon192 192 192
Resize-Image "$basePath\icon-original.png" $icon512 512 512

$mobileSrc = "C:\Users\binkh\.gemini\antigravity\brain\5d159a3d-7366-4cf8-9d22-2474af33d386\screenshot_mobile_1775357805320.png"
$desktopSrc = "C:\Users\binkh\.gemini\antigravity\brain\5d159a3d-7366-4cf8-9d22-2474af33d386\screenshot_desktop_1775357822903.png"

Resize-Image $mobileSrc "$basePath\screenshot-mobile.png" 1080 1920
Resize-Image $desktopSrc "$basePath\screenshot-desktop.png" 1920 1080
