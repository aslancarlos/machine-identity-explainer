import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, CheckCircle, XCircle, AlertTriangle, Shield, Lock,
  Globe, Calendar, Hash, Key, Server, FileText, Info,
  Loader, ArrowRight,
} from 'lucide-react'

// ── API response types ────────────────────────────────────────────────────────

interface ScanResult {
  domain: string
  scannedAt: string
  certificate: {
    subject: string; subjectCN: string; sans: string[]
    issuer: string; issuerCN: string; issuerOrg: string
    validFrom: string; validTo: string; daysRemaining: number
    serial: string; fingerprintSHA1: string; fingerprintSHA256: string
    bits: number; keyAlgo: string
    hasOCSP: boolean; ocspUrl: string | null; caIssuers: string | null; hasCRL: boolean
  }
  tls: {
    protocol: string; cipherName: string; cipherStandard: string
    trusted: boolean; authError: string | null
  }
  headers: {
    hsts: string | null; xContentType: string | null; xFrameOptions: string | null
    referrerPolicy: string | null; csp: string | null; permissionsPolicy: string | null
    coop: string | null; coep: string | null; xPermittedCDP: string | null; server: string | null
  }
}

// ── Audit helpers ─────────────────────────────────────────────────────────────

type Status = 'pass' | 'warn' | 'fail'

interface AuditItem { label: string; status: Status; value: string; detail: string; ref?: string }

function buildTLSAudit(r: ScanResult): AuditItem[] {
  const c = r.certificate
  const t = r.tls

  const tlsStatus = (): Status => {
    if (t.protocol === 'TLSv1.3') return 'pass'
    if (t.protocol === 'TLSv1.2') return 'warn'
    return 'fail'
  }

  const keyStatus = (): Status => {
    if (c.keyAlgo.startsWith('ECDSA')) return c.bits >= 256 ? 'pass' : 'warn'
    return c.bits >= 4096 ? 'pass' : c.bits >= 2048 ? 'warn' : 'fail'
  }

  return [
    {
      label: 'Trusted Certificate',
      status: r.tls.trusted ? 'pass' : 'fail',
      value: r.tls.trusted ? 'Verified by OS trust store' : `Not trusted: ${r.tls.authError}`,
      detail: r.tls.trusted
        ? 'The certificate chain validates against the system trust store (let\'s encrypt / public CA).'
        : `The certificate chain could not be verified: ${r.tls.authError}.`,
      ref: 'RFC 5280 — Certificate validation',
    },
    {
      label: 'TLS Protocol Version',
      status: tlsStatus(),
      value: t.protocol,
      detail: t.protocol === 'TLSv1.3'
        ? 'TLS 1.3 is the recommended protocol. Provides improved security and performance.'
        : t.protocol === 'TLSv1.2'
        ? 'TLS 1.2 is acceptable but consider upgrading to TLS 1.3 only.'
        : 'TLS 1.0/1.1 are deprecated and insecure. Upgrade immediately.',
      ref: 'NIST SP 800-52 Rev 2 §3.3.1',
    },
    {
      label: 'Cipher Suite',
      status: t.cipherName.includes('AES') && t.cipherName.includes('GCM') ? 'pass'
              : t.cipherName.includes('AES') ? 'warn' : 'fail',
      value: t.cipherStandard || t.cipherName,
      detail: 'AEAD cipher suites (AES-GCM, ChaCha20-Poly1305) provide authenticated encryption. RC4, 3DES, and NULL ciphers are insecure.',
      ref: 'NIST SP 800-52 Rev 2 §3.3.2',
    },
    {
      label: 'Key Algorithm & Size',
      status: keyStatus(),
      value: c.keyAlgo,
      detail: c.keyAlgo.startsWith('ECDSA')
        ? `ECDSA ${c.bits}-bit. Excellent choice — equivalent security to RSA ${c.bits * 12}-bit with much smaller key size.`
        : c.bits >= 4096 ? `RSA ${c.bits}-bit. Exceeds NIST minimum of 2048-bit.`
        : c.bits >= 2048 ? `RSA ${c.bits}-bit. Meets NIST minimum. Consider RSA 4096 or ECDSA P-256 for new certs.`
        : `RSA ${c.bits}-bit. Below minimum. Replace immediately.`,
      ref: 'NIST SP 800-57 Pt1 / SP 800-186',
    },
    {
      label: 'Certificate Validity',
      status: c.daysRemaining > 30 ? 'pass' : c.daysRemaining > 14 ? 'warn' : 'fail',
      value: c.daysRemaining > 0 ? `${c.daysRemaining} days remaining` : 'EXPIRED',
      detail: c.daysRemaining > 0
        ? `Expires ${c.validTo}. Short-lived certificates (≤90 days) reduce the window of exposure on compromise.`
        : `Certificate expired on ${c.validTo}. Renew immediately.`,
      ref: 'NIST SP 800-57 — short-lived credentials',
    },
    {
      label: 'Perfect Forward Secrecy',
      status: t.protocol === 'TLSv1.3' ? 'pass'
              : t.cipherName.includes('ECDHE') || t.cipherName.includes('DHE') ? 'pass' : 'fail',
      value: t.protocol === 'TLSv1.3' ? 'Enabled (TLS 1.3 mandates it)'
             : t.cipherName.includes('ECDHE') ? 'Enabled (ECDHE)' : 'Not enabled',
      detail: 'Ephemeral key exchange ensures session keys cannot be recovered from the server private key, protecting past sessions.',
      ref: 'NIST SP 800-52 Rev 2 §3.3.2',
    },
    {
      label: 'OCSP Revocation',
      status: c.hasOCSP ? 'pass' : c.hasCRL ? 'warn' : 'warn',
      value: c.hasOCSP ? `OCSP: ${c.ocspUrl}` : c.hasCRL ? 'CRL only (no OCSP)' : 'No revocation info',
      detail: c.hasOCSP
        ? 'OCSP endpoint present. Enable OCSP stapling in nginx (ssl_stapling on) to speed up TLS handshakes.'
        : c.hasCRL
        ? 'Only CRL is available for revocation. CRL requires the client to download and parse the revocation list.'
        : 'No revocation mechanism found. Compromised certificates cannot be quickly invalidated.',
      ref: 'NIST SP 800-52 Rev 2 §3.4',
    },
  ]
}

