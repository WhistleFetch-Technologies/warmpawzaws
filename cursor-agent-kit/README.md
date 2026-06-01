# Warmpawz Cursor Agent Kit

Portable Cursor rules for team members working on personal feature branches.

## Folder contents

```
cursor-agent-kit/
├── README.md                          ← you are here
├── install.ps1                        ← Windows: activate rules in repo
├── install.sh                         ← macOS/Linux/Git Bash: activate rules
└── rules/
    ├── team-development-bible.mdc     ← main agent bible (always on)
    ├── branch-health.mdc              ← git branch sync & PR discipline (always on)
    ├── deployment.mdc                 ← deploy script guardrails (always on)
    └── git-cli.mdc                    ← git CLI conventions (always on)
```

## One-time setup (new teammate)

1. Clone the repo and checkout your branch (e.g. `dev-abhi`):

   ```powershell
   git checkout dev-abhi
   git pull origin dev-abhi
   ```

2. Open the repo in **Cursor**.

3. From the repo root, run the installer:

   **Windows (PowerShell):**
   ```powershell
   .\cursor-agent-kit\install.ps1
   ```

   **macOS / Linux / Git Bash:**
   ```bash
   ./cursor-agent-kit/install.sh
   ```

4. Restart Cursor (or open a new Agent chat) so rules reload.

5. In Cursor → **Settings → Rules**, confirm these four rules show as active:
   - Team development bible
   - Git branch health
   - Deployment
   - Git CLI

## What each rule does

| File | Purpose |
|------|---------|
| `team-development-bible.mdc` | Local UI, RDS migrations, dev/prod deploy, safety guardrails |
| `branch-health.mdc` | `dev-<name>` sync with `develop`, feature branches, PR hygiene |
| `deployment.mdc` | Approved deploy scripts only; no CDK; UAT/prod Lambda notes |
| `git-cli.mdc` | Consistent git command usage across agent shells |

## Updating rules

When this kit changes on your branch, pull and re-run the install script:

```powershell
git pull origin dev-abhi
.\cursor-agent-kit\install.ps1
```

## Manual install (alternative)

Copy all files from `cursor-agent-kit/rules/` into `.cursor/rules/` at the repo root:

```bash
mkdir -p .cursor/rules
cp cursor-agent-kit/rules/*.mdc .cursor/rules/
```

## Not included (already in repo)

These are referenced by the rules but live elsewhere — no copy needed:

- Deploy scripts: `scripts/deploy-*.sh`
- Migration runner: `scripts/run-migration-rds-node.js`
- Prod URLs: `prodscripts/PRODUCTION_CONFIG.md`
- CI workflows: `.github/workflows/dev.yml`, `prod.yml`
