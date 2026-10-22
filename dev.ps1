# ==============================================================================
# ReadAny Developer Tooling & Launcher (Windows PowerShell)
# ==============================================================================
# Usage:
#   .\dev.ps1                  - Run Vite web app in browser (default)
#   .\dev.ps1 web              - Run Vite web app in browser (http://localhost:5173)
#   .\dev.ps1 desktop          - Run native desktop app via Tauri v2
#   .\dev.ps1 test             - Run unit tests (@readany/core vitest)
#   .\dev.ps1 build            - Build web production assets
#   .\dev.ps1 build-desktop    - Build desktop installers (.exe / .msi) via Tauri
#   .\dev.ps1 check            - Run version, lint, and consistency checks
#   .\dev.ps1 release <ver>    - Bump version, create git tag, and prepare release
#   .\dev.ps1 gitea            - Display Gitea CI testing instructions
# ==============================================================================

param(
    [Parameter(Position = 0)]
    [string]$Command = "web",

    [Parameter(Position = 1)]
    [string]$Arg1 = ""
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $ScriptDir

# Resolve pnpm executable (global or via npx)
function Get-PnpmCommand {
    if (Get-Command pnpm -ErrorAction SilentlyContinue) {
        return "pnpm"
    }
    return "npx pnpm"
}

$Pnpm = Get-PnpmCommand

function Ensure-Dependencies {
    if (-not (Test-Path "node_modules")) {
        Write-Host "Installing workspace dependencies with $Pnpm..." -ForegroundColor Cyan
        Invoke-Expression "$Pnpm install"
    }
}

function Show-Help {
    $HelpText = @'
ReadAny Developer CLI (dev.ps1)

Commands:
  web (default)   Start Vite web dev server at http://localhost:5173
  desktop, tauri  Launch native Tauri v2 desktop window
  test            Run unit tests across packages/core
  build           Build web production bundle
  build-desktop   Build native Windows desktop bundle (.msi / .exe)
  check           Run version consistency and linter checks
  release <ver>   Bump version, create tag v<ver>, and guide release push
  gitea           Show Gitea Docker CI testing instructions
  help            Show this help text

Examples:
  .\dev.ps1
  .\dev.ps1 desktop
  .\dev.ps1 test
  .\dev.ps1 release 1.3.8
'@
    Write-Host $HelpText -ForegroundColor Yellow
}

switch ($Command.ToLower()) {
    "web" {
        Ensure-Dependencies
        Write-Host "Starting ReadAny Web Dev Server (Vite)..." -ForegroundColor Green
        Write-Host "   Local URL: http://localhost:5173" -ForegroundColor Cyan
        Invoke-Expression "$Pnpm --filter app dev"
    }

    { $_ -in "desktop", "tauri" } {
        Ensure-Dependencies
        if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
            Write-Host "Rust/Cargo was not found in PATH. Install Rust from https://rustup.rs/ to run native desktop builds." -ForegroundColor Red
            exit 1
        }
        Write-Host "Launching ReadAny Desktop App (Tauri v2)..." -ForegroundColor Green
        Invoke-Expression "$Pnpm --filter app tauri dev"
    }

    "test" {
        Ensure-Dependencies
        Write-Host "Running Core Unit Tests..." -ForegroundColor Green
        Invoke-Expression "$Pnpm --filter @readany/core test"
    }

    "build" {
        Ensure-Dependencies
        Write-Host "Building web production bundle..." -ForegroundColor Green
        Invoke-Expression "$Pnpm --filter app build"
    }

    { $_ -in "build-desktop", "build-tauri" } {
        Ensure-Dependencies
        if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
            Write-Host "Rust/Cargo was not found in PATH." -ForegroundColor Red
            exit 1
        }
        Write-Host "Building native desktop installer via Tauri..." -ForegroundColor Green
        Invoke-Expression "$Pnpm --filter app tauri build"
    }

    "check" {
        Ensure-Dependencies
        Write-Host "Verifying version consistency..." -ForegroundColor Cyan
        node scripts/bump-version.js --check
        Write-Host "Running Biome linter..." -ForegroundColor Cyan
        Invoke-Expression "$Pnpm lint"
    }

    "release" {
        if (-not $Arg1) {
            Write-Host "Please specify a version number. Example: .\dev.ps1 release 1.3.8" -ForegroundColor Red
            exit 1
        }
        $Version = $Arg1.TrimStart('v')
        Ensure-Dependencies

        Write-Host "Updating version across all files to $Version..." -ForegroundColor Cyan
        node scripts/bump-version.js $Version

        Write-Host "Verifying consistency..." -ForegroundColor Cyan
        node scripts/bump-version.js --check

        $Tag = "v$Version"
        Write-Host "Committing and tagging $Tag..." -ForegroundColor Cyan
        git add -A
        git commit -m "chore(release): release $Tag"
        git tag -a $Tag -m "Release $Tag"

        Write-Host "Created tag $Tag!" -ForegroundColor Green
        Write-Host ""
        Write-Host "To trigger the automated GitHub Actions multi-platform release:" -ForegroundColor Yellow
        Write-Host "   git push origin main --tags" -ForegroundColor White
        Write-Host ""
        Write-Host "GitHub Actions will build Windows (.exe/.msi), macOS (.dmg), Linux (.deb/.AppImage), and Android APK." -ForegroundColor Gray
    }

    "gitea" {
        $GiteaText = @'
==============================================================================
Gitea Actions / CI Testing with Docker
==============================================================================

You can run CI testing on your local Gitea instance using Gitea Actions (Act Runner):

1. Add your repository to your local Gitea instance:
   git remote add gitea http://localhost:3000/<username>/ReadAny.git
   git push gitea main

2. Ensure your Gitea Act Runner is active in Docker.
   The workflow at .gitea/workflows/ci.yml will trigger automatically on pushes
   and pull requests, running:
   - Dependency caching
   - Version consistency check
   - Core unit test suite (including OpenCode and Pi provider modes)
   - Linter checks

3. To trigger a test run immediately:
   git push gitea main
'@
        Write-Host $GiteaText -ForegroundColor Cyan
    }

    default {
        Show-Help
    }
}
