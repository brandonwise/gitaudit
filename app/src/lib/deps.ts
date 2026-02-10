/**
 * Dependency Parser
 * 
 * Parse dependency files from various ecosystems.
 */

export type Ecosystem = 'npm' | 'pypi' | 'go' | 'cargo' | 'rubygems' | 'maven'

export interface Dependency {
  name: string
  version: string
  ecosystem: Ecosystem
  isDev: boolean
  source: string // filename
}

export interface ParsedDependencies {
  ecosystem: Ecosystem
  dependencies: Dependency[]
  source: string
}

/**
 * Parse package.json (npm/yarn/pnpm)
 */
export function parsePackageJson(content: string, filename = 'package.json'): ParsedDependencies {
  const deps: Dependency[] = []
  
  try {
    const pkg = JSON.parse(content)
    
    // Production dependencies
    if (pkg.dependencies) {
      for (const [name, version] of Object.entries(pkg.dependencies)) {
        deps.push({
          name,
          version: cleanVersion(version as string),
          ecosystem: 'npm',
          isDev: false,
          source: filename,
        })
      }
    }
    
    // Dev dependencies
    if (pkg.devDependencies) {
      for (const [name, version] of Object.entries(pkg.devDependencies)) {
        deps.push({
          name,
          version: cleanVersion(version as string),
          ecosystem: 'npm',
          isDev: true,
          source: filename,
        })
      }
    }
    
    // Peer dependencies
    if (pkg.peerDependencies) {
      for (const [name, version] of Object.entries(pkg.peerDependencies)) {
        deps.push({
          name,
          version: cleanVersion(version as string),
          ecosystem: 'npm',
          isDev: false,
          source: filename,
        })
      }
    }
  } catch {
    // Invalid JSON
  }
  
  return { ecosystem: 'npm', dependencies: deps, source: filename }
}

/**
 * Parse requirements.txt (Python pip)
 */
