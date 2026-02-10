/**
 * CVE/Vulnerability Lookup
 * 
 * Integration with OSV.dev and NVD APIs for vulnerability data.
 */

import type { Ecosystem, Dependency } from './deps'

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN'

export interface Vulnerability {
  id: string
  aliases: string[] // CVE IDs, GHSA IDs, etc.
  summary: string
  details: string
  severity: Severity
  cvss?: number
  published: string
  modified: string
  references: { type: string; url: string }[]
  affected: {
    package: string
    ecosystem: string
    versions: string[]
    ranges?: { introduced?: string; fixed?: string }[]
  }[]
  // Additional metadata
  exploitAvailable?: boolean
  cisaKev?: boolean // CISA Known Exploited Vulnerabilities
}

export interface VulnerabilityResult {
  dependency: Dependency
  vulnerabilities: Vulnerability[]
  riskScore: number // 0-100
}

// OSV ecosystem mapping
const ECOSYSTEM_MAP: Record<Ecosystem, string> = {
  npm: 'npm',
  pypi: 'PyPI',
  go: 'Go',
  cargo: 'crates.io',
  rubygems: 'RubyGems',
  maven: 'Maven',
}

/**
 * Query OSV.dev for vulnerabilities
 */
export async function queryOSV(
  packageName: string,
  version: string,
  ecosystem: Ecosystem
): Promise<Vulnerability[]> {
  const osvEcosystem = ECOSYSTEM_MAP[ecosystem]
  
  try {
    const response = await fetch('https://api.osv.dev/v1/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        package: {
          name: packageName,
          ecosystem: osvEcosystem,
        },
        version,
      }),
    })
    
    if (!response.ok) {
      console.warn(`OSV query failed for ${packageName}@${version}: ${response.status}`)
      return []
    }
    
    const data = await response.json()
    
    if (!data.vulns || data.vulns.length === 0) {
      return []
    }
    
    return data.vulns.map(transformOSVVuln)
  } catch (error) {
    console.warn(`OSV query error for ${packageName}@${version}:`, error)
    return []
  }
}

/**
 * Transform OSV vulnerability to our format
 */
function transformOSVVuln(osv: any): Vulnerability {
  // Extract severity from database_specific or severity field
  let severity: Severity = 'UNKNOWN'
  let cvss: number | undefined
  
  if (osv.severity) {
    for (const sev of osv.severity) {
      if (sev.type === 'CVSS_V3') {
        cvss = parseFloat(sev.score)
        if (cvss !== undefined) {
          severity = cvssToSeverity(cvss)
        }
        break
      }
    }
  }
  
  if (severity === 'UNKNOWN' && osv.database_specific?.severity) {
    severity = osv.database_specific.severity.toUpperCase()
  }
  
  return {
    id: osv.id,
    aliases: osv.aliases || [],
    summary: osv.summary || '',
    details: osv.details || '',
    severity,
    cvss,
    published: osv.published || '',
    modified: osv.modified || '',
    references: (osv.references || []).map((r: any) => ({
      type: r.type || 'WEB',
      url: r.url,
    })),
    affected: (osv.affected || []).map((a: any) => ({
      package: a.package?.name || '',
      ecosystem: a.package?.ecosystem || '',
      versions: a.versions || [],
      ranges: a.ranges?.map((r: any) => ({
        introduced: r.events?.find((e: any) => e.introduced)?.introduced,
        fixed: r.events?.find((e: any) => e.fixed)?.fixed,
      })) || [],
    })),
  }
}

/**
 * Query NVD for additional CVE details
 */
