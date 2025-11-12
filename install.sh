#!/bin/bash

# n8n-nodes-aws-bedrock-assumerole Installation Script
# This script helps install the AWS Bedrock node for n8n

set -e

echo "🚀 Installing n8n-nodes-aws-bedrock-assumerole..."

# Check if n8n is installed
if ! command -v n8n &> /dev/null; then
    echo "❌ n8n is not installed or not in PATH"
    echo "Please install n8n first: npm install -g n8n"
    exit 1
fi

# Determine n8n custom directory
N8N_CUSTOM_DIR="$HOME/.n8n/custom"

# Create custom directory if it doesn't exist
if [ ! -d "$N8N_CUSTOM_DIR" ]; then
    echo "📁 Creating n8n custom directory: $N8N_CUSTOM_DIR"
    mkdir -p "$N8N_CUSTOM_DIR"
    cd "$N8N_CUSTOM_DIR"
    npm init -y
fi

cd "$N8N_CUSTOM_DIR"

# Install the package
echo "📦 Installing n8n-nodes-aws-bedrock-assumerole..."
npm install n8n-nodes-aws-bedrock-assumerole

echo "✅ Installation complete!"
echo ""
echo "📋 Next steps:"
echo "1. Restart your n8n instance"
echo "2. Create AWS AssumeRole credentials in n8n"
echo "3. Add the 'AWS Bedrock (AssumeRole)' node to your workflows"
echo ""
echo "📖 For detailed setup instructions, see:"
echo "   https://github.com/cabify/n8n-nodes-aws-bedrock-assumerole#readme"
echo ""
echo "🎉 Happy automating!"
