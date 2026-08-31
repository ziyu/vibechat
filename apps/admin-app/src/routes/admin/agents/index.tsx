import { createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import type {
  AdminAgentGovernanceSnapshot,
  AdminCreateAgentDefinition,
  AdminUpsertSpaceAgentBinding,
} from '@vibechat/api-contracts'
import { Badge } from '@vibechat/react-shared/ui/badge'
import { Button } from '@vibechat/react-shared/ui/button'
import { Input } from '@vibechat/react-shared/ui/input'
import { Label } from '@vibechat/react-shared/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@vibechat/react-shared/ui/select'
import { Switch } from '@vibechat/react-shared/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@vibechat/react-shared/ui/table'
import { Textarea } from '@vibechat/react-shared/ui/textarea'
import {
  Activity,
  Bot,
  ChevronDown,
  CircleDot,
  FileClock,
  Loader2,
  LockKeyhole,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Unplug,
} from 'lucide-react'
import { useTranslation } from '@/hooks/use-translation'

export const Route = createFileRoute('/admin/agents/')({
  component: AdminAgentGovernancePage,
})

type Definition = AdminAgentGovernanceSnapshot['definitions'][number]
type Binding = AdminAgentGovernanceSnapshot['bindings'][number]

interface DefinitionForm {
  agentId: string
  version: string
  adapterKey: 'pi' | 'claude-code'
  adapterVersion: string
  provider: string
  model: string
  displayName: string
  description: string
  capabilities: string
  toolPolicyId: string
  pricingPolicyId: string
  maxBudgetCredits: string
  maxConcurrency: string
  availability: 'available' | 'degraded' | 'unavailable'
  regionMode: 'any' | 'allowlist' | 'required'
  regions: string
  poolMode: 'regional_shared' | 'dedicated'
  poolClass: string
}

interface BindingForm {
  spaceInstanceId: string
  definitionId: string
  agentId: string
  isDefault: boolean
  permissionPolicyId: string
  toolPolicyId: string
  maxCreditsPerTurn: string
  maxInputTokens: string
  maxOutputTokens: string
  status: 'active' | 'disabled'
}

const emptyDefinitionForm: DefinitionForm = {
  agentId: 'claude',
  version: '1.1.0',
  adapterKey: 'claude-code',
  adapterVersion: '0.2.7',
  provider: 'anthropic',
  model: 'configured',
  displayName: 'Claude Code',
  description: '',
  capabilities: 'conversation, project_patch',
  toolPolicyId: 'space-agent-tools-default',
  pricingPolicyId: 'space-agent-pricing-default',
  maxBudgetCredits: '1000',
  maxConcurrency: '1',
  availability: 'available',
  regionMode: 'any',
  regions: '',
  poolMode: 'regional_shared',
  poolClass: '',
}

const emptyBindingForm: BindingForm = {
  spaceInstanceId: '',
  definitionId: '',
  agentId: '',
  isDefault: true,
  permissionPolicyId: 'space-agent-permissions-default',
  toolPolicyId: 'space-agent-tools-default',
  maxCreditsPerTurn: '1000',
  maxInputTokens: '128000',
  maxOutputTokens: '16000',
  status: 'active',
}

function AdminAgentGovernancePage() {
  const { t, locale } = useTranslation()
  const copy = t.admin.agents
  const [snapshot, setSnapshot] = useState<AdminAgentGovernanceSnapshot>({
    definitions: [],
    bindings: [],
    audit: [],
  })
  const [loading, setLoading] = useState(true)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [scope, setScope] = useState({ spaceInstanceId: '', agentId: '' })
  const [appliedScope, setAppliedScope] = useState(scope)
  const [definitionEditorOpen, setDefinitionEditorOpen] = useState(false)
  const [definitionForm, setDefinitionForm] = useState(emptyDefinitionForm)
  const [bindingForm, setBindingForm] = useState(emptyBindingForm)

  const loadSnapshot = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const query = new URLSearchParams({ auditLimit: '50' })
      if (appliedScope.spaceInstanceId.trim()) {
        query.set('spaceInstanceId', appliedScope.spaceInstanceId.trim())
      }
      if (appliedScope.agentId.trim()) {
        query.set('agentId', appliedScope.agentId.trim())
      }
      const response = await fetch(`/api/admin/agents?${query}`)
      const data = await readJson(response)
      if (!response.ok) throw new Error(errorMessage(data, copy.loadFailed))
      setSnapshot(data as AdminAgentGovernanceSnapshot)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : copy.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [appliedScope, copy.loadFailed])

  useEffect(() => { void loadSnapshot() }, [loadSnapshot])

  const activeDefinitions = useMemo(
    () => snapshot.definitions.filter((definition) => definition.status === 'active'),
    [snapshot.definitions],
  )

  const runMutation = async (key: string, request: () => Promise<Response>) => {
    setPendingAction(key)
    setError('')
    setNotice('')
    try {
      const response = await request()
      const data = await readJson(response)
      if (!response.ok) throw new Error(errorMessage(data, copy.loadFailed))
      setNotice(copy.saved)
      await loadSnapshot()
      return true
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : copy.loadFailed)
      return false
    } finally {
      setPendingAction(null)
    }
  }

  const submitDefinition = async (event: FormEvent) => {
    event.preventDefault()
    const body: AdminCreateAgentDefinition = {
      agentId: definitionForm.agentId.trim(),
      version: definitionForm.version.trim(),
      adapterKey: definitionForm.adapterKey,
      adapterVersion: definitionForm.adapterVersion.trim(),
      provider: definitionForm.provider.trim(),
      model: definitionForm.model.trim(),
      displayName: definitionForm.displayName.trim(),
      description: definitionForm.description.trim(),
      capabilities: commaSeparated(definitionForm.capabilities),
      toolPolicyId: definitionForm.toolPolicyId.trim(),
      pricingPolicyId: definitionForm.pricingPolicyId.trim(),
      maxBudgetCredits: Number(definitionForm.maxBudgetCredits),
      maxConcurrency: Number(definitionForm.maxConcurrency),
      availability: definitionForm.availability,
      dataRegionPolicy: {
        mode: definitionForm.regionMode,
        regions: definitionForm.regionMode === 'any'
          ? []
          : commaSeparated(definitionForm.regions),
      },
      executionPoolPolicy: definitionForm.poolMode === 'regional_shared'
        ? { mode: 'regional_shared', poolClass: null }
        : { mode: 'dedicated', poolClass: definitionForm.poolClass.trim() },
    }
    const saved = await runMutation('create-definition', () => fetch(
      '/api/admin/agents/definitions',
      jsonRequest('POST', body),
    ))
    if (saved) setDefinitionEditorOpen(false)
  }

  const toggleDefinition = async (definition: Definition) => {
    await runMutation(`definition:${definition.definitionId}`, () => fetch(
      `/api/admin/agents/definitions/${encodeURIComponent(definition.definitionId)}/status`,
      jsonRequest('PATCH', { frozen: definition.status === 'active' }),
    ))
  }

  const chooseDefinition = (definitionId: string) => {
    const definition = snapshot.definitions.find((candidate) => (
      candidate.definitionId === definitionId
    ))
    setBindingForm((current) => ({
      ...current,
      definitionId,
      agentId: definition?.agentId ?? '',
      toolPolicyId: definition?.toolPolicyId ?? current.toolPolicyId,
    }))
  }

  const editBinding = (binding: Binding) => {
    setBindingForm({
      spaceInstanceId: binding.spaceInstanceId,
      definitionId: binding.definitionId,
      agentId: binding.agentId,
      isDefault: binding.isDefault,
      permissionPolicyId: binding.permissionPolicyId,
      toolPolicyId: binding.toolPolicyId,
      maxCreditsPerTurn: String(binding.budgetPolicy.maxCreditsPerTurn),
      maxInputTokens: String(binding.budgetPolicy.maxInputTokens),
      maxOutputTokens: String(binding.budgetPolicy.maxOutputTokens),
      status: binding.status,
    })
    document.getElementById('agent-binding-editor')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  const submitBinding = async (event: FormEvent) => {
    event.preventDefault()
    const body: AdminUpsertSpaceAgentBinding = {
      spaceInstanceId: bindingForm.spaceInstanceId.trim(),
      agentId: bindingForm.agentId,
      definitionId: bindingForm.definitionId,
      isDefault: bindingForm.isDefault,
      permissionPolicyId: bindingForm.permissionPolicyId.trim(),
      toolPolicyId: bindingForm.toolPolicyId.trim(),
      budgetPolicy: {
        maxCreditsPerTurn: Number(bindingForm.maxCreditsPerTurn),
        maxInputTokens: Number(bindingForm.maxInputTokens),
        maxOutputTokens: Number(bindingForm.maxOutputTokens),
      },
      status: bindingForm.status,
    }
    await runMutation('save-binding', () => fetch(
      '/api/admin/agents/bindings',
      jsonRequest('PUT', body),
    ))
  }

  const applyScope = (event: FormEvent) => {
    event.preventDefault()
    setAppliedScope({
      spaceInstanceId: scope.spaceInstanceId.trim(),
      agentId: scope.agentId.trim(),
    })
    if (scope.spaceInstanceId.trim()) {
      setBindingForm((current) => ({
        ...current,
        spaceInstanceId: scope.spaceInstanceId.trim(),
      }))
    }
  }

  return (
    <div className="agent-governance" data-testid="admin-agent-governance">
      <header className="agent-governance-hero">
        <div>
          <p className="admin-eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
        </div>
        <Button variant="outline" onClick={() => void loadSnapshot()} disabled={loading}>
          <RefreshCw className={loading ? 'animate-spin' : ''} />
          {copy.refresh}
        </Button>
      </header>

      {(error || notice) && (
        <div className={`agent-governance-message ${error ? 'is-error' : 'is-success'}`} role="status">
          {error || notice}
          {error && <Button variant="ghost" size="sm" onClick={() => void loadSnapshot()}>{copy.retry}</Button>}
        </div>
      )}

      <section className="agent-governance-metrics" aria-label={copy.title}>
        <Metric icon={Bot} label={copy.metrics.definitions} value={snapshot.definitions.length} />
        <Metric icon={CircleDot} label={copy.metrics.active} value={activeDefinitions.length} />
        <Metric icon={Unplug} label={copy.metrics.bindings} value={snapshot.bindings.length} />
        <Metric icon={FileClock} label={copy.metrics.audit} value={snapshot.audit.length} />
      </section>

      <section className="agent-governance-panel agent-governance-scope">
        <div className="agent-governance-section-heading">
          <div><h2>{copy.filters.title}</h2><p>{copy.filters.description}</p></div>
        </div>
        <form onSubmit={applyScope} className="agent-governance-scope-form">
          <Field label={copy.filters.spaceInstanceId}>
            <Input value={scope.spaceInstanceId} onChange={(event) => setScope({ ...scope, spaceInstanceId: event.target.value })} />
          </Field>
          <Field label={copy.filters.agentId}>
            <Input value={scope.agentId} onChange={(event) => setScope({ ...scope, agentId: event.target.value })} />
          </Field>
          <Button type="submit">{copy.filters.apply}</Button>
          <Button type="button" variant="ghost" onClick={() => {
            const cleared = { spaceInstanceId: '', agentId: '' }
            setScope(cleared)
            setAppliedScope(cleared)
          }}>{copy.filters.clear}</Button>
        </form>
      </section>

      <section className="agent-governance-panel">
        <div className="agent-governance-section-heading">
          <div><h2>{copy.definitions.title}</h2><p>{copy.definitions.description}</p></div>
          <Button onClick={() => setDefinitionEditorOpen((open) => !open)} data-testid="agent-definition-create-toggle">
            {definitionEditorOpen ? <ChevronDown /> : <Plus />}{copy.definitions.create}
          </Button>
        </div>

        {definitionEditorOpen && (
          <form className="agent-governance-editor" onSubmit={submitDefinition} data-testid="agent-definition-form">
            <div className="agent-governance-editor-heading"><div><h3>{copy.createDefinition.title}</h3><p>{copy.createDefinition.description}</p></div><LockKeyhole /></div>
            <div className="agent-governance-form-grid">
              <Field label={copy.createDefinition.agentId}><Input required value={definitionForm.agentId} onChange={(event) => setDefinitionForm({ ...definitionForm, agentId: event.target.value })} /></Field>
              <Field label={copy.createDefinition.version}><Input required value={definitionForm.version} onChange={(event) => setDefinitionForm({ ...definitionForm, version: event.target.value })} /></Field>
              <Field label={copy.createDefinition.adapter}><Select value={definitionForm.adapterKey} onValueChange={(adapterKey: 'pi' | 'claude-code') => setDefinitionForm({ ...definitionForm, adapterKey })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pi">pi</SelectItem><SelectItem value="claude-code">claude-code</SelectItem></SelectContent></Select></Field>
              <Field label={copy.createDefinition.adapterVersion}><Input required value={definitionForm.adapterVersion} onChange={(event) => setDefinitionForm({ ...definitionForm, adapterVersion: event.target.value })} /></Field>
              <Field label={copy.createDefinition.provider}><Input required value={definitionForm.provider} onChange={(event) => setDefinitionForm({ ...definitionForm, provider: event.target.value })} /></Field>
              <Field label={copy.createDefinition.model}><Input required value={definitionForm.model} onChange={(event) => setDefinitionForm({ ...definitionForm, model: event.target.value })} /></Field>
              <Field label={copy.createDefinition.displayName}><Input required value={definitionForm.displayName} onChange={(event) => setDefinitionForm({ ...definitionForm, displayName: event.target.value })} /></Field>
              <Field label={copy.createDefinition.capabilities}><Input required value={definitionForm.capabilities} onChange={(event) => setDefinitionForm({ ...definitionForm, capabilities: event.target.value })} /></Field>
              <Field label={copy.createDefinition.toolPolicy}><Input required value={definitionForm.toolPolicyId} onChange={(event) => setDefinitionForm({ ...definitionForm, toolPolicyId: event.target.value })} /></Field>
              <Field label={copy.createDefinition.pricingPolicy}><Input required value={definitionForm.pricingPolicyId} onChange={(event) => setDefinitionForm({ ...definitionForm, pricingPolicyId: event.target.value })} /></Field>
              <Field label={copy.createDefinition.maxBudget}><Input required type="number" min="0" value={definitionForm.maxBudgetCredits} onChange={(event) => setDefinitionForm({ ...definitionForm, maxBudgetCredits: event.target.value })} /></Field>
              <Field label={copy.createDefinition.maxConcurrency}><Input required type="number" min="1" value={definitionForm.maxConcurrency} onChange={(event) => setDefinitionForm({ ...definitionForm, maxConcurrency: event.target.value })} /></Field>
              <Field label={copy.createDefinition.availability}><Select value={definitionForm.availability} onValueChange={(availability: typeof definitionForm.availability) => setDefinitionForm({ ...definitionForm, availability })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="available">{copy.options.available}</SelectItem><SelectItem value="degraded">{copy.options.degraded}</SelectItem><SelectItem value="unavailable">{copy.options.unavailable}</SelectItem></SelectContent></Select></Field>
              <Field label={copy.createDefinition.regionMode}><Select value={definitionForm.regionMode} onValueChange={(regionMode: typeof definitionForm.regionMode) => setDefinitionForm({ ...definitionForm, regionMode })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="any">{copy.options.anyRegion}</SelectItem><SelectItem value="allowlist">{copy.options.allowlistRegion}</SelectItem><SelectItem value="required">{copy.options.requiredRegion}</SelectItem></SelectContent></Select></Field>
              {definitionForm.regionMode !== 'any' && <Field label={copy.createDefinition.regions}><Input required value={definitionForm.regions} onChange={(event) => setDefinitionForm({ ...definitionForm, regions: event.target.value })} /></Field>}
              <Field label={copy.createDefinition.poolMode}><Select value={definitionForm.poolMode} onValueChange={(poolMode: typeof definitionForm.poolMode) => setDefinitionForm({ ...definitionForm, poolMode })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="regional_shared">{copy.options.regionalShared}</SelectItem><SelectItem value="dedicated">{copy.options.dedicated}</SelectItem></SelectContent></Select></Field>
              {definitionForm.poolMode === 'dedicated' && <Field label={copy.createDefinition.poolClass}><Input required value={definitionForm.poolClass} onChange={(event) => setDefinitionForm({ ...definitionForm, poolClass: event.target.value })} /></Field>}
              <Field label={copy.createDefinition.descriptionLabel} wide><Textarea value={definitionForm.description} onChange={(event) => setDefinitionForm({ ...definitionForm, description: event.target.value })} /></Field>
            </div>
            <div className="agent-governance-editor-actions"><Button type="button" variant="ghost" onClick={() => setDefinitionEditorOpen(false)}>{copy.createDefinition.cancel}</Button><Button type="submit" disabled={pendingAction === 'create-definition'}>{pendingAction === 'create-definition' ? <Loader2 className="animate-spin" /> : <Save />}{copy.createDefinition.submit}</Button></div>
          </form>
        )}

        <div className="agent-governance-definition-grid">
          {loading ? <LoadingRow label={copy.loading} /> : snapshot.definitions.length === 0 ? <EmptyState label={copy.definitions.empty} /> : snapshot.definitions.map((definition) => (
            <article className="agent-definition-card" key={definition.definitionId}>
              <div className="agent-definition-card-top"><div><span>{definition.agentId}</span><h3>{definition.displayName}</h3></div><StatusBadge definition={definition} labels={copy.definitions.status} /></div>
              <p>{definition.description}</p>
              <dl>
                <DefinitionFact label={copy.definitions.version} value={definition.version} />
                <DefinitionFact label={copy.definitions.adapter} value={`${definition.adapterKey}@${definition.adapterVersion}`} />
                <DefinitionFact label={copy.definitions.model} value={`${definition.provider} / ${definition.model}`} />
                <DefinitionFact label={copy.definitions.region} value={definition.dataRegionPolicy.mode === 'any' ? copy.options.anyRegion : `${definition.dataRegionPolicy.mode}: ${definition.dataRegionPolicy.regions.join(', ')}`} />
                <DefinitionFact label={copy.definitions.pool} value={definition.executionPoolPolicy.mode === 'regional_shared' ? copy.options.regionalShared : definition.executionPoolPolicy.poolClass} />
              </dl>
              <div className="agent-definition-card-footer"><code>{definition.definitionId}</code>{definition.status !== 'retired' && <Button variant="outline" size="sm" onClick={() => void toggleDefinition(definition)} disabled={pendingAction === `definition:${definition.definitionId}`} data-testid={`agent-definition-status-${definition.definitionId}`}>{definition.status === 'active' ? <LockKeyhole /> : <ShieldCheck />}{definition.status === 'active' ? copy.definitions.freeze : copy.definitions.unfreeze}</Button>}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="agent-governance-panel" id="agent-binding-editor">
        <div className="agent-governance-section-heading"><div><h2>{copy.bindings.title}</h2><p>{copy.bindings.description}</p></div></div>
        <form className="agent-governance-editor is-compact" onSubmit={submitBinding} data-testid="agent-binding-form">
          <div className="agent-governance-form-grid">
            <Field label={copy.filters.spaceInstanceId}><Input required value={bindingForm.spaceInstanceId} onChange={(event) => setBindingForm({ ...bindingForm, spaceInstanceId: event.target.value })} /></Field>
            <Field label={copy.bindings.chooseDefinition}><Select value={bindingForm.definitionId} onValueChange={chooseDefinition}><SelectTrigger><SelectValue placeholder={copy.bindings.chooseDefinition} /></SelectTrigger><SelectContent>{snapshot.definitions.map((definition) => <SelectItem key={definition.definitionId} value={definition.definitionId}>{definition.displayName} · {definition.version} · {definition.status}</SelectItem>)}</SelectContent></Select></Field>
            <Field label={copy.bindings.permissionPolicy}><Input required value={bindingForm.permissionPolicyId} onChange={(event) => setBindingForm({ ...bindingForm, permissionPolicyId: event.target.value })} /></Field>
            <Field label={copy.bindings.toolPolicy}><Input required value={bindingForm.toolPolicyId} onChange={(event) => setBindingForm({ ...bindingForm, toolPolicyId: event.target.value })} /></Field>
            <Field label={copy.bindings.maxCredits}><Input required type="number" min="0" value={bindingForm.maxCreditsPerTurn} onChange={(event) => setBindingForm({ ...bindingForm, maxCreditsPerTurn: event.target.value })} /></Field>
            <Field label={copy.bindings.maxInputTokens}><Input required type="number" min="1" value={bindingForm.maxInputTokens} onChange={(event) => setBindingForm({ ...bindingForm, maxInputTokens: event.target.value })} /></Field>
            <Field label={copy.bindings.maxOutputTokens}><Input required type="number" min="1" value={bindingForm.maxOutputTokens} onChange={(event) => setBindingForm({ ...bindingForm, maxOutputTokens: event.target.value })} /></Field>
            <Field label={copy.bindings.status}><Select value={bindingForm.status} onValueChange={(status: typeof bindingForm.status) => setBindingForm({ ...bindingForm, status })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">{copy.options.active}</SelectItem><SelectItem value="disabled">{copy.options.disabled}</SelectItem></SelectContent></Select></Field>
            <div className="agent-governance-switch"><div><Label htmlFor="agent-binding-default">{copy.bindings.default}</Label><small>{copy.bindings.description}</small></div><Switch id="agent-binding-default" checked={bindingForm.isDefault} onCheckedChange={(isDefault) => setBindingForm({ ...bindingForm, isDefault })} /></div>
          </div>
          <div className="agent-governance-editor-actions"><Button type="submit" disabled={!bindingForm.definitionId || pendingAction === 'save-binding'}>{pendingAction === 'save-binding' ? <Loader2 className="animate-spin" /> : <Save />}{copy.bindings.save}</Button></div>
        </form>

        <div className="agent-governance-table-wrap">
          <Table>
            <TableHeader><TableRow><TableHead>{copy.bindings.space}</TableHead><TableHead>{copy.bindings.agent}</TableHead><TableHead>{copy.bindings.definition}</TableHead><TableHead>{copy.bindings.policy}</TableHead><TableHead>{copy.bindings.status}</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>{snapshot.bindings.length === 0 ? <TableRow><TableCell colSpan={6}><EmptyState label={copy.bindings.empty} /></TableCell></TableRow> : snapshot.bindings.map((binding) => <TableRow key={binding.bindingId}><TableCell><code>{binding.spaceInstanceId}</code></TableCell><TableCell><strong>{binding.agentId}</strong>{binding.isDefault && <Badge variant="outline">{copy.bindings.default}</Badge>}</TableCell><TableCell><code>{binding.definitionVersion}</code></TableCell><TableCell><span className="agent-policy-hash">{binding.policySnapshotHash}</span></TableCell><TableCell><Badge variant={binding.status === 'active' ? 'default' : 'secondary'}>{binding.status === 'active' ? copy.options.active : copy.options.disabled}</Badge></TableCell><TableCell><Button variant="ghost" size="sm" onClick={() => editBinding(binding)}>{copy.bindings.edit}</Button></TableCell></TableRow>)}</TableBody>
          </Table>
        </div>
      </section>

      <section className="agent-governance-panel" data-testid="agent-governance-audit">
        <div className="agent-governance-section-heading"><div><h2>{copy.audit.title}</h2><p>{copy.audit.description}</p></div><Activity /></div>
        <div className="agent-governance-table-wrap">
          <Table>
            <TableHeader><TableRow><TableHead>{copy.audit.event}</TableHead><TableHead>{copy.audit.subject}</TableHead><TableHead>{copy.audit.result}</TableHead><TableHead>{copy.audit.time}</TableHead></TableRow></TableHeader>
            <TableBody>{snapshot.audit.length === 0 ? <TableRow><TableCell colSpan={4}><EmptyState label={copy.audit.empty} /></TableCell></TableRow> : snapshot.audit.map((event) => <TableRow key={event.eventId}><TableCell><strong>{event.eventType}</strong><code>{event.eventId}</code></TableCell><TableCell><span>{event.agentId}</span><code>{event.spaceInstanceId}</code></TableCell><TableCell><pre>{JSON.stringify(event.result, null, 2)}</pre></TableCell><TableCell>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(event.createdAt))}</TableCell></TableRow>)}</TableBody>
          </Table>
        </div>
      </section>
    </div>
  )
}

function Metric({ icon: Icon, label, value }: { icon: typeof Bot; label: string; value: number }) {
  return <article><Icon /><div><strong>{value}</strong><span>{label}</span></div></article>
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return <div className={wide ? 'agent-governance-field is-wide' : 'agent-governance-field'}><Label>{label}</Label>{children}</div>
}

function DefinitionFact({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>
}

function StatusBadge({ definition, labels }: { definition: Definition; labels: Record<string, string> }) {
  const variant = definition.status === 'active' ? 'default' : definition.status === 'frozen' ? 'secondary' : 'outline'
  return <Badge variant={variant}>{labels[definition.status] ?? definition.status}</Badge>
}

function LoadingRow({ label }: { label: string }) {
  return <div className="agent-governance-empty"><Loader2 className="animate-spin" /><span>{label}</span></div>
}

function EmptyState({ label }: { label: string }) {
  return <div className="agent-governance-empty"><span>{label}</span></div>
}

function commaSeparated(value: string) {
  return [...new Set(value.split(',').map((entry) => entry.trim()).filter(Boolean))]
}

function jsonRequest(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => ({}))
}

function errorMessage(value: unknown, fallback: string) {
  return typeof value === 'object' && value !== null && 'error' in value
    && typeof value.error === 'string' ? value.error : fallback
}
