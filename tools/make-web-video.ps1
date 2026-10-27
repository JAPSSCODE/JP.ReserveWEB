# Converts a phone video (e.g. an iPhone .mov in HEVC) into a small web MP4 (H.264) that plays in every browser.
# Usage:  powershell -ExecutionPolicy Bypass -File tools\make-web-video.ps1 "Media\my-video.mov" "Media\web\my-video.mp4"
param(
  [Parameter(Mandatory)] [string] $In,
  [Parameter(Mandatory)] [string] $Out,
  [int] $Width = 720,   # 720px wide is sharp on phones and keeps the file small
  [int] $Crf = 24       # quality: lower = better quality and bigger file (18–28 is sensible)
)
$ffmpeg = (Get-Command ffmpeg -ErrorAction SilentlyContinue).Source
if (-not $ffmpeg) {
  $ffmpeg = (Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages" -Recurse -Filter ffmpeg.exe -ErrorAction SilentlyContinue | Select-Object -First 1).FullName
}
if (-not $ffmpeg) { throw "FFmpeg not found. Install it with: winget install Gyan.FFmpeg" }
# -an drops the sound (videos on the site play muted); +faststart lets it begin playing while downloading
& $ffmpeg -v error -y -i $In -an -vf "scale=${Width}:-2" -c:v libx264 -profile:v high -pix_fmt yuv420p -crf $Crf -preset slow -movflags +faststart $Out
"{0}  {1:N1} MB" -f $Out, ((Get-Item $Out).Length / 1MB)
