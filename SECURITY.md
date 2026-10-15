# Security

## Compromised history - do not run old commits
Commits before `fd1032e` (2026-10-15) contain malware planted on 2026-05-15: an auto-run editor task,
an obfuscated payload, a remote-code loader in the build config, and decoy asset files.

- Never check out a commit older than `fd1032e` and run `pnpm install`, `dev`, `build` or any script from it.
  Build tooling executes repository code; reading the files is safe, running them is not.
- Do not open such a checkout in an editor that runs workspace tasks automatically.
- `.gitleaksignore` lists one fingerprint from commit `8179d01` (`.env`). It is a malware indicator,
  not a credential.
- `scripts/check-repo-safety.sh` runs in CI (`repo-safety` workflow) to catch the same patterns again.

## Reporting a vulnerability
Please do not open a public issue. Contact the owner privately using the email address on the
owner's GitHub profile (github.com/aindrajaya), with steps to reproduce and the affected commit.
