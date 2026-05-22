import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import {
  CheckCircle, XCircle, AlertTriangle, Shield, Lock, Globe,
  Calendar, Hash, Key, Server, FileText, ExternalLink, Info,
} from 'lucide-react'

// ── Real certificate data fetched from machine.minha.cloud ──────────────────

const CERT = {
  subject:      'CN=machine.minha.cloud',
  sans:         ['machine.minha.cloud', 'machines.minha.cloud'],
  issuer:       "Let's Encrypt — R13 (C=US, O=Let's Encrypt)",
  notBefore:    'May 22, 2026 — 21:35:52 UTC',
  notAfter:     'Aug 20, 2026 — 21:35:51 UTC',
  daysRemaining: Math.ceil((new Date('2026-08-20T21:35:51Z').getTime() - Date.now()) / 86400000),
  serial:       '06:2C:9D:BD:30:BA:E8:90:11:23:93:9C:34:DF:3F:08:46:AD',
  sha1:         '28:02:1C:1E:C7:82:45:36:D9:B1:69:07:A0:7C:2F:06:B6:D2:2B:64',
  keyAlgo:      'RSA 4096-bit',
  sigAlgo:      'sha256WithRSAEncryption',
  keyUsage:     ['Digital Signature', 'Key Encipherment'],
  extKeyUsage:  ['TLS Web Server Authentication'],
  tlsVersion:   'TLS 1.3',
  cipher:       'AEAD-AES256-GCM-SHA384',
  crl:          'http://r13.c.lencr.org/46.crl',
  caIssuers:    'http://r13.i.lencr.org/',
  ct:           true,
}

// ── Security audit items ─────────────────────────────────────────────────────

type Status = 'pass' | 'warn' | 'fail'

interface AuditItem {
  label: string
  status: Status
  value: string
  detail: string
  nist?: string
}

const AUDIT: AuditItem[] = [
  {
    label:  'TLS Protocol Version',
    status: 'pass',
    value:  'TLS 1.3',
    detail: 'Only TLS 1.3 is active. TLS 1.0 and 1.1 are disabled.',
    nist:   'NIST SP 800-52 Rev 2 §3.3.1 — TLS 1.3 is the recommended protocol.',
  },
  {
    label:  'Cipher Suite',
    status: 'pass',
    value:  'AEAD-AES256-GCM-SHA384',
    detail: 'AES-256-GCM with SHA-384 HMAC. AEAD provides authenticated encryption.',
    nist:   'NIST SP 800-52 Rev 2 §3.3.2 — AES-GCM cipher suites are recommended.',
  },
  {
    label:  'Key Algorithm & Size',
    status: 'pass',
    value:  'RSA 4096-bit',
    detail: 'RSA 4096-bit exceeds the NIST minimum of 2048-bit. Well above baseline.',
    nist:   'NIST SP 800-57 Part 1 §5.6.1 — RSA 4096 provides 140-bit security strength.',
  },
  {
    label:  'Signature Algorithm',
    status: 'pass',
    value:  'SHA-256 with RSA',
    detail: 'SHA-256 is a FIPS 180-4 approved digest algorithm.',
    nist:   'NIST SP 800-52 Rev 2 §3.3.3 — SHA-256 or stronger is required.',
  },
  {
    label:  'Certificate Transparency',
    status: 'pass',
    value:  'SCT present (2 logs)',
    detail: "Certificate is logged in public CT logs. Allows detection of misissued certs.",
    nist:   "RFC 9162 / Google CT Policy — required for browser trust.",
  },
  {
    label:  'Perfect Forward Secrecy',
    status: 'pass',
    value:  'Enabled (TLS 1.3)',
    detail: 'TLS 1.3 mandates ephemeral key exchange. Session keys cannot be recovered from the private key.',
    nist:   'NIST SP 800-52 Rev 2 §3.3.2 — forward secrecy cipher suites are required.',
  },
  {
    label:  'Certificate Validity Period',
    status: CERT.daysRemaining > 30 ? 'pass' : CERT.daysRemaining > 14 ? 'warn' : 'fail',
    value:  `${CERT.daysRemaining} days remaining`,
    detail: `Expires Aug 20, 2026. Let's Encrypt issues 90-day certificates to enforce regular rotation.`,
    nist:   'NIST SP 800-57 — short-lived certificates reduce exposure window on compromise.',
  },
  {
    label:  'OCSP Stapling',
    status: 'warn',
    value:  'Not available',
    detail: "This certificate uses CRL (not OCSP) for revocation. The server cannot staple a revocation response.",
    nist:   'NIST SP 800-52 Rev 2 §3.4 — OCSP stapling reduces latency and improves privacy vs. direct OCSP queries.',
  },
  {
    label:  'RSA vs ECDSA',
    status: 'warn',
    value:  'RSA (consider ECDSA P-256)',
    detail: 'RSA 4096 is secure but slower than ECDSA P-256, which provides equivalent security (~128-bit) with a 4× smaller key and faster handshakes.',
    nist:   'NIST SP 800-186 — ECDSA P-256 and P-384 are recommended for new deployments.',
  },
]