function buildHeaderAudit(h: ScanResult['headers']): AuditItem[] {
  return [
    {
      label: 'Strict-Transport-Security',
      status: h.hsts ? (h.hsts.includes('preload') && h.hsts.includes('includeSubDomains') ? 'pass' : 'warn') : 'fail',
      value: h.hsts || 'Not set',
      detail: h.hsts
        ? 'HSTS forces HTTPS. Best practice: max-age=31536000; includeSubDomains; preload'
        : 'No HSTS. Browsers may connect via HTTP first, enabling downgrade attacks.',
      ref: 'RFC 6797',
    },
    {
      label: 'Content-Security-Policy',
      status: h.csp ? 'pass' : 'fail',
      value: h.csp ? h.csp.substring(0, 60) + (h.csp.length > 60 ? '…' : '') : 'Not set',
      detail: h.csp
        ? 'CSP present. Review policy strength — avoid unsafe-inline and unsafe-eval where possible.'
        : 'No CSP. This is the most impactful missing header. A CSP prevents XSS by restricting resource loading.',
      ref: 'OWASP CSP / NIST SP 800-95',
    },
    {
      label: 'X-Content-Type-Options',
      status: h.xContentType === 'nosniff' ? 'pass' : 'fail',
      value: h.xContentType || 'Not set',
      detail: 'Prevents browsers from MIME-sniffing responses. Should be set to "nosniff".',
      ref: 'OWASP Secure Headers',
    },
    {
      label: 'X-Frame-Options',
      status: h.xFrameOptions ? 'pass' : 'warn',
      value: h.xFrameOptions || 'Not set',
      detail: h.xFrameOptions
        ? 'Clickjacking protection active.'
        : 'Consider adding X-Frame-Options: SAMEORIGIN or using CSP frame-ancestors.',
      ref: 'RFC 7034',
    },
    {
      label: 'Referrer-Policy',
      status: h.referrerPolicy ? 'pass' : 'warn',
      value: h.referrerPolicy || 'Not set',
      detail: 'Controls how much referrer information is sent. Recommended: no-referrer-when-downgrade or strict-origin.',
      ref: 'W3C Referrer Policy',
    },
    {
      label: 'Permissions-Policy',
      status: h.permissionsPolicy ? 'pass' : 'warn',
      value: h.permissionsPolicy || 'Not set',
      detail: 'Restricts access to browser APIs (camera, microphone, geolocation). Reduces attack surface.',
      ref: 'W3C Permissions Policy',
    },
    {
      label: 'Cross-Origin-Opener-Policy',
      status: h.coop ? 'pass' : 'warn',
      value: h.coop || 'Not set',
      detail: 'COOP isolates browsing context from cross-origin windows. Recommended: same-origin.',
      ref: 'HTML Living Standard',
    },
    {
      label: 'Server header',
      status: !h.server || h.server === 'nginx' ? 'pass' : 'warn',
      value: h.server || 'Not exposed',
      detail: !h.server
        ? 'Server header not exposed. Good — reduces information leakage.'
        : h.server.match(/\d+\.\d+/) ? 'Server header exposes version number. Remove with server_tokens off in nginx.'
        : 'Server header present but without version. Consider removing entirely.',
      ref: 'OWASP Security Misconfiguration',
    },
  ]
}

