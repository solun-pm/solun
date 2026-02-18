#!/usr/bin/env bash
# Usage:
#   ./scripts/release.sh patch          → 0.0.1 → 0.0.2        (tag: v0.0.2)
#   ./scripts/release.sh minor          → 0.0.1 → 0.1.0        (tag: v0.1.0)
#   ./scripts/release.sh major          → 0.0.1 → 1.0.0        (tag: v1.0.0)
#   ./scripts/release.sh patch --dev    → 0.0.1 → 0.0.2-dev.1  (tag: v0.0.2-dev.1)
#   ./scripts/release.sh minor --dev    → 0.0.1 → 0.1.0-dev.1  (tag: v0.1.0-dev.1)

set -euo pipefail

BUMP="${1:-patch}"
DEV=false

for arg in "$@"; do
  [[ "$arg" == "--dev" ]] && DEV=true
done

if [[ "$BUMP" != "patch" && "$BUMP" != "minor" && "$BUMP" != "major" ]]; then
  echo "Usage: $0 [patch|minor|major] [--dev]"
  exit 1
fi

# Read current version from root-adjacent api package.json (source of truth)
CURRENT=$(node -p "require('./apps/api/package.json').version")

# Split into parts
IFS='.' read -r MAJOR MINOR PATCH <<< "${CURRENT%%-*}"

case "$BUMP" in
  major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  patch) PATCH=$((PATCH + 1)) ;;
esac

BASE="$MAJOR.$MINOR.$PATCH"

if [[ "$DEV" == true ]]; then
  VERSION="$BASE-dev.1"
else
  VERSION="$BASE"
fi

TAG="v$VERSION"

echo "Bumping $CURRENT → $VERSION"

# Update all package.json files
for PKG in package.json apps/api/package.json apps/web/package.json packages/shared/package.json; do
  if [[ -f "$PKG" ]]; then
    node -e "
      const fs = require('fs');
      const pkg = JSON.parse(fs.readFileSync('$PKG', 'utf8'));
      if (pkg.version !== undefined) pkg.version = '$VERSION';
      fs.writeFileSync('$PKG', JSON.stringify(pkg, null, 2) + '\n');
    "
    echo "  ✓ $PKG"
  fi
done

# Commit + tag
git add package.json apps/api/package.json apps/web/package.json packages/shared/package.json
git commit -m "chore: release $TAG"
git tag "$TAG"

echo ""
echo "Created commit + tag $TAG"
echo "Push with: git push origin main --tags"
echo "      or: git push origin dev --tags"
