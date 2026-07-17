# Lead-Gen App — start all services (Next.js stack)
# Usage: .\start.ps1
#
# Legacy Rust/Tauri stack (backend/, lead-gen-app/) is left in place but no
# longer started here — see strategy.md / progress.md for the migration.

$root = $PSScriptRoot

Write-Host "Starting Lead-Gen App..." -ForegroundColor Cyan

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
