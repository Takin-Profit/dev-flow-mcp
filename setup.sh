#!/bin/bash
set -e

echo "🚀 Setting up DevFlow MCP development environment..."

# Check if mise is installed
if ! command -v mise &> /dev/null; then
    echo "📦 Installing mise..."

    # Detect OS
    OS=$(uname -s)

    case "$OS" in
        "Darwin")
            # macOS - try homebrew
            if command -v brew &> /dev/null; then
                echo "Using homebrew to install mise..."
                brew install mise
            else
                echo "Using curl installer..."
                curl https://mise.run | sh
                export PATH="$HOME/.local/share/mise/bin:$PATH"
            fi
            ;;
        "Linux")
            # Linux - detect distribution and try package managers
            if [ -f /etc/os-release ]; then
                . /etc/os-release
                case "$ID" in
                    "ubuntu"|"debian")
                        if command -v apt &> /dev/null; then
                            echo "Using apt to install mise..."
                            sudo apt update && sudo apt install -y mise
                        else
                            echo "Using curl installer..."
                            curl https://mise.run | sh
                            export PATH="$HOME/.local/share/mise/bin:$PATH"
                        fi
                        ;;
                    "fedora"|"rhel"|"centos")
                        if command -v dnf &> /dev/null; then
                            echo "Using dnf to install mise..."
                            sudo dnf install -y mise
                        elif command -v yum &> /dev/null; then
                            echo "Using yum to install mise..."
                            sudo yum install -y mise
                        else
                            echo "Using curl installer..."
                            curl https://mise.run | sh
                            export PATH="$HOME/.local/share/mise/bin:$PATH"
                        fi
                        ;;
                    "arch")
                        if command -v pacman &> /dev/null; then
                            echo "Using pacman to install mise..."
                            sudo pacman -S mise
                        else
                            echo "Using curl installer..."
                            curl https://mise.run | sh
                            export PATH="$HOME/.local/share/mise/bin:$PATH"
                        fi
                        ;;
                    *)
                        echo "Using curl installer..."
                        curl https://mise.run | sh
                        export PATH="$HOME/.local/share/mise/bin:$PATH"
                        ;;
                esac
            else
                echo "Using curl installer..."
                curl https://mise.run | sh
                export PATH="$HOME/.local/share/mise/bin:$PATH"
            fi
            ;;
        *)
            echo "Using curl installer..."
            curl https://mise.run | sh
            export PATH="$HOME/.local/share/mise/bin:$PATH"
            ;;
    esac

    # Add to shell profiles if using curl installer
    if [[ "$PATH" == *".local/share/mise/bin"* ]]; then
        echo 'export PATH="$HOME/.local/share/mise/bin:$PATH"' >> ~/.bashrc 2>/dev/null || true
        echo 'export PATH="$HOME/.local/share/mise/bin:$PATH"' >> ~/.zshrc 2>/dev/null || true
    fi
else
    echo "✅ mise is already installed"
fi

# Trust mise configuration
echo "🔐 Trusting mise configuration..."
mise trust

# Install development tools
echo "🔧 Installing development tools (Node.js, pnpm, lefthook, ls-lint)..."
mise install

# Install Node.js dependencies
echo "📚 Installing Node.js dependencies..."
pnpm install

# Setup git hooks with lefthook
echo "🪝 Setting up git hooks with lefthook..."
lefthook install

echo ""
echo "🎉 Setup complete! DevFlow MCP is ready for development."
echo ""
echo "Available commands:"
echo "  pnpm test        # Run tests"
echo "  pnpm run lint    # Run linter"
echo "  pnpm run format  # Format code"
echo "  pnpm run build   # Build the project"
echo ""
echo "Git hooks are now active via lefthook."