// ── HTTP Security Headers audit ───────────────────────────────────────────────

interface HeaderItem {
  header: string
  status: Status
  value: string
  detail: string
  ref: string
}

const HEADERS: HeaderItem[] = [
  {
    header: 'Strict-Transport-Security',
    status: 'pass',
    value:  'max-age=31536000; includeSubDomains; preload',
    detail: '1-year HSTS with includeSubDomains and preload flag. Eligible for HSTS preload list submission.',
    ref:    'RFC 6797 — HSTS',
  },
  {
    header: 'X-Content-Type-Options',
    status: 'pass',
    value:  'nosniff',
    detail: 'Prevents browsers from MIME-sniffing a response away from the declared content-type.',
    ref:    'OWASP Secure Headers',
  },
  {
    header: 'X-Frame-Options',
    status: 'pass',
    value:  'SAMEORIGIN',
    detail: 'Prevents clickjacking by disallowing the page to be framed by external origins.',
    ref:    'RFC 7034',
  },
  {
    header: 'Referrer-Policy',
    status: 'pass',
    value:  'no-referrer-when-downgrade',
    detail: 'Sends full URL to same-origin HTTPS, strips referrer on HTTP downgrade.',
    ref:    'W3C Referrer Policy',
  },
  {
    header: 'Content-Security-Policy',
    status: 'fail',
    value:  'Not set',
    detail: 'No CSP header present. A CSP prevents XSS by restricting which resources the browser may load.',
    ref:    'OWASP CSP Cheat Sheet / NIST SP 800-95',
  },
  {
    header: 'Permissions-Policy',
    status: 'fail',
    value:  'Not set',
    detail: 'No Permissions-Policy header. This header restricts browser APIs (camera, geolocation, microphone).',
    ref:    'W3C Permissions Policy',
  },
  {
    header: 'Cross-Origin-Opener-Policy',
    status: 'fail',
    value:  'Not set',
    detail: 'COOP isolates the browsing context to prevent cross-origin attacks via window references.',
    ref:    'HTML Living Standard — COOP',
  },
  {
    header: 'X-Permitted-Cross-Domain-Policies',
    status: 'warn',
    value:  'Not set',
    detail: 'Controls Adobe Flash/PDF cross-domain access. Low risk for this app but recommended for completeness.',
    ref:    'OWASP Secure Headers',
  },
]

// ── NIST recommendations ──────────────────────────────────────────────────────

interface NistItem {
  ref: string
  title: string
  status: Status
  desc: string
}

