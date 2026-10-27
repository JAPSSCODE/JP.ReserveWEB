# Builds the link-preview image (Media/web/share-preview.jpg, 1200x630) and the square site icons
# (Media/web/icon-180.png, icon-64.png) from the logo and a product photo.
param(
  [string] $Root = (Split-Path $PSScriptRoot -Parent),
  [string] $Photo = "Media\unnamed (1).jpg",
  [string] $Tagline = "Luxury, sourced for you."
)
Add-Type -AssemblyName System.Drawing
$logo = [System.Drawing.Image]::FromFile((Join-Path $Root "Media\IMG_9218.jpeg"))
$photoImg = [System.Drawing.Image]::FromFile((Join-Path $Root $Photo))
# Respect phone-camera rotation
$orient = 0x0112
if ($photoImg.PropertyIdList -contains $orient) {
  switch ($photoImg.GetPropertyItem($orient).Value[0]) {
    3 { $photoImg.RotateFlip("Rotate180FlipNone") } 6 { $photoImg.RotateFlip("Rotate90FlipNone") } 8 { $photoImg.RotateFlip("Rotate270FlipNone") }
  }
}
$gold = [System.Drawing.Color]::FromArgb(212, 175, 90)
$s = $logo.Width / 800.0   # logo crops below are measured on the 800px-wide web copy

function New-Canvas($w, $h) {
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = "HighQualityBicubic"; $g.SmoothingMode = "AntiAlias"
  $g.PixelOffsetMode = "HighQuality"; $g.TextRenderingHint = "AntiAliasGridFit"
  $g.Clear([System.Drawing.Color]::Black)  # matches the logo's own black background
  return @($bmp, $g)
}
function Save-Jpeg($bmp, $path) {
  $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq "image/jpeg"
  $p = New-Object System.Drawing.Imaging.EncoderParameters 1
  $p.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 90L
  $bmp.Save($path, $codec, $p)
}

# ---- Link preview: logo + tagline on the left, photo on the right ----
$bmp, $g = New-Canvas 1200 630
# Photo: cover-crop into the right half
$dst = New-Object System.Drawing.RectangleF 600, 0, 600, 630
$ratio = [Math]::Max(600 / $photoImg.Width, 630 / $photoImg.Height)
$cw = 600 / $ratio; $ch = 630 / $ratio
$src = New-Object System.Drawing.RectangleF (($photoImg.Width - $cw) / 2), (($photoImg.Height - $ch) / 2), $cw, $ch
$g.DrawImage($photoImg, $dst, $src, "Pixel")
# Gold divider
$g.FillRectangle((New-Object System.Drawing.SolidBrush $gold), 598, 0, 2, 630)
# Logo (monogram + name), from the web-copy area x 60-740, y 200-680
$lsrc = New-Object System.Drawing.RectangleF (60 * $s), (200 * $s), (680 * $s), (480 * $s)
$lw = 470; $lh = [int]($lw * 480 / 680)
$g.DrawImage($logo, (New-Object System.Drawing.RectangleF ((600 - $lw) / 2), 95, $lw, $lh), $lsrc, "Pixel")
# Tagline
$font = New-Object System.Drawing.Font "Georgia", 30, ([System.Drawing.FontStyle]::Italic), ([System.Drawing.GraphicsUnit]::Pixel)
$fmt = New-Object System.Drawing.StringFormat; $fmt.Alignment = "Center"
$g.DrawString($Tagline, $font, (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(243, 238, 228))), (New-Object System.Drawing.RectangleF 0, (95 + $lh + 34), 600, 50), $fmt)
$small = New-Object System.Drawing.Font "Segoe UI", 15, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
$dot = [char]0x00B7; $g.DrawString("AUTHENTIC  $dot  UK TRACKED DELIVERY  $dot  SOURCED ON REQUEST", $small, (New-Object System.Drawing.SolidBrush $gold), (New-Object System.Drawing.RectangleF 0, (95 + $lh + 92), 600, 30), $fmt)
Save-Jpeg $bmp (Join-Path $Root "Media\web\share-preview.jpg")
$g.Dispose(); $bmp.Dispose()

# ---- Square icons: the JP monogram, from the web-copy area x 255-560, y 205-510 ----
foreach ($size in 180, 64) {
  $bmp, $g = New-Canvas $size $size
  $pad = [int]($size * 0.1)
  $msrc = New-Object System.Drawing.RectangleF (255 * $s), (205 * $s), (305 * $s), (305 * $s)
  $g.DrawImage($logo, (New-Object System.Drawing.RectangleF $pad, $pad, ($size - 2 * $pad), ($size - 2 * $pad)), $msrc, "Pixel")
  $bmp.Save((Join-Path $Root "Media\web\icon-$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}
$logo.Dispose(); $photoImg.Dispose()
"Done"
