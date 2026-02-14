# gitpulse

**Git repository health check.**

One CLI to analyze any repo:
- 👥 **Authors** — detect duplicates, generate .mailmap
- 🚩 **Flags** — find stale feature flags  
- 🐷 **Bloat** — locate large files in history
- 🔐 **Security** — secret detection, CI integration
- 📊 **Visualize** — web UI for exploration

## Installation

```bash
npm install -g gitpulse
```

## Quick Start

```bash
# Full health check
gitpulse

# Specific checks
gitpulse authors      # Duplicate detection
gitpulse flags        # Stale feature flags
gitpulse bloat        # Large files

# CI mode
gitpulse ci --fail-on-secrets
```

## Commands

### `gitpulse` / `gitpulse analyze`

Run full repository analysis.

```bash
gitpulse                       # All checks
gitpulse --include authors,flags  # Specific modules
gitpulse --output json         # JSON output
```

### `gitpulse authors`

Detect duplicate Git identities and generate .mailmap files.

```bash
gitpulse authors               # Text summary
gitpulse authors --output mailmap  # Generate .mailmap
gitpulse authors --apply       # Write .mailmap file
gitpulse authors --threshold 80    # Higher match threshold
```

### `gitpulse flags`

Find stale feature flags (hardcoded to true/false).

```bash
gitpulse flags                 # Text summary
gitpulse flags --stale-only    # Only stale flags
gitpulse flags --diff          # Generate cleanup patches
gitpulse flags --output json   # JSON for CI
```

Detects patterns from:
- LaunchDarkly, Split.io, Unleash, Flipper
- Environment variables (`FEATURE_*`)
- Generic patterns (`isFeatureEnabled()`, etc.)

### `gitpulse bloat`

Find large files bloating your repository.

```bash
gitpulse bloat                 # Top 20 largest
gitpulse bloat --limit 50      # More files
gitpulse bloat --include-deleted   # Include deleted files
gitpulse bloat --min-size 5242880  # 5MB minimum
```

### `gitpulse visualize`

Launch web UI for interactive visualization.

```bash
gitpulse visualize             # Open in browser
gitpulse viz --port 8080       # Custom port
```

### `gitpulse ci`

CI/CD mode with JSON output and exit codes.

```bash
gitpulse ci                         # Run all checks
gitpulse ci --fail-on-secrets       # Exit 1 if secrets found
gitpulse ci --fail-on-stale-flags   # Exit 1 if stale flags
gitpulse ci --fail-on-bloat 10      # Exit 1 if files > 10MB
gitpulse ci --fail-on-duplicates    # Exit 1 if duplicate authors
```

## Example Output

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Author Analysis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

▸ Summary
Total identities: 653
Duplicate clusters: 71
Unique contributors: 551
Consolidation rate: 15.6%

▸ Duplicate Clusters

  Peter Steinberger <steipete@gmail.com> (7211 commits)
  └─ similar-name
     → Peter Steinberger <peter@steipete.me> (3 commits)
```

## Alias

For convenience, `gp` is also available:

```bash
gp authors
gp bloat
gp ci
```

## License

MIT
