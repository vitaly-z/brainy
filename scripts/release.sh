#!/bin/bash
set -e  # Exit on error

# Brainy Release Script
# Simple, reliable release workflow: build → test → commit → push → publish → release

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
RELEASE_TYPE="${1:-patch}"  # patch, minor, or major
SKIP_TESTS=false
DRY_RUN=false

for arg in "$@"; do
  case $arg in
    --skip-tests)
      SKIP_TESTS=true
      ;;
    --dry-run)
      DRY_RUN=true
      ;;
  esac
done

echo -e "${BLUE}🚀 Brainy Release Script${NC}"
echo -e "${BLUE}Release type: ${RELEASE_TYPE}${NC}\n"

if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}⚠️  DRY RUN MODE - No changes will be made${NC}\n"
fi

if [ "$SKIP_TESTS" = true ]; then
  echo -e "${YELLOW}⚠️  SKIPPING TESTS - Use with caution!${NC}\n"
fi

# Step 1: Verify clean git state
echo -e "${BLUE}1️⃣  Checking git status...${NC}"
if [ -n "$(git status --porcelain)" ]; then
  echo -e "${RED}❌ Working directory not clean. Commit or stash changes first.${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Working directory clean${NC}\n"

# Step 2: Build
echo -e "${BLUE}2️⃣  Building project...${NC}"
if [ "$DRY_RUN" = false ]; then
  npm run build
fi
echo -e "${GREEN}✅ Build successful${NC}\n"

# Step 3: Test
if [ "$SKIP_TESTS" = false ]; then
  echo -e "${BLUE}3️⃣  Running tests...${NC}"
  if [ "$DRY_RUN" = false ]; then
    npm test
  fi
  echo -e "${GREEN}✅ Tests passed${NC}\n"
else
  echo -e "${YELLOW}3️⃣  Skipping tests...${NC}\n"
fi

# Step 4: Get current and new version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo -e "${BLUE}Current version: ${CURRENT_VERSION}${NC}"

# Calculate new version
IFS='.' read -r -a VERSION_PARTS <<< "$CURRENT_VERSION"
MAJOR="${VERSION_PARTS[0]}"
MINOR="${VERSION_PARTS[1]}"
PATCH="${VERSION_PARTS[2]}"

case $RELEASE_TYPE in
  major)
    NEW_VERSION="$((MAJOR + 1)).0.0"
    ;;
  minor)
    NEW_VERSION="${MAJOR}.$((MINOR + 1)).0"
    ;;
  patch)
    NEW_VERSION="${MAJOR}.${MINOR}.$((PATCH + 1))"
    ;;
  *)
    echo -e "${RED}❌ Invalid release type: ${RELEASE_TYPE}${NC}"
    echo "Usage: ./scripts/release.sh [patch|minor|major] [--dry-run]"
    exit 1
    ;;
esac

echo -e "${BLUE}New version: ${NEW_VERSION}${NC}\n"

if [ "$DRY_RUN" = true ]; then
  echo -e "${YELLOW}DRY RUN: Would release version ${NEW_VERSION}${NC}"
  exit 0
fi

# Step 5: Bump version in package files
echo -e "${BLUE}4️⃣  Bumping version to ${NEW_VERSION}...${NC}"
npm version $NEW_VERSION --no-git-tag-version
echo -e "${GREEN}✅ Version bumped${NC}\n"

# Step 6: Update CHANGELOG
echo -e "${BLUE}5️⃣  Updating CHANGELOG...${NC}"
# Get commits since last tag
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
if [ -z "$LAST_TAG" ]; then
  COMMITS=$(git log --oneline --pretty=format:"- %s (%h)")
else
  COMMITS=$(git log ${LAST_TAG}..HEAD --oneline --pretty=format:"- %s (%h)")
fi

# Create new changelog entry
CHANGELOG_ENTRY="### [${NEW_VERSION}](https://github.com/soulcraftlabs/brainy/compare/v${CURRENT_VERSION}...v${NEW_VERSION}) ($(date +%Y-%m-%d))

${COMMITS}
"

# Prepend to CHANGELOG.md after header
if [ -f "CHANGELOG.md" ]; then
  # Read header (first 4 lines)
  HEADER=$(head -n 4 CHANGELOG.md)
  # Read rest of file
  REST=$(tail -n +5 CHANGELOG.md)
  # Write new CHANGELOG
  echo "$HEADER" > CHANGELOG.md
  echo "" >> CHANGELOG.md
  echo "$CHANGELOG_ENTRY" >> CHANGELOG.md
  echo "" >> CHANGELOG.md
  echo "$REST" >> CHANGELOG.md
fi
echo -e "${GREEN}✅ CHANGELOG updated${NC}\n"

# Step 7: Create release commit
echo -e "${BLUE}6️⃣  Creating release commit...${NC}"
git add package.json package-lock.json CHANGELOG.md
git commit -m "chore(release): ${NEW_VERSION}"
echo -e "${GREEN}✅ Release commit created${NC}\n"

# Step 8: Create git tag
echo -e "${BLUE}7️⃣  Creating git tag v${NEW_VERSION}...${NC}"
git tag "v${NEW_VERSION}"
echo -e "${GREEN}✅ Tag created${NC}\n"

# Step 9: Push to GitHub
echo -e "${BLUE}8️⃣  Pushing to GitHub...${NC}"
git push --follow-tags origin main
echo -e "${GREEN}✅ Pushed to GitHub${NC}\n"

# Step 10: Publish to npm
echo -e "${BLUE}9️⃣  Publishing to npm...${NC}"
npm publish
echo -e "${GREEN}✅ Published to npm${NC}\n"

# Step 11: Create GitHub release
echo -e "${BLUE}🔟 Creating GitHub release...${NC}"
gh release create "v${NEW_VERSION}" --generate-notes
echo -e "${GREEN}✅ GitHub release created${NC}\n"

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 Release ${NEW_VERSION} complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "📦 npm: ${BLUE}https://www.npmjs.com/package/@soulcraft/brainy/v/${NEW_VERSION}${NC}"
echo -e "🐙 GitHub: ${BLUE}https://github.com/soulcraftlabs/brainy/releases/tag/v${NEW_VERSION}${NC}"
