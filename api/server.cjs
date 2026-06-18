'use strict'

const http  = require('http')
const https = require('https')
const tls   = require('tls')
const { URL } = require('url')
const scep  = require('./scep.cjs')
const ztpki = require('./ztpki.cjs')

const PORT    = 3001
const TIMEOUT = 10000

// Reject non-public hostnames to prevent SSRF
function isPrivateHost(hostname) {
  return (
    /^localhost$/i.test(hostname) ||
    /^127\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
    /^::1$/.test(hostname) ||
    /^0\.0\.0\.0$/.test(hostname) ||
    /^169\.254\./.test(hostname)
  )
}

function parseHostname(raw) {
  let h = raw.trim().toLowerCase()
  if (!h.startsWith('http')) h = 'https://' + h
  try {
    const u = new URL(h)
    return u.hostname
  } catch {
    return null
  }
}

// ── SCEP input validation ────────────────────────────────────────────────────
const MAX_FIELD = 256
const isStr = (v, max = MAX_FIELD) => typeof v === 'string' && v.length > 0 && v.length <= max
const strArr = (v, max = 32) =>
  Array.isArray(v) ? v.filter(x => isStr(x)).slice(0, max) : []

function validateScepInput(b) {
  if (!b || typeof b !== 'object') return 'Invalid request body'
  if (b.mode !== 'user' && b.mode !== 'machine') return 'mode must be "user" or "machine"'
  if (!isStr(b.url, 2048)) return 'url is required'

  // Scheme allow-list: only http(s). Reject file:, gopher:, ftp:, etc.
  let parsed
  try { parsed = new URL(b.url.includes('://') ? b.url : 'https://' + b.url) }
  catch { return `Invalid SCEP url: ${b.url}` }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'SCEP url must use http or https'
  }
  // SSRF guard (fast literal pre-check; scep.cjs additionally resolves the
  // hostname, rejects private resolved IPs, and pins the address per request).
  if (isPrivateHost(parsed.hostname)) {
    return 'Private/internal SCEP addresses are not allowed by this public proxy'
  }
  if (!isStr(b.challenge, 2048)) return 'challenge is required'

  const s = b.subject || {}
  if (!isStr(s.CN)) return 'subject.CN (Common Name) is required'
  for (const k of ['O', 'OU', 'C', 'ST', 'L', 'email']) {
    if (s[k] !== undefined && s[k] !== '' && !isStr(s[k])) return `subject.${k} is invalid`
  }
  if (b.keyBits !== undefined && ![2048, 3072, 4096].includes(b.keyBits)) {
    return 'keyBits must be one of 2048, 3072, 4096'
  }
  return null
}

function buildScepOptions(b) {
  const s = b.subject || {}
  const subject = {
    CN: s.CN.trim(),
    O:  isStr(s.O)  ? s.O.trim()  : undefined,
    OU: isStr(s.OU) ? s.OU.trim() : undefined,
    C:  isStr(s.C)  ? s.C.trim()  : undefined,
    ST: isStr(s.ST) ? s.ST.trim() : undefined,
    L:  isStr(s.L)  ? s.L.trim()  : undefined,
    email: isStr(s.email) ? s.email.trim() : undefined,
  }
  const sIn = b.sans || {}
  const sans = {
    dns:   strArr(sIn.dns),
    email: strArr(sIn.email),
    ip:    strArr(sIn.ip),
    uri:   strArr(sIn.uri),
    upn:   strArr(sIn.upn),
  }
  return {
    url: b.url.trim(),
    challenge: b.challenge,
    caIdent: isStr(b.caIdent) ? b.caIdent : undefined,
    keyBits: b.keyBits || 2048,
    insecureTLS: b.insecureTLS === true,
    subject,
    sans,
  }
}

// ── ZTPKI input validation ───────────────────────────────────────────────────
const ZTPKI_METHODS = ['GET', 'POST', 'PATCH']

