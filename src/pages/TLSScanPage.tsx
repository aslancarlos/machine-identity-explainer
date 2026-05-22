import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, CheckCircle, XCircle, AlertTriangle, Shield, Lock,
  Globe, Calendar, Hash, Key, Server, FileText, Info,
  Loader, ArrowRight, ExternalLink, BookOpen,
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

function buildNISTAudit(r: ScanResult): AuditItem[] {
  const c = r.certificate
  const t = r.tls
  const h = r.headers

  const certAgeDays = (new Date(c.validTo).getTime() - new Date(c.validFrom).getTime()) / 86400000

  const keyStatus = (): Status => {
    if (c.keyAlgo.startsWith('ECDSA')) return c.bits >= 384 ? 'pass' : c.bits >= 256 ? 'warn' : 'fail'
    if (c.bits >= 3072) return 'pass'
    if (c.bits >= 2048) return 'warn'
    return 'fail'
  }

  const approvedCurve = (): Status => {
    if (!c.keyAlgo.startsWith('ECDSA')) return 'pass'
    return [256, 384, 521].includes(c.bits) ? 'pass' : 'fail'
  }

  const cipherStatus = (): Status => {
    const n = t.cipherName
    if (n.includes('AES_128_GCM') || n.includes('AES_256_GCM') || n.includes('CHACHA20')) return 'pass'
    if (t.protocol === 'TLSv1.3') return 'pass'
    if (n.includes('AES') && n.includes('GCM')) return 'pass'
    if (n.includes('AES')) return 'warn'
    return 'fail'
  }

  const hstsStatus = (): Status => {
    if (!h.hsts) return 'fail'
    const maxAge = parseInt(h.hsts.match(/max-age=(\d+)/)?.[1] || '0')
    if (maxAge >= 31536000 && h.hsts.includes('includeSubDomains')) return 'pass'
    if (maxAge >= 2592000) return 'warn'
    return 'fail'
  }

  return [
    {
      label: 'SP 800-52 Rev 2 §3.3.1 — TLS Protocol Version',
      status: t.protocol === 'TLSv1.3' ? 'pass' : t.protocol === 'TLSv1.2' ? 'warn' : 'fail',
      value: t.protocol,
      detail: t.protocol === 'TLSv1.3'
        ? 'Compliant. TLS 1.3 is the NIST-preferred protocol — removes legacy handshake vulnerabilities and mandates AEAD and PFS by design.'
        : t.protocol === 'TLSv1.2'
        ? 'Conditionally compliant. TLS 1.2 is the NIST minimum. Configure ssl_protocols TLSv1.2 TLSv1.3 and prefer TLS 1.3 cipher suites.'
        : 'Non-compliant. TLS 1.0 and 1.1 are explicitly prohibited by NIST SP 800-52 Rev 2. Upgrade immediately.',
      ref: 'NIST SP 800-52 Rev 2 §3.3.1',
    },
    {
      label: 'SP 800-52 Rev 2 §3.3.2 — Approved Cipher Suite',
      status: cipherStatus(),
      value: t.cipherStandard || t.cipherName,
      detail: 'NIST-approved suites (Table 3-5): TLS_AES_256_GCM_SHA384, TLS_AES_128_GCM_SHA256, TLS_CHACHA20_POLY1305_SHA256 (TLS 1.3); TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384, TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384 (TLS 1.2). RC4, 3DES, NULL, and export ciphers are prohibited.',
      ref: 'NIST SP 800-52 Rev 2 §3.3.2 Table 3-5',
    },
    {
      label: 'SP 800-52 Rev 2 §3.3.2 — Perfect Forward Secrecy',
      status: t.protocol === 'TLSv1.3' ? 'pass'
              : t.cipherName.includes('ECDHE') || t.cipherName.includes('DHE') ? 'pass' : 'fail',
      value: t.protocol === 'TLSv1.3' ? 'Mandated by TLS 1.3'
             : t.cipherName.includes('ECDHE') ? 'ECDHE enabled'
             : t.cipherName.includes('DHE') ? 'DHE enabled' : 'Not enabled',
      detail: 'NIST requires ephemeral (EC)DHE key exchange to ensure session keys cannot be recovered from a compromised server private key. Static RSA key exchange (no PFS) is prohibited. TLS 1.3 mandates PFS by design.',
      ref: 'NIST SP 800-52 Rev 2 §3.3.2',
    },
    {
      label: 'SP 800-57 Pt 1 §5.6 — Key Strength (2031+ Horizon)',
      status: keyStatus(),
      value: c.keyAlgo,
      detail: (() => {
        const s = keyStatus()
        if (s === 'pass') return c.keyAlgo.startsWith('ECDSA')
          ? `ECDSA ${c.bits}-bit provides ≥192-bit security. Meets NIST requirement for security through 2031 and beyond.`
          : `RSA ${c.bits}-bit meets NIST key strength requirements for long-term security beyond 2030.`
        if (s === 'warn') return c.keyAlgo.startsWith('ECDSA')
          ? 'ECDSA P-256 is acceptable (128-bit security, adequate through 2030). Migrate to P-384 for certificates requiring security beyond 2030.'
          : 'RSA 2048-bit provides 112-bit security (adequate through 2030 only). Migrate to RSA 3072-bit or ECDSA P-256 for post-2030 security.'
        return 'Key strength is below NIST minimums. Replace certificate immediately with RSA ≥2048-bit or ECDSA P-256.'
      })(),
      ref: 'NIST SP 800-57 Pt 1 Rev 5 §5.6.1 Table 2',
    },
    {
      label: 'SP 800-186 §4 — ECDSA Approved Curve',
      status: approvedCurve(),
      value: c.keyAlgo.startsWith('ECDSA') ? `P-${c.bits} (secp${c.bits}r1)` : `N/A — ${c.keyAlgo}`,
      detail: c.keyAlgo.startsWith('ECDSA')
        ? [256, 384, 521].includes(c.bits)
          ? `P-${c.bits} is a NIST-approved curve per SP 800-186. Provides ${c.bits === 256 ? '128' : c.bits === 384 ? '192' : '256'}-bit security. Brainpool, secp256k1, and X25519 are not approved for FIPS 140 use.`
          : `P-${c.bits} is not a NIST-approved curve. Use P-256 (secp256r1), P-384 (secp384r1), or P-521 (secp521r1).`
        : 'Certificate uses RSA — NIST SP 800-186 elliptic curve requirements do not apply. Consider ECDSA for new certificates.',
      ref: 'NIST SP 800-186 §4 / FIPS 186-5',
    },
    {
      label: 'SP 800-57 §5.3.6 — Certificate Cryptoperiod',
      status: certAgeDays <= 90 ? 'pass' : certAgeDays <= 397 ? 'warn' : 'fail',
      value: `${Math.round(certAgeDays)}-day validity`,
      detail: certAgeDays <= 90
        ? '≤90-day certificate. Aligns with NIST SP 800-57 short-lived credential guidance and CA/Browser Forum TM2024-001. Automate renewal via ACME (cert-manager, Certbot).'
        : certAgeDays <= 397
        ? 'Validity ≤397 days meets CA/Browser Forum Baseline §6.3.2. NIST SP 800-57 recommends shorter cryptoperiods to limit the window of exposure on key compromise.'
        : 'Validity >397 days. CA/Browser Forum Baseline Requirements and NIST SP 800-57 require reissuance. Browsers and clients will reject certificates with validity over 398 days.',
      ref: 'NIST SP 800-57 Pt 1 §5.3.6 / CA/B Forum BR §6.3.2',
    },
    {
      label: 'SP 800-52 Rev 2 §3.4 — Certificate Revocation',
      status: c.hasOCSP ? 'pass' : c.hasCRL ? 'warn' : 'fail',
      value: c.hasOCSP ? `OCSP: ${c.ocspUrl}` : c.hasCRL ? 'CRL only' : 'None found',
      detail: c.hasOCSP
        ? 'OCSP endpoint present. NIST requires real-time revocation status. Enable OCSP stapling in nginx (ssl_stapling on; ssl_stapling_verify on;) to cache the response server-side and reduce client handshake latency.'
        : c.hasCRL
        ? 'CRL-only revocation. NIST accepts CRL but recommends OCSP for lower latency. CRL downloads can be large and cached for hours — revocation propagation is delayed.'
        : 'No revocation mechanism found. NIST SP 800-52 Rev 2 §3.4 requires OCSP or CRL for all TLS certificates. A compromised certificate cannot be invalidated before expiry.',
      ref: 'NIST SP 800-52 Rev 2 §3.4',
    },
    {
      label: 'SP 800-95 §6.2 — HSTS Transport Enforcement',
      status: hstsStatus(),
      value: h.hsts || 'Not set',
      detail: h.hsts
        ? 'HSTS present. NIST SP 800-95 requires enforced transport security. Best practice: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload — submit to the HSTS preload list to eliminate first-visit HTTP exposure.'
        : 'HSTS not configured. NIST SP 800-95 §6.2 requires transport security enforcement. Without HSTS, clients are vulnerable to SSL stripping and protocol downgrade attacks on first connection.',
      ref: 'NIST SP 800-95 §6.2 / RFC 6797',
    },
    {
      label: 'SP 800-95 §6.4 — Content Security Policy',
      status: h.csp ? 'pass' : 'fail',
      value: h.csp ? 'Configured' : 'Not set',
      detail: h.csp
        ? 'CSP present. NIST SP 800-95 §6.4 identifies web injection as critical. Review policy: avoid unsafe-inline and unsafe-eval — use script nonces or hashes instead. Verify no overly permissive origins (e.g., *).'
        : 'No Content-Security-Policy. NIST SP 800-95 §6.4 identifies XSS as a critical web threat. CSP is the primary browser-enforced mitigation. Implement: default-src \'self\'; script-src \'self\' as a baseline.',
      ref: 'NIST SP 800-95 §6.4 / OWASP CSP Cheat Sheet',
    },
  ]
}

