param(
  [Parameter(Mandatory)] [string] $MediaDir,
  [int] $ShortSide = 800,    # sharp on retina screens for tiles/cards up to ~400px wide
  [long] $Quality = 90,
  [double] $Sharpen = 0.55   # unsharp-mask strength (0 = off)
)
# Creates high-quality resized + lightly sharpened copies of photos in <MediaDir>\web\ (originals untouched).
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System; using System.Drawing; using System.Drawing.Imaging; using System.Runtime.InteropServices;
public static class Sharpen {
  // Unsharp mask: out = px + amount * (px - blur3x3(px))
  public static void Unsharp(Bitmap bmp, double amount) {
    var rect = new Rectangle(0, 0, bmp.Width, bmp.Height);
    var data = bmp.LockBits(rect, ImageLockMode.ReadWrite, PixelFormat.Format24bppRgb);
    int stride = data.Stride, w = bmp.Width, h = bmp.Height;
    var src = new byte[stride * h]; Marshal.Copy(data.Scan0, src, 0, src.Length);
    var dst = (byte[])src.Clone();
    for (int y = 1; y < h - 1; y++)
      for (int x = 1; x < w - 1; x++)
        for (int c = 0; c < 3; c++) {
          int i = y * stride + x * 3 + c, sum = 0;
          for (int dy = -1; dy <= 1; dy++)
            for (int dx = -1; dx <= 1; dx++)
              sum += src[(y + dy) * stride + (x + dx) * 3 + c] * ((dx == 0 ? 2 : 1) * (dy == 0 ? 2 : 1));
          double blur = sum / 16.0, v = src[i] + amount * (src[i] - blur);
          dst[i] = (byte)(v < 0 ? 0 : v > 255 ? 255 : v);
        }
    Marshal.Copy(dst, 0, data.Scan0, dst.Length);
    bmp.UnlockBits(data);
  }
}
'@

$outDir = Join-Path $MediaDir "web"
New-Item -ItemType Directory -Force $outDir | Out-Null
$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
$params = New-Object System.Drawing.Imaging.EncoderParameters 1
$params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), $Quality

$photos = Get-ChildItem -LiteralPath $MediaDir -File | Where-Object { $_.Extension -match '^\.(jpe?g|png)$' }
# Names shared by more than one photo (e.g. unnamed.jpg + unnamed.png) — the non-JPEG ones get a suffix
# so their web copies can't overwrite each other: unnamed.jpg -> web\unnamed.jpg, unnamed.png -> web\unnamed-png.jpg
$sharedNames = $photos | Group-Object { $_.BaseName.ToLower() } | Where-Object Count -gt 1 | ForEach-Object Name

$photos | ForEach-Object {
  $src = [System.Drawing.Image]::FromFile($_.FullName)
  try {
    # Apply the phone's EXIF rotation so the copy isn't sideways (browsers do this automatically)
    if ($src.PropertyIdList -contains 0x0112) {
      switch ([int]$src.GetPropertyItem(0x0112).Value[0]) {
        3 { $src.RotateFlip([System.Drawing.RotateFlipType]::Rotate180FlipNone) }
        6 { $src.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipNone) }
        8 { $src.RotateFlip([System.Drawing.RotateFlipType]::Rotate270FlipNone) }
      }
    }
    $short = [Math]::Min($src.Width, $src.Height)
    $scale = [Math]::Min(1.0, $ShortSide / $short)
    $w = [int][Math]::Round($src.Width * $scale); $h = [int][Math]::Round($src.Height * $scale)

    $bmp = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::Black)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $attr = New-Object System.Drawing.Imaging.ImageAttributes
    $attr.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)   # no dark fringe at the edges
    $g.DrawImage($src, (New-Object System.Drawing.Rectangle 0, 0, $w, $h), 0, 0, $src.Width, $src.Height, [System.Drawing.GraphicsUnit]::Pixel, $attr)
    $g.Dispose()
    if ($Sharpen -gt 0 -and $scale -lt 1.0) { [Sharpen]::Unsharp($bmp, $Sharpen) }

    $outName = $_.BaseName
    if ($sharedNames -contains $_.BaseName.ToLower() -and $_.Extension -notmatch '^\.jpe?g$') {
      $outName += "-" + $_.Extension.TrimStart('.').ToLower()
    }
    $out = Join-Path $outDir ($outName + ".jpg")
    $bmp.Save($out, $jpegCodec, $params)
    $bmp.Dispose()
    "{0,-48} {1,5}x{2,-5} -> {3,4}x{4,-4} {5,7:N0} KB -> {6,5:N0} KB" -f $_.Name, $src.Width, $src.Height, $w, $h, ($_.Length / 1KB), ((Get-Item $out).Length / 1KB)
  } finally { $src.Dispose() }
}
