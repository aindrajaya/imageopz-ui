#!/usr/bin/env bash
# Fails if the repo contains auto-run editor tasks, disguised asset files,
# or obfuscated JS. Run locally or in CI.
set -u
fail=0
bad() { echo "FAIL: $*"; fail=1; }

# 1. Editor configs that execute code on open
if [ -d .vscode ]; then
  grep -rnE 'folderOpen|allowAutomaticTasks"?\s*:\s*(true|"on")' .vscode && bad ".vscode contains auto-run task settings"
fi

# 2. Asset files that are really text/scripts
while IFS= read -r f; do
  case "$f" in
    *.woff|*.woff2|*.ttf|*.eot|*.otf|*.png|*.jpg|*.jpeg|*.gif|*.webp|*.ico|*.pdf)
      file -b "$f" | grep -qiE 'text|script|JSON' && bad "$f is text but has a binary extension" ;;
  esac
done < <(git ls-files)

# 3. Obfuscation markers and remote-code loaders in tracked code files.
# Code files only: docs that describe these patterns are not executable.
code_files() { git ls-files -z -- '*.ts' '*.tsx' '*.js' '*.jsx' '*.mjs' '*.cjs' '*.html' '*.sh' ':!scripts/check-repo-safety.sh'; }
while IFS= read -r f; do bad "obfuscation markers in $f"; done < <(code_files | xargs -0 grep -IlE \
  '(\\u00[0-9A-Fa-f]{2}){4,}|global\.[a-z]\s*=\s*require|_0x[0-9a-f]{4,}|eval\(atob' 2>/dev/null)
# eval( in the same file as atob( or fetch( = download-and-execute
while IFS= read -r f; do
  grep -qE 'atob\(|fetch\(' "$f" && bad "$f combines eval( with atob( or fetch("
done < <(code_files | xargs -0 grep -IlE 'eval\(' 2>/dev/null)
# build configs run on every dev/build, so any eval( there is a fail
while IFS= read -r f; do bad "$f (vite config) contains eval("; done < <(git ls-files -z -- 'vite.config.*' | xargs -0 grep -lE 'eval\(' 2>/dev/null)

# 5. Secrets file tracked, or .gitignore ignoring itself
git ls-files --error-unmatch .env >/dev/null 2>&1 && bad ".env is tracked"
grep -qxE '/?\.gitignore' .gitignore 2>/dev/null && bad ".gitignore ignores itself"

# 4. Install-time scripts that run arbitrary code
grep -nE '"(preinstall|install|postinstall|prepare)"' package.json && bad "package.json has install lifecycle scripts (review them)"

exit $fail
