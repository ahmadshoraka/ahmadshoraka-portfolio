Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'

$sourceFile = 'C:\Users\hamoodi\.cursor\projects\c-Users-hamoodi-ahmadshoraka-portfolio\assets\c__Users_hamoodi_AppData_Roaming_Cursor_User_workspaceStorage_1e9036f19f67e82fc59d45b352c367ba_images_hamoodiStikcer-17a5276c-6fa5-4162-b86f-5ffcecb86779.png'
$outDir = 'c:\Users\hamoodi\ahmadshoraka-portfolio\public'

function Add-RoundedRect([System.Drawing.Drawing2D.GraphicsPath]$gp, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $d = $r * 2
  $gp.AddArc($x, $y, $d, $d, 180, 90)
  $gp.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $gp.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $gp.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $gp.CloseFigure()
}

function New-AppIcon {
  param(
    [System.Drawing.Image]$Source,
    [int]$Size,
    [string]$OutputFile
  )

  $canvas = New-Object System.Drawing.Bitmap $Size, $Size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $canvas.SetResolution(96, 96)
  $gfx = [System.Drawing.Graphics]::FromImage($canvas)
  $gfx.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $gfx.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $gfx.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $gfx.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
  $gfx.Clear([System.Drawing.Color]::FromArgb(0, 0, 0, 0))

  $pad = [Math]::Max(1.0, $Size * 0.05)
  $tileX = $pad
  $tileY = $pad
  $tileW = $Size - (2 * $pad)
  $tileH = $Size - (2 * $pad)
  $corner = [Math]::Max(3.0, $tileW * 0.32)

  # Soft purple glow under the tile
  $glow = New-Object System.Drawing.Drawing2D.GraphicsPath
  Add-RoundedRect $glow ($tileX - 1) ($tileY + 1) ($tileW + 2) ($tileH + 2) ($corner + 1)
  $glowBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush($glow)
  $glowBrush.CenterColor = [System.Drawing.Color]::FromArgb(70, 150, 80, 230)
  $glowBrush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 60, 30, 140))
  $gfx.FillPath($glowBrush, $glow)
  $glowBrush.Dispose()
  $glow.Dispose()

  # Drop shadow
  $shadowShift = [Math]::Max(1.0, $Size * 0.035)
  $shadowGp = New-Object System.Drawing.Drawing2D.GraphicsPath
  Add-RoundedRect $shadowGp $tileX ($tileY + $shadowShift) $tileW $tileH $corner
  $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(70, 18, 8, 45))
  $gfx.FillPath($shadowBrush, $shadowGp)
  $shadowBrush.Dispose()
  $shadowGp.Dispose()

  # Clip mask for artwork
  $mask = New-Object System.Drawing.Drawing2D.GraphicsPath
  Add-RoundedRect $mask $tileX $tileY $tileW $tileH $corner

  $state = $gfx.Save()
  $gfx.SetClip($mask)

  # Slight zoom so face/character reads at tiny sizes
  $zoom = 1.14
  $srcW = $Source.Width / $zoom
  $srcH = $Source.Height / $zoom
  $srcX = ($Source.Width - $srcW) / 2.0
  $srcY = (($Source.Height - $srcH) / 2.0) - ($Source.Height * 0.03)
  $srcRect = New-Object System.Drawing.RectangleF $srcX, $srcY, $srcW, $srcH
  $dstRect = New-Object System.Drawing.RectangleF $tileX, $tileY, $tileW, $tileH
  $gfx.DrawImage($Source, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
  $gfx.Restore($state)

  # Soft white rim highlight
  $rimWidth = [Math]::Max(1.2, $Size * 0.038)
  $rim = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(150, 255, 255, 255), $rimWidth)
  $rim.Alignment = [System.Drawing.Drawing2D.PenAlignment]::Inset
  $gfx.DrawPath($rim, $mask)
  $rim.Dispose()

  # Subtle purple edge
  $edgeWidth = [Math]::Max(1.0, $Size * 0.018)
  $edge = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(110, 130, 70, 210), $edgeWidth)
  $edge.Alignment = [System.Drawing.Drawing2D.PenAlignment]::Inset
  $gfx.DrawPath($edge, $mask)
  $edge.Dispose()

  $mask.Dispose()
  $gfx.Dispose()

  $canvas.Save($OutputFile, [System.Drawing.Imaging.ImageFormat]::Png)
  $canvas.Dispose()
  Write-Host "OK $Size -> $OutputFile"
}

$source = [System.Drawing.Image]::FromFile($sourceFile)
New-AppIcon -Source $source -Size 32  -OutputFile (Join-Path $outDir 'favicon.png')
New-AppIcon -Source $source -Size 48  -OutputFile (Join-Path $outDir 'favicon-48.png')
New-AppIcon -Source $source -Size 64  -OutputFile (Join-Path $outDir 'favicon-64.png')
New-AppIcon -Source $source -Size 180 -OutputFile (Join-Path $outDir 'apple-touch-icon.png')
New-AppIcon -Source $source -Size 512 -OutputFile (Join-Path $outDir 'icon-512.png')
$source.Dispose()

Get-ChildItem $outDir\favicon*, $outDir\apple-touch*, $outDir\icon-512.png | Format-Table Name, Length -AutoSize
