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

# 3. Obfuscation markers in tracked source (excluding lockfiles)
git ls-files -z -- ':!*lock*' ':!scripts/check-repo-safety.sh' ':!.github/*' | xargs -0 grep -IlE \
  '(\\u00[0-9A-Fa-f]{2}){4,}|global\.[a-z]\s*=\s*require|_0x[0-9a-f]{4,}|eval\(atob' 2>/dev/null \
  | while read -r f; do echo "FAIL: obfuscation markers in $f"; done | grep -q FAIL && fail=1

# 4. Install-time scripts that run arbitrary code
grep -nE '"(preinstall|install|postinstall|prepare)"' package.json && bad "package.json has install lifecycle scripts (review them)"

exit $fail