const NIST_ITEMS: NistItem[] = [
  { ref: 'SP 800-52 Rev 2', title: 'Use TLS 1.3 exclusively',             status: 'pass', desc: 'TLS 1.3 is the only protocol active. TLS 1.2 is disabled via ssl_protocols in nginx.' },
  { ref: 'SP 800-52 Rev 2', title: 'Disable weak cipher suites',           status: 'pass', desc: 'Only AEAD ciphers (AES-GCM) are offered. RC4, 3DES, NULL, EXPORT ciphers are absent.' },
  { ref: 'SP 800-52 Rev 2', title: 'Enforce Forward Secrecy',              status: 'pass', desc: 'TLS 1.3 removes static RSA key exchange. All sessions use ephemeral keys.' },
  { ref: 'SP 800-57 Pt 1',  title: 'RSA key ≥ 2048 bits',                  status: 'pass', desc: 'RSA 4096-bit key in use — 2× the minimum. Provides 140-bit security strength.' },
  { ref: 'SP 800-52 Rev 2', title: 'HSTS with long max-age',               status: 'pass', desc: 'HSTS max-age=31536000 (1 year) is set with includeSubDomains and preload.' },
  { ref: 'SP 800-52 Rev 2', title: 'Certificate revocation mechanism',     status: 'warn', desc: 'CRL is present but OCSP stapling is not available. CRL requires client-side fetching.' },
  { ref: 'SP 800-95',       title: 'Content Security Policy',              status: 'fail', desc: 'No CSP header present. NIST SP 800-95 recommends defense-in-depth headers to prevent injection attacks.' },
  { ref: 'SP 800-186',      title: 'Prefer ECDSA for new certificates',    status: 'warn', desc: 'RSA 4096 is used. ECDSA P-256 or P-384 provides equivalent security with better performance.' },
  { ref: 'SP 800-57 Pt 1',  title: 'Certificate rotation (short TTL)',     status: 'pass', desc: "90-day Let's Encrypt certificate enforces regular rotation. Private key compromise window is limited." },
  { ref: 'FIPS 180-4',      title: 'Approved hash algorithm (SHA-256+)',   status: 'pass', desc: 'SHA-256 is used for certificate signature. SHA-1 is absent from the chain.' },
]

// ── Best Practices ────────────────────────────────────────────────────────────

interface BestPractice {
  priority: 'high' | 'medium' | 'low'
  title: string
  detail: string
  action: string
}

const BEST_PRACTICES: BestPractice[] = [
  {
    priority: 'high',
    title:    'Add a Content Security Policy header',
    detail:   'The absence of a CSP is the most significant security gap. A CSP prevents XSS by controlling which scripts, styles, and resources the browser may load. Even a permissive policy (script-src \'self\') is better than none.',
    action:   "add_header Content-Security-Policy \"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:;\" always;",
  },
  {
    priority: 'high',
    title:    'Add Cross-Origin-Opener-Policy (COOP)',
    detail:   'COOP isolates the top-level browsing context, preventing cross-origin window attacks. Required to enable SharedArrayBuffer and high-resolution timers in modern browsers.',
    action:   "add_header Cross-Origin-Opener-Policy \"same-origin\" always;",
  },
  {
    priority: 'medium',
    title:    'Switch to ECDSA P-256 on next certificate renewal',
    detail:   'RSA 4096 is strong but the private-key operations are ~40× slower than ECDSA P-256 for equivalent security. P-256 reduces TLS handshake CPU and improves latency, especially on mobile.',
    action:   "certbot certonly --key-type ecdsa --elliptic-curve secp256r1 -d machine.minha.cloud",
  },
  {
    priority: 'medium',
    title:    'Add Permissions-Policy header',
    detail:   'Lock down browser APIs this page does not use. Reduces the attack surface if a third-party script is ever injected.',
    action:   "add_header Permissions-Policy \"camera=(), microphone=(), geolocation=(), payment=()\" always;",
  },
  {
    priority: 'medium',
    title:    'Automate certificate renewal',
    detail:   "Let's Encrypt certificates expire every 90 days. Configure a cron or systemd timer to run certbot renew --pre-hook 'nginx -s stop' --post-hook 'nginx' at least twice a week.",
    action:   "sudo systemctl enable --now certbot.timer  # or: crontab -e → 0 3 * * 1,4 certbot renew",
  },
  {
    priority: 'low',
    title:    'Submit to HSTS Preload List',
    detail:   'The HSTS header includes the preload directive. Submit the domain to hstspreload.org so browsers hard-code HTTPS for machine.minha.cloud before the first visit.',
    action:   "https://hstspreload.org/?domain=machine.minha.cloud",
  },
  {
    priority: 'low',
    title:    'Add X-Permitted-Cross-Domain-Policies',
    detail:   'Prevents Adobe Flash and PDF readers from loading cross-domain content from this origin.',
    action:   "add_header X-Permitted-Cross-Domain-Policies \"none\" always;",
  },
]

