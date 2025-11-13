#!/opt/homebrew/bin/bash

# Script to publish the package to npm
# This script handles version bumping, changelog updates, and npm publishing

set -e

echo "📦 Publishing n8n-nodes-aws-bedrock-assumerole to npm..."
echo ""

# Check if we're on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "⚠️  You're not on the main branch. Current branch: $CURRENT_BRANCH"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Operation cancelled"
        exit 1
    fi
fi

# Check for uncommitted changes
if [[ -n $(git status -s) ]]; then
    echo "⚠️  You have uncommitted changes:"
    git status -s
    echo ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Operation cancelled"
        exit 1
    fi
fi

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "📌 Current version: $CURRENT_VERSION"
echo ""

# Ask for version bump type
echo "Select version bump type:"
echo "  1) patch (1.0.2 -> 1.0.3) - Bug fixes"
echo "  2) minor (1.0.2 -> 1.1.0) - New features (backwards compatible)"
echo "  3) major (1.0.2 -> 2.0.0) - Breaking changes"
echo "  4) custom - Specify version manually"
echo ""
read -p "Enter choice [1-4]: " VERSION_CHOICE

case $VERSION_CHOICE in
    1)
        VERSION_TYPE="patch"
        ;;
    2)
        VERSION_TYPE="minor"
        ;;
    3)
        VERSION_TYPE="major"
        ;;
    4)
        read -p "Enter new version (e.g., 1.2.3): " NEW_VERSION
        VERSION_TYPE="custom"
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

# Bump version
if [ "$VERSION_TYPE" = "custom" ]; then
    npm version $NEW_VERSION --no-git-tag-version
else
    npm version $VERSION_TYPE --no-git-tag-version
fi

NEW_VERSION=$(node -p "require('./package.json').version")
echo ""
echo "✅ Version bumped: $CURRENT_VERSION -> $NEW_VERSION"
echo ""

# Ask for changelog entry
echo "📝 Enter changelog information:"
echo ""
echo "What type of changes are included? (select all that apply, comma-separated)"
echo "  1) Added - New features"
echo "  2) Changed - Changes in existing functionality"
echo "  3) Deprecated - Soon-to-be removed features"
echo "  4) Removed - Removed features"
echo "  5) Fixed - Bug fixes"
echo "  6) Security - Security fixes"
echo ""
read -p "Enter choices (e.g., 1,5): " CHANGE_TYPES

# Convert choices to section names
declare -a SECTIONS
IFS=',' read -ra CHOICES <<< "$CHANGE_TYPES"
for choice in "${CHOICES[@]}"; do
    choice=$(echo $choice | xargs) # trim whitespace
    case $choice in
        1) SECTIONS+=("Added") ;;
        2) SECTIONS+=("Changed") ;;
        3) SECTIONS+=("Deprecated") ;;
        4) SECTIONS+=("Removed") ;;
        5) SECTIONS+=("Fixed") ;;
        6) SECTIONS+=("Security") ;;
    esac
done

# Collect changelog entries for each section
declare -A CHANGELOG_ENTRIES
for section in "${SECTIONS[@]}"; do
    echo ""
    echo "Enter changes for [$section] (one per line, empty line to finish):"
    entries=()
    while IFS= read -r line; do
        [[ -z "$line" ]] && break
        entries+=("$line")
    done
    CHANGELOG_ENTRIES[$section]="${entries[@]}"
done

# Generate changelog entry
CHANGELOG_DATE=$(date +%Y-%m-%d)
CHANGELOG_ENTRY="## [$NEW_VERSION] - $CHANGELOG_DATE\n"

for section in "${SECTIONS[@]}"; do
    CHANGELOG_ENTRY+="\n### $section\n"
    IFS=$'\n' read -rd '' -a entries <<< "${CHANGELOG_ENTRIES[$section]}" || true
    for entry in "${entries[@]}"; do
        [[ -n "$entry" ]] && CHANGELOG_ENTRY+="- $entry\n"
    done
done

# Update CHANGELOG.md
echo ""
echo "📄 Updating CHANGELOG.md..."

# Create temporary file with new entry
{
    echo -e "# Changelog\n"
    echo -e "All notable changes to this project will be documented in this file.\n"
    echo -e "The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),"
    echo -e "and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).\n"
    echo -e "$CHANGELOG_ENTRY"
    tail -n +7 CHANGELOG.md
} > CHANGELOG.md.tmp

mv CHANGELOG.md.tmp CHANGELOG.md

echo "✅ CHANGELOG.md updated"
echo ""

# Show what will be published
echo "📋 Summary of changes:"
echo "  Version: $CURRENT_VERSION -> $NEW_VERSION"
echo "  Changelog updated with new entry"
echo ""

# Build the project
echo "🔨 Building project..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo "✅ Build successful"
echo ""

# Confirm before publishing
echo "⚠️  Ready to publish to npm"
echo ""
read -p "Proceed with npm publish? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Publish cancelled"
    echo "💡 Changes have been made to package.json and CHANGELOG.md"
    echo "   You can commit them manually or revert with: git checkout package.json CHANGELOG.md"
    exit 1
fi

# Publish to npm
echo ""
echo "📤 Publishing to npm..."
npm publish --access public

if [ $? -ne 0 ]; then
    echo "❌ npm publish failed"
    exit 1
fi

echo ""
echo "✅ Successfully published to npm!"
echo ""

# Commit changes
echo "💾 Committing version bump and changelog..."
git add package.json package-lock.json CHANGELOG.md
git commit -m "chore: release v$NEW_VERSION"

echo "✅ Changes committed"
echo ""

# Create git tag
echo "🏷️  Creating git tag v$NEW_VERSION..."
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"

echo "✅ Tag created"
echo ""

echo "🎉 Release complete!"
echo ""
echo "📍 Next steps:"
echo "   1. Push changes: git push"
echo "   2. Push tag: git push --tags"
echo "   3. Or use: make sync (to sync all repos)"
echo ""
echo "📦 Package published: https://www.npmjs.com/package/n8n-nodes-aws-bedrock-assumerole"

