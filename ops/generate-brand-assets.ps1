param(
  [string]$OutputDir = (Join-Path $PSScriptRoot '..\public')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$OutputDir = [System.IO.Path]::GetFullPath($OutputDir)
[System.IO.Directory]::CreateDirectory($OutputDir) | Out-Null

$brandGreen = [System.Drawing.Color]::FromArgb(27, 67, 50)
$brandGreenLight = [System.Drawing.Color]::FromArgb(45, 106, 79)
$brandMint = [System.Drawing.Color]::FromArgb(216, 243, 220)
$brandOrange = [System.Drawing.Color]::FromArgb(232, 101, 26)
$brandOrangeLight = [System.Drawing.Color]::FromArgb(242, 138, 61)
$white = [System.Drawing.Color]::White

function New-RoundedPath {
  param(
    [float]$X,
    [float]$Y,
    [float]$Width,
    [float]$Height,
    [float]$Radius
  )

  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = $Radius * 2
  $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
  $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
  $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function Save-PngAsset {
  param(
    [int]$Width,
    [int]$Height,
    [string]$Path,
    [scriptblock]$Draw
  )

  $bitmap = New-Object System.Drawing.Bitmap $Width, $Height
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    & $Draw $graphics $bitmap
    $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

function Draw-BrandMark {
  param(
    [System.Drawing.Graphics]$Graphics,
    [int]$Width,
    [int]$Height
  )

  $Graphics.Clear($brandGreen)

  $backgroundRect = New-RoundedPath 0 0 $Width $Height ([Math]::Max(12, [Math]::Round($Width * 0.18)))
  $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    ([System.Drawing.Point]::new(0, 0)),
    ([System.Drawing.Point]::new($Width, $Height)),
    $brandGreen,
    $brandGreenLight
  )
  try {
    $Graphics.FillPath($bgBrush, $backgroundRect)
  } finally {
    $bgBrush.Dispose()
    $backgroundRect.Dispose()
  }

  $leafBrush = New-Object System.Drawing.SolidBrush $brandMint
  $accentBrush = New-Object System.Drawing.SolidBrush $brandOrange
  $textBrush = New-Object System.Drawing.SolidBrush $white
  $shadowBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(45, 0, 0, 0))
  try {
    $leaf = New-Object System.Drawing.Drawing2D.GraphicsPath
    $leaf.AddEllipse($Width * 0.18, $Height * 0.12, $Width * 0.46, $Height * 0.38)
    $leaf.AddEllipse($Width * 0.34, $Height * 0.24, $Width * 0.28, $Height * 0.22)
    $Graphics.FillPath($leafBrush, $leaf)
    $Graphics.FillEllipse($accentBrush, $Width * 0.58, $Height * 0.18, $Width * 0.2, $Height * 0.2)
    $leaf.Dispose()

    $fontSize = [Math]::Max(10, [Math]::Round($Width * 0.22))
    $font = New-Object System.Drawing.Font('Segoe UI Semibold', $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    try {
      $format = New-Object System.Drawing.StringFormat
      $format.Alignment = [System.Drawing.StringAlignment]::Center
      $format.LineAlignment = [System.Drawing.StringAlignment]::Center
      $textRect = [System.Drawing.RectangleF]::new([single]0, [single]($Height * 0.52), [single]$Width, [single]($Height * 0.32))
      $shadowRect = [System.Drawing.RectangleF]::new([single]1, [single](($Height * 0.52) + 2), [single]$Width, [single]($Height * 0.32))
      $Graphics.DrawString('css', $font, $shadowBrush, $shadowRect, $format)
      $Graphics.DrawString('css', $font, $textBrush, $textRect, $format)
      $format.Dispose()
    } finally {
      $font.Dispose()
    }
  } finally {
    $leafBrush.Dispose()
    $accentBrush.Dispose()
    $textBrush.Dispose()
    $shadowBrush.Dispose()
  }
}

Save-PngAsset -Width 32 -Height 32 -Path (Join-Path $OutputDir 'favicon-32x32.png') -Draw {
  param($graphics, $bitmap)
  Draw-BrandMark -Graphics $graphics -Width $bitmap.Width -Height $bitmap.Height
}

Save-PngAsset -Width 180 -Height 180 -Path (Join-Path $OutputDir 'apple-touch-icon.png') -Draw {
  param($graphics, $bitmap)
  Draw-BrandMark -Graphics $graphics -Width $bitmap.Width -Height $bitmap.Height
}

Save-PngAsset -Width 192 -Height 192 -Path (Join-Path $OutputDir 'icon-192.png') -Draw {
  param($graphics, $bitmap)
  Draw-BrandMark -Graphics $graphics -Width $bitmap.Width -Height $bitmap.Height
}

Save-PngAsset -Width 512 -Height 512 -Path (Join-Path $OutputDir 'icon-512.png') -Draw {
  param($graphics, $bitmap)
  Draw-BrandMark -Graphics $graphics -Width $bitmap.Width -Height $bitmap.Height
}

Save-PngAsset -Width 1200 -Height 630 -Path (Join-Path $OutputDir 'og-image.png') -Draw {
  param($graphics, $bitmap)

  $backgroundBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    ([System.Drawing.Point]::new(0, 0)),
    ([System.Drawing.Point]::new($bitmap.Width, $bitmap.Height)),
    $brandGreen,
    $brandGreenLight
  )
  $panelBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(30, 255, 255, 255))
  $mintBrush = New-Object System.Drawing.SolidBrush $brandMint
  $accentBrush = New-Object System.Drawing.SolidBrush $brandOrange
  $whiteBrush = New-Object System.Drawing.SolidBrush $white
  $mutedBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(220, 240, 247, 242))
  try {
    $graphics.FillRectangle($backgroundBrush, 0, 0, $bitmap.Width, $bitmap.Height)

    $circleSize = 320
    $graphics.FillEllipse($panelBrush, 860, -40, $circleSize, $circleSize)
    $graphics.FillEllipse($panelBrush, 930, 330, 220, 220)

    $card = New-RoundedPath 58 62 1084 506 42
    $graphics.FillPath($panelBrush, $card)
    $card.Dispose()

    $logoRect = New-RoundedPath 96 110 180 180 34
    $logoBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
      ([System.Drawing.Point]::new(96, 110)),
      ([System.Drawing.Point]::new(276, 290)),
      $brandGreenLight,
      $brandGreen
    )
    $graphics.FillPath($logoBrush, $logoRect)
    $logoBrush.Dispose()
    $logoRect.Dispose()

    $graphics.FillEllipse($mintBrush, 124, 138, 86, 62)
    $graphics.FillEllipse($mintBrush, 156, 158, 70, 52)
    $graphics.FillEllipse($accentBrush, 212, 142, 42, 42)

    $brandFont = New-Object System.Drawing.Font('Segoe UI Semibold', 42, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $titleFont = New-Object System.Drawing.Font('Segoe UI Semibold', 72, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $bodyFont = New-Object System.Drawing.Font('Segoe UI', 28, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    $pillFont = New-Object System.Drawing.Font('Segoe UI Semibold', 22, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    try {
      $graphics.DrawString('cssberlin.de', $brandFont, $whiteBrush, 312, 126)
      $graphics.DrawString('Second-Hand smart und sicher.', $titleFont, $whiteBrush, 96, 300)
      $graphics.DrawString('Nachhaltig kaufen und verkaufen in Berlin mit Kaeuferschutz, Nachrichten und echten Live-Daten.', $bodyFont, $mutedBrush, [System.Drawing.RectangleF]::new(100, 392, 700, 120))

      $pill = New-RoundedPath 822 436 240 64 28
      $pillBrush = New-Object System.Drawing.SolidBrush $brandOrange
      $graphics.FillPath($pillBrush, $pill)
      $pillBrush.Dispose()
      $pill.Dispose()
      $graphics.DrawString('Launch Ready', $pillFont, $whiteBrush, 866, 454)
    } finally {
      $brandFont.Dispose()
      $titleFont.Dispose()
      $bodyFont.Dispose()
      $pillFont.Dispose()
    }
  } finally {
    $backgroundBrush.Dispose()
    $panelBrush.Dispose()
    $mintBrush.Dispose()
    $accentBrush.Dispose()
    $whiteBrush.Dispose()
    $mutedBrush.Dispose()
  }
}

$iconBitmap = New-Object System.Drawing.Bitmap 32, 32
$iconGraphics = [System.Drawing.Graphics]::FromImage($iconBitmap)
try {
  $iconGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $iconGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $iconGraphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  Draw-BrandMark -Graphics $iconGraphics -Width 32 -Height 32
  $icon = [System.Drawing.Icon]::FromHandle($iconBitmap.GetHicon())
  $stream = [System.IO.File]::Open((Join-Path $OutputDir 'favicon.ico'), [System.IO.FileMode]::Create)
  try {
    $icon.Save($stream)
  } finally {
    $stream.Dispose()
    $icon.Dispose()
  }
} finally {
  $iconGraphics.Dispose()
  $iconBitmap.Dispose()
}

Write-Output "Brand assets generated in $OutputDir"