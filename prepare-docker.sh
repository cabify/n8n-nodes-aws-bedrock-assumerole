#!/bin/bash

# Script to prepare the node for Docker testing

set -e

echo "🔧 Preparing n8n node for Docker testing..."

# Build the project
echo "📦 Building TypeScript..."
npm run build

# Create package.json in dist directory for n8n to recognize the node
echo "📄 Creating package.json in dist directory..."
cat > dist/package.json << 'EOF'
{
  "name": "n8n-nodes-aws-bedrock-assumerole",
  "version": "1.0.0",
  "description": "n8n node for AWS Bedrock with AssumeRole authentication",
  "main": "index.js",
  "n8n": {
    "n8nNodesApiVersion": 1,
    "credentials": [
      "credentials/AwsAssumeRole.credentials.js"
    ],
    "nodes": [
      "nodes/AwsBedrockAssumeRole.node.js"
    ]
  },
  "dependencies": {
    "@aws-sdk/client-sts": "^3.0.0",
    "@aws-sdk/client-bedrock-runtime": "^3.0.0"
  }
}
EOF

echo "✅ Node prepared for Docker testing!"
echo ""
echo "🚀 Next steps:"
echo "1. Copy .env.docker to .env and fill in your AWS credentials"
echo "2. Run: docker-compose up --build"
echo "3. Open http://localhost:5678 (admin/admin)"
echo "4. Look for 'AWS Bedrock (AssumeRole)' node"
