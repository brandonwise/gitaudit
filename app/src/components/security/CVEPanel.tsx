/**
 * CVE Panel Component
 * 
 * Display vulnerabilities with severity colors and details.
 */

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSecurityStore } from '../../stores/securityStore'
import { getSeverityColor, getSeverityBgColor, type Vulnerability, type Severity } from '../../lib/cve'

interface CVEPanelProps {
  compact?: boolean
}

export function CVEPanel({ compact = false }: CVEPanelProps) {
  const { vulnerabilities, selectedVulnerability, selectVulnerability } = useSecurityStore()
  const [filter, setFilter] = useState<Severity | 'ALL'>('ALL')
  
  // Flatten all vulnerabilities
  const allVulns = vulnerabilities.flatMap(result => 
    result.vulnerabilities.map(v => ({
      ...v,
      packageName: result.dependency.name,
      packageVersion: result.dependency.version,
    }))
  )
  
  // Apply filter
  const filteredVulns = filter === 'ALL' 
    ? allVulns 
    : allVulns.filter(v => v.severity === filter)
  
  // Group by severity for stats
  const severityCounts = {
    CRITICAL: allVulns.filter(v => v.severity === 'CRITICAL').length,
    HIGH: allVulns.filter(v => v.severity === 'HIGH').length,
    MEDIUM: allVulns.filter(v => v.severity === 'MEDIUM').length,
    LOW: allVulns.filter(v => v.severity === 'LOW').length,
    UNKNOWN: allVulns.filter(v => v.severity === 'UNKNOWN').length,
  }
  
  if (compact) {
    return (
      <CompactCVEList 
        vulnerabilities={filteredVulns} 
        onSelect={selectVulnerability}
      />
    )
  }
  
  return (
    <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)]">
      {/* Header with filters */}
      <div className="p-4 border-b border-[var(--color-border-subtle)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Vulnerabilities</h3>
          <span className="text-sm text-[var(--color-text-muted)]">
            {allVulns.length} total
          </span>
        </div>
        
        {/* Severity filter pills */}
        <div className="flex gap-2 flex-wrap">
          <FilterPill 
            label="All" 
            count={allVulns.length}
            active={filter === 'ALL'}
            onClick={() => setFilter('ALL')}
          />
          {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map(severity => (
            <FilterPill
              key={severity}
              label={severity}
              count={severityCounts[severity]}
              color={getSeverityColor(severity)}
              active={filter === severity}
              onClick={() => setFilter(severity)}
            />
          ))}
        </div>
      </div>
      
      {/* Vulnerability list */}
      <div className="max-h-[400px] overflow-y-auto">
        {filteredVulns.length === 0 ? (
          <div className="p-8 text-center text-[var(--color-text-muted)]">
            {allVulns.length === 0 ? (
              <>
                <div className="text-4xl mb-2">🛡️</div>
                <p>No vulnerabilities detected!</p>
              </>
            ) : (
              <p>No vulnerabilities match this filter</p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border-subtle)]">
            {filteredVulns.map((vuln, i) => (
              <CVERow
                key={`${vuln.id}-${i}`}
                vulnerability={vuln}
                packageName={vuln.packageName}
                packageVersion={vuln.packageVersion}
                isSelected={selectedVulnerability?.id === vuln.id}
                onClick={() => selectVulnerability(vuln)}
              />
            ))}
          </div>
        )}
      </div>
      
      {/* Detail panel */}
      <AnimatePresence>
        {selectedVulnerability && (
          <CVEDetail 
            vulnerability={selectedVulnerability}
            onClose={() => selectVulnerability(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function FilterPill({
  label,
  count,
  color,
  active,
  onClick,
}: {
  label: string
  count: number
  color?: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`
        px-3 py-1 rounded-full text-xs font-medium transition-all
        ${active 
          ? 'ring-2 ring-white/20' 
          : 'hover:bg-white/5'
        }
      `}
      style={{
        backgroundColor: active ? (color ? color + '30' : 'rgba(255,255,255,0.1)') : 'transparent',
        color: color || 'var(--color-text)',
      }}
    >
      {label} {count > 0 && <span className="opacity-60">({count})</span>}
    </button>
  )
}

function CVERow({
  vulnerability,
  packageName,
  packageVersion,
  isSelected,
  onClick,
}: {
  vulnerability: Vulnerability
  packageName: string
  packageVersion: string
  isSelected: boolean
  onClick: () => void
}) {
  const color = getSeverityColor(vulnerability.severity)
  const bgColor = getSeverityBgColor(vulnerability.severity)
  
  return (
    <motion.button
      onClick={onClick}
      className={`
        w-full p-4 text-left transition-all
        ${isSelected ? 'bg-white/5' : 'hover:bg-white/5'}
      `}
      whileHover={{ x: 4 }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* CVE ID and severity */}
          <div className="flex items-center gap-2 mb-1">
            <span 
              className="px-2 py-0.5 rounded text-xs font-bold"
              style={{ backgroundColor: bgColor, color }}
            >
              {vulnerability.severity}
            </span>
            <code className="text-sm font-mono">{vulnerability.id}</code>
          </div>
          
          {/* Summary */}
          <p className="text-sm text-[var(--color-text-muted)] line-clamp-2 mb-2">
            {vulnerability.summary || 'No description available'}
          </p>
          
          {/* Package info */}
          <div className="flex items-center gap-2 text-xs text-[var(--color-text-subtle)]">
            <span className="font-mono">{packageName}@{packageVersion}</span>
            {vulnerability.cvss && (
              <>
                <span>•</span>
                <span style={{ color }}>CVSS {vulnerability.cvss}</span>
              </>
            )}
          </div>
        </div>
        
        {/* CVSS score badge */}
        {vulnerability.cvss && (
          <div 
            className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold"
            style={{ backgroundColor: bgColor, color }}
          >
            {vulnerability.cvss.toFixed(1)}
          </div>
        )}
      </div>
    </motion.button>
  )
}

function CVEDetail({
  vulnerability,
  onClose,
}: {
  vulnerability: Vulnerability
  onClose: () => void
}) {
  const color = getSeverityColor(vulnerability.severity)
  const bgColor = getSeverityBgColor(vulnerability.severity)
  
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="border-t border-[var(--color-border-subtle)] overflow-hidden"
    >
      <div 
        className="p-4"
        style={{ backgroundColor: bgColor }}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span 
                className="px-2 py-0.5 rounded text-xs font-bold"
                style={{ backgroundColor: color + '40', color }}
              >
                {vulnerability.severity}
              </span>
              <code className="font-mono font-bold">{vulnerability.id}</code>
            </div>
            {vulnerability.aliases.length > 0 && (
              <div className="text-xs text-[var(--color-text-muted)]">
                Also known as: {vulnerability.aliases.slice(0, 3).join(', ')}
                {vulnerability.aliases.length > 3 && ` +${vulnerability.aliases.length - 3} more`}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 transition-colors"
          >
            <span className="text-xl">×</span>
          </button>
        </div>
        
        {/* Description */}
        <div className="mb-4">
          <h5 className="text-sm font-medium mb-2">Description</h5>
          <p className="text-sm text-[var(--color-text-muted)]">
            {vulnerability.details || vulnerability.summary || 'No description available'}
          </p>
        </div>
        
        {/* Affected versions */}
        {vulnerability.affected.length > 0 && (
          <div className="mb-4">
            <h5 className="text-sm font-medium mb-2">Affected Packages</h5>
            <div className="space-y-1">
              {vulnerability.affected.map((a, i) => (
                <div key={i} className="text-sm font-mono text-[var(--color-text-muted)]">
                  {a.package} ({a.ecosystem})
                  {a.ranges?.[0] && (
                    <span className="ml-2">
                      {a.ranges[0].introduced && `≥${a.ranges[0].introduced}`}
                      {a.ranges[0].fixed && ` → Fixed in ${a.ranges[0].fixed}`}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* References */}
        {vulnerability.references.length > 0 && (
          <div>
            <h5 className="text-sm font-medium mb-2">References</h5>
            <div className="space-y-1">
              {vulnerability.references.slice(0, 5).map((ref, i) => (
                <a
                  key={i}
                  href={ref.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-sm text-blue-400 hover:underline truncate"
                >
                  {ref.url}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}

function CompactCVEList({
  vulnerabilities,
  onSelect,
}: {
  vulnerabilities: Array<Vulnerability & { packageName: string; packageVersion: string }>
  onSelect: (v: Vulnerability) => void
}) {
  return (
    <div className="space-y-2">
      {vulnerabilities.slice(0, 5).map((vuln, i) => {
        const color = getSeverityColor(vuln.severity)
        return (
          <motion.button
            key={`${vuln.id}-${i}`}
            onClick={() => onSelect(vuln)}
            className="w-full p-2 rounded-lg bg-white/5 hover:bg-white/10 text-left flex items-center gap-2"
            whileHover={{ scale: 1.02 }}
          >
            <div 
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: color }}
            />
            <code className="text-xs font-mono truncate flex-1">{vuln.id}</code>
            <span className="text-xs text-[var(--color-text-muted)]">
              {vuln.packageName}
            </span>
          </motion.button>
        )
      })}
      {vulnerabilities.length > 5 && (
        <div className="text-xs text-center text-[var(--color-text-muted)]">
          +{vulnerabilities.length - 5} more
        </div>
      )}
    </div>
  )
}
