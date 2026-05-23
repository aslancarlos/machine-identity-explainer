import { useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Shield, Key, AlertTriangle, CheckCircle, XCircle, Clock,
  RefreshCw, Search, Eye, EyeOff, Loader2, Database,
  Lock, ChevronUp, ChevronDown, ExternalLink, Award,
  BarChart2, Info, Filter, FileText,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface VenafiCert {
  id: string
  fingerprint: string
  issuerDN: string
  issuerCN: string
  subjectDN: string
  subjectCN: string
  subjectAlternativeNamesByType?: { dNSName?: string[] }
  keyType: string
  keyStrength: number
  signatureHashAlgorithm: string
  validityStart: string
  validityEnd: string
  selfSigned: boolean
  certificateSource: string
  managedStatus?: string
  validationStatus?: string
  totalInstanceCount?: number
  applications?: { applicationId: string; applicationAlias?: string }[]
}

interface TenantInfo {
  username: string
  firstname: string
  lastname: string
  urlPrefix: string
  companyName: string
}

type CertStatus = 'expired' | 'critical' | 'warning' | 'valid' | 'self-signed'
type SortField = 'cn' | 'expiry' | 'issuer' | 'keysize' | 'status'

// ── Helpers ───────────────────────────────────────────────────────────────────

const EXAMPLE_KEY = 'daaf52d9-0d88-4b65-a033-4744818b386f'

function getDaysLeft(validityEnd: string): number {
  return Math.ceil((new Date(validityEnd).getTime() - Date.now()) / 86_400_000)
}

function getCertStatus(cert: VenafiCert): CertStatus {
  if (cert.selfSigned) return 'self-signed'
  const days = getDaysLeft(cert.validityEnd)
  if (days <= 0)  return 'expired'
  if (days <= 30) return 'critical'
  if (days <= 90) return 'warning'
  return 'valid'
}

function getValidityDays(cert: VenafiCert): number {
  const start = new Date(cert.validityStart).getTime()
  const end   = new Date(cert.validityEnd).getTime()
  return Math.ceil((end - start) / 86_400_000)
}

function formatDate(iso: string): string {
  if (!iso) return 'N/A'
  try {
    return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: '2-digit' }).format(new Date(iso))
  } catch { return iso }
}

const STATUS_CFG: Record<CertStatus, { label: string; color: string; bg: string; border: string }> = {
  expired:     { label: 'EXPIRED',   color: 'text-mi-red',    bg: 'bg-mi-red/15',    border: 'border-mi-red/30'    },
  critical:    { label: '<30 DAYS',  color: 'text-orange-400',bg: 'bg-orange-500/15',border: 'border-orange-500/30' },
  warning:     { label: '<90 DAYS',  color: 'text-mi-gold',   bg: 'bg-mi-gold/15',   border: 'border-mi-gold/30'   },
  valid:       { label: 'VALID',     color: 'text-green-400', bg: 'bg-green-500/15', border: 'border-green-500/30' },
  'self-signed':{ label: 'SELF-SIGNED',color:'text-slate-400',bg: 'bg-slate-500/15', border: 'border-slate-500/30' },
}

function daysColor(days: number) {
  if (days <= 0)  return 'text-mi-red'
  if (days <= 30) return 'text-orange-400'
  if (days <= 90) return 'text-mi-gold'
  return 'text-green-400'
}

// ── API call through proxy ────────────────────────────────────────────────────