export function parseRequirementsTxt(content: string, filename = 'requirements.txt'): ParsedDependencies {
  const deps: Dependency[] = []
  const lines = content.split('\n')
  
  for (const line of lines) {
    const trimmed = line.trim()
    
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-')) {
      continue
    }
    
    // Parse package==version, package>=version, etc.
    const match = trimmed.match(/^([A-Za-z0-9_-]+)\s*(?:[=<>!~]+\s*)?([0-9][^\s,;#]*)?/)
    if (match) {
      deps.push({
        name: match[1].toLowerCase(),
        version: match[2] || '*',
        ecosystem: 'pypi',
        isDev: filename.includes('dev') || filename.includes('test'),
        source: filename,
      })
    }
  }
  
  return { ecosystem: 'pypi', dependencies: deps, source: filename }
}

/**
 * Parse go.mod (Go modules)
 */
export function parseGoMod(content: string, filename = 'go.mod'): ParsedDependencies {
  const deps: Dependency[] = []
  const lines = content.split('\n')
  let inRequire = false
  
  for (const line of lines) {
    const trimmed = line.trim()
    
    if (trimmed === 'require (') {
      inRequire = true
      continue
    }
    
    if (trimmed === ')') {
      inRequire = false
      continue
    }
    
    // Single require line
    const singleMatch = trimmed.match(/^require\s+([^\s]+)\s+v?([^\s]+)/)
    if (singleMatch) {
      deps.push({
        name: singleMatch[1],
        version: singleMatch[2],
        ecosystem: 'go',
        isDev: false,
        source: filename,
      })
      continue
    }
    
    // Inside require block
    if (inRequire) {
      const match = trimmed.match(/^([^\s]+)\s+v?([^\s]+)/)
      if (match && !match[1].startsWith('//')) {
        deps.push({
          name: match[1],
          version: match[2].replace(/\/\/.*/, '').trim(),
          ecosystem: 'go',
          isDev: false,
          source: filename,
        })
      }
    }
  }
  
  return { ecosystem: 'go', dependencies: deps, source: filename }
}

/**
 * Parse Cargo.toml (Rust)
 */
export function parseCargoToml(content: string, filename = 'Cargo.toml'): ParsedDependencies {
  const deps: Dependency[] = []
  const lines = content.split('\n')
  let section: 'none' | 'dependencies' | 'dev-dependencies' = 'none'
  
  for (const line of lines) {
    const trimmed = line.trim()
    
    // Section headers
    if (trimmed === '[dependencies]') {
      section = 'dependencies'
      continue
    }
    if (trimmed === '[dev-dependencies]') {
      section = 'dev-dependencies'
      continue
    }
    if (trimmed.startsWith('[')) {
      section = 'none'
      continue
    }
    
    if (section === 'none') continue
    
    // Simple: package = "version"
    const simpleMatch = trimmed.match(/^([A-Za-z0-9_-]+)\s*=\s*"([^"]+)"/)
    if (simpleMatch) {
      deps.push({
        name: simpleMatch[1],
        version: simpleMatch[2],
        ecosystem: 'cargo',
        isDev: section === 'dev-dependencies',
        source: filename,
      })
      continue
    }
    
    // Complex: package = { version = "x.y.z", ... }
    const complexMatch = trimmed.match(/^([A-Za-z0-9_-]+)\s*=\s*\{.*version\s*=\s*"([^"]+)"/)
    if (complexMatch) {
      deps.push({
        name: complexMatch[1],
        version: complexMatch[2],
        ecosystem: 'cargo',
        isDev: section === 'dev-dependencies',
        source: filename,
      })
    }
  }
  
  return { ecosystem: 'cargo', dependencies: deps, source: filename }
}

/**
 * Parse Gemfile (Ruby)
 */
export function parseGemfile(content: string, filename = 'Gemfile'): ParsedDependencies {
  const deps: Dependency[] = []
  const lines = content.split('\n')
  let inDevGroup = false
  
  for (const line of lines) {
    const trimmed = line.trim()
    
    // Track dev group
    if (trimmed.match(/group\s*:(?:development|test)/)) {
      inDevGroup = true
    }
    if (trimmed === 'end' && inDevGroup) {
      inDevGroup = false
    }
    
    // gem 'name', 'version'
    const match = trimmed.match(/gem\s+['"]([^'"]+)['"]\s*(?:,\s*['"]([^'"]*)['""])?/)
    if (match) {
      deps.push({
        name: match[1],
        version: match[2] || '*',
        ecosystem: 'rubygems',
        isDev: inDevGroup,
        source: filename,
      })
    }
  }
  
  return { ecosystem: 'rubygems', dependencies: deps, source: filename }
}

/**
 * Parse pom.xml (Maven/Java) - basic parsing
 */
export function parsePomXml(content: string, filename = 'pom.xml'): ParsedDependencies {
  const deps: Dependency[] = []
  
  // Simple regex-based parsing (not full XML)
  const depRegex = /<dependency>\s*<groupId>([^<]+)<\/groupId>\s*<artifactId>([^<]+)<\/artifactId>\s*(?:<version>([^<]+)<\/version>)?/g
  
  let match
  while ((match = depRegex.exec(content)) !== null) {
    deps.push({
      name: `${match[1]}:${match[2]}`,
      version: match[3] || '*',
      ecosystem: 'maven',
      isDev: false,
      source: filename,
    })
  }
  
  return { ecosystem: 'maven', dependencies: deps, source: filename }
}

/**
 * Auto-detect and parse a dependency file
 */
export function parseDependencyFile(filename: string, content: string): ParsedDependencies | null {
  const name = filename.toLowerCase()
  
  if (name === 'package.json' || name.endsWith('/package.json')) {
    return parsePackageJson(content, filename)
  }
  
  if (name === 'requirements.txt' || name.includes('requirements') && name.endsWith('.txt')) {
    return parseRequirementsTxt(content, filename)
  }
  
  if (name === 'go.mod' || name.endsWith('/go.mod')) {
    return parseGoMod(content, filename)
  }
  
  if (name === 'cargo.toml' || name.endsWith('/cargo.toml')) {
    return parseCargoToml(content, filename)
  }
  
  if (name === 'gemfile' || name.endsWith('/gemfile')) {
    return parseGemfile(content, filename)
  }
  
  if (name === 'pom.xml' || name.endsWith('/pom.xml')) {
    return parsePomXml(content, filename)
  }
  
  return null
}

/**
 * Check if a file is a dependency file
 */
export function isDependencyFile(filename: string): boolean {
  const name = filename.toLowerCase()
  return (
    name === 'package.json' ||
    name.endsWith('/package.json') ||
    name === 'requirements.txt' ||
    name.includes('requirements') && name.endsWith('.txt') ||
    name === 'go.mod' ||
    name.endsWith('/go.mod') ||
    name === 'cargo.toml' ||
    name.endsWith('/cargo.toml') ||
    name === 'gemfile' ||
    name.endsWith('/gemfile') ||
    name === 'pom.xml' ||
    name.endsWith('/pom.xml') ||
    name === 'pyproject.toml' ||
    name.endsWith('/pyproject.toml')
  )
}

/**
 * Clean version string (remove ^, ~, etc.)
 */
function cleanVersion(version: string): string {
  return version.replace(/^[\^~>=<]/, '').split(' ')[0]
}
