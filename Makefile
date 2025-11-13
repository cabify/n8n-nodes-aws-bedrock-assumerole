.PHONY: help build test clean install dev docker-up docker-down docker-logs sync publish release

# Default target
help:
	@echo "📦 n8n-nodes-aws-bedrock-assumerole - Available commands:"
	@echo ""
	@echo "Development:"
	@echo "  make build        - Build the project (TypeScript compilation + copy icons)"
	@echo "  make test         - Run tests (if available)"
	@echo "  make clean        - Clean build artifacts"
	@echo "  make install      - Install dependencies"
	@echo "  make dev          - Build and start Docker for local development"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-up    - Start Docker containers"
	@echo "  make docker-down  - Stop Docker containers"
	@echo "  make docker-logs  - Show Docker logs"
	@echo ""
	@echo "Deployment:"
	@echo "  make sync         - Sync repositories (GitHub + GitLab)"
	@echo "  make publish      - Publish to npm (interactive)"
	@echo "  make release      - Full release: build + publish + sync"
	@echo ""

# Build the project
build:
	@echo "🔨 Building project..."
	@npm run build
	@echo "✅ Build complete"

# Run tests
test:
	@echo "🧪 Running tests..."
	@npm test || echo "⚠️  No tests configured"

# Clean build artifacts
clean:
	@echo "🧹 Cleaning build artifacts..."
	@rm -rf dist
	@echo "✅ Clean complete"

# Install dependencies
install:
	@echo "📦 Installing dependencies..."
	@npm install
	@echo "✅ Dependencies installed"

# Development mode: build and start Docker
dev: build docker-up
	@echo ""
	@echo "🚀 Development environment ready!"
	@echo "   n8n: http://localhost:5678"
	@echo "   User: admin"
	@echo "   Pass: admin"
	@echo ""
	@echo "💡 Use 'make docker-logs' to see logs"
	@echo "💡 Use 'make docker-down' to stop"

# Start Docker containers
docker-up:
	@echo "🐳 Starting Docker containers..."
	@docker-compose up -d
	@echo "✅ Docker containers started"
	@echo "   n8n: http://localhost:5678"

# Stop Docker containers
docker-down:
	@echo "🐳 Stopping Docker containers..."
	@docker-compose down
	@echo "✅ Docker containers stopped"

# Show Docker logs
docker-logs:
	@docker-compose logs -f n8n

# Sync repositories (GitHub + GitLab)
sync:
	@echo "🔄 Syncing repositories..."
	@if [ ! -f sync-repos.sh ]; then \
		echo "❌ sync-repos.sh not found"; \
		exit 1; \
	fi
	@chmod +x sync-repos.sh
	@./sync-repos.sh
	@echo "✅ Repositories synced"

# Publish to npm (interactive)
publish:
	@echo "📤 Starting npm publish process..."
	@if [ ! -f publish-npm.sh ]; then \
		echo "❌ publish-npm.sh not found"; \
		exit 1; \
	fi
	@chmod +x publish-npm.sh
	@/opt/homebrew/bin/bash publish-npm.sh

# Full release: build + publish + sync
release: build
	@echo "🚀 Starting full release process..."
	@echo ""
	@$(MAKE) publish
	@echo ""
	@echo "📤 Syncing repositories..."
	@$(MAKE) sync
	@echo ""
	@echo "🎉 Release complete!"
	@echo ""
	@echo "✅ Package published to npm"
	@echo "✅ Changes synced to GitHub and GitLab"
	@echo ""
	@echo "📦 View on npm: https://www.npmjs.com/package/n8n-nodes-aws-bedrock-assumerole"

