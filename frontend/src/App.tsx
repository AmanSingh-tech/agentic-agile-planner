import { useCallback, useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { api, formatMs, getBaseUrl, setBaseUrl } from './api'
import type { AgentCard, AgentTurn, PlanResult, Step } from './api'
import './App.css'

type Tab = 'auto' | 'manual' | 'agents' | 'runs'

type RunRecord = {
  at: string
  requirement: string
  totalMs: number
  agentMs: number
  steps: number
  refinements: number
  model: string
  ok: boolean
}

const SAMPLES = [
  'Build JWT authentication with login, logout and refresh token generation',
  'Users can reset their password via an emailed one-time link that expires in 15 minutes',
  'Add a shopping cart where customers can add, remove and update item quantities before checkout',
]

const RUNS_KEY = 'planner.runs'

function loadRuns(): RunRecord[] {
  try {
    return JSON.parse(localStorage.getItem(RUNS_KEY) || '[]')
  } catch {
    return []
  }
}

function saveRuns(runs: RunRecord[]) {
  try {
    localStorage.setItem(RUNS_KEY, JSON.stringify(runs.slice(0, 50)))
  } catch {
    /* storage unavailable */
  }
}

function useElapsed(running: boolean) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!running) return
    const start = Date.now()
    setElapsed(0)
    const id = setInterval(() => setElapsed(Date.now() - start), 250)
    return () => clearInterval(id)
  }, [running])
  return elapsed
}

