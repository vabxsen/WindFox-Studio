# Checks that every app in src-tauri/catalog.json resolves in its winget source.
# Usage: npm run check-catalog
$ErrorActionPreference = 'Stop'
$catalogPath = Join-Path $PSScriptRoot '..\src-tauri\catalog.json'
$catalog = Get-Content $catalogPath -Raw -Encoding UTF8 | ConvertFrom-Json

$failed = @()
$total = 0
foreach ($category in $catalog.categories) {
    foreach ($app in $category.apps) {
        $total++
        $null = winget show --id $app.id --exact --source $app.source --accept-source-agreements --disable-interactivity 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host ("  ok    {0,-40} {1}" -f $app.id, $app.name)
        } else {
            Write-Host ("  FAIL  {0,-40} {1} (exit 0x{2:X8})" -f $app.id, $app.name, $LASTEXITCODE) -ForegroundColor Red
            $failed += $app.id
        }
    }
}

Write-Host ""
if ($failed.Count -gt 0) {
    Write-Host "$($failed.Count) of $total IDs did not resolve: $($failed -join ', ')" -ForegroundColor Red
    exit 1
}
Write-Host "All $total IDs resolved." -ForegroundColor Green
