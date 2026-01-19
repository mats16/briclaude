#!/bin/bash
set -e

# Skip on non-Linux systems (for local development on macOS)
if [ "$(uname)" != "Linux" ]; then
    echo "Skipping jq installation on $(uname)"
    exit 0
fi

TARGET="$HOME/bin"

echo "Creating bin directory: $TARGET"
mkdir -p "$TARGET"

# Install databricks-cli
if [ ! -f "$TARGET/databricks" ]; then
    echo "Installing databricks-cli..."
    curl -fsSL https://raw.githubusercontent.com/databricks/setup-cli/main/install.sh | DATABRICKS_RUNTIME_VERSION=1 sh
else
    echo "databricks-cli already installed"
fi

# Install jq
JQ_VERSION="1.7.1"
if [ ! -f "$TARGET/jq" ]; then
    echo "Installing jq..."
    curl -sSL "https://github.com/jqlang/jq/releases/download/jq-${JQ_VERSION}/jq-linux-amd64" -o "$TARGET/jq"
    chmod +x "$TARGET/jq"
    echo "jq installed to $TARGET/jq"
else
    echo "jq already installed"
fi
