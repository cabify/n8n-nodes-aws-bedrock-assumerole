#!/bin/bash

# Script to push current branch to both repositories and create MR/PR

set -e

echo "🚀 Pushing branch to both repositories..."
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
    read -p "Do you want to continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Operation cancelled"
        exit 1
    fi
fi

# Push to GitLab
echo "🦊 Pushing to GitLab..."
if git push gitlab "$CURRENT_BRANCH" 2>&1; then
    echo "✅ GitLab push successful"
    
    # Extract GitLab MR URL from git output if available
    GITLAB_MR_URL="https://gitlab.otters.xyz/platform/business-automation/n8n-nodes-aws-bedrock-assumerole/-/merge_requests/new?merge_request%5Bsource_branch%5D=$(echo $CURRENT_BRANCH | sed 's/\//%2F/g')"
    echo "📝 Create GitLab MR: $GITLAB_MR_URL"
else
    echo "❌ Failed to push to GitLab"
    exit 1
fi

echo ""

# Push to GitHub
echo "🐙 Pushing to GitHub..."
if git push github "$CURRENT_BRANCH" 2>&1; then
    echo "✅ GitHub push successful"
    
    # Extract GitHub PR URL
    GITHUB_PR_URL="https://github.com/cabify/n8n-nodes-aws-bedrock-assumerole/pull/new/$CURRENT_BRANCH"
    echo "📝 Create GitHub PR: $GITHUB_PR_URL"
else
    echo "❌ Failed to push to GitHub"
    exit 1
fi

echo ""
echo "🎉 Branch pushed to both repositories!"
echo ""
echo "📍 Next steps:"
echo "   1. Create Merge Request on GitLab:"
echo "      $GITLAB_MR_URL"
echo ""
echo "   2. Create Pull Request on GitHub:"
echo "      $GITHUB_PR_URL"
echo ""