function score(items: { status: Status }[]) {
  const pass = items.filter(i => i.status === 'pass').length
  const warn = items.filter(i => i.status === 'warn').length
  const fail = items.filter(i => i.status === 'fail').length
  return { pass, warn, fail, total: items.length }
}

// ── Sub-components ────────────────────────────────────────────────────────────

const statusIcon = (s: Status, size = 15) => {
  if (s === 'pass') return <CheckCircle   size={size} className="text-spiffe  shrink-0" />
  if (s === 'warn') return <AlertTriangle  size={size} className="text-mi-gold shrink-0" />
  return                   <XCircle       size={size} className="text-mi-red  shrink-0" />
}

const statusBadge = (s: Status) => {
  const map = {
    pass: 'bg-spiffe/10  text-spiffe  border-spiffe/20',
    warn: 'bg-mi-gold/10 text-mi-gold border-mi-gold/20',
    fail: 'bg-mi-red/10  text-mi-red  border-mi-red/20',
  }
  return <span className={`badge text-[10px] border ${map[s]}`}>{s.toUpperCase()}</span>
}

function ScoreCard({ label, pass, total, color }: { label: string; pass: number; total: number; color: string }) {
  return (
    <div className="section-card text-center space-y-1">
      <p className={`text-3xl font-bold font-mono ${color}`}>{pass}/{total}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  )
}

function AuditRow({ item, delay }: { item: AuditItem; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay }}
      className="section-card space-y-2"
    >
      <div className="flex items-center gap-3 flex-wrap">
        {statusIcon(item.status)}
        <span className="font-semibold text-white text-sm flex-1">{item.label}</span>
        {statusBadge(item.status)}
        <span className="font-mono text-xs text-mi-cyan bg-mi-cyan/5 px-2 py-0.5 rounded border border-mi-cyan/15 max-w-xs truncate">
          {item.value}
        </span>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed pl-6">{item.detail}</p>
      {item.ref && <p className="text-[10px] text-slate-600 font-mono pl-6">{item.ref}</p>}
    </motion.div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const EXAMPLES = ['github.com', 'cloudflare.com', 'google.com', 'expired.badssl.com']