const NIST_REFS = [
  {
    id: 'SP 800-52 Rev 2',
    title: 'Guidelines for TLS Implementations',
    year: '2019',
    url: 'https://doi.org/10.6028/NIST.SP.800-52r2',
    color: 'text-mi-cyan',
    borderColor: 'border-mi-cyan/20',
    bgColor: 'bg-mi-cyan/5',
    items: [
      'TLS 1.3 preferred — TLS 1.2 minimum; TLS 1.0/1.1 prohibited',
      'AEAD cipher suites only: AES-GCM, ChaCha20-Poly1305',
      'Ephemeral (EC)DHE key exchange mandatory (Perfect Forward Secrecy)',
      'OCSP or CRL revocation checking required for all certs',
      'RSA ≥2048-bit or ECDSA P-256/P-384 minimum',
    ],
  },
  {
    id: 'SP 800-57 Pt 1 Rev 5',
    title: 'Recommendation for Key Management',
    year: '2020',
    url: 'https://doi.org/10.6028/NIST.SP.800-57pt1r5',
    color: 'text-pki',
    borderColor: 'border-pki/20',
    bgColor: 'bg-pki/5',
    items: [
      'RSA 2048-bit: 112-bit security, adequate through 2030 only',
      'RSA 3072-bit or ECDSA P-384: security beyond 2030',
      'Short cryptoperiods minimize compromise exposure window',
      'Automate certificate renewal — ACME, cert-manager, Vault PKI',
    ],
  },
  {
    id: 'SP 800-186',
    title: 'Discrete Log-Based Cryptography: ECC',
    year: '2023',
    url: 'https://doi.org/10.6028/NIST.SP.800-186',
    color: 'text-spiffe',
    borderColor: 'border-spiffe/20',
    bgColor: 'bg-spiffe/5',
    items: [
      'Approved curves: P-256 (128-bit), P-384 (192-bit), P-521 (256-bit)',
      'Brainpool, secp256k1, X25519 — not approved for FIPS 140 use',
      'ECDSA preferred over RSA: smaller keys, faster TLS handshakes',
      'Use P-384+ for certificates requiring security beyond 2030',
    ],
  },
  {
    id: 'SP 800-95',
    title: 'Guide to Secure Web Services',
    year: '2007',
    url: 'https://doi.org/10.6028/NIST.SP.800-95',
    color: 'text-mi-gold',
    borderColor: 'border-mi-gold/20',
    bgColor: 'bg-mi-gold/5',
    items: [
      'HSTS: max-age=31536000; includeSubDomains; preload',
      'Content-Security-Policy to prevent XSS and injection',
      'X-Content-Type-Options: nosniff (prevent MIME sniffing)',
      'Remove Server version tokens — server_tokens off in nginx',
      'X-Frame-Options or CSP frame-ancestors for clickjacking defense',
    ],
  },
]

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

  const tlsAudit    = result ? buildTLSAudit(result)           : []
  const headerAudit = result ? buildHeaderAudit(result.headers) : []
  const nistAudit   = result ? buildNISTAudit(result)           : []
  const tlsScore    = score(tlsAudit)
  const hdrScore    = score(headerAudit)
  const nistScore   = score(nistAudit)
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
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                <ScoreCard label="Overall"      pass={tlsScore.pass + hdrScore.pass} total={tlsScore.total + hdrScore.total} color={overallPct >= 80 ? 'text-spiffe' : overallPct >= 55 ? 'text-mi-gold' : 'text-mi-red'} />
                <ScoreCard label="TLS / Cert"   pass={tlsScore.pass}  total={tlsScore.total}  color="text-mi-cyan" />
                <ScoreCard label="HTTP Headers" pass={hdrScore.pass}  total={hdrScore.total}  color="text-mi-gold" />
                <ScoreCard label="NIST Controls" pass={nistScore.pass} total={nistScore.total} color="text-spiffe" />
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

              {/* NIST Compliance Assessment */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <BookOpen size={18} className="text-spiffe" /> NIST Compliance Assessment
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Mapping scan results against NIST SP 800-52 Rev 2, SP 800-57, SP 800-186, and SP 800-95.
                  </p>
                </div>
                <div className="space-y-2">
                  {nistAudit.map((item, i) => <AuditRow key={i} item={item} delay={i * 0.04} />)}
                </div>
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

        {/* NIST Reference Guides — always visible */}
        <div className="space-y-6 pt-8 border-t border-border">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <BookOpen size={18} className="text-spiffe" /> NIST Reference Guides
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Key NIST publications governing TLS, key management, and web security — applied by this scanner.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {NIST_REFS.map(ref => (
              <div key={ref.id} className={`rounded-xl border ${ref.borderColor} ${ref.bgColor} p-5 space-y-3`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className={`text-xs font-mono font-bold ${ref.color}`}>{ref.id}</p>
                    <p className="text-sm font-semibold text-white mt-0.5">{ref.title}</p>
                    <p className="text-[10px] text-slate-600 font-mono">{ref.year}</p>
                  </div>
                  <a
                    href={ref.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${ref.color} opacity-60 hover:opacity-100 transition-opacity shrink-0 mt-0.5`}
                    title="Open NIST document"
                  >
                    <ExternalLink size={13} />
                  </a>
                </div>
                <ul className="space-y-1.5">
                  {ref.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                      <span className={`w-1 h-1 rounded-full shrink-0 mt-1.5 ${ref.color.replace('text-', 'bg-')}`} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