export async function queryNVD(cveId: string): Promise<Partial<Vulnerability> | null> {
  try {
    const response = await fetch(
      `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${cveId}`,
      {
        headers: {
          // Optional: Add API key for higher rate limits
          // 'apiKey': process.env.NVD_API_KEY || '',
        },
      }
    )
    
    if (!response.ok) {
      return null
    }
    
    const data = await response.json()
    const cve = data.vulnerabilities?.[0]?.cve
    
    if (!cve) return null
    
    // Extract CVSS score
    let cvss: number | undefined
    let severity: Severity = 'UNKNOWN'
    
    if (cve.metrics?.cvssMetricV31?.[0]) {
      cvss = cve.metrics.cvssMetricV31[0].cvssData.baseScore
      if (typeof cvss === 'number') severity = cvssToSeverity(cvss)
    } else if (cve.metrics?.cvssMetricV30?.[0]) {
      cvss = cve.metrics.cvssMetricV30[0].cvssData.baseScore
      if (typeof cvss === 'number') severity = cvssToSeverity(cvss)
    }
    
    return {
      id: cveId,
      summary: cve.descriptions?.find((d: any) => d.lang === 'en')?.value || '',
      severity,
      cvss,
      published: cve.published,
      modified: cve.lastModified,
    }
  } catch {
    return null
  }
}

/**
 * Batch check dependencies for vulnerabilities
 */
export async function checkDependencies(
  dependencies: Dependency[],
  options: { parallel?: number } = {}
): Promise<VulnerabilityResult[]> {
  const parallel = options.parallel || 5
  const results: VulnerabilityResult[] = []
  
  // Process in batches to avoid rate limits
  for (let i = 0; i < dependencies.length; i += parallel) {
    const batch = dependencies.slice(i, i + parallel)
    
    const batchResults = await Promise.all(
      batch.map(async (dep) => {
        const vulns = await queryOSV(dep.name, dep.version, dep.ecosystem)
        return {
          dependency: dep,
          vulnerabilities: vulns,
          riskScore: calculateRiskScore(vulns),
        }
      })
    )
    
    results.push(...batchResults)
    
    // Small delay between batches
    if (i + parallel < dependencies.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
  
  return results
}

/**
 * Calculate risk score (0-100) based on vulnerabilities
 */
export function calculateRiskScore(vulns: Vulnerability[]): number {
  if (vulns.length === 0) return 0
  
  let score = 0
  
  for (const vuln of vulns) {
    // Base score from severity
    switch (vuln.severity) {
      case 'CRITICAL': score += 40; break
      case 'HIGH': score += 25; break
      case 'MEDIUM': score += 10; break
      case 'LOW': score += 3; break
      default: score += 5
    }
    
    // Bonus for CVSS if available
    if (vuln.cvss) {
      score += vuln.cvss * 2
    }
    
    // Extra weight for CISA KEV
    if (vuln.cisaKev) {
      score += 20
    }
    
    // Extra weight if exploit is available
    if (vuln.exploitAvailable) {
      score += 15
    }
  }
  
  return Math.min(100, score)
}

/**
 * Convert CVSS score to severity
 */
function cvssToSeverity(score: number): Severity {
  if (score >= 9.0) return 'CRITICAL'
  if (score >= 7.0) return 'HIGH'
  if (score >= 4.0) return 'MEDIUM'
  if (score > 0) return 'LOW'
  return 'UNKNOWN'
}

/**
 * Get severity color
 */
export function getSeverityColor(severity: Severity): string {
  switch (severity) {
    case 'CRITICAL': return '#ff4444'
    case 'HIGH': return '#ff8c00'
    case 'MEDIUM': return '#ffcc00'
    case 'LOW': return '#44cc44'
    default: return '#888888'
  }
}

/**
 * Get severity background color (for badges)
 */
export function getSeverityBgColor(severity: Severity): string {
  switch (severity) {
    case 'CRITICAL': return 'rgba(255, 68, 68, 0.15)'
    case 'HIGH': return 'rgba(255, 140, 0, 0.15)'
    case 'MEDIUM': return 'rgba(255, 204, 0, 0.15)'
    case 'LOW': return 'rgba(68, 204, 68, 0.15)'
    default: return 'rgba(136, 136, 136, 0.15)'
  }
}
