# Git Time Machine — Security Extension

## Overview

Extend Git Time Machine from a repo visualization tool into a **full security time machine** — see your codebase evolve AND its security posture over time.

---

## New Capabilities

### 1. Secret Detection
- Scan all commits for leaked credentials
- AWS keys, GitHub tokens, Stripe keys, database creds, private keys
- Timeline showing: introduced → exposed duration → removed (or still exposed)
- Integration: **Gitleaks** patterns (MIT licensed, comprehensive rules)

### 2. CVE/Vulnerability Tracking  
- Parse dependency files at each commit point
- Cross-reference with OSV.dev, NVD, GitHub Advisory DB
- Show when vulnerable versions were in use
- CVSS scores, exploit availability, CISA KEV status

### 3. Supply Chain Graph
- Full transitive dependency tree via deps.dev API
- Visualize what your dependencies depend on
- Highlight vulnerable nodes in the chain
- Show maintainer info, download counts, update frequency

### 4. Security Commit Analysis
- Auto-detect security-relevant commits (keywords: security, CVE, fix, vulnerability, auth, crypto)
- Highlight changes to sensitive files (auth/, crypto/, config/, .env)
- Track security health over time

### 5. Git Hygiene Scoring
- Force push detection (history rewrites)
- Signed vs unsigned commits
- Unusual patterns (large binaries, weird timestamps, single-use emails)

---

## Visualization Layer

### The River of Time
Commits flow as particles through time. Color = author. Speed = commit velocity. Red disturbances = vulnerabilities/secrets.

### Dependency Galaxy (3D)
Force-directed Three.js visualization. Packages as stars. Connections as gravity lines. Vulnerable nodes pulse red. Zoom from macro to package-level.

### Risk Terrain Map
Topographic 3D surface. Elevation = risk level. Animate over time to show shifting risk landscape.

### Attack Surface Radar
Circular radar sweep. Entry points, exposed secrets, vulnerable deps revealed as the sweep passes.

### Code Archaeology Layers
Geological strata view. Each layer = time period. Dig down through history. Secrets glow through layers.

### The Heartbeat
Real-time pulse visualization. Steady = healthy. CVEs flash as arrhythmias.

---

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite for build
- TailwindCSS v4 (dark mode first)
- Three.js + React Three Fiber (3D viz)
- D3.js (2D charts, force graphs)
- Framer Motion (transitions)
- React Flow (dependency diagrams)
- Zustand (state)

### Security Data
- Gitleaks patterns for secret detection
- OSV.dev API (free, generous limits)
- NVD API (free, 50 req/30s)
- GitHub Advisory Database API
- deps.dev API (dependency graphs)
- CISA KEV (known exploited)

### Backend (minimal)
- Edge functions (Vercel) for API proxying
- Or Go API on Fly.io for heavier lifting

---

## File Structure

```
git-time-machine/
├── app/                      # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── viz/          # Visualization components
│   │   │   │   ├── Timeline.tsx
│   │   │   │   ├── DependencyGalaxy.tsx
│   │   │   │   ├── RiskTerrain.tsx
│   │   │   │   ├── AttackRadar.tsx
│   │   │   │   ├── Heartbeat.tsx
│   │   │   │   └── CodeLayers.tsx
│   │   │   ├── security/     # Security-specific UI
│   │   │   │   ├── SecretsList.tsx
│   │   │   │   ├── CVEPanel.tsx
│   │   │   │   ├── SupplyChainGraph.tsx
│   │   │   │   └── RiskScore.tsx
│   │   │   └── ui/           # Generic UI components
│   │   ├── lib/
│   │   │   ├── github.ts     # GitHub API
│   │   │   ├── secrets.ts    # Secret detection
│   │   │   ├── cve.ts        # CVE lookups
│   │   │   ├── deps.ts       # Dependency parsing
│   │   │   └── supply.ts     # Supply chain API
│   │   ├── hooks/
│   │   ├── pages/
│   │   └── stores/
├── api/                      # Edge functions or Go API
├── patterns/                 # Gitleaks-style patterns
└── docs/
```

---

## Build Phases

### Phase 1: Security Data Layer (Day 1)
- [ ] Secret detection patterns (port Gitleaks rules)
- [ ] Dependency file parsers (package.json, requirements.txt, go.mod, Cargo.toml, Gemfile)
- [ ] OSV.dev API integration
- [ ] NVD API integration  
- [ ] deps.dev API integration
- [ ] Data models for vulnerabilities, secrets, dependencies

### Phase 2: Core Visualizations (Day 2)
- [ ] Enhanced Timeline with security overlays
- [ ] Dependency Galaxy (Three.js 3D force graph)
- [ ] Risk Score dashboard component
- [ ] CVE Panel with severity colors

### Phase 3: Advanced Visualizations (Day 3)
- [ ] Risk Terrain Map (3D topographic)
- [ ] Attack Surface Radar
- [ ] Code Archaeology Layers
- [ ] Heartbeat pulse animation

### Phase 4: Integration & Polish (Day 4)
- [ ] Connect all data sources to visualizations
- [ ] Smooth transitions between views
- [ ] Loading states and error handling
- [ ] Performance optimization (virtualization, caching)
- [ ] Mobile responsiveness

### Phase 5: Deploy & Document (Day 5)
- [ ] Vercel deployment
- [ ] README and usage docs
- [ ] Demo video/GIF for README
- [ ] Blog post draft

---

## API Reference

### OSV.dev
```
POST https://api.osv.dev/v1/query
{
  "package": {"name": "lodash", "ecosystem": "npm"},
  "version": "4.17.15"
}
```

### NVD
```
GET https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=lodash
```

### deps.dev
```
GET https://api.deps.dev/v3/systems/npm/packages/lodash/versions/4.17.21
```

### GitHub Advisory
```
GET https://api.github.com/advisories?ecosystem=npm&package=lodash
```

---

## Design Tokens

```css
/* Risk Colors */
--critical: #ff4444;
--high: #ff8c00;
--medium: #ffcc00;
--low: #44cc44;
--info: #4488ff;

/* Glow Effects */
--glow-critical: 0 0 20px rgba(255, 68, 68, 0.6);
--glow-safe: 0 0 20px rgba(68, 204, 68, 0.4);

/* Background */
--bg-primary: #0a0a0f;
--bg-secondary: #12121a;
--bg-elevated: #1a1a25;
```

---

## Success Metrics

1. **Wow factor** — People screenshot and share it
2. **Useful** — Actually finds real issues in repos
3. **Fast** — Results in under 5 seconds for typical repos
4. **Accurate** — Low false positive rate on secrets/CVEs