async function venafi(apiKey: string, path: string, method = 'GET', body?: unknown) {
  const resp = await fetch('/api/venafi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey, path, method, body }),
  })
  const data = await resp.json()
  if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`)
  return data
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color, bg, border, icon: Icon }: {
  label: string; value: number | string; sub?: string
  color: string; bg: string; border: string
  icon: React.ElementType
}) {
  return (
    <div className={`rounded-xl border ${border} ${bg} p-5 space-y-2`}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">{label}</span>
        <Icon size={15} className={color} />
      </div>
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  )
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-500 w-8 text-right">{pct}%</span>
    </div>
  )
}

function SortIcon({ field, current, dir }: { field: SortField; current: SortField; dir: 'asc' | 'desc' }) {
  if (field !== current) return <ChevronDown size={12} className="text-slate-600" />
  return dir === 'asc' ? <ChevronUp size={12} className="text-mi-cyan" /> : <ChevronDown size={12} className="text-mi-cyan" />
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CLMPage() {
  const [apiKey, setApiKey]         = useState(EXAMPLE_KEY)
  const [showKey, setShowKey]       = useState(false)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [certificates, setCertificates] = useState<VenafiCert[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [tenant, setTenant]         = useState<TenantInfo | null>(null)
  const [loadedAt, setLoadedAt]     = useState<Date | null>(null)

  const [search, setSearch]         = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | CertStatus>('all')
  const [sortField, setSortField]   = useState<SortField>('expiry')
  const [sortDir, setSortDir]       = useState<'asc' | 'desc'>('asc')
  const [page, setPage]             = useState(0)
  const PAGE_SIZE = 25

  // ── Load dashboard ──────────────────────────────────────────────────────────

  const loadDashboard = useCallback(async () => {
    if (!apiKey.trim()) return
    setLoading(true)
    setError(null)
    setPage(0)

    try {
      const [userResp, certResp] = await Promise.all([
        venafi(apiKey, '/v1/useraccounts'),
        venafi(apiKey, '/v1/certificatesearch', 'POST', {
          expression: { operands: [] },
          ordering: { orders: [{ direction: 'ASC', field: 'validityEnd' }] },
          paging: { pageNumber: 0, pageSize: 1000 },
        }),
      ])

      if (userResp?.user) {
        setTenant({
          username: userResp.user.username || '',
          firstname: userResp.user.firstname || '',
          lastname: userResp.user.lastname || '',
          urlPrefix: userResp.company?.urlPrefix || '',
          companyName: userResp.company?.name || '',
        })
      }

      const certs: VenafiCert[] = certResp?.certificates ?? []
      setCertificates(certs)
      setTotalCount(certResp?.count ?? certs.length)
      setLoadedAt(new Date())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [apiKey])

  // ── Computed stats ──────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const s = { total: 0, expired: 0, critical: 0, warning: 0, valid: 0, selfSigned: 0, managed: 0, unmanaged: 0 }
    s.total = certificates.length
    for (const c of certificates) {
      const st = getCertStatus(c)
      if (st === 'expired')     s.expired++
      else if (st === 'critical') s.critical++
      else if (st === 'warning')  s.warning++
      else if (st === 'valid')    s.valid++
      if (c.selfSigned) s.selfSigned++
      if (c.managedStatus === 'MANAGED') s.managed++
      else s.unmanaged++
    }
    return s
  }, [certificates])

  // ── Best practices ──────────────────────────────────────────────────────────

  const bestPractices = useMemo(() => {
    if (!certificates.length) return []
    const total = certificates.length

    const weakKey   = certificates.filter(c =>
      (c.keyType === 'RSA' && c.keyStrength < 2048) ||
      (c.keyType === 'EC'  && c.keyStrength < 256)  ||
      (!c.keyType && c.keyStrength < 2048)
    ).length

    const sha1 = certificates.filter(c =>
      /sha.?1/i.test(c.signatureHashAlgorithm || '') ||
      /md5/i.test(c.signatureHashAlgorithm || '')
    ).length

    const longValidity = certificates.filter(c => getValidityDays(c) > 397).length

    const noSAN = certificates.filter(c =>
      !c.subjectAlternativeNamesByType?.dNSName?.length
    ).length

    const selfSigned = certificates.filter(c => c.selfSigned).length

    const expired = certificates.filter(c => getDaysLeft(c.validityEnd) <= 0).length

    const wildcard = certificates.filter(c =>
      c.subjectCN?.startsWith('*.') ||
      c.subjectAlternativeNamesByType?.dNSName?.some(s => s.startsWith('*.'))
    ).length

    const unmanaged = certificates.filter(c => c.managedStatus !== 'MANAGED').length

    return [
      { key: 'expired',    title: 'No Expired Certificates',      nist: 'NIST SP 800-57 §5.3.5',   fail: expired,     pass: total - expired,     desc: 'Expired certificates cause immediate service outages and create unmonitored attack surfaces.' },
      { key: 'critical',   title: 'No Certificates Expiring <30d', nist: 'NIST SP 800-57 §5.3.5',  fail: stats.critical, pass: total - stats.critical, desc: 'Certificates within 30 days of expiry require immediate renewal to avoid unplanned outages.' },
      { key: 'keystrength',title: 'Key Strength >= 2048-bit',      nist: 'NIST SP 800-57 §5.3',    fail: weakKey,     pass: total - weakKey,     desc: 'RSA keys must be >= 2048-bit; EC keys >= 256-bit (P-256). Smaller keys are vulnerable to factoring attacks.' },
      { key: 'sha1',       title: 'No SHA-1 / MD5 Signatures',    nist: 'NIST SP 800-52 §3.3.1',  fail: sha1,        pass: total - sha1,        desc: 'SHA-1 is cryptographically broken since 2017. All modern CAs refuse to issue SHA-1 certificates.' },
      { key: 'validity',   title: 'Validity <= 397 Days',          nist: 'CAB Forum BR §6.3.2',     fail: longValidity,pass: total - longValidity,desc: 'Apple and Chrome enforce 397-day maximum since Sep 2020. Longer certs are rejected by major browsers.' },
      { key: 'san',        title: 'Subject Alternative Names Set', nist: 'RFC 5280 §4.2.1.6',       fail: noSAN,       pass: total - noSAN,       desc: 'Modern TLS ignores the Subject CN. SANs are required. CN-only certificates are rejected by browsers.' },
      { key: 'selfsigned', title: 'No Self-Signed Certificates',  nist: 'NIST SP 800-52 §3.1',    fail: selfSigned,  pass: total - selfSigned,  desc: 'Self-signed certificates cannot be verified by a trusted CA chain and are rejected in most production contexts.' },
      { key: 'wildcard',   title: 'Wildcard Usage (Warning)',      nist: 'NIST SP 800-52 §3.1',    fail: wildcard,    pass: total - wildcard,    desc: 'Wildcard certificates expand the blast radius of a private key compromise to all covered subdomains.' },
      { key: 'managed',    title: 'Lifecycle Managed by Venafi',   nist: 'NIST SP 800-57 §5.4',    fail: unmanaged,   pass: total - unmanaged,   desc: 'Unmanaged certificates are at risk of expiry, mis-issuance, and policy violations without automated lifecycle controls.' },
    ]
  }, [certificates, stats.critical])

  // ── Health score ────────────────────────────────────────────────────────────

  const healthScore = useMemo(() => {
    if (!bestPractices.length) return 0
    // Weight: expired + keystrength + sha1 are critical (weight 2), rest weight 1
    const critical = ['expired', 'critical', 'keystrength', 'sha1']
    let total = 0, passed = 0
    for (const p of bestPractices) {
      const weight = critical.includes(p.key) ? 2 : 1
      total  += weight
      if (p.fail === 0) passed += weight
    }
    return Math.round((passed / total) * 100)
  }, [bestPractices])

  // ── Distribution ────────────────────────────────────────────────────────────

  const distribution = useMemo(() => {
    const issuers:  Record<string, number> = {}
    const keyTypes: Record<string, number> = {}
    const sources:  Record<string, number> = {}

    for (const c of certificates) {
      const issuer = c.issuerCN || 'Unknown'
      issuers[issuer]  = (issuers[issuer] || 0) + 1

      const kt = c.keyType ? `${c.keyType} ${c.keyStrength}` : 'Unknown'
      keyTypes[kt]     = (keyTypes[kt] || 0) + 1

      const src = c.certificateSource || 'Unknown'
      sources[src]     = (sources[src] || 0) + 1
    }

    return {
      issuers:  Object.entries(issuers).sort(([,a],[,b]) => b-a).slice(0, 7),
      keyTypes: Object.entries(keyTypes).sort(([,a],[,b]) => b-a),
      sources:  Object.entries(sources).sort(([,a],[,b]) => b-a),
    }
  }, [certificates])

  // ── Filtered / sorted table ─────────────────────────────────────────────────

  const filteredCerts = useMemo(() => {
    let certs = [...certificates]

    if (search.trim()) {
      const q = search.toLowerCase()
      certs = certs.filter(c =>
        c.subjectCN?.toLowerCase().includes(q) ||
        c.issuerCN?.toLowerCase().includes(q) ||
        c.fingerprint?.toLowerCase().includes(q) ||
        c.subjectAlternativeNamesByType?.dNSName?.some(s => s.toLowerCase().includes(q))
      )
    }

    if (statusFilter !== 'all') {
      certs = certs.filter(c => getCertStatus(c) === statusFilter)
    }

    certs.sort((a, b) => {
      let av: number | string = 0
      let bv: number | string = 0
      switch (sortField) {
        case 'expiry':   av = new Date(a.validityEnd).getTime(); bv = new Date(b.validityEnd).getTime(); break
        case 'cn':       av = a.subjectCN || ''; bv = b.subjectCN || ''; break
        case 'issuer':   av = a.issuerCN  || ''; bv = b.issuerCN  || ''; break
        case 'keysize':  av = a.keyStrength;     bv = b.keyStrength;     break
        case 'status':   av = getCertStatus(a);  bv = getCertStatus(b);  break
      }
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })

    return certs
  }, [certificates, search, statusFilter, sortField, sortDir])

  const pagedCerts = filteredCerts.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(filteredCerts.length / PAGE_SIZE)

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') }
    setPage(0)
  }

  const scoreColor = healthScore >= 80 ? 'text-green-400' : healthScore >= 60 ? 'text-mi-gold' : 'text-mi-red'
  const hasCerts = certificates.length > 0

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="py-16 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto space-y-10">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="badge bg-pki/10 text-pki border border-pki/20">
              <Database size={11} className="mr-1.5" /> Certificate Inventory
            </span>
            {tenant && (
              <span className="badge bg-mi-cyan/10 text-mi-cyan border border-mi-cyan/20 text-xs">
                {tenant.urlPrefix}.venafi.cloud · {tenant.firstname} {tenant.lastname}
              </span>
            )}
            {loadedAt && (
              <span className="text-xs text-slate-500">
                Updated {loadedAt.toLocaleTimeString()}
              </span>
            )}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold">
            CLM Dashboard{' '}
            <span className="text-pki">Venafi TLS Protect Cloud</span>
          </h1>
          <p className="text-slate-400 max-w-3xl">
            Full certificate inventory from your Venafi tenant with security health scoring, NIST compliance mapping, and lifecycle best practices analysis.
          </p>
        </motion.div>

        {/* API Key card */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}>
          <div className="rounded-2xl border border-border bg-bg-card p-6 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Lock size={14} className="text-mi-cyan" /> Venafi Cloud API Key
            </div>
            <div className="flex gap-3 flex-wrap sm:flex-nowrap">
              <div className="relative flex-1 min-w-0">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && loadDashboard()}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 pr-10 text-sm font-mono text-slate-200 focus:outline-none focus:border-mi-cyan/50 placeholder-slate-600"
                />
                <button
                  onClick={() => setShowKey(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button
                onClick={loadDashboard}
                disabled={loading || !apiKey.trim()}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-pki text-white font-bold text-sm hover:bg-pki/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {loading ? 'Loading...' : hasCerts ? 'Refresh' : 'Load Dashboard'}
              </button>
            </div>
            <p className="text-xs text-slate-600">
              The API key is sent directly to Venafi Cloud via a local proxy — it is never stored on the server.
              Calls: <span className="text-slate-500 font-mono">GET /v1/useraccounts</span> and <span className="text-slate-500 font-mono">POST /v1/certificatesearch</span>
            </p>
          </div>
        </motion.div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-mi-red/30 bg-mi-red/10 p-4 flex items-center gap-3">
            <XCircle size={16} className="text-mi-red shrink-0" />
            <div>
              <p className="text-sm font-semibold text-white">Failed to load data</p>
              <p className="text-xs text-slate-400 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !hasCerts && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-bg-card p-5 space-y-3 animate-pulse">
                <div className="h-3 bg-bg-muted rounded w-2/3" />
                <div className="h-8 bg-bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {/* ── Dashboard (only when data loaded) ────────────────────────────── */}
        {hasCerts && (
          <>
            {/* Stats row */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatCard label="Total"        value={stats.total}    sub={totalCount > certificates.length ? `${totalCount} in tenant` : undefined} color="text-pki"         bg="bg-pki/5"         border="border-pki/20"        icon={Database}      />
              <StatCard label="Expired"      value={stats.expired}  sub="immediate action"    color="text-mi-red"     bg="bg-mi-red/5"     border="border-mi-red/20"    icon={XCircle}       />
              <StatCard label="< 30 Days"    value={stats.critical} sub="renew now"           color="text-orange-400" bg="bg-orange-500/5" border="border-orange-500/20" icon={AlertTriangle} />
              <StatCard label="< 90 Days"    value={stats.warning}  sub="plan renewal"        color="text-mi-gold"    bg="bg-mi-gold/5"    border="border-mi-gold/20"   icon={Clock}         />
              <StatCard label="Valid"        value={stats.valid}    sub="no action needed"    color="text-green-400"  bg="bg-green-500/5"  border="border-green-500/20" icon={CheckCircle}   />
              <StatCard label="Self-Signed"  value={stats.selfSigned} sub="review recommended" color="text-slate-400" bg="bg-slate-500/5"  border="border-slate-500/20" icon={Shield}        />
            </motion.div>

            {/* Health + Best Practices + Distribution */}
            <div className="grid lg:grid-cols-3 gap-6">

              {/* Health score */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}
                className="rounded-xl border border-border bg-bg-card p-6 space-y-5">
                <div className="flex items-center gap-2">
                  <Award size={16} className="text-mi-gold" />
                  <span className="font-bold text-white text-sm">Security Health Score</span>
                </div>
                <div className="flex items-end gap-3">
                  <span className={`text-6xl font-bold ${scoreColor}`}>{healthScore}</span>
                  <span className="text-slate-500 text-xl mb-2">/ 100</span>
                </div>
                <div className="w-full h-2 bg-bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${healthScore >= 80 ? 'bg-green-400' : healthScore >= 60 ? 'bg-mi-gold' : 'bg-mi-red'}`}
                    style={{ width: `${healthScore}%` }}
                  />
                </div>
                <div className="space-y-1.5 pt-1">
                  <div className="grid grid-cols-3 gap-2 text-xs text-center">
                    <div className={`rounded-lg p-2 ${stats.expired > 0 ? 'bg-mi-red/10 text-mi-red' : 'bg-green-500/10 text-green-400'}`}>
                      <div className="font-bold text-lg">{stats.expired}</div>
                      <div>Expired</div>
                    </div>
                    <div className={`rounded-lg p-2 ${stats.critical > 0 ? 'bg-orange-500/10 text-orange-400' : 'bg-green-500/10 text-green-400'}`}>
                      <div className="font-bold text-lg">{stats.critical}</div>
                      <div>Critical</div>
                    </div>
                    <div className={`rounded-lg p-2 ${stats.selfSigned > 0 ? 'bg-slate-500/10 text-slate-400' : 'bg-green-500/10 text-green-400'}`}>
                      <div className="font-bold text-lg">{stats.selfSigned}</div>
                      <div>Self-Signed</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-center pt-1">
                    <div className="rounded-lg p-2 bg-pki/10 text-pki">
                      <div className="font-bold text-lg">{stats.managed}</div>
                      <div>Managed</div>
                    </div>
                    <div className="rounded-lg p-2 bg-mi-gold/10 text-mi-gold">
                      <div className="font-bold text-lg">{stats.unmanaged}</div>
                      <div>Unmanaged</div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Best practices */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
                className="lg:col-span-2 rounded-xl border border-border bg-bg-card p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Shield size={16} className="text-mi-cyan" />
                  <span className="font-bold text-white text-sm">NIST Compliance Checks</span>
                  <span className="ml-auto text-xs text-slate-500">{bestPractices.filter(p => p.fail === 0).length}/{bestPractices.length} passing</span>
                </div>
                <div className="space-y-3 overflow-y-auto max-h-96 pr-1">
                  {bestPractices.map(p => {
                    const passing = p.fail === 0
                    return (
                      <div key={p.key} className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          {passing
                            ? <CheckCircle size={13} className="text-green-400 shrink-0" />
                            : <XCircle size={13} className={p.key === 'wildcard' || p.key === 'managed' ? 'text-mi-gold shrink-0' : 'text-mi-red shrink-0'} />
                          }
                          <span className="text-xs font-semibold text-slate-200 flex-1">{p.title}</span>
                          <span className="text-[10px] font-mono text-slate-500 bg-bg px-1.5 py-0.5 rounded border border-border shrink-0">{p.nist}</span>
                          {!passing && (
                            <span className={`text-[10px] font-bold shrink-0 ${p.key === 'wildcard' || p.key === 'managed' ? 'text-mi-gold' : 'text-mi-red'}`}>
                              {p.fail} issue{p.fail !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <ProgressBar
                          value={p.pass}
                          max={p.pass + p.fail}
                          color={passing ? 'bg-green-500' : p.key === 'wildcard' || p.key === 'managed' ? 'bg-mi-gold' : 'bg-mi-red'}
                        />
                        <p className="text-[10px] text-slate-600 pl-5">{p.desc}</p>
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            </div>

            {/* Distribution */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}
              className="grid sm:grid-cols-3 gap-6">

              {/* By CA */}
              <div className="rounded-xl border border-border bg-bg-card p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <BarChart2 size={14} className="text-pki" />
                  <span className="text-sm font-bold text-white">By Issuing CA</span>
                </div>
                <div className="space-y-2.5">
                  {distribution.issuers.map(([name, count]) => (
                    <div key={name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300 truncate max-w-[160px]" title={name}>{name}</span>
                        <span className="text-slate-500 shrink-0 ml-2">{count}</span>
                      </div>
                      <ProgressBar value={count} max={certificates.length} color="bg-pki" />
                    </div>
                  ))}
                </div>
              </div>

              {/* By key type */}
              <div className="rounded-xl border border-border bg-bg-card p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Key size={14} className="text-mi-gold" />
                  <span className="text-sm font-bold text-white">By Key Type</span>
                </div>
                <div className="space-y-2.5">
                  {distribution.keyTypes.map(([name, count]) => (
                    <div key={name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300 font-mono">{name}</span>
                        <span className="text-slate-500">{count}</span>
                      </div>
                      <ProgressBar
                        value={count}
                        max={certificates.length}
                        color={name.includes('RSA') ? 'bg-mi-gold' : name.includes('EC') ? 'bg-mi-cyan' : 'bg-slate-500'}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* By source */}
              <div className="rounded-xl border border-border bg-bg-card p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-k8s" />
                  <span className="text-sm font-bold text-white">By Source</span>
                </div>
                <div className="space-y-2.5">
                  {distribution.sources.map(([name, count]) => (
                    <div key={name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300 truncate">{name.replace(/_/g, ' ')}</span>
                        <span className="text-slate-500">{count}</span>
                      </div>
                      <ProgressBar value={count} max={certificates.length} color="bg-k8s" />
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Certificate table */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}
              className="rounded-xl border border-border bg-bg-card overflow-hidden">

              {/* Table header */}
              <div className="px-5 py-4 border-b border-border flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <FileText size={15} className="text-pki" />
                  <span className="font-bold text-white">Certificate Inventory</span>
                  <span className="text-xs text-slate-500">({filteredCerts.length} of {certificates.length})</span>
                </div>

                {/* Search */}
                <div className="relative flex-1 min-w-52">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(0) }}
                    placeholder="Search CN, issuer, SAN..."
                    className="w-full bg-bg border border-border rounded-lg pl-8 pr-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-mi-cyan/40 placeholder-slate-600"
                  />
                </div>

                {/* Status filter */}
                <div className="flex items-center gap-1">
                  <Filter size={12} className="text-slate-500" />
                  <select
                    value={statusFilter}
                    onChange={e => { setStatusFilter(e.target.value as typeof statusFilter); setPage(0) }}
                    className="bg-bg border border-border rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none"
                  >
                    <option value="all">All Status</option>
                    <option value="expired">Expired</option>
                    <option value="critical">Critical (&lt;30d)</option>
                    <option value="warning">Warning (&lt;90d)</option>
                    <option value="valid">Valid</option>
                    <option value="self-signed">Self-Signed</option>
                  </select>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-slate-500 uppercase tracking-wide">
                      <th className="px-4 py-3 text-left w-24">Status</th>
                      <th className="px-4 py-3 text-left cursor-pointer hover:text-slate-300" onClick={() => toggleSort('cn')}>
                        <span className="flex items-center gap-1">CN / SANs <SortIcon field="cn" current={sortField} dir={sortDir} /></span>
                      </th>
                      <th className="px-4 py-3 text-left cursor-pointer hover:text-slate-300" onClick={() => toggleSort('issuer')}>
                        <span className="flex items-center gap-1">Issuer <SortIcon field="issuer" current={sortField} dir={sortDir} /></span>
                      </th>
                      <th className="px-4 py-3 text-left cursor-pointer hover:text-slate-300" onClick={() => toggleSort('expiry')}>
                        <span className="flex items-center gap-1">Expires <SortIcon field="expiry" current={sortField} dir={sortDir} /></span>
                      </th>
                      <th className="px-4 py-3 text-left cursor-pointer hover:text-slate-300" onClick={() => toggleSort('keysize')}>
                        <span className="flex items-center gap-1">Key <SortIcon field="keysize" current={sortField} dir={sortDir} /></span>
                      </th>
                      <th className="px-4 py-3 text-left">Algorithm</th>
                      <th className="px-4 py-3 text-left">Source</th>
                      <th className="px-4 py-3 text-left">Managed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {pagedCerts.map(cert => {
                      const status = getCertStatus(cert)
                      const cfg    = STATUS_CFG[status]
                      const days   = getDaysLeft(cert.validityEnd)
                      const sans   = cert.subjectAlternativeNamesByType?.dNSName ?? []
                      const weakKey = (cert.keyType === 'RSA' && cert.keyStrength < 2048) || (cert.keyType === 'EC' && cert.keyStrength < 256)
                      const badAlgo = /sha.?1|md5/i.test(cert.signatureHashAlgorithm || '')

                      return (
                        <tr key={cert.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
                              {cfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 max-w-xs">
                            <div className="font-mono text-slate-200 truncate" title={cert.subjectCN}>{cert.subjectCN || 'N/A'}</div>
                            {sans.length > 0 && (
                              <div className="text-slate-600 truncate" title={sans.join(', ')}>
                                +{sans.length} SAN{sans.length !== 1 ? 's' : ''}
                                {sans.length <= 2 && `: ${sans.slice(0, 2).join(', ')}`}
                              </div>
                            )}
                            {cert.selfSigned && <span className="text-slate-500 italic">self-signed</span>}
                          </td>
                          <td className="px-4 py-3 max-w-[160px]">
                            <span className="text-slate-300 truncate block" title={cert.issuerCN}>{cert.issuerCN || 'Unknown'}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-slate-300">{formatDate(cert.validityEnd)}</div>
                            <div className={`font-semibold ${daysColor(days)}`}>
                              {days <= 0 ? 'Expired' : `${days}d left`}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`font-mono ${weakKey ? 'text-mi-red' : 'text-slate-300'}`}>
                              {cert.keyType} {cert.keyStrength}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`font-mono ${badAlgo ? 'text-mi-red' : 'text-slate-400'}`}>
                              {cert.signatureHashAlgorithm || 'N/A'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-slate-500 truncate block max-w-[100px]" title={cert.certificateSource}>
                              {(cert.certificateSource || 'N/A').replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={cert.managedStatus === 'MANAGED' ? 'text-green-400' : 'text-mi-gold'}>
                              {cert.managedStatus === 'MANAGED' ? '✓' : '✗'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                    {pagedCerts.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                          No certificates match the current filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-5 py-3 border-t border-border flex items-center justify-between text-xs text-slate-500">
                  <span>
                    Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredCerts.length)} of {filteredCerts.length}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="px-2.5 py-1 rounded border border-border hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      Prev
                    </button>
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      const p = totalPages <= 7 ? i : page < 4 ? i : page > totalPages - 4 ? totalPages - 7 + i : page - 3 + i
                      return (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={`w-7 h-7 rounded border text-xs font-medium ${p === page ? 'border-pki text-pki bg-pki/10' : 'border-border hover:bg-white/5 text-slate-400'}`}
                        >
                          {p + 1}
                        </button>
                      )
                    })}
                    <button
                      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                      className="px-2.5 py-1 rounded border border-border hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </motion.div>

            {/* Bottom Venafi CTA */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.25 }}>
              <div className="rounded-xl border border-mi-cyan/20 bg-mi-cyan/5 p-5 flex items-center justify-between gap-4 flex-wrap">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-white">Manage this inventory with full automation</p>
                  <p className="text-xs text-slate-400">Venafi TLS Protect Cloud provides automated issuance, renewal, revocation, and policy enforcement for all certificates shown here.</p>
                </div>
                <a
                  href="https://latamlab.venafi.cloud"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-mi-cyan text-bg font-bold text-sm hover:bg-mi-cyan/80 transition-colors shrink-0"
                >
                  Open Venafi Cloud <ExternalLink size={13} />
                </a>
              </div>
            </motion.div>
          </>
        )}

        {/* Empty state (no data yet) */}
        {!hasCerts && !loading && !error && (
          <div className="text-center py-24 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-pki/10 border border-pki/20 flex items-center justify-center mx-auto">
              <Database size={28} className="text-pki" />
            </div>
            <p className="text-slate-400 max-w-sm mx-auto">
              Enter your Venafi Cloud API key above and click <strong className="text-white">Load Dashboard</strong> to view your certificate inventory.
            </p>
            <div className="flex items-center justify-center gap-2 text-xs text-slate-600">
              <Info size={12} />
              Calls <span className="font-mono text-slate-500">POST /v1/certificatesearch</span> — up to 1000 certificates per load
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
