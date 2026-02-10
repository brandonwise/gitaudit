/**
 * Security State Store
 * 
 * Zustand store for security data state management.
 */

import { create } from 'zustand'
import type { DetectedSecret } from '../lib/secrets'
import type { VulnerabilityResult, Vulnerability } from '../lib/cve'
import type { Dependency } from '../lib/deps'
import type { SupplyChainGraph, PackageInfo } from '../lib/supply'

export interface SecurityState {
  // Loading states
  isScanning: boolean
  scanProgress: number
  scanStatus: string
  
  // Secrets
  secrets: DetectedSecret[]
  secretsByFile: Map<string, DetectedSecret[]>
  secretsByCommit: Map<string, DetectedSecret[]>
  
  // Dependencies
  dependencies: Dependency[]
  vulnerabilities: VulnerabilityResult[]
  
  // Supply chain
  supplyChain: SupplyChainGraph | null
  packageInfoCache: Map<string, PackageInfo>
  
  // Aggregate scores
  overallRiskScore: number
  secretsCount: number
  criticalVulnCount: number
  highVulnCount: number
  
  // Timeline data
  securityTimeline: SecurityTimelinePoint[]
  
  // Selected item for detail view
  selectedSecret: DetectedSecret | null
  selectedVulnerability: Vulnerability | null
  selectedPackage: string | null
  
  // View state
  activeTab: 'overview' | 'secrets' | 'vulnerabilities' | 'supply-chain'
  galaxySelectedNode: string | null
}

export interface SecurityTimelinePoint {
  date: string
  commit: string
  secretsIntroduced: number
  secretsRemoved: number
  vulnsIntroduced: number
  vulnsFixed: number
  riskScore: number
}

interface SecurityActions {
  // Setters
  setScanning: (isScanning: boolean) => void
  setScanProgress: (progress: number, status: string) => void
  
  setSecrets: (secrets: DetectedSecret[]) => void
  addSecret: (secret: DetectedSecret) => void
  
  setDependencies: (deps: Dependency[]) => void
  setVulnerabilities: (vulns: VulnerabilityResult[]) => void
  
  setSupplyChain: (graph: SupplyChainGraph | null) => void
  cachePackageInfo: (key: string, info: PackageInfo) => void
  
  setSecurityTimeline: (timeline: SecurityTimelinePoint[]) => void
  
  // Selection
  selectSecret: (secret: DetectedSecret | null) => void
  selectVulnerability: (vuln: Vulnerability | null) => void
  selectPackage: (packageId: string | null) => void
  setActiveTab: (tab: SecurityState['activeTab']) => void
  setGalaxySelectedNode: (nodeId: string | null) => void
  
  // Computed
  recalculateScores: () => void
  
  // Reset
  reset: () => void
}

const initialState: SecurityState = {
  isScanning: false,
  scanProgress: 0,
  scanStatus: '',
  
  secrets: [],
  secretsByFile: new Map(),
  secretsByCommit: new Map(),
  
  dependencies: [],
  vulnerabilities: [],
  
  supplyChain: null,
  packageInfoCache: new Map(),
  
  overallRiskScore: 0,
  secretsCount: 0,
  criticalVulnCount: 0,
  highVulnCount: 0,
  
  securityTimeline: [],
  
  selectedSecret: null,
  selectedVulnerability: null,
  selectedPackage: null,
  
  activeTab: 'overview',
  galaxySelectedNode: null,
}

export const useSecurityStore = create<SecurityState & SecurityActions>((set, get) => ({
  ...initialState,
  
  setScanning: (isScanning) => set({ isScanning }),
  
  setScanProgress: (progress, status) => set({ 
    scanProgress: progress, 
    scanStatus: status 
  }),
  
  setSecrets: (secrets) => {
    // Build indexes
    const byFile = new Map<string, DetectedSecret[]>()
    const byCommit = new Map<string, DetectedSecret[]>()
    
    for (const secret of secrets) {
      // By file
      const fileSecrets = byFile.get(secret.file) || []
      fileSecrets.push(secret)
      byFile.set(secret.file, fileSecrets)
      
      // By commit
      const commitSecrets = byCommit.get(secret.commit) || []
      commitSecrets.push(secret)
      byCommit.set(secret.commit, commitSecrets)
    }
    
    set({
      secrets,
      secretsByFile: byFile,
      secretsByCommit: byCommit,
      secretsCount: secrets.length,
    })
    
    get().recalculateScores()
  },
  
  addSecret: (secret) => {
    const secrets = [...get().secrets, secret]
    get().setSecrets(secrets)
  },
  
  setDependencies: (deps) => set({ dependencies: deps }),
  
  setVulnerabilities: (vulns) => {
    // Count by severity
    let critical = 0
    let high = 0
    
    for (const result of vulns) {
      for (const vuln of result.vulnerabilities) {
        if (vuln.severity === 'CRITICAL') critical++
        else if (vuln.severity === 'HIGH') high++
      }
    }
    
    set({
      vulnerabilities: vulns,
      criticalVulnCount: critical,
      highVulnCount: high,
    })
    
    get().recalculateScores()
  },
  
  setSupplyChain: (graph) => set({ supplyChain: graph }),
  
  cachePackageInfo: (key, info) => {
    const cache = new Map(get().packageInfoCache)
    cache.set(key, info)
    set({ packageInfoCache: cache })
  },
  
  setSecurityTimeline: (timeline) => set({ securityTimeline: timeline }),
  
  selectSecret: (secret) => set({ selectedSecret: secret }),
  selectVulnerability: (vuln) => set({ selectedVulnerability: vuln }),
  selectPackage: (packageId) => set({ selectedPackage: packageId }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setGalaxySelectedNode: (nodeId) => set({ galaxySelectedNode: nodeId }),
  
  recalculateScores: () => {
    const state = get()
    
    let riskScore = 0
    
    // Secrets contribution
    for (const secret of state.secrets) {
      switch (secret.pattern.severity) {
        case 'critical': riskScore += 25; break
        case 'high': riskScore += 15; break
        case 'medium': riskScore += 8; break
        case 'low': riskScore += 3; break
      }
    }
    
    // Vulnerabilities contribution
    for (const result of state.vulnerabilities) {
      riskScore += result.riskScore * 0.5
    }
    
    // Cap at 100
    riskScore = Math.min(100, riskScore)
    
    set({ overallRiskScore: Math.round(riskScore) })
  },
  
  reset: () => set(initialState),
}))

// Selectors
export const selectVulnerablePackages = (state: SecurityState) => 
  state.vulnerabilities.filter(v => v.vulnerabilities.length > 0)

export const selectCriticalSecrets = (state: SecurityState) =>
  state.secrets.filter(s => s.pattern.severity === 'critical')

export const selectHighRiskNodes = (state: SecurityState) => {
  if (!state.supplyChain) return []
  return Array.from(state.supplyChain.nodes.values())
    .filter(n => (n.riskScore || 0) > 50)
}