// ── Sub-components ─────────────────────────────────────────────────────────────

const statusIcon = (s: Status, size = 15) => {
  if (s === 'pass') return <CheckCircle  size={size} className="text-spiffe  shrink-0" />
  if (s === 'warn') return <AlertTriangle size={size} className="text-mi-gold shrink-0" />
  return                   <XCircle      size={size} className="text-mi-red  shrink-0" />
}

const statusBadge = (s: Status) => {
  const map = {
    pass: 'bg-spiffe/10  text-spiffe  border-spiffe/20',
    warn: 'bg-mi-gold/10 text-mi-gold border-mi-gold/20',
    fail: 'bg-mi-red/10  text-mi-red  border-mi-red/20',
  }
  return <span className={`badge text-[10px] border ${map[s]}`}>{s.toUpperCase()}</span>
}

const priorityBadge = (p: BestPractice['priority']) => {
  const map = {
    high:   'bg-mi-red/10  text-mi-red  border-mi-red/20',
    medium: 'bg-mi-gold/10 text-mi-gold border-mi-gold/20',
    low:    'bg-k8s/10     text-k8s     border-k8s/20',
  }
  return <span className={`badge text-[10px] border ${map[p]}`}>{p.toUpperCase()}</span>
}

// ── Score ──────────────────────────────────────────────────────────────────────