function validateZtpkiInput(b) {
  if (!b || typeof b !== 'object') return 'Invalid request body'
  if (!isStr(b.hawkId, 512)) return 'hawkId is required'
  if (!isStr(b.hawkKey, 4096)) return 'hawkKey is required'
  if (!isStr(b.baseUrl, 2048)) return 'baseUrl is required'

  let u
  try { u = new URL(b.baseUrl) } catch { return `Invalid baseUrl: ${b.baseUrl}` }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return 'baseUrl must use http or https'
  if (isPrivateHost(u.hostname)) return 'Private/internal ZTPKI addresses are not allowed by this public proxy'

  const method = (b.method || 'GET').toUpperCase()
  if (!ZTPKI_METHODS.includes(method)) return `method must be one of ${ZTPKI_METHODS.join(', ')}`

  // Path allow-list: only the certificate lifecycle endpoints this tool uses.
  if (!isStr(b.path, 512) || !b.path.startsWith('/certificates')) {
    return 'path must start with /certificates'
  }
  if (b.path.includes('..') || b.path.includes('//')) return 'Invalid path'
  if (b.body !== undefined && b.body !== null && typeof b.body !== 'object') {
    return 'body must be a JSON object'
  }
  return null
}

function getCertAndTLS(hostname) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      { host: hostname, port: 443, servername: hostname, rejectUnauthorized: false },
      () => {
        const cert      = socket.getPeerCertificate(true)
        const protocol  = socket.getProtocol()
        const cipher    = socket.getCipher()
        const authorized = socket.authorized
        const authError  = socket.authorizationError || null
        socket.destroy()
        resolve({ cert, protocol, cipher, authorized, authError })
      }
    )
    socket.setTimeout(TIMEOUT, () => { socket.destroy(); reject(new Error('Connection timed out')) })
    socket.on('error', reject)
  })
}

function getHeaders(hostname) {
  return new Promise((resolve) => {
    const req = https.request(
      { hostname, port: 443, path: '/', method: 'HEAD', rejectUnauthorized: false, timeout: TIMEOUT },
      (res) => resolve(res.headers)
    )
    req.on('error', () => resolve({}))
    req.on('timeout', () => { req.destroy(); resolve({}) })
    req.end()
  })
}

// Also verify with full chain validation to report real trusted status
function checkTrusted(hostname) {
  return new Promise((resolve) => {
    const socket = tls.connect(
      { host: hostname, port: 443, servername: hostname, rejectUnauthorized: true },
      () => { socket.destroy(); resolve(true) }
    )
    socket.setTimeout(TIMEOUT, () => { socket.destroy(); resolve(false) })
    socket.on('error', () => resolve(false))
  })
}

