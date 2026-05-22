'use strict'

const http  = require('http')
const https = require('https')
const tls   = require('tls')
const { URL } = require('url')

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

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
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
