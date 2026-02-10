/**
 * Secret Detection Engine
 * 
 * Port of Gitleaks patterns for detecting leaked credentials in code.
 * Patterns are MIT licensed from github.com/gitleaks/gitleaks
 */

export interface SecretPattern {
  id: string
  name: string
  pattern: RegExp
  severity: 'critical' | 'high' | 'medium' | 'low'
  description: string
}

export interface DetectedSecret {
  id: string
  pattern: SecretPattern
  match: string
  redactedMatch: string
  line: number
  column: number
  file: string
  commit: string
  author: string
  date: string
}

// Core secret patterns - ported from Gitleaks
export const SECRET_PATTERNS: SecretPattern[] = [
  // AWS
  {
    id: 'aws-access-key',
    name: 'AWS Access Key ID',
    pattern: /(?:AKIA|A3T|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g,
    severity: 'critical',
    description: 'AWS Access Key ID allows access to AWS services'
  },
  {
    id: 'aws-secret-key',
    name: 'AWS Secret Access Key',
    pattern: /(?:aws_secret_access_key|aws_secret_key|secret_access_key)\s*[:=]\s*['"]?([A-Za-z0-9+/]{40})['"]?/gi,
    severity: 'critical',
    description: 'AWS Secret Access Key provides full AWS access'
  },
  
  // GitHub
  {
    id: 'github-pat',
    name: 'GitHub Personal Access Token',
    pattern: /ghp_[A-Za-z0-9]{36}/g,
    severity: 'critical',
    description: 'GitHub PAT can access repositories and user data'
  },
  {
    id: 'github-oauth',
    name: 'GitHub OAuth Token',
    pattern: /gho_[A-Za-z0-9]{36}/g,
    severity: 'critical',
    description: 'GitHub OAuth token for API access'
  },
  {
    id: 'github-app-token',
    name: 'GitHub App Token',
    pattern: /(?:ghu|ghs)_[A-Za-z0-9]{36}/g,
    severity: 'critical',
    description: 'GitHub App installation or user access token'
  },
  {
    id: 'github-refresh-token',
    name: 'GitHub Refresh Token',
    pattern: /ghr_[A-Za-z0-9]{36}/g,
    severity: 'high',
    description: 'GitHub refresh token for OAuth flow'
  },

  // Stripe
  {
    id: 'stripe-secret',
    name: 'Stripe Secret Key',
    pattern: /sk_live_[A-Za-z0-9]{24,}/g,
    severity: 'critical',
    description: 'Stripe live secret key - can process real payments'
  },
  {
    id: 'stripe-restricted',
    name: 'Stripe Restricted Key',
    pattern: /rk_live_[A-Za-z0-9]{24,}/g,
    severity: 'high',
    description: 'Stripe restricted API key'
  },

  // API Keys - Generic
  {
    id: 'openai-key',
    name: 'OpenAI API Key',
    pattern: /sk-[A-Za-z0-9]{32,}/g,
    severity: 'high',
    description: 'OpenAI API key for GPT and other models'
  },
  {
    id: 'anthropic-key',
    name: 'Anthropic API Key',
    pattern: /sk-ant-[A-Za-z0-9-]{32,}/g,
    severity: 'high',
    description: 'Anthropic API key for Claude models'
  },

  // Database
  {
    id: 'postgres-url',
    name: 'PostgreSQL Connection String',
    pattern: /postgres(?:ql)?:\/\/[^:]+:[^@]+@[^/]+\/[^\s"']+/gi,
    severity: 'critical',
    description: 'Database connection string with credentials'
  },
  {
    id: 'mongodb-url',
    name: 'MongoDB Connection String',
    pattern: /mongodb(?:\+srv)?:\/\/[^:]+:[^@]+@[^/]+/gi,
    severity: 'critical',
    description: 'MongoDB connection string with credentials'
  },
  {
    id: 'mysql-url',
    name: 'MySQL Connection String',
    pattern: /mysql:\/\/[^:]+:[^@]+@[^/]+/gi,
    severity: 'critical',
    description: 'MySQL connection string with credentials'
  },

  // Private Keys
  {
    id: 'private-key-rsa',
    name: 'RSA Private Key',
    pattern: /-----BEGIN RSA PRIVATE KEY-----/g,
    severity: 'critical',
    description: 'RSA private key for authentication/encryption'
  },
  {
    id: 'private-key-openssh',
    name: 'OpenSSH Private Key',
    pattern: /-----BEGIN OPENSSH PRIVATE KEY-----/g,
    severity: 'critical',
    description: 'OpenSSH private key for SSH authentication'
  },
  {
    id: 'private-key-ec',
    name: 'EC Private Key',
    pattern: /-----BEGIN EC PRIVATE KEY-----/g,
    severity: 'critical',
    description: 'Elliptic curve private key'
  },
  {
    id: 'private-key-pgp',
    name: 'PGP Private Key',
    pattern: /-----BEGIN PGP PRIVATE KEY BLOCK-----/g,
    severity: 'critical',
    description: 'PGP private key for encryption'
  },

  // Cloud Providers
  {
    id: 'gcp-api-key',
    name: 'Google Cloud API Key',
    pattern: /AIza[A-Za-z0-9_-]{35}/g,
    severity: 'high',
    description: 'Google Cloud Platform API key'
  },
  {
    id: 'gcp-service-account',
    name: 'GCP Service Account',
    pattern: /"type":\s*"service_account"/g,
    severity: 'high',
    description: 'Google Cloud service account JSON key'
  },
  {
    id: 'azure-storage',
    name: 'Azure Storage Key',
    pattern: /DefaultEndpointsProtocol=https;AccountName=[^;]+;AccountKey=[A-Za-z0-9+/=]{86,}/g,
    severity: 'critical',
    description: 'Azure Storage connection string'
  },

  // Auth Tokens
  {
    id: 'jwt',
    name: 'JSON Web Token',
    pattern: /eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g,
    severity: 'medium',
    description: 'JWT token - may contain sensitive claims'
  },
  {
    id: 'basic-auth',
    name: 'Basic Auth Credentials',
    pattern: /(?:basic|authorization)\s*[:=]\s*['"]?[A-Za-z0-9+/]{20,}={0,2}['"]?/gi,
    severity: 'high',
    description: 'Basic authentication credentials'
  },

  // Slack
  {
    id: 'slack-token',
    name: 'Slack Token',
    pattern: /xox[baprs]-[A-Za-z0-9-]{10,}/g,
    severity: 'high',
    description: 'Slack API token'
  },
  {
    id: 'slack-webhook',
    name: 'Slack Webhook URL',
    pattern: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]+/g,
    severity: 'medium',
    description: 'Slack incoming webhook URL'
  },

  // Discord
  {
    id: 'discord-token',
    name: 'Discord Bot Token',
    pattern: /[MN][A-Za-z\d]{23,}\.[\w-]{6}\.[\w-]{27}/g,
    severity: 'high',
    description: 'Discord bot token'
  },
  {
    id: 'discord-webhook',
    name: 'Discord Webhook',
    pattern: /https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+/g,
    severity: 'medium',
    description: 'Discord webhook URL'
  },

  // NPM
  {
    id: 'npm-token',
    name: 'NPM Access Token',
    pattern: /npm_[A-Za-z0-9]{36}/g,
    severity: 'high',
    description: 'NPM registry access token'
  },

  // Twilio
  {
    id: 'twilio-api-key',
    name: 'Twilio API Key',
    pattern: /SK[a-f0-9]{32}/g,
    severity: 'high',
    description: 'Twilio API key'
  },

  // SendGrid
  {
    id: 'sendgrid-key',
    name: 'SendGrid API Key',
    pattern: /SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}/g,
    severity: 'high',
    description: 'SendGrid email API key'
  },

  // Mailchimp
  {
    id: 'mailchimp-key',
    name: 'Mailchimp API Key',
    pattern: /[a-f0-9]{32}-us\d{1,2}/g,
    severity: 'medium',
    description: 'Mailchimp API key'
  },

  // Generic secrets
  {
    id: 'generic-password',
    name: 'Password in Config',
    pattern: /(?:password|passwd|pwd|secret)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
    severity: 'medium',
    description: 'Hardcoded password in configuration'
  },
  {
    id: 'generic-api-key',
    name: 'Generic API Key',
    pattern: /(?:api[_-]?key|apikey|api[_-]?secret)\s*[:=]\s*['"][A-Za-z0-9_-]{20,}['"]/gi,
    severity: 'medium',
    description: 'Generic API key pattern'
  },
]

/**
 * Redact a secret value, showing only first/last chars
 */
function redactSecret(match: string): string {
  if (match.length <= 8) {
    return '*'.repeat(match.length)
  }
  const visible = Math.min(4, Math.floor(match.length / 4))
  return match.slice(0, visible) + '*'.repeat(match.length - visible * 2) + match.slice(-visible)
}

/**
 * Scan content for secrets
 */
export function scanForSecrets(
  content: string,
  metadata: {
    file: string
    commit: string
    author: string
    date: string
  }
): DetectedSecret[] {
  const secrets: DetectedSecret[] = []
  
  for (const pattern of SECRET_PATTERNS) {
    // Reset regex state
    pattern.pattern.lastIndex = 0
    
    let match: RegExpExecArray | null
    while ((match = pattern.pattern.exec(content)) !== null) {
      // Find line number
      const beforeMatch = content.slice(0, match.index)
      const lineNumber = beforeMatch.split('\n').length
      const lineStart = beforeMatch.lastIndexOf('\n') + 1
      const column = match.index - lineStart + 1
      
      // Skip if it looks like a placeholder/example
      const matchLower = match[0].toLowerCase()
      if (
        matchLower.includes('example') ||
        matchLower.includes('placeholder') ||
        matchLower.includes('your-') ||
        matchLower.includes('xxx') ||
        matchLower.includes('your_') ||
        match[0] === 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
      ) {
        continue
      }
      
      secrets.push({
        id: `${pattern.id}-${match.index}`,
        pattern,
        match: match[0],
        redactedMatch: redactSecret(match[0]),
        line: lineNumber,
        column,
        file: metadata.file,
        commit: metadata.commit,
        author: metadata.author,
        date: metadata.date,
      })
    }
  }
  
  return secrets
}

/**
 * Get severity color for a secret
 */
export function getSeverityColor(severity: SecretPattern['severity']): string {
  switch (severity) {
    case 'critical': return '#ff4444'
    case 'high': return '#ff8c00'
    case 'medium': return '#ffcc00'
    case 'low': return '#44cc44'
    default: return '#888888'
  }
}

/**
 * Get severity glow for a secret
 */
export function getSeverityGlow(severity: SecretPattern['severity']): string {
  switch (severity) {
    case 'critical': return '0 0 20px rgba(255, 68, 68, 0.6)'
    case 'high': return '0 0 15px rgba(255, 140, 0, 0.5)'
    case 'medium': return '0 0 10px rgba(255, 204, 0, 0.4)'
    case 'low': return '0 0 8px rgba(68, 204, 68, 0.3)'
    default: return 'none'
  }
}