function buildResponse(hostname, certData, headers, trusted) {
  const { cert, protocol, cipher, authorized, authError } = certData
  const now          = Date.now()
  const notAfter     = new Date(cert.valid_to)
  const notBefore    = new Date(cert.valid_from)
  const daysRemaining = Math.ceil((notAfter.getTime() - now) / 86400000)

  const subjectStr = cert.subject
    ? Object.entries(cert.subject).map(([k, v]) => `${k}=${v}`).join(', ')
    : hostname

  const issuerStr = cert.issuer
    ? Object.entries(cert.issuer).map(([k, v]) => `${k}=${v}`).join(', ')
    : 'Unknown'

  const sans = cert.subjectaltname
    ? cert.subjectaltname.split(', ').map(s => s.replace(/^DNS:/, ''))
    : [hostname]

  const hasOCSP   = !!(cert.infoAccess && cert.infoAccess['OCSP - URI'])
  const ocspUrl   = hasOCSP ? cert.infoAccess['OCSP - URI'][0] : null
  const caIssuers = cert.infoAccess && cert.infoAccess['CA Issuers - URI']
    ? cert.infoAccess['CA Issuers - URI'][0] : null

  const hasCRL    = !!(cert.crlDistributionPoints)
  const hasCT     = !!(cert.raw) // SCT presence is hard to detect; approximate by issuer type

  // Key algorithm guess from bits
  let keyAlgo
  if (cert.bits <= 521 && cert.bits >= 256) {
    keyAlgo = `ECDSA ${cert.bits}-bit`
  } else {
    keyAlgo = `RSA ${cert.bits}-bit`
  }

  return {
    domain: hostname,
    scannedAt: new Date().toISOString(),
    certificate: {
      subject:       subjectStr,
      subjectCN:     cert.subject?.CN || hostname,
      sans,
      issuer:        issuerStr,
      issuerCN:      cert.issuer?.CN || 'Unknown',
      issuerOrg:     cert.issuer?.O  || 'Unknown',
      validFrom:     cert.valid_from,
      validTo:       cert.valid_to,
      daysRemaining,
      serial:        cert.serialNumber || 'N/A',
      fingerprintSHA1:   cert.fingerprint    || 'N/A',
      fingerprintSHA256: cert.fingerprint256  || 'N/A',
      bits:          cert.bits,
      keyAlgo,
      hasOCSP,
      ocspUrl,
      caIssuers,
      hasCRL,
    },
    tls: {
      protocol,
      cipherName:    cipher?.name        || 'Unknown',
      cipherStandard: cipher?.standardName || 'Unknown',
      trusted,
      authError: trusted ? null : authError,
    },
    headers: {
      hsts:             headers['strict-transport-security']          || null,
      xContentType:     headers['x-content-type-options']             || null,
      xFrameOptions:    headers['x-frame-options']                    || null,
      referrerPolicy:   headers['referrer-policy']                    || null,
      csp:              headers['content-security-policy']            || null,
      permissionsPolicy:headers['permissions-policy']                 || null,
      coop:             headers['cross-origin-opener-policy']         || null,
      coep:             headers['cross-origin-embedder-policy']       || null,
      xPermittedCDP:    headers['x-permitted-cross-domain-policies']  || null,
      server:           headers['server']                             || null,
    },
  }
}

