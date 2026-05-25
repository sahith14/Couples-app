<#
.SYNOPSIS
    SoulSync one-shot setup. Installs deps, primes env, runs typecheck.
.DESCRIPTION
    Idempotent. Safe to re-run. Designed for fresh clones on Windows.
    For Supabase + EAS deployment, the README has the next steps.
#>
[CmdletBinding()]
param(
    [switch]$SkipInstall,
    [switch]$RunDev
)

$ErrorActionPreference = 'Stop'

function Step($msg) { Write-Host ""; Write-Host "==> $msg" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "  OK $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "  ! $msg" -ForegroundColor Yellow }

Step "Checking prerequisites"
$node = node --version 2>$null; if (-not $node) { throw "Node.js is required. Install Node 20+ from https://nodejs.org" }
Ok "node $node"
$pnpm = pnpm --version 2>$null; if (-not $pnpm) {
    Warn "pnpm not found. Installing via corepack..."
    corepack enable
    corepack prepare pnpm@latest --activate
    $pnpm = pnpm --version
}
Ok "pnpm $pnpm"

Step "Setting up .env"
if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
    Ok "Created .env from .env.example. Edit it with your Supabase keys."
} else {
    Ok ".env already exists"
}

if (-not $SkipInstall) {
    Step "Installing workspace dependencies (this can take 1-3 min on cold caches)"
    pnpm install
    Ok "Install complete"
}

Step "Type-checking everything"
pnpm -r exec tsc --noEmit
Ok "Type-check passed"

Step "Setup complete. Next steps:"
Write-Host "  1. Edit .env with your Supabase URL + anon key"
Write-Host "     (get them at https://supabase.com/dashboard/project/_/settings/api)"
Write-Host "  2. Run the migrations:"
Write-Host "     supabase link --project-ref <YOUR_REF>"
Write-Host "     supabase db push"
Write-Host "  3. Deploy Edge Functions (optional but recommended):"
Write-Host "     supabase functions deploy compose-message"
Write-Host "     supabase functions deploy dispatch-scheduled"
Write-Host "     supabase functions deploy widget-payload"
Write-Host "  4. Run the apps:"
Write-Host "     pnpm --filter @soulsync/admin dev    # http://localhost:3000"
Write-Host "     pnpm --filter @soulsync/mobile start # Expo · scan QR with Expo Go"
Write-Host ""

if ($RunDev) {
    Step "Starting admin dev server (Ctrl+C to stop)"
    pnpm --filter @soulsync/admin dev
}