function Markdown({ text }: { text: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState<Tab>('auto')
  const [agents, setAgents] = useState<Record<string, AgentCard> | null>(null)
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [showSettings, setShowSettings] = useState(false)
  const [baseUrlDraft, setBaseUrlDraft] = useState(getBaseUrl())
  const [runs, setRuns] = useState<RunRecord[]>(loadRuns)

  const checkConnection = useCallback(async () => {
    setStatus('checking')
    try {
      setAgents(await api.agents())
      setStatus('online')
    } catch {
      setAgents(null)
      setStatus('offline')
    }
  }, [])

  useEffect(() => {
    checkConnection()
  }, [checkConnection])

  const addRun = (run: RunRecord) => {
    setRuns((prev) => {
      const next = [run, ...prev]
      saveRuns(next)
      return next
    })
  }

  const skillCount = agents ? Object.keys(agents).length : 0

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="logo" aria-hidden>
            ◆
          </span>
          <div>
            <h1>Agentic Agile Planner</h1>
            <p className="subtitle">Requirement → user stories → Jira, by collaborating A2A agents</p>
          </div>
        </div>
        <div className="header-actions">
          <button className={`status status-${status}`} onClick={checkConnection} title={getBaseUrl()}>
            <span className="dot" />
            {status === 'online' ? `Online · ${skillCount} skills` : status === 'offline' ? 'Offline' : 'Checking…'}
          </button>
          <button className="ghost" onClick={() => setShowSettings((s) => !s)}>
            Settings
          </button>
        </div>
      </header>

      {showSettings && (
        <section className="card settings">
          <label htmlFor="baseUrl">Orchestrator API URL</label>
          <div className="row">
            <input
              id="baseUrl"
              value={baseUrlDraft}
              onChange={(e) => setBaseUrlDraft(e.target.value)}
              placeholder="http://localhost:8080/orchestrator-agent"
            />
            <button
              onClick={() => {
                setBaseUrl(baseUrlDraft)
                setBaseUrlDraft(getBaseUrl())
                checkConnection()
              }}
            >
              Save
            </button>
          </div>
          <p className="hint">
            The backend runs where Ollama runs (usually your machine). From a Vercel deployment, point this at
            <code> http://localhost:8080/orchestrator-agent</code> or at a public tunnel URL.
          </p>
        </section>
      )}

      {status === 'offline' && (
        <div className="banner error">
          Cannot reach the orchestrator at <code>{getBaseUrl()}</code>. Start the backend (see README) or change the
          URL in Settings.
        </div>
      )}

      <nav className="tabs" role="tablist">
        {(
          [
            ['auto', 'Autonomous'],
            ['manual', 'Step-by-step'],
            ['agents', 'Agents'],
            ['runs', `Runs${runs.length ? ` (${runs.length})` : ''}`],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      <main>
        {tab === 'auto' && <AutonomousPanel onRun={addRun} />}
        {tab === 'manual' && <ManualPanel />}
        {tab === 'agents' && <AgentsPanel agents={agents} />}
        {tab === 'runs' && (
          <RunsPanel
            runs={runs}
            onClear={() => {
              setRuns([])
              saveRuns([])
            }}
          />
        )}
      </main>
    </div>
  )
}

function RequirementForm({
  busy,
  submitLabel,
  withProjectKey,
  onSubmit,
}: {
  busy: boolean
  submitLabel: string
  withProjectKey: boolean
  onSubmit: (requirement: string, projectKey: string) => void
}) {
  const [requirement, setRequirement] = useState('')
  const [projectKey, setProjectKey] = useState('DEMO')
  return (
    <form
      className="card form"
      onSubmit={(e) => {
        e.preventDefault()
        if (requirement.trim()) onSubmit(requirement.trim(), projectKey.trim())
      }}
    >
      <label htmlFor="requirement">Requirement</label>
      <textarea
        id="requirement"
        rows={4}
        value={requirement}
        onChange={(e) => setRequirement(e.target.value)}
        placeholder="Describe the feature in plain English…"
        disabled={busy}
      />
      <div className="samples">
        {SAMPLES.map((s) => (
          <button type="button" key={s} className="chip" onClick={() => setRequirement(s)} disabled={busy}>
            {s.length > 48 ? s.slice(0, 48) + '…' : s}
          </button>
        ))}
      </div>
      <div className="row end">
        {withProjectKey && (
          <div className="field-inline">
            <label htmlFor="projectKey">Jira project key</label>
            <input id="projectKey" value={projectKey} onChange={(e) => setProjectKey(e.target.value)} disabled={busy} />
          </div>
        )}
        <button type="submit" className="primary" disabled={busy || !requirement.trim()}>
          {busy ? 'Working…' : submitLabel}
        </button>
      </div>
    </form>
  )
}

function Running({ elapsed, label }: { elapsed: number; label: string }) {
  return (
    <div className="card running">
      <div className="spinner" />
      <div>
        <strong>{label}</strong>
        <p className="hint">Elapsed {formatMs(elapsed)} · local LLMs on CPU can take a few minutes</p>
      </div>
    </div>
  )
}

function AutonomousPanel({ onRun }: { onRun: (r: RunRecord) => void }) {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<PlanResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const elapsed = useElapsed(busy)

  const run = async (requirement: string, projectKey: string) => {
    setBusy(true)
    setError(null)
    setResult(null)
    const started = performance.now()
    try {
      const res = await api.plan(requirement, projectKey)
      setResult(res)
      const agentMs = res.steps.reduce((sum, s) => sum + s.durationMs, 0)
      onRun({
        at: new Date().toISOString(),
        requirement,
        totalMs: res.totalMs,
        agentMs,
        steps: res.steps.length,
        refinements: res.steps.filter((s) => s.tool === 'refineRequirement').length,
        model: res.model,
        ok: res.steps.some((s) => s.tool === 'approveRequirement' && s.success),
      })
    } catch (e) {
      setError((e as Error).message)
      onRun({
        at: new Date().toISOString(),
        requirement,
        totalMs: Math.round(performance.now() - started),
        agentMs: 0,
        steps: 0,
        refinements: 0,
        model: '—',
        ok: false,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <p className="lede">
        One request. The orchestrator LLM calls the Requirement Analysis agent, reviews and refines the stories,
        then approves them, which creates the Epic and stores acceptance criteria in PGVector.
      </p>
      <RequirementForm busy={busy} submitLabel="Plan sprint" withProjectKey onSubmit={run} />
      {busy && <Running elapsed={elapsed} label="Agents are planning…" />}
      {error && <div className="banner error">{error}</div>}
      {result && <PlanView result={result} />}
    </>
  )
}

function PlanView({ result }: { result: PlanResult }) {
  const agentMs = result.steps.reduce((sum, s) => sum + s.durationMs, 0)
  const orchestratorMs = Math.max(result.totalMs - agentMs, 0)
  const approved = result.steps.some((s) => s.tool === 'approveRequirement' && s.success)
  return (
    <>
      <section className="metrics">
        <Metric label="Total time" value={formatMs(result.totalMs)} />
        <Metric label="Agent calls (A2A)" value={formatMs(agentMs)} hint={`${result.steps.length} tool calls`} />
        <Metric label="Orchestrator reasoning" value={formatMs(orchestratorMs)} />
        <Metric label="Refinements" value={String(result.steps.filter((s) => s.tool === 'refineRequirement').length)} />
        <Metric label="Outcome" value={approved ? 'Approved' : 'Not approved'} tone={approved ? 'good' : 'warn'} hint={result.model} />
      </section>

      <section className="card">
        <h2>Execution trace</h2>
        {result.steps.length === 0 ? (
          <p className="hint">The orchestrator LLM answered without calling any tools.</p>
        ) : (
          <ol className="timeline">
            {result.steps.map((s, i) => (
              <StepRow key={i} step={s} index={i} max={Math.max(...result.steps.map((x) => x.durationMs), 1)} />
            ))}
          </ol>
        )}
      </section>

      <section className="card">
        <h2>Orchestrator summary</h2>
        <Markdown text={result.summary || '_No summary returned._'} />
      </section>
    </>
  )
}

function Metric({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'good' | 'warn' }) {
  return (
    <div className={`metric ${tone ?? ''}`}>
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value}</span>
      {hint && <span className="metric-hint">{hint}</span>}
    </div>
  )
}

function StepRow({ step, index, max }: { step: Step; index: number; max: number }) {
  return (
    <li className={`step ${step.success ? '' : 'failed'}`}>
      <details>
        <summary>
          <span className="step-index">{index + 1}</span>
          <span className="step-tool">{step.tool}</span>
          <span className="bar">
            <span style={{ width: `${Math.max((step.durationMs / max) * 100, 2)}%` }} />
          </span>
          <span className="step-time">{formatMs(step.durationMs)}</span>
        </summary>
        <div className="step-body">
          <h4>Input</h4>
          <pre>{step.input}</pre>
          <h4>Output</h4>
          <Markdown text={step.output || ''} />
        </div>
      </details>
    </li>
  )
}

function ManualPanel() {
  const [turns, setTurns] = useState<(AgentTurn & { kind: string; prompt: string })[]>([])
  const [contextId, setContextId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')
  const [projectKey, setProjectKey] = useState('DEMO')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const elapsed = useElapsed(busy !== null)

  const call = async (kind: string, prompt: string, fn: () => Promise<AgentTurn>) => {
    setBusy(kind)
    setError(null)
    try {
      const turn = await fn()
      if (turn.contextId) setContextId(turn.contextId)
      setTurns((t) => [...t, { ...turn, kind, prompt }])
      return true
    } catch (e) {
      setError((e as Error).message)
      return false
    } finally {
      setBusy(null)
    }
  }

  const reset = () => {
    setTurns([])
    setContextId(null)
    setFeedback('')
    setDone(false)
    setError(null)
  }

  const total = turns.reduce((s, t) => s + t.ms, 0)

  return (
    <>
      <p className="lede">
        Human in the loop: you review each version of the stories, send feedback, and approve when they're ready.
        The agent keeps the conversation in memory under one A2A <code>contextId</code>.
      </p>

      {!contextId && !busy && (
        <RequirementForm
          busy={false}
          submitLabel="Generate stories"
          withProjectKey={false}
          onSubmit={(req) => call('Analyze', req, () => api.start(req))}
        />
      )}

      {turns.length > 0 && (
        <section className="metrics">
          <Metric label="Session" value={contextId ? contextId.slice(0, 8) + '…' : '—'} />
          <Metric label="Turns" value={String(turns.length)} />
          <Metric label="Total agent time" value={formatMs(total)} />
        </section>
      )}

      {turns.map((t, i) => (
        <section className="card turn" key={i}>
          <header className="turn-head">
            <span className={`pill pill-${t.kind.toLowerCase()}`}>{t.kind}</span>
            <span className="turn-prompt">{t.prompt}</span>
            <span className="step-time">{formatMs(t.ms)}</span>
          </header>
          <Markdown text={t.text} />
        </section>
      ))}

      {busy && <Running elapsed={elapsed} label={`${busy} in progress…`} />}
      {error && <div className="banner error">{error}</div>}

      {contextId && !done && !busy && (
        <section className="card form">
          <label htmlFor="feedback">Feedback</label>
          <textarea
            id="feedback"
            rows={3}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="e.g. Split story 2 into two stories and add an acceptance criterion for invalid tokens"
          />
          <div className="row end">
            <button
              disabled={!feedback.trim()}
              onClick={async () => {
                const text = feedback.trim()
                if (await call('Refine', text, () => api.refine(contextId, text))) setFeedback('')
              }}
            >
              Refine
            </button>
            <div className="field-inline">
              <label htmlFor="mProjectKey">Jira project key</label>
              <input id="mProjectKey" value={projectKey} onChange={(e) => setProjectKey(e.target.value)} />
            </div>
            <button
              className="primary"
              onClick={async () => {
                if (await call('Approve', `Approve into ${projectKey}`, () => api.approve(contextId, projectKey))) setDone(true)
              }}
            >
              Approve & create in Jira
            </button>
          </div>
        </section>
      )}

      {(done || (turns.length > 0 && !contextId)) && (
        <div className="row end">
          <button onClick={reset}>Start a new requirement</button>
        </div>
      )}
    </>
  )
}

function AgentsPanel({ agents }: { agents: Record<string, AgentCard> | null }) {
  if (!agents) return <p className="hint">Connect to the orchestrator to see discovered agents.</p>
  const byName = new Map<string, AgentCard>()
  Object.values(agents).forEach((card) => byName.set(card.name, card))
  if (byName.size === 0) return <p className="hint">The orchestrator is running but discovered no agents.</p>
  return (
    <>
      <p className="lede">
        Agents discovered at startup from <code>/.well-known/agent-card.json</code>. The orchestrator routes each
        request by skill ID.
      </p>
      {[...byName.values()].map((card) => (
        <section className="card" key={card.name}>
          <div className="agent-head">
            <h2>{card.name}</h2>
            <span className="pill">v{card.version}</span>
          </div>
          <p className="hint">{card.description}</p>
          {card.supportedInterfaces?.map((i) => (
            <p className="hint" key={i.url}>
              <code>{i.protocolBinding}</code> · <code>{i.url}</code>
            </p>
          ))}
          <div className="skills">
            {card.skills.map((s) => (
              <div className="skill" key={s.id}>
                <div className="skill-head">
                  <strong>{s.name}</strong>
                  <code>{s.id}</code>
                </div>
                <p>{s.description}</p>
                {s.tags && (
                  <div className="tags">
                    {s.tags.map((t) => (
                      <span className="tag" key={t}>
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  )
}

function RunsPanel({ runs, onClear }: { runs: RunRecord[]; onClear: () => void }) {
  if (runs.length === 0) return <p className="hint">Autonomous runs you make in this browser will show up here.</p>
  const ok = runs.filter((r) => r.ok)
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0)
  return (
    <>
      <section className="metrics">
        <Metric label="Runs" value={String(runs.length)} />
        <Metric label="Success rate" value={`${Math.round((ok.length / runs.length) * 100)}%`} />
        <Metric label="Avg time (successful)" value={ok.length ? formatMs(avg(ok.map((r) => r.totalMs))) : '—'} />
        <Metric label="Avg refinements" value={(ok.length ? ok.reduce((a, r) => a + r.refinements, 0) / ok.length : 0).toFixed(1)} />
      </section>
      <section className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Requirement</th>
              <th>Model</th>
              <th className="num">Tool calls</th>
              <th className="num">Agent time</th>
              <th className="num">Total</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r, i) => (
              <tr key={i}>
                <td>{new Date(r.at).toLocaleString()}</td>
                <td className="truncate" title={r.requirement}>
                  {r.requirement}
                </td>
                <td>{r.model}</td>
                <td className="num">{r.steps}</td>
                <td className="num">{formatMs(r.agentMs)}</td>
                <td className="num">{formatMs(r.totalMs)}</td>
                <td>{r.ok ? <span className="pill pill-good">approved</span> : <span className="pill pill-bad">failed</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <div className="row end">
        <button className="ghost" onClick={onClear}>
          Clear history
        </button>
      </div>
    </>
  )
}
