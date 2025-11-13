#!/bin/bash

# Script to pull from both repositories (GitHub and GitLab)

set -e

echo "🔄 Pulling from both repositories..."
echo ""

# Get current branch name
CURRENT_BRANCH=$(git branch --show-current)

if [ -z "$CURRENT_BRANCH" ]; then
    echo "❌ Error: Not on a branch (detached HEAD?)"
    exit 1
fi

echo "📍 Current branch: $CURRENT_BRANCH"
echo ""

# Check if there are uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  Warning: You have uncommitted changes"
    git status --short
    echo ""
    read -p "Do you want to stash changes and continue? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "📦 Stashing changes..."
        git stash push -m "Auto-stash before pull-all at $(date)"
        STASHED=true
    else
        echo "❌ Operation cancelled"
        exit 1
    fi
fi

# Fetch from both remotes
echo "📥 Fetching from GitHub..."
if git fetch github; then
    echo "✅ GitHub fetch successful"
else
    echo "⚠️  Warning: Failed to fetch from GitHub"
fi

echo ""

echo "📥 Fetching from GitLab..."
if git fetch gitlab; then
    echo "✅ GitLab fetch successful"
else
    echo "⚠️  Warning: Failed to fetch from GitLab"
fi

echo ""

# Pull from GitHub (primary)
echo "🐙 Pulling from GitHub..."
if git pull github "$CURRENT_BRANCH" --no-rebase 2>&1; then
    echo "✅ GitHub pull successful"
else
    echo "⚠️  No changes from GitHub or branch doesn't exist on remote"
fi

echo ""

# Pull from GitLab
echo "🦊 Pulling from GitLab..."
if git pull gitlab "$CURRENT_BRANCH" --no-rebase 2>&1; then
    echo "✅ GitLab pull successful"
else
    echo "⚠️  No changes from GitLab or branch doesn't exist on remote"
fi

echo ""

# Restore stashed changes if any
if [ "$STASHED" = true ]; then
    echo "📦 Restoring stashed changes..."
    if git stash pop; then
        echo "✅ Stashed changes restored"
    else
        echo "⚠️  Warning: Could not restore stashed changes automatically"
        echo "💡 Run 'git stash list' to see your stashed changes"
        echo "💡 Run 'git stash pop' to restore them manually"
    fi
    echo ""
fi

echo "🎉 Pull from both repositories complete!"
echo ""

# Show current status
echo "📊 Current status:"
git status --short
if [ -z "$(git status --short)" ]; then
    echo "   Working tree clean ✨"
fi
echo ""

