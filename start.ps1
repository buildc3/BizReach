# Lead-Gen App — start all services (Next.js stack)
# Usage: .\start.ps1
#
# Legacy Rust/Tauri stack (backend/, lead-gen-app/) is left in place but no
# longer started here — see strategy.md / progress.md for the migration.

$root = $PSScriptRoot

Write-Host "Starting Lead-Gen App..." -ForegroundColor Cyan

# 0. Dated DB backup (strategy.md §10.2 #7 — the leads DB is the business
# asset; snapshot it on every start, keep the last 14). Best-effort: a
# failed backup (Docker not up yet, pg_dump missing) must not block startup.
$backupDir = Join-Path $root "_backups"
if (-not (Test-Path $backupDir)) { New-Item -ItemType Directory -Path $backupDir | Out-Null }
$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = Join-Path $backupDir "lead_gen_$stamp.dump"
try {
    docker exec postgres-client pg_dump -U yashdba -Fc lead_gen > $backupFile 2>$null
    if ($? -and (Test-Path $backupFile) -and (Get-Item $backupFile).Length -gt 0) {
        Write-Host "DB backup saved -> $backupFile" -ForegroundColor Gray
        Get-ChildItem $backupDir -Filter "lead_gen_*.dump" | Sort-Object LastWriteTime -Descending |
            Select-Object -Skip 14 | Remove-Item -Force
    } else {
        Remove-Item $backupFile -ErrorAction SilentlyContinue
        Write-Host "DB backup skipped (is the postgres-client container running?)" -ForegroundColor DarkYellow
    }
} catch {
    Write-Host "DB backup skipped: $_" -ForegroundColor DarkYellow
}

# 1. WhatsApp sidecar (Baileys on port 3099)
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$root\sidecar'; Write-Host 'WhatsApp sidecar starting...' -ForegroundColor Yellow; node index.js"
) -WindowStyle Normal

Start-Sleep -Seconds 1

# 2. Next.js app (frontend + backend API routes, port 3000)
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$root\next-app'; Write-Host 'Next.js app starting...' -ForegroundColor Yellow; npm run dev"
) -WindowStyle Normal

Write-Host ""
Write-Host "All services launched in separate windows." -ForegroundColor Green
Write-Host "  Sidecar   -> http://127.0.0.1:3099" -ForegroundColor Gray
Write-Host "  Next.js   -> http://localhost:3000" -ForegroundColor Gray
