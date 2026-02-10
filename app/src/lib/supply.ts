/**
 * Supply Chain API Integration
 * 
 * deps.dev API for transitive dependency analysis and supply chain insights.
 */

import type { Ecosystem, Dependency } from './deps'

export interface PackageInfo {
  name: string
  ecosystem: string
  version: string
  description?: string
  homepage?: string
  repository?: string
  license?: string
  publishedAt?: string
  
  // Maintainer info
  maintainers?: {
    name: string
    email?: string
  }[]
  
  // Health metrics
  downloads?: {
    weekly: number
    monthly: number
  }
  dependents?: number
  lastUpdated?: string
  
  // Supply chain
  directDeps: DependencyNode[]
  transitiveDeps: DependencyNode[]
}

export interface DependencyNode {
  name: string
  version: string
  ecosystem: string
  depth: number
  path: string[] // Full dependency path from root
  isVulnerable?: boolean
  vulnerabilityCount?: number
  riskScore?: number
}

export interface SupplyChainGraph {
  root: string
  nodes: Map<string, DependencyNode>
  edges: Array<{ from: string; to: string }>
  stats: {
    totalDeps: number
    directDeps: number
    transitiveDeps: number
    maxDepth: number
    vulnerableCount: number
    avgRiskScore: number
  }
}

// deps.dev ecosystem mapping
const DEPSDEV_SYSTEM: Record<Ecosystem, string> = {
  npm: 'npm',
  pypi: 'pypi',
  go: 'go',
  cargo: 'cargo',
  rubygems: 'rubygems',
  maven: 'maven',
}

/**
 * Fetch package info from deps.dev
 */
export async function fetchPackageInfo(
  name: string,
  version: string,
  ecosystem: Ecosystem
): Promise<PackageInfo | null> {
  const system = DEPSDEV_SYSTEM[ecosystem]
  const encodedName = encodeURIComponent(name)
  const encodedVersion = encodeURIComponent(version)
  
  try {
    // Fetch version info
    const versionUrl = `https://api.deps.dev/v3/systems/${system}/packages/${encodedName}/versions/${encodedVersion}`
    const versionRes = await fetch(versionUrl)
    
    if (!versionRes.ok) {
      return null
    }
    
    const versionData = await versionRes.json()
    
    // Fetch package-level info
    const packageUrl = `https://api.deps.dev/v3/systems/${system}/packages/${encodedName}`
    const packageRes = await fetch(packageUrl)
    const packageData = packageRes.ok ? await packageRes.json() : {}
    
    // Fetch dependencies
    const depsUrl = `https://api.deps.dev/v3/systems/${system}/packages/${encodedName}/versions/${encodedVersion}:dependencies`
    const depsRes = await fetch(depsUrl)
    const depsData = depsRes.ok ? await depsRes.json() : { nodes: [] }
    
    // Parse dependencies
    const directDeps: DependencyNode[] = []
    const transitiveDeps: DependencyNode[] = []
    
    if (depsData.nodes) {
      for (const node of depsData.nodes) {
        // Skip the root node
        if (node.versionKey?.name === name) continue
        
        const depNode: DependencyNode = {
          name: node.versionKey?.name || '',
          version: node.versionKey?.version || '',
          ecosystem: node.versionKey?.system || ecosystem,
          depth: node.relation === 'DIRECT' ? 1 : 2,
          path: [name, node.versionKey?.name || ''],
        }
        
        if (node.relation === 'DIRECT') {
          directDeps.push(depNode)
        } else {
          transitiveDeps.push(depNode)
        }
      }
    }
    
    return {
      name,
      ecosystem: system,
      version,
      description: packageData.package?.description,
      homepage: versionData.links?.find((l: any) => l.label === 'HOMEPAGE')?.url,
      repository: versionData.links?.find((l: any) => l.label === 'SOURCE_REPO')?.url,
      license: versionData.licenses?.join(', '),
      publishedAt: versionData.publishedAt,
      directDeps,
      transitiveDeps,
    }
  } catch (error) {
    console.warn(`deps.dev query failed for ${name}@${version}:`, error)
    return null
  }
}

/**
 * Build a full supply chain graph for multiple dependencies
 */
