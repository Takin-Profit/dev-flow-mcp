#!/usr/bin/env pwsh

Write-Host "🚀 Setting up DevFlow MCP development environment..." -ForegroundColor Green

# Check if mise is installed
if (!(Get-Command mise -ErrorAction SilentlyContinue)) {
    Write-Host "📦 Installing mise..." -ForegroundColor Yellow

    # Try winget first
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Write-Host "Using winget to install mise..." -ForegroundColor Cyan
        winget install jdx.mise
    }
    # Try scoop second
    elseif (Get-Command scoop -ErrorAction SilentlyContinue) {
        Write-Host "Using scoop to install mise..." -ForegroundColor Cyan
        scoop install mise
    }
    # Try chocolatey third
    elseif (Get-Command choco -ErrorAction SilentlyContinue) {
        Write-Host "Using chocolatey to install mise..." -ForegroundColor Cyan
        choco install mise
    }
    # No package manager found
    else {
        Write-Host "❌ Error: No supported package manager found!" -ForegroundColor Red
        Write-Host "Please install one of the following:" -ForegroundColor Yellow
        Write-Host "  - winget (comes with Windows 10+)" -ForegroundColor Cyan
        Write-Host "  - scoop: https://scoop.sh" -ForegroundColor Cyan
        Write-Host "  - chocolatey: https://chocolatey.org" -ForegroundColor Cyan
        exit 1
    }

    # Refresh PATH
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
} else {
    Write-Host "✅ mise is already installed" -ForegroundColor Green
}

# Trust mise configuration
Write-Host "🔐 Trusting mise configuration..." -ForegroundColor Yellow
mise trust

# Install development tools
Write-Host "🔧 Installing development tools (Node.js, pnpm, lefthook, ls-lint)..." -ForegroundColor Yellow
mise install

# Install Node.js dependencies
Write-Host "📚 Installing Node.js dependencies..." -ForegroundColor Yellow
pnpm install

# Setup git hooks with lefthook
Write-Host "🪝 Setting up git hooks with lefthook..." -ForegroundColor Yellow
lefthook install

Write-Host ""
Write-Host "🎉 Setup complete! DevFlow MCP is ready for development." -ForegroundColor Green
Write-Host ""
Write-Host "Available commands:" -ForegroundColor Cyan
Write-Host "  pnpm test        # Run tests" -ForegroundColor White
Write-Host "  pnpm run lint    # Run linter" -ForegroundColor White
Write-Host "  pnpm run format  # Format code" -ForegroundColor White
Write-Host "  pnpm run build   # Build the project" -ForegroundColor White
Write-Host ""
Write-Host "Git hooks are now active via lefthook." -ForegroundColor Green