// Proxy request to Venafi Cloud API (only api.venafi.cloud allowed)
function venafiFetch(apiKey, path, method, body) {
  return new Promise((resolve, reject) => {
    const safePath = path.startsWith('/') ? path : '/' + path
    const postData = body ? JSON.stringify(body) : null
    const options = {
      hostname: 'api.venafi.cloud',
      port: 443,
      path: safePath,
      method: method || 'GET',
      headers: {
        'tppl-api-key': apiKey,
        'Accept': 'application/json',
        'User-Agent': 'MachineIdentityExplainer/1.0',
        ...(postData ? {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        } : {}),
      },
    }
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => resolve({ status: res.statusCode, body: data }))
    })
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Venafi API timed out')) })
    req.on('error', reject)
    if (postData) req.write(postData)
    req.end()
  })
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Content-Type', 'application/json')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  let url
  try { url = new URL(req.url, 'http://localhost') } catch {
    res.writeHead(400)
    res.end(JSON.stringify({ error: 'Invalid request URL' }))
    return
  }

  // ── Venafi Cloud proxy ────────────────────────────────────────────────────
  if (url.pathname === '/venafi' && req.method === 'POST') {
    let rawBody = ''
    req.on('data', chunk => { rawBody += chunk })
    req.on('end', async () => {
      try {
        const { apiKey, path, method = 'GET', body } = JSON.parse(rawBody)

        // Validate API key: UUID pattern (8-4-4-4-12 hex)
        if (!apiKey || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(apiKey)) {
          res.writeHead(400)
          res.end(JSON.stringify({ error: 'Invalid API key format' }))
          return
        }

        // Only allow Venafi Cloud v1 API paths
        if (!path || typeof path !== 'string' || !path.startsWith('/v1/')) {
          res.writeHead(400)
          res.end(JSON.stringify({ error: 'Path must start with /v1/' }))
          return
        }

        // Reject any path traversal attempts
        if (path.includes('..') || path.includes('//')) {
          res.writeHead(400)
          res.end(JSON.stringify({ error: 'Invalid path' }))
          return
        }

        const result = await venafiFetch(apiKey, path, method, body)
        res.writeHead(result.status, { 'Content-Type': 'application/json' })
        res.end(result.body)
      } catch (e) {
        res.writeHead(500)
        res.end(JSON.stringify({ error: e.message }))
      }
    })
    return
  }

  // ── SCEP enrolment ─────────────────────────────────────────────────────────
  if (url.pathname === '/scep' && req.method === 'POST') {
    let rawBody = ''
    let tooBig = false
    req.on('data', chunk => {
      rawBody += chunk
      if (rawBody.length > 64 * 1024) { tooBig = true; req.destroy() }
    })
    req.on('end', async () => {
      if (tooBig) {
        res.writeHead(413)
        res.end(JSON.stringify({ error: 'Request body too large' }))
        return
      }
      try {
        const body = JSON.parse(rawBody)
        const errs = validateScepInput(body)
        if (errs) {
          res.writeHead(400)
          res.end(JSON.stringify({ error: errs }))
          return
        }
        const result = await scep.enroll(buildScepOptions(body))
        // Never log keys or challenge; only the per-request result is returned.
        const httpStatus = result.status === 'FAILURE' ? 502 : 200
        res.writeHead(httpStatus)
        res.end(JSON.stringify(result))
      } catch (e) {
        res.writeHead(502)
        res.end(JSON.stringify({
          error: e.message || 'SCEP enrolment failed',
          log: Array.isArray(e.scepLog) ? e.scepLog : undefined,
        }))
      }
    })
    return
  }

  // ── ZTPKI (Venafi Zero Touch PKI) proxy ────────────────────────────────────
  if (url.pathname === '/ztpki' && req.method === 'POST') {
    let rawBody = ''
    let tooBig = false
    req.on('data', chunk => {
      rawBody += chunk
      if (rawBody.length > 64 * 1024) { tooBig = true; req.destroy() }
    })
    req.on('end', async () => {
      if (tooBig) {
        res.writeHead(413)
        res.end(JSON.stringify({ error: 'Request body too large' }))
        return
      }
      try {
        const body = JSON.parse(rawBody)
        const errs = validateZtpkiInput(body)
        if (errs) {
          res.writeHead(400)
          res.end(JSON.stringify({ error: errs }))
          return
        }
        // HAWK creds are used only to sign this request; never logged or stored.
        const result = await ztpki.call({
          baseUrl: body.baseUrl.trim(),
          path: body.path,
          method: (body.method || 'GET').toUpperCase(),
          body: body.body,
          hawkId: body.hawkId,
          hawkKey: body.hawkKey,
          insecureTLS: body.insecureTLS === true,
        })
        // Pass the upstream status through; surface JSON when present, else raw.
        res.writeHead(result.status || 502, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(result.json !== null ? result.json : { raw: result.raw, status: result.status }))
      } catch (e) {
        res.writeHead(502)
        res.end(JSON.stringify({ error: e.message || 'ZTPKI request failed' }))
      }
    })
    return
  }

  if (url.pathname !== '/scan') {
    res.writeHead(404)
    res.end(JSON.stringify({ error: 'Not found. Use /scan?domain=example.com' }))
    return
  }

  const raw = url.searchParams.get('domain')
  if (!raw) {
    res.writeHead(400)
    res.end(JSON.stringify({ error: 'domain parameter is required' }))
    return
  }

  const hostname = parseHostname(raw)
  if (!hostname) {
    res.writeHead(400)
    res.end(JSON.stringify({ error: `Invalid hostname: ${raw}` }))
    return
  }

  if (isPrivateHost(hostname)) {
    res.writeHead(403)
    res.end(JSON.stringify({ error: 'Private/internal addresses are not allowed' }))
    return
  }

  try {
    const [certData, headers, trusted] = await Promise.all([
      getCertAndTLS(hostname),
      getHeaders(hostname),
      checkTrusted(hostname),
    ])
    const result = buildResponse(hostname, certData, headers, trusted)
    res.writeHead(200)
    res.end(JSON.stringify(result))
  } catch (err) {
    res.writeHead(502)
    res.end(JSON.stringify({ error: `Could not connect to ${hostname}: ${err.message}` }))
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`TLS scan API listening on 127.0.0.1:${PORT}`)
})