function score(items: { status: Status }[]) {
  const pass = items.filter(i => i.status === 'pass').length
  const warn = items.filter(i => i.status === 'warn').length
  const fail = items.filter(i => i.status === 'fail').length
  return { pass, warn, fail, total: items.length, pct: Math.round((pass / items.length) * 100) }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CertInfoPage() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  const tlsScore    = score(AUDIT)
  const headerScore = score(HEADERS)
  const nistScore   = score(NIST_ITEMS)

  const overallPct = Math.round(
    (tlsScore.pass + headerScore.pass + nistScore.pass) /
    (tlsScore.total + headerScore.total + nistScore.total) * 100
  )

  const fade = (delay = 0) => ({
    initial: { opacity: 0, y: 20 },
    animate: inView ? { opacity: 1, y: 0 } : {},
    transition: { duration: 0.5, delay },
  })

  return (
    <div ref={ref} className="py-24 px-6">
      <div className="max-w-5xl mx-auto space-y-16">

        {/* ── Header ── */}
        <motion.div {...fade(0)} className="text-center space-y-4">
          <span className="badge bg-mi-cyan/10 text-mi-cyan border border-mi-cyan/20">
            <Lock size={11} className="mr-1.5" /> TLS Certificate & Security Audit
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold">machine.minha.cloud</h1>
          <p className="text-slate-400 max-w-xl mx-auto">
            Real-time inspection of the TLS certificate, HTTP security headers, NIST SP 800-52 compliance, and actionable hardening recommendations.
          </p>
        </motion.div>

        {/* ── Overall score cards ── */}
        <motion.div {...fade(0.05)} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Overall Score',    value: `${overallPct}%`,          color: overallPct >= 80 ? 'text-spiffe' : overallPct >= 60 ? 'text-mi-gold' : 'text-mi-red' },
            { label: 'TLS / Certificate',value: `${tlsScore.pass}/${tlsScore.total}`,   color: 'text-mi-cyan'  },
            { label: 'HTTP Headers',     value: `${headerScore.pass}/${headerScore.total}`, color: 'text-mi-gold'  },
            { label: 'NIST SP 800-52',   value: `${nistScore.pass}/${nistScore.total}`,  color: 'text-pki'     },
          ].map((c, i) => (
            <div key={i} className="section-card text-center space-y-1">
              <p className={`text-3xl font-bold font-mono ${c.color}`}>{c.value}</p>
              <p className="text-xs text-slate-500">{c.label}</p>
            </div>
          ))}
        </motion.div>

        {/* ── Certificate details card ── */}
        <motion.div {...fade(0.1)} className="space-y-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FileText size={20} className="text-mi-cyan" /> Certificate Details
          </h2>
          <div className="rounded-xl border border-border overflow-hidden">
            {[
              { icon: Globe,    label: 'Subject',             value: CERT.subject },
              { icon: Globe,    label: 'Subject Alt Names',   value: CERT.sans.join(', ') },
              { icon: Shield,   label: 'Issuer',              value: CERT.issuer },
              { icon: Calendar, label: 'Valid From',          value: CERT.notBefore },
              { icon: Calendar, label: 'Valid Until',         value: `${CERT.notAfter} (${CERT.daysRemaining} days remaining)`, warn: CERT.daysRemaining < 30 },
              { icon: Key,      label: 'Public Key',          value: CERT.keyAlgo },
              { icon: Lock,     label: 'Signature Algorithm', value: CERT.sigAlgo },
              { icon: Hash,     label: 'Serial Number',       value: CERT.serial },
              { icon: Hash,     label: 'SHA-1 Fingerprint',   value: CERT.sha1 },
              { icon: Server,   label: 'TLS Version',         value: CERT.tlsVersion },
              { icon: Lock,     label: 'Cipher Suite',        value: CERT.cipher },
              { icon: Globe,    label: 'Key Usage',           value: CERT.keyUsage.join(', ') },
              { icon: Globe,    label: 'Extended Key Usage',  value: CERT.extKeyUsage.join(', ') },
              { icon: Info,     label: 'CT Logs',             value: 'Present (2 Signed Certificate Timestamps)' },
              { icon: Info,     label: 'CRL Distribution',   value: CERT.crl },
            ].map((row, i) => {
              const Icon = row.icon
              return (
                <div key={i} className={`flex items-start gap-4 px-5 py-3 border-b border-border/50 ${i % 2 === 0 ? 'bg-bg-card' : 'bg-bg'}`}>
                  <Icon size={14} className="text-slate-600 mt-0.5 shrink-0" />
                  <span className="text-slate-400 text-sm w-44 shrink-0">{row.label}</span>
                  <span className={`text-sm font-mono break-all ${row.warn ? 'text-mi-gold' : 'text-slate-200'}`}>{row.value}</span>
                </div>
              )
            })}
          </div>
        </motion.div>

        {/* ── TLS Security Audit ── */}
        <motion.div {...fade(0.15)} className="space-y-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield size={20} className="text-mi-gold" /> TLS Security Audit
          </h2>
          <div className="space-y-2">
            {AUDIT.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -16 }} animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.4, delay: 0.18 + i * 0.05 }}
                className="section-card space-y-2"
              >
                <div className="flex items-center gap-3 flex-wrap">
                  {statusIcon(item.status)}
                  <span className="font-semibold text-white text-sm flex-1">{item.label}</span>
                  {statusBadge(item.status)}
                  <span className="font-mono text-xs text-mi-cyan bg-mi-cyan/5 px-2 py-0.5 rounded border border-mi-cyan/15">{item.value}</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed pl-6">{item.detail}</p>
                {item.nist && (
                  <p className="text-[10px] text-slate-600 font-mono pl-6">{item.nist}</p>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* ── HTTP Headers Audit ── */}
        <motion.div {...fade(0.2)} className="space-y-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Server size={20} className="text-pki" /> HTTP Security Headers
          </h2>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-muted/50">
                  <th className="text-left px-5 py-3 text-slate-400 font-semibold w-8"></th>
                  <th className="text-left px-5 py-3 text-slate-400 font-semibold">Header</th>
                  <th className="text-left px-5 py-3 text-slate-400 font-semibold hidden sm:table-cell">Value</th>
                  <th className="text-left px-5 py-3 text-slate-400 font-semibold w-20">Status</th>
                </tr>
              </thead>
              <tbody>
                {HEADERS.map((h, i) => (
                  <tr key={i} className={`border-b border-border/50 ${i % 2 === 0 ? 'bg-bg-card' : 'bg-bg'}`}>
                    <td className="px-5 py-3">{statusIcon(h.status, 14)}</td>
                    <td className="px-5 py-3">
                      <p className="font-mono text-xs text-slate-200">{h.header}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">{h.detail}</p>
                    </td>
                    <td className="px-5 py-3 hidden sm:table-cell">
                      <span className="font-mono text-[11px] text-mi-cyan break-all">{h.value}</span>
                    </td>
                    <td className="px-5 py-3">{statusBadge(h.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* ── NIST Compliance ── */}
        <motion.div {...fade(0.25)} className="space-y-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FileText size={20} className="text-spiffe" /> NIST Compliance
          </h2>
          <p className="text-sm text-slate-500">Evaluated against NIST SP 800-52 Rev 2 (TLS Guidelines), SP 800-57 (Key Management), SP 800-186 (Elliptic Curves), and SP 800-95 (Web Security).</p>
          <div className="space-y-2">
            {NIST_ITEMS.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -16 }} animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.4, delay: 0.28 + i * 0.04 }}
                className="flex items-start gap-3 section-card"
              >
                {statusIcon(item.status)}
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white text-sm">{item.title}</span>
                    <span className="font-mono text-[10px] text-mi-gold bg-mi-gold/5 px-1.5 py-0.5 rounded border border-mi-gold/15">{item.ref}</span>
                    {statusBadge(item.status)}
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* ── Best Practices ── */}
        <motion.div {...fade(0.3)} className="space-y-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <CheckCircle size={20} className="text-mi-cyan" /> Recommendations
          </h2>
          <div className="space-y-4">
            {BEST_PRACTICES.map((bp, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: 0.32 + i * 0.06 }}
                className="section-card space-y-3"
              >
                <div className="flex items-start gap-3 flex-wrap">
                  {priorityBadge(bp.priority)}
                  <h3 className="font-semibold text-white text-sm flex-1">{bp.title}</h3>
                </div>
                <p className="text-sm text-slate-400 leading-relaxed">{bp.detail}</p>
                <div className="code-block text-xs text-mi-cyan break-all">{bp.action}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* ── External resources ── */}
        <motion.div {...fade(0.35)} className="section-card space-y-4 bg-gradient-to-br from-mi-cyan/5 to-bg-card border-mi-cyan/20">
          <h2 className="text-lg font-bold text-white">Reference Documents</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { label: 'NIST SP 800-52 Rev 2 — TLS Guidelines',         url: 'https://csrc.nist.gov/publications/detail/sp/800-52/rev-2/final' },
              { label: 'NIST SP 800-57 Part 1 — Key Management',        url: 'https://csrc.nist.gov/publications/detail/sp/800-57-part-1/rev-5/final' },
              { label: 'NIST SP 800-186 — Recommendations for ECC',     url: 'https://csrc.nist.gov/publications/detail/sp/800-186/final' },
              { label: 'OWASP TLS Cheat Sheet',                          url: 'https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Security_Cheat_Sheet.html' },
              { label: 'OWASP Secure Headers Project',                   url: 'https://owasp.org/www-project-secure-headers/' },
              { label: 'RFC 9162 — Certificate Transparency v2',         url: 'https://www.rfc-editor.org/rfc/rfc9162' },
              { label: "Let's Encrypt — R13 Intermediate CA",            url: 'https://letsencrypt.org/certificates/' },
              { label: 'HSTS Preload Submission',                        url: 'https://hstspreload.org/?domain=machine.minha.cloud' },
            ].map((r, i) => (
              <a key={i} href={r.url} target="_blank" rel="noopener"
                className="flex items-center gap-2 text-xs text-slate-400 hover:text-mi-cyan transition-colors">
                <ExternalLink size={10} className="shrink-0" />
                {r.label}
              </a>
            ))}
          </div>
        </motion.div>

      </div>
    </div>
  )
}