export async function buildSupplyChainGraph(
  dependencies: Dependency[],
  options: { maxDepth?: number; parallel?: number } = {}
): Promise<SupplyChainGraph> {
  const maxDepth = options.maxDepth || 3
  const parallel = options.parallel || 3
  
  const nodes = new Map<string, DependencyNode>()
  const edges: Array<{ from: string; to: string }> = []
  
  // Add root nodes for all direct dependencies
  for (const dep of dependencies) {
    const nodeId = `${dep.ecosystem}:${dep.name}@${dep.version}`
    nodes.set(nodeId, {
      name: dep.name,
      version: dep.version,
      ecosystem: dep.ecosystem,
      depth: 0,
      path: [dep.name],
    })
  }
  
  // Fetch transitive dependencies in batches
  const toProcess = [...dependencies]
  let currentDepth = 0
  
  while (toProcess.length > 0 && currentDepth < maxDepth) {
    currentDepth++
    const batch = toProcess.splice(0, parallel)
    
    const results = await Promise.all(
      batch.map(dep => fetchPackageInfo(dep.name, dep.version, dep.ecosystem))
    )
    
    for (let i = 0; i < batch.length; i++) {
      const parentDep = batch[i]
      const info = results[i]
      
      if (!info) continue
      
      const parentId = `${parentDep.ecosystem}:${parentDep.name}@${parentDep.version}`
      const parentNode = nodes.get(parentId)
      const parentPath = parentNode?.path || [parentDep.name]
      
      // Process direct dependencies
      for (const childDep of info.directDeps) {
        const childId = `${childDep.ecosystem}:${childDep.name}@${childDep.version}`
        
        edges.push({ from: parentId, to: childId })
        
        if (!nodes.has(childId)) {
          nodes.set(childId, {
            ...childDep,
            depth: currentDepth,
            path: [...parentPath, childDep.name],
          })
          
          // Queue for further processing if not at max depth
          if (currentDepth < maxDepth) {
            toProcess.push({
              name: childDep.name,
              version: childDep.version,
              ecosystem: childDep.ecosystem as Ecosystem,
              isDev: false,
              source: 'transitive',
            })
          }
        }
      }
    }
    
    // Small delay between depths
    if (toProcess.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
  
  // Calculate stats
  const nodeArray = Array.from(nodes.values())
  const directCount = nodeArray.filter(n => n.depth === 0).length
  const transitiveCount = nodeArray.filter(n => n.depth > 0).length
  const maxDepthFound = Math.max(...nodeArray.map(n => n.depth), 0)
  const vulnerableNodes = nodeArray.filter(n => n.isVulnerable)
  
  return {
    root: dependencies[0]?.name || 'root',
    nodes,
    edges,
    stats: {
      totalDeps: nodes.size,
      directDeps: directCount,
      transitiveDeps: transitiveCount,
      maxDepth: maxDepthFound,
      vulnerableCount: vulnerableNodes.length,
      avgRiskScore: vulnerableNodes.length > 0
        ? vulnerableNodes.reduce((sum, n) => sum + (n.riskScore || 0), 0) / vulnerableNodes.length
        : 0,
    },
  }
}

/**
 * Get package health score (0-100)
 */
export function calculatePackageHealth(info: PackageInfo): number {
  let score = 50 // Base score
  
  // Has license
  if (info.license) score += 10
  
  // Has repository
  if (info.repository) score += 10
  
  // Recently updated (within last year)
  if (info.lastUpdated) {
    const lastUpdate = new Date(info.lastUpdated)
    const daysSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24)
    if (daysSinceUpdate < 30) score += 15
    else if (daysSinceUpdate < 90) score += 10
    else if (daysSinceUpdate < 365) score += 5
  }
  
  // Has maintainers
  if (info.maintainers && info.maintainers.length > 0) score += 10
  
  // Reasonable dependency count
  const totalDeps = info.directDeps.length + info.transitiveDeps.length
  if (totalDeps < 10) score += 10
  else if (totalDeps < 50) score += 5
  else if (totalDeps > 200) score -= 10
  
  return Math.max(0, Math.min(100, score))
}

/**
 * Format a dependency path for display
 */
export function formatDependencyPath(path: string[]): string {
  return path.join(' → ')
}
