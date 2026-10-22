#!/usr/bin/env bash
# ==============================================================================
# ReadAny Developer Tooling & Launcher (Bash / POSIX / macOS / Linux / Git Bash)
# ==============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Resolve pnpm
if command -v pnpm &>/dev/null; then
    PNPM="pnpm"
else
    PNPM="npx pnpm"
fi

ensure_dependencies() {
    if [ ! -d "node_modules" ]; then
        echo "📦 Installing workspace dependencies with $PNPM..."
        $PNPM install
    fi
}

show_help() {
    cat <<EOF
ReadAny Developer CLI (dev.sh)

Commands:
  web (default)   Start Vite web dev server at http://localhost:5173
  desktop, tauri  Launch native Tauri v2 desktop window
  test            Run unit tests across packages/core
  build           Build web production bundle
  build-desktop   Build native desktop bundle (.dmg, .deb, .msi, etc.)
  check           Run version consistency and linter checks
  release <ver>   Bump version, create tag v<ver>, and guide release push
  gitea           Show Gitea Docker CI testing instructions
  help            Show this help text

Examples:
  ./dev.sh
  ./dev.sh desktop
  ./dev.sh test
  ./dev.sh release 1.3.8
EOF
}

COMMAND="${1:-web}"
ARG1="$2"

case "$COMMAND" in
    web)
        ensure_dependencies
        echo "🚀 Starting ReadAny Web Dev Server (Vite)..."
        echo "   Local URL: http://localhost:5173"
        $PNPM --filter app dev
        ;;
    desktop|tauri)
        ensure_dependencies
        if ! command -v cargo &>/dev/null; then
            echo "❌ Rust/Cargo was not found in PATH. Install from https://rustup.rs/."
            exit 1
        fi
        echo "🦀 Launching ReadAny Desktop App (Tauri v2)..."
        $PNPM --filter app tauri dev
        ;;
    test)
        ensure_dependencies
        echo "🧪 Running Core Unit Tests..."
        $PNPM --filter @readany/core test
        ;;
    build)
        ensure_dependencies
        echo "🏗️ Building web production bundle..."
        $PNPM --filter app build
        ;;
    build-desktop|build-tauri)
        ensure_dependencies
        if ! command -v cargo &>/dev/null; then
            echo "❌ Rust/Cargo was not found in PATH."
            exit 1
        fi
        echo "📦 Building native desktop installer via Tauri..."
        $PNPM --filter app tauri build
        ;;
    check)
        ensure_dependencies
        echo "🔍 Verifying version consistency..."
        node scripts/bump-version.js --check
        echo "🔍 Running Biome linter..."
        $PNPM lint
        ;;
    release)
        if [ -z "$ARG1" ]; then
            echo "❌ Please specify a version number. Example: ./dev.sh release 1.3.8"
            exit 1
        fi
        VERSION="${ARG1#v}"
        ensure_dependencies
        echo "🏷️ Updating version across all files to $VERSION..."
        node scripts/bump-version.js "$VERSION"
        echo "🔍 Verifying consistency..."
        node scripts/bump-version.js --check
        TAG="v$VERSION"
        echo "📌 Committing and tagging $TAG..."
        git add -A
        git commit -m "chore(release): release $TAG"
        git tag -a "$TAG" -m "Release $TAG"
        echo "✅ Created tag $TAG!"
        echo ""
        echo "To trigger the automated GitHub Actions multi-platform release:"
        echo "   git push origin main --tags"
        ;;
    gitea)
        cat <<EOF
==============================================================================
Gitea Actions / CI Testing with Docker
==============================================================================

You can run CI testing on your local Gitea instance using Gitea Actions (Act Runner):

1. Add your repository to your local Gitea instance:
   git remote add gitea http://localhost:3000/<username>/ReadAny.git
   git push gitea main

2. Ensure your Gitea Act Runner is active in Docker.
   The workflow at .gitea/workflows/ci.yml will trigger automatically on pushes
   and pull requests, running:
   - Dependency caching
   - Version consistency check
   - Core unit test suite (including OpenCode and Pi provider modes)
   - Linter checks

3. To trigger a test run immediately:
   git push gitea main
EOF
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        show_help
        ;;
esac
