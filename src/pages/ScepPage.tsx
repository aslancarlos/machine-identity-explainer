import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ScrollText, Server, User, KeyRound, ShieldCheck, ShieldAlert,
  Clock, Loader, Download, Copy, Check, ChevronDown, Info, Lock, FileText,
} from 'lucide-react'

// ── API contract ──────────────────────────────────────────────────────────────
type Mode = 'machine' | 'user'

interface ScepResult {
  transactionId: string
  pkiStatus: string | null
  status: 'SUCCESS' | 'PENDING' | 'FAILURE' | string
  failInfo: string | null
  certificatePem: string | null
  chainPem: string[]
  privateKeyPem: string
  csrPem: string
  caCertPem: string
  log: string[]
}

const KEY_SIZES = [2048, 3072, 4096] as const

// ── Small UI helpers ──────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500) }}
      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-bg-muted hover:bg-bg border border-border text-text-2 transition-colors"
    >
      {done ? <Check size={13} className="text-spiffe" /> : <Copy size={13} />}
      {done ? 'Copied' : 'Copy'}
    </button>
  )
}

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: 'application/x-pem-file' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function PemBlock({ title, pem, filename, accent }: { title: string; pem: string; filename: string; accent: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg-muted overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-bg-card border-b border-border">
        <div className={`flex items-center gap-2 text-sm font-semibold ${accent}`}>
          <FileText size={14} /> {title}
        </div>
        <div className="flex items-center gap-2">
          <CopyButton text={pem} />
          <button
            type="button"
            onClick={() => download(filename, pem)}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-bg-muted hover:bg-bg border border-border text-text-2 transition-colors"
          >
            <Download size={13} /> {filename}
          </button>
        </div>
      </div>
      <pre className="text-[11px] leading-tight text-text-muted p-3 overflow-x-auto max-h-48 font-mono">{pem}</pre>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function ScepPage() {
  const { t } = useTranslation()

  const [mode, setMode] = useState<Mode>('machine')
  const [url, setUrl] = useState('')
  const [challenge, setChallenge] = useState('')

  // subject + SAN fields
  const [cn, setCn] = useState('')
  const [org, setOrg] = useState('')
  const [ou, setOu] = useState('')
  const [country, setCountry] = useState('')
  const [email, setEmail] = useState('')
  const [dns, setDns] = useState('')   // comma/space separated (machine)
  const [upn, setUpn] = useState('')   // user principal name (user)

  // advanced
  const [advOpen, setAdvOpen] = useState(false)
  const [keyBits, setKeyBits] = useState<number>(2048)
  const [caIdent, setCaIdent] = useState('')
  const [insecureTLS, setInsecureTLS] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ScepResult | null>(null)

  const splitList = (s: string) => s.split(/[\s,;]+/).map(x => x.trim()).filter(Boolean)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setResult(null)

    const subject: Record<string, string> = { CN: cn.trim() }
    if (org) subject.O = org.trim()
    if (ou) subject.OU = ou.trim()
    if (country) subject.C = country.trim()
    if (email) subject.email = email.trim()

    const sans: Record<string, string[]> = {}
    if (mode === 'machine') {
      const list = splitList(dns)
      if (list.length) sans.dns = list
    } else {
      if (email) sans.email = [email.trim()]
      const upns = splitList(upn)
      if (upns.length) sans.upn = upns
    }

    const payload = {
      mode,
      url: url.trim(),
      challenge,
      keyBits,
      insecureTLS,
      caIdent: caIdent.trim() || undefined,
      subject,
      sans,
    }

    setLoading(true)
    try {
      const res = await fetch('/api/scep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok && !data.status) {
        setError(data.error || `Request failed (HTTP ${res.status})`)
      } else {
        setResult(data)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }

  const statusStyle = (s: string) =>
    s === 'SUCCESS' ? { c: 'text-spiffe', b: 'border-spiffe/40 bg-spiffe/10', Icon: ShieldCheck }
    : s === 'PENDING' ? { c: 'text-mi-gold', b: 'border-mi-gold/40 bg-mi-gold/10', Icon: Clock }
    : { c: 'text-mi-red', b: 'border-mi-red/40 bg-mi-red/10', Icon: ShieldAlert }

  const field = 'w-full bg-bg-muted border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-text-muted focus:border-mi-cyan/60 focus:outline-none focus:ring-1 focus:ring-mi-cyan/20 transition-colors'
  const label = 'block text-xs font-semibold text-text-2 mb-1'

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Hero */}
      <div className="text-center mb-8">
        <span className="inline-flex items-center text-xs font-semibold tracking-wide uppercase text-mi-cyan bg-mi-cyan/10 border border-mi-cyan/30 rounded-full px-3 py-1">
          <ScrollText size={11} className="mr-1.5" /> {t('scep_page.badge')}
        </span>
        <h1 className="text-4xl sm:text-5xl font-bold mt-4 text-text">{t('scep_page.title')}</h1>
        <p className="text-text-2 mt-3 max-w-2xl mx-auto">{t('scep_page.subtitle')}</p>
      </div>

      {/* Mode toggle */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {(['machine', 'user'] as Mode[]).map(m => {
          const active = mode === m
          const Icon = m === 'machine' ? Server : User
          return (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
                active ? 'border-mi-cyan/60 bg-mi-cyan/10' : 'border-border bg-bg-card hover:bg-bg-muted'
              }`}
            >
              <Icon size={22} className={active ? 'text-mi-cyan' : 'text-text-muted'} />
              <div>
                <div className={`font-semibold ${active ? 'text-mi-cyan' : 'text-text'}`}>
                  {t(`scep_page.mode_${m}`)}
                </div>
                <div className="text-xs text-text-muted mt-0.5">{t(`scep_page.mode_${m}_sub`)}</div>
              </div>
            </button>
          )
        })}
      </div>

      <form onSubmit={submit} className="space-y-5 bg-bg-card border border-border rounded-2xl p-6">
        {/* Endpoint */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={label}>{t('scep_page.url')}</label>
            <input className={field} value={url} onChange={e => setUrl(e.target.value)}
              placeholder="https://tpp.example.com/certsrv/mscep/mscep.dll" required />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>{t('scep_page.challenge')}</label>
            <input className={field} type="password" value={challenge} onChange={e => setChallenge(e.target.value)}
              placeholder={t('scep_page.challenge_ph')} required autoComplete="off" />
          </div>
        </div>

        <div className="border-t border-border pt-5">
          <div className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-3">
            {mode === 'machine' ? t('scep_page.machine_identity') : t('scep_page.user_identity')}
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={label}>
                {mode === 'machine' ? t('scep_page.cn_machine') : t('scep_page.cn_user')}
              </label>
              <input className={field} value={cn} onChange={e => setCn(e.target.value)}
                placeholder={mode === 'machine' ? 'host01.example.com' : 'Jane Doe'} required />
            </div>

            {mode === 'machine' ? (
              <div className="sm:col-span-2">
                <label className={label}>{t('scep_page.dns_sans')}</label>
                <input className={field} value={dns} onChange={e => setDns(e.target.value)}
                  placeholder="host01.example.com, host01" />
                <p className="text-[11px] text-text-muted mt-1">{t('scep_page.dns_sans_hint')}</p>
              </div>
            ) : (
              <>
                <div>
                  <label className={label}>{t('scep_page.email')}</label>
                  <input className={field} type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="jane.doe@example.com" />
                </div>
                <div>
                  <label className={label}>{t('scep_page.upn')}</label>
                  <input className={field} value={upn} onChange={e => setUpn(e.target.value)}
                    placeholder="jane.doe@example.com" />
                </div>
              </>
            )}

            <div>
              <label className={label}>{t('scep_page.org')}</label>
              <input className={field} value={org} onChange={e => setOrg(e.target.value)} placeholder="Example Corp" />
            </div>
            <div>
              <label className={label}>{t('scep_page.ou')}</label>
              <input className={field} value={ou} onChange={e => setOu(e.target.value)} placeholder="IT Security" />
            </div>
            <div>
              <label className={label}>{t('scep_page.country')}</label>
              <input className={field} value={country} onChange={e => setCountry(e.target.value)}
                placeholder="BR" maxLength={2} />
            </div>
            {mode === 'machine' && (
              <div>
                <label className={label}>{t('scep_page.email')}</label>
                <input className={field} type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="ops@example.com" />
              </div>
            )}
          </div>
        </div>

        {/* Advanced */}
        <div className="border-t border-border pt-4">
          <button type="button" onClick={() => setAdvOpen(o => !o)}
            className="flex items-center gap-1.5 text-sm text-text-2 hover:text-text">
            <ChevronDown size={15} className={`transition-transform ${advOpen ? 'rotate-180' : ''}`} />
            {t('scep_page.advanced')}
          </button>
          <AnimatePresence>
            {advOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden">
                <div className="grid sm:grid-cols-2 gap-4 pt-4">
                  <div>
                    <label className={label}>{t('scep_page.keysize')}</label>
                    <select className={field} value={keyBits} onChange={e => setKeyBits(Number(e.target.value))}>
                      {KEY_SIZES.map(k => <option key={k} value={k}>RSA {k}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={label}>{t('scep_page.caident')}</label>
                    <input className={field} value={caIdent} onChange={e => setCaIdent(e.target.value)} placeholder="(optional)" />
                  </div>
                  <label className="sm:col-span-2 flex items-center gap-2 text-sm text-text-2 cursor-pointer">
                    <input type="checkbox" checked={insecureTLS} onChange={e => setInsecureTLS(e.target.checked)}
                      className="accent-mi-red" />
                    <ShieldAlert size={15} className="text-mi-red" />
                    {t('scep_page.insecure_tls')}
                  </label>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button type="submit" disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-mi-cyan text-bg font-semibold rounded-lg px-4 py-3 hover:bg-mi-cyan/80 disabled:opacity-50 transition-colors">
          {loading ? <><Loader size={16} className="animate-spin" /> {t('scep_page.enrolling')}</>
                   : <><KeyRound size={16} /> {t('scep_page.enroll')}</>}
        </button>

        <p className="flex items-start gap-1.5 text-[11px] text-text-muted">
          <Info size={13} className="shrink-0 mt-0.5" /> {t('scep_page.privacy_note')}
        </p>
      </form>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mt-6 flex items-start gap-3 rounded-xl border border-mi-red/40 bg-mi-red/10 p-4">
            <ShieldAlert size={20} className="text-mi-red shrink-0" />
            <div>
              <div className="font-semibold text-mi-red">{t('scep_page.failed')}</div>
              <div className="text-sm text-text-2 mt-0.5">{error}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result */}
      <AnimatePresence>
        {result && (() => {
          const st = statusStyle(result.status)
          return (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-8 space-y-5">
              <div className={`flex items-center gap-3 rounded-xl border p-4 ${st.b}`}>
                <st.Icon size={24} className={st.c} />
                <div className="flex-1">
                  <div className={`font-bold ${st.c}`}>{t(`scep_page.status_${result.status.toLowerCase()}`, result.status)}</div>
                  <div className="text-xs text-text-muted font-mono mt-0.5 break-all">txid: {result.transactionId}</div>
                </div>
              </div>

              {result.failInfo && (
                <div className="text-sm text-mi-red bg-mi-red/5 border border-mi-red/20 rounded-lg p-3">{result.failInfo}</div>
              )}

              {result.status === 'SUCCESS' && result.certificatePem && (
                <>
                  <div className="flex items-start gap-2 text-xs text-mi-gold bg-mi-gold/10 border border-mi-gold/30 rounded-lg p-3">
                    <Lock size={15} className="shrink-0 mt-0.5" />
                    {t('scep_page.key_warning')}
                  </div>
                  <PemBlock title={t('scep_page.issued_cert')} pem={result.certificatePem} filename="certificate.pem" accent="text-spiffe" />
                  {result.chainPem.map((c, i) => (
                    <PemBlock key={i} title={`${t('scep_page.chain')} #${i + 1}`} pem={c} filename={`chain-${i + 1}.pem`} accent="text-pki" />
                  ))}
                  <PemBlock title={t('scep_page.private_key')} pem={result.privateKeyPem} filename="private-key.pem" accent="text-mi-gold" />
                </>
              )}

              {/* Transaction log */}
              <details className="rounded-xl border border-border bg-bg-card">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-text-2 flex items-center gap-2">
                  <ScrollText size={15} /> {t('scep_page.transaction_log')}
                </summary>
                <ol className="px-5 pb-4 space-y-1 text-xs text-text-muted font-mono">
                  {result.log.map((l, i) => <li key={i}>{l}</li>)}
                </ol>
              </details>
            </motion.div>
          )
        })()}
      </AnimatePresence>
    </div>
  )
}
