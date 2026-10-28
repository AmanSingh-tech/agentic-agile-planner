export type Step = {
  tool: string
  input: string
  output: string
  durationMs: number
  success: boolean
}

export type PlanResult = {
  summary: string
  steps: Step[]
  totalMs: number
  model: string
}

export type AgentSkill = {
  id: string
  name: string
  description: string
  tags?: string[]
  examples?: string[]
}

export type AgentCard = {
  name: string
  description: string
  version: string
  skills: AgentSkill[]
  supportedInterfaces?: { protocolBinding: string; url: string }[]
}

export type AgentTurn = { contextId: string | null; text: string; ms: number }

const DEFAULT_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/orchestrator-agent'
const STORAGE_KEY = 'planner.apiBaseUrl'

export function getBaseUrl(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_BASE_URL
  } catch {
    return DEFAULT_BASE_URL
  }
}

export function setBaseUrl(url: string) {
  try {
    if (url.trim()) localStorage.setItem(STORAGE_KEY, url.trim().replace(/\/+$/, ''))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* storage unavailable — keep the default */
  }
}

async function request<T>(path: string, init: RequestInit, parse: (r: Response) => Promise<T>): Promise<T> {
  let res: Response
  try {
    res = await fetch(getBaseUrl() + path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init.headers },
    })
  } catch {
    throw new Error(`Cannot reach the orchestrator at ${getBaseUrl()}. Is it running, and is CORS allowed?`)
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 500) || res.statusText}`)
  }
  return parse(res)
}

// Manual endpoints answer with "contextId:<id>\n<agent text>"
function parseTurn(raw: string, ms: number): AgentTurn {
  const match = raw.match(/^contextId:(\S+)\n?([\s\S]*)$/)
  return match ? { contextId: match[1], text: match[2], ms } : { contextId: null, text: raw, ms }
}

async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const start = performance.now()
  const value = await fn()
  return [value, Math.round(performance.now() - start)]
}

export const api = {
  agents: () => request<Record<string, AgentCard>>('/orchestrator/agents', { method: 'GET' }, (r) => r.json()),

  plan: (requirement: string, projectKey: string) =>
    request<PlanResult>(
      '/orchestrator/plan',
      { method: 'POST', body: JSON.stringify({ requirement, projectKey }) },
      (r) => r.json(),
    ),

  start: async (requirement: string) => {
    const [raw, ms] = await timed(() =>
      request('/orchestrator/requirement/start', { method: 'POST', body: JSON.stringify({ requirement }) }, (r) =>
        r.text(),
      ),
    )
    return parseTurn(raw, ms)
  },

  refine: async (contextId: string, feedback: string) => {
    const [raw, ms] = await timed(() =>
      request(
        '/orchestrator/requirement/refine',
        { method: 'POST', body: JSON.stringify({ contextId, feedback }) },
        (r) => r.text(),
      ),
    )
    return parseTurn(raw, ms)
  },

  approve: async (contextId: string, projectKey: string): Promise<AgentTurn> => {
    const [raw, ms] = await timed(() =>
      request(
        '/orchestrator/requirement/approve',
        { method: 'POST', body: JSON.stringify({ contextId, projectKey }) },
        (r) => r.text(),
      ),
    )
    return { contextId, text: raw, ms }
  },
}

export function formatMs(ms: number): string {
  if (ms < 1000) return `${ms} ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)} s`
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`
}
