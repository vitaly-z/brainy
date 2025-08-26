# Claude Code Development Guidelines for Brainy

You are assisting with the Brainy project, an AI-powered database with zero-configuration philosophy.

## Core Development Principles

### 1. Always Use TodoWrite
- Track ALL tasks with the TodoWrite tool
- Mark tasks as in_progress when starting
- Mark completed immediately when done
- Never batch completions

### 2. Zero-Config Philosophy
- Everything must work with zero configuration
- Sensible defaults for all features
- Optional configuration only for advanced users
- No complex setup required

### 3. Test-Driven Development
```bash
# ALWAYS follow this workflow:
npm run build    # Build TypeScript first
npm test         # Run all tests
# Fix any failures before proceeding
```

### 4. Documentation First
- Check `/docs/` before creating new documentation
- Check if feature already exists before building
- Update existing docs rather than creating duplicates

### 5. Code Quality Standards
- Follow existing patterns in the codebase
- Maintain TypeScript type safety
- Use meaningful variable and function names
- Add comments only when logic is complex

### 6. Code Style (ESLint & Prettier)
**ALWAYS follow these style rules (defined in package.json):**
- **NO SEMICOLONS** - Never use semicolons
- **Single quotes** - Use 'string' not "string"
- **2 spaces** - Indent with 2 spaces, not tabs
- **No trailing commas** - Don't add commas after last item
- **Arrow parens** - Always use (x) => x, not x => x
- **Line width** - Max 80 characters per line
- **Allow 'any'** - TypeScript 'any' type is allowed
- **Unused vars** - Prefix with _ to ignore (e.g., _unused)

## Development Workflow

### Before Starting Any Task:
1. Read PLAN.md to understand current goals
2. Check existing code/docs for similar features
3. Create todo list with TodoWrite
4. Build and test to ensure clean starting point

### During Development:
1. Make incremental changes
2. Test frequently (npm run build && npm test)
3. Update todos as you progress
4. Document significant decisions

### After Completing Task:
1. Run full test suite
2. Update relevant documentation
3. Mark all todos as completed
4. Summarize what was accomplished

## Critical Rules

### NEVER:
- ❌ Publish with failing tests
- ❌ Commit PLAN.md (it's confidential)
- ❌ Add premium/paid features (everything is MIT)
- ❌ Create complex configuration requirements
- ❌ Skip the build step before testing

### ALWAYS:
- ✅ Run `npm run build` before `npm test`
- ✅ Pass ALL tests before considering done
- ✅ Check existing documentation first
- ✅ Follow zero-config philosophy
- ✅ Keep the API simple and intuitive

## Project-Specific Information

### Core Requirements:
- Tests: 400+ tests must pass
- Philosophy: Zero-config, everything included
- License: MIT (all features included)

### Key Architecture:
- `brain.augmentations` - Extension system
- `brain.metadataIndex` - O(1) field lookups
- `brain.index` - Vector search
- `brain.storage` - Persistence layer

### Key Documentation:
- `/docs/architectural-integrity.md` - Entity resolution strategy
- `/docs/enterprise-storage-architecture.md` - Storage layer design
- `/docs/BRAINY-2.0-STORAGE-ARCHITECTURE.md` - Storage implementation
- `/ARCHITECTURE.md` - Component integration map
- `/PLAN.md` - Current development plan (DO NOT COMMIT)


# 🚨 CRITICAL: ALWAYS PASS ALL TESTS BEFORE RELEASE

**NEVER publish or release without passing ALL tests in /tests directory**
```bash
npm test  # MUST show ALL tests passing (400+ tests)
```

If tests fail:
1. Fix the code if it's broken
2. Fix the test if it's testing incorrectly  
3. Remove the test if it's no longer relevant
4. NEVER publish with failing tests

## 🔨 IMPORTANT: ALWAYS REBUILD BEFORE TESTING

**ALWAYS rebuild TypeScript before running any tests:**
```bash
npm run build  # or just: npx tsc
```

Without rebuilding, you'll be testing old JavaScript code even after TypeScript changes!

## 📚 CRITICAL: CHECK EXISTING DOCUMENTATION

**BEFORE building new features or creating new docs:**
1. Check `/docs/` folder for existing architecture docs
2. Read `ARCHITECTURE.md` for component connections
3. Check if feature already exists in codebase
4. Look for existing solutions before building new ones

**Key Architecture Documents:**
- `/docs/architectural-integrity.md` - Entity resolution strategy
- `/docs/enterprise-storage-architecture.md` - Storage layer design
- `/docs/BRAINY-2.0-STORAGE-ARCHITECTURE.md` - Storage implementation
- `/ARCHITECTURE.md` - Component integration map

**Key Integration Points:**
- `brain.metadataIndex` - O(1) field lookups
- `brain.index` - Vector search
- `brain.augmentations` - Feature extensions
- `brain.storage` - Persistence layer

---

---

## 🧠 BRAINY PROJECT GUIDELINES

**Current development status, version, and tasks: See PLAN.md (DO NOT COMMIT)**

### Core Philosophy
- **Zero Configuration**: Everything works instantly with sensible defaults
- **Everything Included**: All features ship in core (MIT licensed)
- **Simple API**: Intuitive methods that just work
- **No Premium Tiers**: No feature limitations or paid upgrades

## Known Issues

### Bash Tool 2>&1 Redirection Bug (Critical)
**GitHub Issue:** https://github.com/anthropics/claude-code/issues/4711

A critical bug exists in the Bash tool where `2>&1` stderr redirection is treated as a literal argument "2", breaking many commands.

**Impact:** 
- Commands with stderr redirection fail or produce incorrect output
- Test runners like `npm test` that use stderr redirection internally fail
- Build commands may pass "2" as an argument instead of redirecting stderr

**Examples of Affected Commands:**
```bash
# These will FAIL:
npm test 2>&1           # Runs "vitest run 2" instead of "vitest run"
npm build 2>&1          # Runs "tsc 2" instead of "tsc"
command 2>&1 | grep x   # Passes "2" as argument to command
```

**Workarounds:**

1. **Use bash -c wrapper (RECOMMENDED):**
```bash
# Instead of:
npm test 2>&1

# Use:
bash -c 'npm test 2>&1'
```

2. **Run without stderr redirection:**
```bash
# Just run without capturing stderr:
npm test
npm build
```

3. **Use script wrapper:**
```bash
# Create a wrapper script
echo 'npm test' > run-tests.sh
chmod +x run-tests.sh
./run-tests.sh
```

**Note:** This affects ALL commands in Claude Code that try to redirect stderr. Always use the bash -c workaround when you need to capture both stdout and stderr.
