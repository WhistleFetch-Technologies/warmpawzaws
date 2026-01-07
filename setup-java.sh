#!/bin/bash

# Java 17 Setup Script for macOS
# This script installs JDK 17 and configures it for the Warmpawz project

set -e

echo "🔧 Java 17 Setup for Warmpawz Project"
echo "======================================"
echo ""

# Check if Java 17 is already installed
check_java() {
    if command -v java &> /dev/null; then
        JAVA_VERSION=$(java -version 2>&1 | head -n 1 | awk -F '"' '{print $2}' | cut -d'.' -f1)
        if [ "$JAVA_VERSION" -ge 17 ] 2>/dev/null; then
            JAVA_HOME_PATH=$(/usr/libexec/java_home -v 17 2>/dev/null || echo "")
            if [ -n "$JAVA_HOME_PATH" ]; then
                echo "✅ Java 17+ is already installed at: $JAVA_HOME_PATH"
                echo "$JAVA_HOME_PATH"
                return 0
            fi
        fi
    fi
    return 1
}

# Try to find existing Java installation
if JAVA_PATH=$(check_java); then
    echo "Using existing Java installation: $JAVA_PATH"
    export JAVA_HOME="$JAVA_PATH"
else
    echo "❌ Java 17 not found. Installing..."
    echo ""
    
    # Method 1: Try Homebrew (if available)
    if command -v brew &> /dev/null; then
        echo "📦 Installing Java 17 via Homebrew..."
        brew install openjdk@17
        
        # Create symlink for system Java
        sudo ln -sfn /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-17.jdk 2>/dev/null || \
        sudo ln -sfn /usr/local/opt/openjdk@17/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-17.jdk 2>/dev/null || true
        
        JAVA_HOME_PATH=$(/usr/libexec/java_home -v 17 2>/dev/null || echo "/opt/homebrew/opt/openjdk@17")
        export JAVA_HOME="$JAVA_HOME_PATH"
        echo "✅ Java 17 installed via Homebrew"
        
    # Method 2: Try SDKMAN (install if not present)
    elif [ -d "$HOME/.sdkman" ] || command -v sdk &> /dev/null; then
        echo "📦 Installing Java 17 via SDKMAN..."
        if ! command -v sdk &> /dev/null; then
            echo "Installing SDKMAN..."
            curl -s "https://get.sdkman.io" | bash
            source "$HOME/.sdkman/bin/sdkman-init.sh"
        fi
        sdk install java 17.0.2-tem
        JAVA_HOME_PATH="$HOME/.sdkman/candidates/java/current"
        export JAVA_HOME="$JAVA_HOME_PATH"
        echo "✅ Java 17 installed via SDKMAN"
        
    # Method 3: Direct download (manual instructions)
    else
        echo "⚠️  Automatic installation methods not available."
        echo ""
        echo "Please install Java 17 manually using one of these methods:"
        echo ""
        echo "Option 1: Install Homebrew first, then run this script again:"
        echo "  /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
        echo ""
        echo "Option 2: Download and install from Adoptium (Eclipse Temurin):"
        echo "  1. Visit: https://adoptium.net/temurin/releases/?version=17"
        echo "  2. Download: macOS .pkg installer (x64 or ARM64 based on your Mac)"
        echo "  3. Install the downloaded .pkg file"
        echo "  4. Run this script again to configure"
        echo ""
        echo "Option 3: Install SDKMAN, then run this script again:"
        echo "  curl -s \"https://get.sdkman.io\" | bash"
        echo "  source \"\$HOME/.sdkman/bin/sdkman-init.sh\""
        echo ""
        exit 1
    fi
fi

# Verify installation
if [ -z "$JAVA_HOME" ]; then
    JAVA_HOME=$(/usr/libexec/java_home -v 17 2>/dev/null || echo "")
fi

if [ -z "$JAVA_HOME" ]; then
    echo "❌ Failed to find Java 17 installation"
    exit 1
fi

# Verify Java version
JAVA_VERSION_OUTPUT=$(java -version 2>&1 | head -n 1)
echo ""
echo "✅ Java Installation Complete!"
echo "   Java Home: $JAVA_HOME"
echo "   Version: $JAVA_VERSION_OUTPUT"
echo ""

# Update VS Code settings
VSCODE_SETTINGS=".vscode/settings.json"
if [ -f "$VSCODE_SETTINGS" ]; then
    echo "📝 Updating VS Code settings..."
    
    # Create backup
    cp "$VSCODE_SETTINGS" "$VSCODE_SETTINGS.bak"
    
    # Update settings with Java home
    cat > "$VSCODE_SETTINGS" << EOF
{
  "java.jdt.ls.java.home": "$JAVA_HOME",
  "java.configuration.runtimes": [
    {
      "name": "JavaSE-17",
      "path": "$JAVA_HOME",
      "default": true
    }
  ],
  "java.compile.nullAnalysis.mode": "automatic",
  "java.configuration.updateBuildConfiguration": "automatic"
}
EOF
    
    echo "✅ VS Code settings updated"
    echo "   Java home configured: $JAVA_HOME"
else
    echo "⚠️  VS Code settings file not found. Creating it..."
    mkdir -p .vscode
    cat > "$VSCODE_SETTINGS" << EOF
{
  "java.jdt.ls.java.home": "$JAVA_HOME",
  "java.configuration.runtimes": [
    {
      "name": "JavaSE-17",
      "path": "$JAVA_HOME",
      "default": true
    }
  ],
  "java.compile.nullAnalysis.mode": "automatic",
  "java.configuration.updateBuildConfiguration": "automatic"
}
EOF
    echo "✅ VS Code settings created"
fi

# Update shell profile
SHELL_PROFILE=""
if [ -f "$HOME/.zshrc" ]; then
    SHELL_PROFILE="$HOME/.zshrc"
elif [ -f "$HOME/.bash_profile" ]; then
    SHELL_PROFILE="$HOME/.bash_profile"
elif [ -f "$HOME/.bashrc" ]; then
    SHELL_PROFILE="$HOME/.bashrc"
fi

if [ -n "$SHELL_PROFILE" ]; then
    if ! grep -q "JAVA_HOME.*17" "$SHELL_PROFILE" 2>/dev/null; then
        echo ""
        echo "📝 Adding JAVA_HOME to $SHELL_PROFILE..."
        cat >> "$SHELL_PROFILE" << EOF

# Java 17 Configuration (added by Warmpawz setup script)
export JAVA_HOME="$JAVA_HOME"
export PATH="\$JAVA_HOME/bin:\$PATH"
EOF
        echo "✅ JAVA_HOME added to shell profile"
        echo "   Please run: source $SHELL_PROFILE"
    else
        echo "✅ JAVA_HOME already configured in shell profile"
    fi
fi

echo ""
echo "🎉 Setup Complete!"
echo ""
echo "Next steps:"
echo "1. Restart VS Code/Cursor to apply settings"
echo "2. If you updated your shell profile, run: source $SHELL_PROFILE"
echo "3. Verify Java is working: java -version"
echo ""

