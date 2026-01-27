# Brainy Release Guide

## Standard Semantic Versioning (Industry Guidelines)

### Official SemVer 2.0.0 says:
- **MAJOR**: Incompatible API changes (breaking changes)
- **MINOR**: Add functionality in backwards compatible manner
- **PATCH**: Backwards compatible bug fixes

## Our Approach for Brainy (More Conservative)

### We intentionally diverge from strict SemVer:
- **PATCH (2.3.0 → 2.3.1)**: Bug fixes, internal improvements, dependency updates
- **MINOR (2.3.0 → 2.4.0)**: New features, API changes, enhancements
- **MAJOR (3.0.0)**: Reserved for strategic platform shifts (manual decision)

### Why We Do This:
1. **User Trust**: Major versions signal huge changes and scare users
2. **Adoption**: People hesitate to upgrade major versions
3. **Flexibility**: We can evolve the API without version explosion
4. **Industry Practice**: Many successful projects (React, Vue) do this

## CRITICAL: Never Use "BREAKING CHANGE" 

**"BREAKING CHANGE" in commits = Automatic major version = BAD!**
- Even if removing methods, just use `feat:` or `refactor:`
- Major versions are MANUAL decisions: `npm run release:major`
- Most API changes can be handled gracefully in minor versions

## Commit Message Guidelines

### ✅ CORRECT Examples:
```bash
# New features → MINOR bump
git commit -m "feat: add new model delivery system"

# Bug fixes → PATCH bump
git commit -m "fix: resolve model download timeout"

# Internal improvements → PATCH bump
git commit -m "refactor: simplify model manager logic"
git commit -m "perf: optimize model caching"
git commit -m "chore: remove unused dependency"
```

### ❌ AVOID These Mistakes:
```bash
# DON'T use BREAKING CHANGE for internal changes
git commit -m "feat: improve model delivery

BREAKING CHANGE: removed tar-stream dependency"  # WRONG! This triggers
```

## Release Workflow Checklist

### Before Committing:
- [ ] Review commit message - no "BREAKING CHANGE" unless API changes
- [ ] Consider: Will users need to change their code? If NO → Not breaking

### Release Commands:
```bash
# Let standard-version figure it out from commits
npm run release              # Recommended - auto-detects version

# Or be explicit:
npm run release:patch        # 2.4.0 → 2.4.1 (fixes)
npm run release:minor        # 2.4.0 → 2.5.0 (features)
npm run release:major        # 2.4.0 → 3.0.0 (API changes only!)
```

### After Release:
```bash
git push --follow-tags origin main
npm publish
gh release create $(git describe --tags --abbrev=0) --generate-notes
```

## When to Use Major Version (3.0.0)

ONLY when we make changes like:
- Removing methods from the public API
- Changing method signatures (parameters, return types)
- Renaming public methods
- Changing default behaviors that break existing code

Examples:
- ❌ `search(query, limit, options)` → `search(query, options)` (major)
- ✅ Adding `find()` method (minor - doesn't break existing code)
- ✅ Internal refactoring (patch - users don't see it)

## Quick Decision Tree

1. **Does this fix a bug?** → PATCH (fix:)
2. **Does this add new functionality?** → MINOR (feat:)
3. **Will users' existing code break?** → MAJOR (with BREAKING CHANGE)
4. **Is it internal/maintenance?** → PATCH (chore:/refactor:/perf:)

## Emergency: If Wrong Version is Released

```bash
# 1. Deprecate wrong version on npm
npm deprecate @soulcraft/brainy@X.X.X "Incorrect version - use Y.Y.Y"

# 2. Fix version in package.json
# 3. Republish correct version
npm publish

# 4. Delete wrong GitHub tag/release
git push origin :vX.X.X
gh release delete vX.X.X --yes

# 5. Create correct tag/release
git tag vY.Y.Y
git push --tags
gh release create vY.Y.Y --generate-notes
```

## Remember:
- **Most releases should be MINOR or PATCH**
- **Major versions should be RARE**
- **When in doubt, it's probably MINOR**
- **NEVER use "BREAKING CHANGE" for internal changes**