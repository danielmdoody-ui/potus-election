param(
  [string]$ModelFile = "phi3-mini-q4.gguf"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$pkg = Get-Content package.json -Raw | ConvertFrom-Json
$version = $pkg.version
$product = $pkg.build.productName

$setupExe = Join-Path $root "dist\$product Setup $version.exe"
$modelSrc = Join-Path $root "models\$ModelFile"
$bundleDir = Join-Path $root "dist\release-bundle-$version"
$zipPath = Join-Path $root "dist\release-bundle-$version.zip"

if (!(Test-Path $setupExe)) { throw "Installer not found: $setupExe (run npm run dist first)" }
if (!(Test-Path $modelSrc)) { throw "Model not found: $modelSrc" }

if (Test-Path $bundleDir) { Remove-Item -LiteralPath $bundleDir -Recurse -Force }
if (Test-Path $zipPath) { Remove-Item -LiteralPath $zipPath -Force }

New-Item -ItemType Directory -Path $bundleDir | Out-Null
Copy-Item -LiteralPath $setupExe -Destination $bundleDir
Copy-Item -LiteralPath $modelSrc -Destination (Join-Path $bundleDir $ModelFile)

@"
POTUS-SIM release bundle

How to install:
1) Keep both files in the same folder.
2) Run the Setup EXE.
3) The installer will automatically copy $ModelFile for Local AI.
"@ | Set-Content -Path (Join-Path $bundleDir "README.txt") -Encoding ASCII

Push-Location $bundleDir
Write-Host "Compressing $bundleDir into $zipPath..."
Write-Host "This will take several minutes because the model is over 2.4GB. Please wait..."
try {
  & tar.exe -a -c -f $zipPath *
  if ($LASTEXITCODE -ne 0) { throw "tar.exe failed with exit code $LASTEXITCODE" }
} finally {
  Pop-Location
}

Write-Host "Bundle ready: $bundleDir"
Write-Host "Zip ready: $zipPath"
