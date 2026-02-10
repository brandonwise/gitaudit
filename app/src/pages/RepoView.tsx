import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { parseGitHubUrl, fetchRepoInfo, fetchCommits, type RepoInfo, type Commit } from '../lib/github'
import { Timeline } from '../components/viz/Timeline'
import { ContributorList } from '../components/viz/ContributorList'
import { FileList } from '../components/viz/FileList'
import { SecurityView } from '../components/security/SecurityView'
import { parsePackageJson, type Dependency } from '../lib/deps'
import { useSecurityStore } from '../stores/securityStore'

interface RepoViewProps {
  url: string
}

type Tab = 'activity' | 'security' | 'files' | 'contributors'

export function RepoView({ url }: RepoViewProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [repo, setRepo] = useState<RepoInfo | null>(null)
  const [commits, setCommits] = useState<Commit[]>([])
  const [dependencies, setDependencies] = useState<Dependency[]>([])
  const [tab, setTab] = useState<Tab>('activity')
  const resetSecurityStore = useSecurityStore(state => state.reset)

  const parsed = parseGitHubUrl(url)

  useEffect(() => {
    if (!parsed) {
      setError('Invalid GitHub URL')
      setLoading(false)
      return
    }

    // Reset security store on new repo
    resetSecurityStore()
    
    async function load() {
      try {
        const [repoData, commitData] = await Promise.all([
          fetchRepoInfo(parsed!.owner, parsed!.repo),
          fetchCommits(parsed!.owner, parsed!.repo),
        ])
        setRepo(repoData)
        setCommits(commitData)
        
        // Try to fetch package.json for dependencies
        try {
          const pkgRes = await fetch(
            `https://raw.githubusercontent.com/${parsed!.owner}/${parsed!.repo}/HEAD/package.json`
          )
          if (pkgRes.ok) {
            const pkgContent = await pkgRes.text()
            const parsed = parsePackageJson(pkgContent)
            setDependencies(parsed.dependencies)
          }
        } catch {
          // No package.json, that's fine
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load repository')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [url, resetSecurityStore])

  if (loading) {
    return <LoadingState />
  }

  if (error || !repo) {
    return <ErrorState message={error || 'Unknown error'} />
  }

  return (
    <div className="pt-20 px-6 pb-12">
      <div className="max-w-6xl mx-auto">
        {/* Repo header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <span className="text-[var(--color-text-muted)]">{repo.owner}/</span>
                <span>{repo.name}</span>
              </h1>
              {repo.description && (
                <p className="mt-2 text-[var(--color-text-muted)] max-w-2xl">
                  {repo.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm">
              <Stat label="Stars" value={formatNumber(repo.stars)} />
              <Stat label="Forks" value={formatNumber(repo.forks)} />
              <Stat label="Commits" value={formatNumber(commits.length)} />
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-[var(--color-border-subtle)]">
          <TabButton active={tab === 'activity'} onClick={() => setTab('activity')}>
            Activity
          </TabButton>
          <TabButton active={tab === 'security'} onClick={() => setTab('security')}>
            <span className="flex items-center gap-1">
              🛡️ Security
            </span>
          </TabButton>
          <TabButton active={tab === 'files'} onClick={() => setTab('files')}>
            Hot Files
          </TabButton>
          <TabButton active={tab === 'contributors'} onClick={() => setTab('contributors')}>
            Contributors
          </TabButton>
        </div>

        {/* Content */}
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {tab === 'activity' && <Timeline commits={commits} />}
          {tab === 'security' && (
            <SecurityView 
              commits={commits} 
              dependencies={dependencies}
              repoOwner={repo.owner}
              repoName={repo.name}
            />
          )}
          {tab === 'files' && <FileList commits={commits} />}
          {tab === 'contributors' && <ContributorList commits={commits} />}
        </motion.div>
      </div>
    </div>
  )
}

function TabButton({ 
  children, 
  active, 
  onClick 
}: { 
  children: React.ReactNode
  active: boolean
  onClick: () => void 
}) {
  return (
    <button
      onClick={onClick}
      className={`
        px-4 py-2 text-sm font-medium -mb-px
        border-b-2 transition-colors
        ${active 
          ? 'border-[var(--color-accent)] text-[var(--color-text)]' 
          : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
        }
      `}
    >
      {children}
    </button>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="font-semibold">{value}</div>
      <div className="text-[var(--color-text-subtle)]">{label}</div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="pt-32 flex flex-col items-center justify-center">
      <div className="w-8 h-8 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
      <p className="mt-4 text-[var(--color-text-muted)]">Loading repository...</p>
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="pt-32 flex flex-col items-center justify-center">
      <div className="text-4xl mb-4">😵</div>
      <p className="text-[var(--color-error)]">{message}</p>
    </div>
  )
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}m`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return n.toString()
}
