/**
 * Secrets List Component
 * 
 * Display detected secrets with severity and location info.
 */

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSecurityStore } from '../../stores/securityStore'
import { getSeverityColor, getSeverityGlow, type DetectedSecret, type SecretPattern } from '../../lib/secrets'

interface SecretsListProps {
  compact?: boolean
}

export function SecretsList({ compact = false }: SecretsListProps) {
  const { secrets, selectedSecret, selectSecret } = useSecurityStore()
  const [groupBy, setGroupBy] = useState<'type' | 'file' | 'severity'>('severity')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  
  // Group secrets
  const groups = useMemo(() => {
    const grouped = new Map<string, DetectedSecret[]>()
    
    for (const secret of secrets) {
      let key: string
      switch (groupBy) {
        case 'type':
          key = secret.pattern.name
          break
        case 'file':
          key = secret.file
          break
        case 'severity':
          key = secret.pattern.severity
          break
      }
      
      const group = grouped.get(key) || []
      group.push(secret)
      grouped.set(key, group)
    }
    
    // Sort groups by priority
    const entries = Array.from(grouped.entries())
    if (groupBy === 'severity') {
      const order = { critical: 0, high: 1, medium: 2, low: 3 }
      entries.sort((a, b) => order[a[0] as keyof typeof order] - order[b[0] as keyof typeof order])
    }
    
    return entries
  }, [secrets, groupBy])
  
  const toggleGroup = (key: string) => {
    const next = new Set(expandedGroups)
    if (next.has(key)) {
      next.delete(key)
    } else {
      next.add(key)
    }
    setExpandedGroups(next)
  }
  
  if (secrets.length === 0) {
    return (
      <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] p-8 text-center">
        <div className="text-4xl mb-2">🔐</div>
        <p className="text-[var(--color-text-muted)]">No secrets detected!</p>
        <p className="text-sm text-[var(--color-text-subtle)] mt-1">
          Your repository appears to be free of exposed credentials.
        </p>
      </div>
    )
  }
  
  if (compact) {
    return <CompactSecretsList secrets={secrets} onSelect={selectSecret} />
  }
  
  return (
    <div className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)]">
      {/* Header */}
      <div className="p-4 border-b border-[var(--color-border-subtle)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <span className="text-red-400">🔑</span>
            Detected Secrets
          </h3>
          <span className="text-sm text-red-400 font-medium">
            {secrets.length} found
          </span>
        </div>
        
        {/* Group by selector */}
        <div className="flex gap-2">
          {(['severity', 'type', 'file'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setGroupBy(mode)}
              className={`
                px-3 py-1 rounded-full text-xs font-medium transition-all
                ${groupBy === mode 
                  ? 'bg-white/10 text-white' 
                  : 'text-[var(--color-text-muted)] hover:bg-white/5'
                }
              `}
            >
              By {mode}
            </button>
          ))}
        </div>
      </div>
      
      {/* Grouped list */}
      <div className="max-h-[400px] overflow-y-auto">
        {groups.map(([key, groupSecrets]) => (
          <SecretGroup
            key={key}
            label={key}
            secrets={groupSecrets}
            groupBy={groupBy}
            isExpanded={expandedGroups.has(key)}
            onToggle={() => toggleGroup(key)}
            selectedId={selectedSecret?.id}
            onSelect={selectSecret}
          />
        ))}
      </div>
      
      {/* Detail panel */}
      <AnimatePresence>
        {selectedSecret && (
          <SecretDetail 
            secret={selectedSecret}
            onClose={() => selectSecret(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function SecretGroup({
  label,
  secrets,
  groupBy,
  isExpanded,
  onToggle,
  selectedId,
  onSelect,
}: {
  label: string
  secrets: DetectedSecret[]
  groupBy: 'type' | 'file' | 'severity'
  isExpanded: boolean
  onToggle: () => void
  selectedId?: string
  onSelect: (s: DetectedSecret) => void
}) {
  const color = groupBy === 'severity' 
    ? getSeverityColor(label as SecretPattern['severity'])
    : '#888'
  
  return (
    <div className="border-b border-[var(--color-border-subtle)] last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full p-3 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          {groupBy === 'severity' && (
            <div 
              className="w-2 h-2 rounded-full"
              style={{ 
                backgroundColor: color,
                boxShadow: getSeverityGlow(label as SecretPattern['severity']),
              }}
            />
          )}
          <span className="text-sm font-medium capitalize">{label}</span>
          <span 
            className="px-2 py-0.5 rounded-full text-xs"
            style={{ backgroundColor: color + '20', color }}
          >
            {secrets.length}
          </span>
        </div>
        <motion.span
          animate={{ rotate: isExpanded ? 180 : 0 }}
          className="text-[var(--color-text-muted)]"
        >
          ▼
        </motion.span>
      </button>
      
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {secrets.map((secret, i) => (
              <SecretRow
                key={secret.id}
                secret={secret}
                isSelected={selectedId === secret.id}
                onClick={() => onSelect(secret)}
                index={i}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function SecretRow({
  secret,
  isSelected,
  onClick,
  index,
}: {
  secret: DetectedSecret
  isSelected: boolean
  onClick: () => void
  index: number
}) {
  const color = getSeverityColor(secret.pattern.severity)
  
  return (
    <motion.button
      onClick={onClick}
      className={`
        w-full p-3 pl-6 text-left border-l-2 transition-all
        ${isSelected ? 'bg-white/5' : 'hover:bg-white/5'}
      `}
      style={{ borderLeftColor: isSelected ? color : 'transparent' }}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-medium text-[var(--color-text-muted)]">
          {secret.pattern.name}
        </span>
      </div>
      <code className="text-sm font-mono text-[var(--color-text)]">
        {secret.redactedMatch}
      </code>
      <div className="flex items-center gap-2 mt-1 text-xs text-[var(--color-text-subtle)]">
        <span>{secret.file}</span>
        <span>•</span>
        <span>Line {secret.line}</span>
      </div>
    </motion.button>
  )
}

function SecretDetail({
  secret,
  onClose,
}: {
  secret: DetectedSecret
  onClose: () => void
}) {
  const color = getSeverityColor(secret.pattern.severity)
  
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="border-t border-[var(--color-border-subtle)] overflow-hidden"
    >
      <div 
        className="p-4"
        style={{ backgroundColor: color + '10' }}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span 
                className="px-2 py-0.5 rounded text-xs font-bold uppercase"
                style={{ backgroundColor: color + '30', color }}
              >
                {secret.pattern.severity}
              </span>
              <span className="font-medium">{secret.pattern.name}</span>
            </div>
            <p className="text-sm text-[var(--color-text-muted)]">
              {secret.pattern.description}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 transition-colors"
          >
            <span className="text-xl">×</span>
          </button>
        </div>
        
        {/* Location */}
        <div className="mb-4">
          <h5 className="text-sm font-medium mb-2">Location</h5>
          <div className="text-sm space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[var(--color-text-muted)]">File:</span>
              <code className="font-mono">{secret.file}</code>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[var(--color-text-muted)]">Line:</span>
              <code className="font-mono">{secret.line}:{secret.column}</code>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[var(--color-text-muted)]">Commit:</span>
              <code className="font-mono">{secret.commit.slice(0, 7)}</code>
            </div>
          </div>
        </div>
        
        {/* Matched value (redacted) */}
        <div className="mb-4">
          <h5 className="text-sm font-medium mb-2">Detected Value (Redacted)</h5>
          <code 
            className="block p-3 rounded bg-black/30 text-sm font-mono break-all"
            style={{ color }}
          >
            {secret.redactedMatch}
          </code>
        </div>
        
        {/* Recommendations */}
        <div>
          <h5 className="text-sm font-medium mb-2">Recommendations</h5>
          <ul className="text-sm text-[var(--color-text-muted)] space-y-1 list-disc list-inside">
            <li>Rotate this credential immediately</li>
            <li>Remove from version control history using git filter-branch</li>
            <li>Use environment variables or a secrets manager</li>
            <li>Add pattern to .gitignore to prevent future exposure</li>
          </ul>
        </div>
      </div>
    </motion.div>
  )
}

function CompactSecretsList({
  secrets,
  onSelect,
}: {
  secrets: DetectedSecret[]
  onSelect: (s: DetectedSecret) => void
}) {
  // Show only critical/high by default
  const prioritySecrets = secrets
    .filter(s => s.pattern.severity === 'critical' || s.pattern.severity === 'high')
    .slice(0, 5)
  
  return (
    <div className="space-y-2">
      {prioritySecrets.map((secret, i) => {
        const color = getSeverityColor(secret.pattern.severity)
        return (
          <motion.button
            key={secret.id}
            onClick={() => onSelect(secret)}
            className="w-full p-2 rounded-lg bg-white/5 hover:bg-white/10 text-left flex items-center gap-2"
            whileHover={{ scale: 1.02 }}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <div 
              className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse"
              style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
            />
            <span className="text-xs truncate flex-1">{secret.pattern.name}</span>
            <code className="text-xs font-mono text-[var(--color-text-muted)]">
              {secret.file.split('/').pop()}
            </code>
          </motion.button>
        )
      })}
      {secrets.length > 5 && (
        <div className="text-xs text-center text-red-400">
          +{secrets.length - 5} more secrets detected
        </div>
      )}
    </div>
  )
}