export default function TLSScanPage() {
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<ScanResult | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  async function runScan(domain: string) {
    const d = domain.trim()
    if (!d) return
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      const res = await fetch(`/api/scan?domain=${encodeURIComponent(d)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setResult(data as ScanResult)
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unexpected error')
    } finally {
      setLoading(false)
    }
  }

  const tlsAudit    = result ? buildTLSAudit(result)    : []
  const headerAudit = result ? buildHeaderAudit(result.headers) : []
  const tlsScore    = score(tlsAudit)
  const hdrScore    = score(headerAudit)
  const overallPct  = result
    ? Math.round((tlsScore.pass + hdrScore.pass) / (tlsScore.total + hdrScore.total) * 100)
    : 0

  return (
    <div className="py-24 px-6">
      <div className="max-w-4xl mx-auto space-y-12">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-4"
        >
          <span className="badge bg-mi-cyan/10 text-mi-cyan border border-mi-cyan/20">
            <Search size={11} className="mr-1.5" /> TLS Scanner
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold">Certificate & Security Scan</h1>
          <p className="text-slate-400 max-w-xl mx-auto">
            Enter any domain to inspect its TLS certificate, HTTP security headers, and get a full security audit — live from the server.
          </p>
        </motion.div>

        {/* Input */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="space-y-4"
        >
          <form
            onSubmit={e => { e.preventDefault(); runScan(input) }}
            className="flex gap-2"
          >
            <div className="flex-1 relative">
              <Globe size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="example.com or https://example.com"
                className="w-full bg-bg-card border border-border rounded-xl pl-9 pr-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-mi-cyan/50 focus:ring-1 focus:ring-mi-cyan/20 transition-colors"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-mi-cyan text-bg font-semibold text-sm hover:bg-mi-cyan/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              {loading ? <Loader size={15} className="animate-spin" /> : <ArrowRight size={15} />}
              {loading ? 'Scanning…' : 'Scan'}
            </button>
          </form>

          {/* Example domains */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-slate-600">Try:</span>
            {EXAMPLES.map(ex => (
              <button
                key={ex}
                onClick={() => { setInput(ex); runScan(ex) }}
                className="text-xs font-mono text-slate-500 hover:text-mi-cyan bg-bg-muted border border-border hover:border-mi-cyan/30 px-2.5 py-1 rounded-lg transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Error state */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-start gap-3 section-card border-mi-red/20 bg-mi-red/5"
            >
              <XCircle size={16} className="text-mi-red shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-mi-red">Scan failed</p>
                <p className="text-xs text-slate-400 mt-0.5">{error}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <AnimatePresence>
          {result && (
            <motion.div
              ref={resultsRef}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="space-y-12"
            >
              {/* Domain header */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-mi-cyan">{result.domain}</h2>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    Scanned {new Date(result.scannedAt).toLocaleString()}
                  </p>
                </div>
                <div className={`text-4xl font-bold font-mono ${overallPct >= 80 ? 'text-spiffe' : overallPct >= 55 ? 'text-mi-gold' : 'text-mi-red'}`}>
                  {overallPct}%
                </div>
              </div>

              {/* Score cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <ScoreCard label="Overall"      pass={tlsScore.pass + hdrScore.pass} total={tlsScore.total + hdrScore.total} color={overallPct >= 80 ? 'text-spiffe' : overallPct >= 55 ? 'text-mi-gold' : 'text-mi-red'} />
                <ScoreCard label="TLS / Cert"   pass={tlsScore.pass}  total={tlsScore.total}  color="text-mi-cyan" />
                <ScoreCard label="HTTP Headers" pass={hdrScore.pass}  total={hdrScore.total}  color="text-mi-gold" />
                <ScoreCard label="Trusted CA"   pass={result.tls.trusted ? 1 : 0} total={1} color={result.tls.trusted ? 'text-spiffe' : 'text-mi-red'} />
              </div>

              {/* Certificate details */}
              <div className="space-y-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <FileText size={18} className="text-mi-cyan" /> Certificate Details
                </h3>
                <div className="rounded-xl border border-border overflow-hidden">
                  {[
                    { icon: Globe,    label: 'Domain',             value: result.certificate.subjectCN },
                    { icon: Globe,    label: 'Subject Alt Names',  value: result.certificate.sans.join(', ') },
                    { icon: Shield,   label: 'Issuer',             value: result.certificate.issuer },
                    { icon: Calendar, label: 'Valid From',         value: result.certificate.validFrom },
                    { icon: Calendar, label: 'Valid Until',        value: `${result.certificate.validTo} (${result.certificate.daysRemaining} days)`, warn: result.certificate.daysRemaining < 30 },
                    { icon: Key,      label: 'Public Key',         value: result.certificate.keyAlgo },
                    { icon: Lock,     label: 'TLS Protocol',       value: result.tls.protocol },
                    { icon: Lock,     label: 'Cipher Suite',       value: result.tls.cipherStandard },
                    { icon: Hash,     label: 'Serial Number',      value: result.certificate.serial },
                    { icon: Hash,     label: 'SHA-1 Fingerprint',  value: result.certificate.fingerprintSHA1 },
                    { icon: Hash,     label: 'SHA-256 Fingerprint',value: result.certificate.fingerprintSHA256 },
                    { icon: Info,     label: 'OCSP',               value: result.certificate.ocspUrl || 'Not available' },
                    { icon: Info,     label: 'CRL',                value: result.certificate.hasCRL ? 'Present' : 'Not found' },
                  ].map((row, i) => {
                    const Icon = row.icon
                    return (
                      <div key={i} className={`flex items-start gap-4 px-5 py-3 border-b border-border/50 ${i % 2 === 0 ? 'bg-bg-card' : 'bg-bg'}`}>
                        <Icon size={13} className="text-slate-600 mt-0.5 shrink-0" />
                        <span className="text-slate-400 text-xs w-40 shrink-0">{row.label}</span>
                        <span className={`text-xs font-mono break-all ${row.warn ? 'text-mi-gold' : 'text-slate-200'}`}>{row.value}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* TLS audit */}
              <div className="space-y-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Shield size={18} className="text-mi-gold" /> TLS Security Audit
                </h3>
                <div className="space-y-2">
                  {tlsAudit.map((item, i) => <AuditRow key={i} item={item} delay={i * 0.04} />)}
                </div>
              </div>

              {/* HTTP headers audit */}
              <div className="space-y-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Server size={18} className="text-pki" /> HTTP Security Headers
                </h3>
                <div className="rounded-xl border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-bg-muted/50">
                        <th className="w-8 px-4 py-3"></th>
                        <th className="text-left px-4 py-3 text-slate-400 font-semibold">Header</th>
                        <th className="text-left px-4 py-3 text-slate-400 font-semibold hidden md:table-cell">Value</th>
                        <th className="text-left px-4 py-3 text-slate-400 font-semibold w-16">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {headerAudit.map((h, i) => (
                        <tr key={i} className={`border-b border-border/50 ${i % 2 === 0 ? 'bg-bg-card' : 'bg-bg'}`}>
                          <td className="px-4 py-3">{statusIcon(h.status, 13)}</td>
                          <td className="px-4 py-3">
                            <p className="font-mono text-xs text-slate-200">{h.label}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{h.detail}</p>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className="font-mono text-[11px] text-mi-cyan break-all">{h.value}</span>
                          </td>
                          <td className="px-4 py-3">{statusBadge(h.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Raw header values (mobile fallback) */}
              <div className="md:hidden space-y-2">
                <p className="text-xs text-slate-600 font-mono uppercase tracking-widest">Raw header values</p>
                {Object.entries(result.headers).map(([k, v]) => v ? (
                  <div key={k} className="flex gap-2 text-xs">
                    <span className="text-slate-500 shrink-0 w-32 truncate font-mono">{k}</span>
                    <span className="text-mi-cyan font-mono break-all">{v}</span>
                  </div>
                ) : null)}
              </div>

              {/* Scan again nudge */}
              <div className="section-card flex items-center justify-between gap-4 flex-wrap">
                <p className="text-sm text-slate-400">Want to scan another domain?</p>
                <button
                  onClick={() => { setResult(null); setInput(''); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                  className="flex items-center gap-2 text-sm text-mi-cyan hover:text-mi-cyan/80 transition-colors font-semibold"
                >
                  New scan <ArrowRight size={14} />
                </button>
              </div>

            </motion.div>
          )}
        </AnimatePresence>

        {/* Idle state */}
        {!result && !loading && !error && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-center py-16 space-y-3"
          >
            <Lock size={40} className="text-border mx-auto" />
            <p className="text-slate-600 text-sm">Enter a domain above to start the scan</p>
            <p className="text-slate-700 text-xs font-mono">Inspects TLS certificate, cipher suite, and all HTTP security headers</p>
          </motion.div>
        )}

      </div>
    </div>
  )
}
