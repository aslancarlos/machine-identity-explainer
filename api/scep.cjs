'use strict'

/**
 * Minimal SCEP (RFC 8894) enrolment client implemented in pure Node.js.
 *
 * Uses node-forge for the crypto primitives (RSA keygen, PKCS#10 CSR,
 * PKCS#7 EnvelopedData) and hand-builds the PKCS#7 SignedData "pkiMessage"
 * envelope with forge.asn1, because the SCEP authenticated attributes
 * (transactionID / messageType / senderNonce) use Verisign OIDs that
 * node-forge's high-level pkcs7 API cannot emit.
 *
 * Flow (PKCSReq):
 *   1. GetCACaps  -> negotiate digest + content cipher + POST support
 *   2. GetCACert  -> recipient (RA/CA) certificate to encrypt the request to
 *   3. Build CSR  -> RSA key + PKCS#10 with challengePassword + SAN
 *   4. pkiMessage -> SignedData( EnvelopedData( CSR ) ) signed by a throwaway
 *                    self-signed cert matching the CSR subject
 *   5. PKIOperation (POST application/x-pki-message, or GET fallback)
 *   6. Parse response -> pkiStatus; on SUCCESS decrypt EnvelopedData with the
 *      requester key to recover the issued certificate(s)
 *
 * This module is transport-only; it does not log or persist keys.
 */

const http  = require('http')
const https = require('https')
const crypto = require('crypto')
const dns   = require('dns').promises
const net   = require('net')
const { URL } = require('url')
const forge = require('node-forge')

const asn1 = forge.asn1
const pki  = forge.pki

// ── OIDs ─────────────────────────────────────────────────────────────────────
const OID = {
  data:          '1.2.840.113549.1.7.1',
  signedData:    '1.2.840.113549.1.7.2',
  contentType:   '1.2.840.113549.1.9.3',
  messageDigest: '1.2.840.113549.1.9.4',
  signingTime:   '1.2.840.113549.1.9.5',
  rsaEncryption: '1.2.840.113549.1.1.1',
  sha1:          '1.3.14.3.2.26',
  sha256:        '2.16.840.1.101.3.4.2.1',
  // SCEP (Verisign) attribute OIDs
  scepMessageType:   '2.16.840.1.113733.1.9.2',
  scepPkiStatus:     '2.16.840.1.113733.1.9.3',
  scepFailInfo:      '2.16.840.1.113733.1.9.4',
  scepSenderNonce:   '2.16.840.1.113733.1.9.5',
  scepRecipientNonce:'2.16.840.1.113733.1.9.6',
  scepTransId:       '2.16.840.1.113733.1.9.7',
}

const FAIL_INFO = {
  '0': 'badAlg — unrecognized or unsupported algorithm',
  '1': 'badMessageCheck — integrity check (signature) failed',
  '2': 'badRequest — transaction not permitted or supported',
  '3': 'badTime — signingTime attribute too far from system time',
  '4': 'badCertId — no certificate could be identified',
}

// ── SSRF guard ────────────────────────────────────────────────────────────────
// True for any address that must never be reachable from a public-facing proxy:
// loopback, RFC1918, link-local, CGNAT, IPv6 ULA/link-local, multicast/reserved.
function isPrivateIp(addr) {
  let ip = (addr || '').toLowerCase()
  if (ip.startsWith('::ffff:')) ip = ip.slice(7) // IPv4-mapped IPv6
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number)
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 192 && b === 168) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 169 && b === 254) ||           // link-local
      (a === 100 && b >= 64 && b <= 127) || // CGNAT 100.64.0.0/10
      a >= 224                              // multicast / reserved
    )
  }
  return (
    ip === '::1' || ip === '::' ||
    ip.startsWith('fc') || ip.startsWith('fd') ||                 // fc00::/7 ULA
    ip.startsWith('fe8') || ip.startsWith('fe9') ||
    ip.startsWith('fea') || ip.startsWith('feb')                 // fe80::/10 link-local
  )
}

// Resolve a hostname to a single validated public address and pin it, so every
// SCEP HTTP call in this enrolment connects to the same already-checked IP
// (defeats DNS-rebinding / TOCTOU between GetCACaps, GetCACert and PKIOperation).
async function resolvePinnedAddress(hostname) {
  let addrs
  if (net.isIP(hostname)) {
    addrs = [{ address: hostname, family: net.isIP(hostname) }]
  } else {
    addrs = await dns.lookup(hostname, { all: true })
  }
  if (!addrs || !addrs.length) throw new Error(`Could not resolve ${hostname}`)
  for (const a of addrs) {
    if (isPrivateIp(a.address)) {
      throw new Error(`Refusing to connect: ${hostname} resolves to a private/internal address (${a.address})`)
    }
  }
  return { address: addrs[0].address, family: addrs[0].family }
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────
function requestRaw(urlStr, { method = 'GET', headers = {}, body = null, timeout = 30000, insecureTLS = false, pinned = null } = {}) {
  return new Promise((resolve, reject) => {
    let u
    try { u = new URL(urlStr) } catch { return reject(new Error(`Invalid SCEP URL: ${urlStr}`)) }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') {
      return reject(new Error(`Unsupported URL scheme: ${u.protocol}`))
    }
    const lib = u.protocol === 'https:' ? https : http
    const opts = {
      method,
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      headers,
      // TLS verification is ON by default. SCEP CAs that front their endpoint
      // with a private/self-signed cert require an explicit insecureTLS opt-in;
      // the SCEP pkiMessage itself is still signed+encrypted at the PKCS#7 layer.
      rejectUnauthorized: !insecureTLS,
      // Pin to the pre-validated address so the connection cannot be re-pointed
      // at an internal host between DNS resolution and connect.
      ...(pinned ? { lookup: (_h, _o, cb) => cb(null, pinned.address, pinned.family) } : {}),
      // SNI / cert validation must still use the real hostname.
      ...(pinned && u.protocol === 'https:' ? { servername: u.hostname } : {}),
    }
    const req = lib.request(opts, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks),
      }))
    })
    req.setTimeout(timeout, () => { req.destroy(); reject(new Error('SCEP request timed out')) })
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

function withOperation(base, operation, message) {
  const u = new URL(base)
  u.searchParams.set('operation', operation)
  if (message !== undefined) u.searchParams.set('message', message)
  return u.toString()
}

// ── GetCACaps / GetCACert ───────────────────────────────────────────────────
async function getCACaps(base, netOpts) {
  try {
    const res = await requestRaw(withOperation(base, 'GetCACaps'), { ...netOpts })
    if (res.status !== 200) return new Set()
    return new Set(
      res.body.toString('utf8').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    )
  } catch {
    return new Set()
  }
}

/**
 * Returns the recipient certificate to encrypt the request to, plus any
 * extra CA chain certs. Handles both the single-cert response
 * (application/x-x509-ca-cert) and the degenerate PKCS#7 bundle
 * (application/x-x509-ca-ra-cert) where an RA cert is present.
 */
async function getCACert(base, caIdent, netOpts) {
  const res = await requestRaw(withOperation(base, 'GetCACert', caIdent || ''), { ...netOpts })
  if (res.status !== 200 || !res.body.length) {
    throw new Error(`GetCACert failed (HTTP ${res.status})`)
  }
  const der = forge.util.createBuffer(res.body.toString('binary'))
  const obj = asn1.fromDer(der)

  let certs = []
  try {
    // Try as a degenerate PKCS#7 (certs-only) bundle first.
    const p7 = forge.pkcs7.messageFromAsn1(obj)
    certs = p7.certificates || []
  } catch {
    // Fall back to a single bare X.509 certificate.
    certs = [pki.certificateFromAsn1(obj)]
  }
  if (!certs.length) throw new Error('GetCACert returned no certificates')

  // Pick the encryption recipient: prefer a cert asserting keyEncipherment
  // (the RA encryption cert); otherwise use the first/only cert.
  const recipient = certs.find((c) => certHasKeyUsage(c, 'keyEncipherment')) || certs[0]
  return { recipient, chain: certs }
}

function certHasKeyUsage(cert, usage) {
  const ext = (cert.extensions || []).find((e) => e.name === 'keyUsage')
  return !!(ext && ext[usage])
}

// ── DN / CSR construction ──────────────────────────────────────────────────
const DN_OID = {
  CN: '2.5.4.3', commonName: '2.5.4.3',
  O:  '2.5.4.10', organizationName: '2.5.4.10',
  OU: '2.5.4.11', organizationalUnitName: '2.5.4.11',
  C:  '2.5.4.6', countryName: '2.5.4.6',
  ST: '2.5.4.8', stateOrProvinceName: '2.5.4.8',
  L:  '2.5.4.7', localityName: '2.5.4.7',
  emailAddress: '1.2.840.113549.1.9.1',
}

// Build a forge subject attribute array from a {CN, O, OU, C, ST, L, email} map.
function buildSubjectAttrs(subject) {
  const attrs = []
  const push = (shortName, name, value) => {
    if (value) attrs.push(shortName ? { shortName, value } : { name, value })
  }
  push('CN', 'commonName', subject.CN)
  push('OU', 'organizationalUnitName', subject.OU)
  push('O',  'organizationName', subject.O)
  push('L',  'localityName', subject.L)
  push('ST', 'stateOrProvinceName', subject.ST)
  push('C',  'countryName', subject.C)
  if (subject.email) attrs.push({ name: 'emailAddress', value: subject.email })
  if (!attrs.length) throw new Error('Subject must contain at least a Common Name')
  return attrs
}

// altNames per forge: type 2 = DNS, 1 = rfc822 (email), 7 = IP, 6 = URI
function buildAltNames(sans = {}) {
  const out = []
  for (const dns of sans.dns || []) out.push({ type: 2, value: dns })
  for (const email of sans.email || []) out.push({ type: 1, value: email })
  for (const ip of sans.ip || []) out.push({ type: 7, ip })
  for (const uri of sans.uri || []) out.push({ type: 6, value: uri })
  // UPN goes in as an otherName (1.3.6.1.4.1.311.20.2.3) for user certs
  for (const upn of sans.upn || []) {
    out.push({
      type: 0,
      value: asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, [
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false,
          asn1.oidToDer('1.3.6.1.4.1.311.20.2.3').getBytes()),
        asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, [
          asn1.create(asn1.Class.UNIVERSAL, asn1.Type.UTF8, false, upn),
        ]),
      ]),
    })
  }
  return out
}

function makeKeyAndCsr({ subject, sans, challenge, keyBits, mdName }) {
  const keys = pki.rsa.generateKeyPair({ bits: keyBits })
  const subjectAttrs = buildSubjectAttrs(subject)

  const csr = pki.createCertificationRequest()
  csr.publicKey = keys.publicKey
  csr.setSubject(subjectAttrs)

  const attributes = [{ name: 'challengePassword', value: challenge }]
  const altNames = buildAltNames(sans)
  if (altNames.length) {
    attributes.push({
      name: 'extensionRequest',
      extensions: [{ name: 'subjectAltName', altNames }],
    })
  }
  csr.setAttributes(attributes)
  csr.sign(keys.privateKey, md(mdName))

  // Throwaway self-signed cert matching the subject — required to sign the
  // SCEP pkiMessage. SCEP servers ignore its trust; only the key binding matters.
  const cert = pki.createCertificate()
  cert.publicKey = keys.publicKey
  cert.serialNumber = '01' + crypto.randomBytes(8).toString('hex')
  cert.validity.notBefore = new Date()
  cert.validity.notAfter = new Date(Date.now() + 1000 * 60 * 60 * 24)
  cert.setSubject(subjectAttrs)
  cert.setIssuer(subjectAttrs)
  cert.sign(keys.privateKey, md(mdName))

  return { keys, csr, selfSigned: cert, subjectAttrs }
}

function md(name) {
  return name === 'sha1' ? forge.md.sha1.create() : forge.md.sha256.create()
}

// ── pkiMessage (SignedData over EnvelopedData(CSR)) ──────────────────────────
function dnToAsn1(subjectAttrs) {
  // Name ::= SEQUENCE OF RelativeDistinguishedName (SET OF AttributeTypeAndValue)
  // Note: forge.setSubject() mutates the attribute objects in place, adding a
  // `.type` (the OID string) plus `.name`/`.shortName`. Resolve via `.type`
  // first, then fall back to the name maps for un-normalised arrays.
  return asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true,
    subjectAttrs.map((a) => {
      const oid = a.type || DN_OID[a.shortName] || DN_OID[a.name]
      if (!oid) throw new Error(`Unsupported DN attribute: ${a.shortName || a.name}`)
      const valType = (oid === DN_OID.emailAddress) ? asn1.Type.IA5STRING
        : (oid === DN_OID.C) ? asn1.Type.PRINTABLESTRING
        : asn1.Type.UTF8
      return asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, [
        asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
          asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false, asn1.oidToDer(oid).getBytes()),
          asn1.create(asn1.Class.UNIVERSAL, valType, false, forge.util.encodeUtf8(a.value)),
        ]),
      ])
    })
  )
}

function attr(oidStr, valueAsn1) {
  return asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false, asn1.oidToDer(oidStr).getBytes()),
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, [valueAsn1]),
  ])
}
const printable = (s) => asn1.create(asn1.Class.UNIVERSAL, asn1.Type.PRINTABLESTRING, false, s)
const octet     = (bytes) => asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, bytes)
const oidVal    = (o) => asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false, asn1.oidToDer(o).getBytes())

// DER-sort a list of attribute SEQUENCEs into a valid SET OF.
function sortedAttrSet(attrs, tagClass, tagType) {
  const encoded = attrs.map((a) => ({ a, der: asn1.toDer(a).getBytes() }))
  encoded.sort((x, y) => (x.der < y.der ? -1 : x.der > y.der ? 1 : 0))
  return asn1.create(tagClass, tagType, true, encoded.map((e) => e.a))
}

function digestOid(mdName) { return mdName === 'sha1' ? OID.sha1 : OID.sha256 }
function algId(oidStr, withNull = true) {
  const seq = [oidVal(oidStr)]
  if (withNull) seq.push(asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, ''))
  return asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, seq)
}

/**
 * @param csrDer        DER bytes (binary string) of the PKCS#10 CSR
 * @param recipientCert forge cert to encrypt to (RA/CA)
 * @param signerCert    requester self-signed cert
 * @param signerKey     requester private key
 * @param subjectAttrs  signer DN
 * @param opts          { mdName, cipherOid, transId, senderNonce, messageType }
 * @returns DER bytes (binary string) of the SCEP pkiMessage
 */
function buildPkiMessage(csrDer, recipientCert, signerCert, signerKey, subjectAttrs, opts) {
  const { mdName, cipherOid, transId, senderNonce, messageType } = opts

  // 1. EnvelopedData( CSR )
  const env = forge.pkcs7.createEnvelopedData()
  env.addRecipient(recipientCert)
  env.content = forge.util.createBuffer(csrDer)
  env.encrypt(undefined, cipherOid)
  const envContentInfoDer = asn1.toDer(env.toAsn1()).getBytes()

  // 2. messageDigest over the eContent bytes (the EnvelopedData ContentInfo DER)
  const dMd = md(mdName)
  dMd.update(envContentInfoDer)
  const messageDigest = dMd.digest().getBytes()

  // 3. Authenticated attributes
  const authAttrs = [
    attr(OID.contentType, oidVal(OID.data)),
    attr(OID.messageDigest, octet(messageDigest)),
    attr(OID.scepTransId, printable(transId)),
    attr(OID.scepMessageType, printable(messageType)),
    attr(OID.scepSenderNonce, octet(senderNonce)),
  ]
  // Signature is computed over the SET OF (tag 0x31) DER encoding.
  const signedAttrsSet = sortedAttrSet(authAttrs, asn1.Class.UNIVERSAL, asn1.Type.SET)
  const sMd = md(mdName)
  sMd.update(asn1.toDer(signedAttrsSet).getBytes())
  const signature = signerKey.sign(sMd)

  // The embedded copy uses [0] IMPLICIT (context tag 0), same sorted children.
  const signedAttrsImplicit = sortedAttrSet(authAttrs, asn1.Class.CONTEXT_SPECIFIC, 0)

  // 4. SignerInfo
  const signerInfo = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.INTEGER, false, asn1.integerToDer(1).getBytes()),
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [ // issuerAndSerialNumber
      dnToAsn1(subjectAttrs),
      asn1.create(asn1.Class.UNIVERSAL, asn1.Type.INTEGER, false,
        forge.util.hexToBytes(signerCert.serialNumber)),
    ]),
    algId(digestOid(mdName)),         // digestAlgorithm
    signedAttrsImplicit,              // [0] authenticatedAttributes
    algId(OID.rsaEncryption),         // digestEncryptionAlgorithm
    octet(signature),                 // encryptedDigest
  ])

  // 5. SignedData
  const signerCertAsn1 = pki.certificateToAsn1(signerCert)
  const signedData = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.INTEGER, false, asn1.integerToDer(1).getBytes()),
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, [algId(digestOid(mdName))]),
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [ // encapContentInfo
      oidVal(OID.data),
      asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, [octet(envContentInfoDer)]),
    ]),
    asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, [signerCertAsn1]), // [0] certificates
    asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, [signerInfo]),
  ])

  // 6. Outer ContentInfo
  const contentInfo = asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, [
    oidVal(OID.signedData),
    asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, [signedData]),
  ])
  return asn1.toDer(contentInfo).getBytes()
}

// ── Response parsing ─────────────────────────────────────────────────────────
function findAttrValue(setOfAttrs, oidStr) {
  for (const a of setOfAttrs.value) {
    const oid = asn1.derToOid(a.value[0].value)
    if (oid === oidStr) return a.value[1].value[0] // first value in the SET
  }
  return null
}

function parseResponse(derBuffer, requesterKey) {
  const obj = asn1.fromDer(forge.util.createBuffer(derBuffer.toString('binary')))
  // ContentInfo -> [1] content -> SignedData
  const signedData = obj.value[1].value[0]
  // SignedData fields: version, digestAlgs, encapContentInfo, [0]certs?, [n]crls?, signerInfos
  const signerInfos = signedData.value[signedData.value.length - 1]
  const signerInfo = signerInfos.value[0]

  // authenticatedAttributes is the [0] IMPLICIT element within the SignerInfo
  let authAttrs = null
  for (const el of signerInfo.value) {
    if (el.tagClass === asn1.Class.CONTEXT_SPECIFIC && el.type === 0 && el.constructed) {
      authAttrs = el
      break
    }
  }
  if (!authAttrs) throw new Error('SCEP response missing authenticated attributes')

  const statusEl = findAttrValue(authAttrs, OID.scepPkiStatus)
  const pkiStatus = statusEl ? statusEl.value : null
  const failEl = findAttrValue(authAttrs, OID.scepFailInfo)
  const failInfo = failEl ? failEl.value : null

  const result = { pkiStatus, failInfo, certs: [] }

  if (pkiStatus === '0') {
    // SUCCESS: encapContentInfo holds an EnvelopedData encrypted to our key.
    const encap = signedData.value[2]
    const eContentDer = encap.value[1].value[0].value // OCTET STRING bytes
    const envObj = asn1.fromDer(forge.util.createBuffer(eContentDer))
    const p7 = forge.pkcs7.messageFromAsn1(envObj)
    p7.decrypt(p7.recipients[0], requesterKey)
    // Decrypted content is a degenerate certs-only PKCS#7.
    const inner = asn1.fromDer(p7.content)
    const certsP7 = forge.pkcs7.messageFromAsn1(inner)
    result.certs = certsP7.certificates || []
  }
  return result
}

// ── PKIOperation transport ────────────────────────────────────────────────────
async function pkiOperation(base, pkiMessageDer, canPost, netOpts) {
  const bodyBuf = Buffer.from(pkiMessageDer, 'binary')
  if (canPost) {
    const res = await requestRaw(withOperation(base, 'PKIOperation'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-pki-message',
        'Content-Length': bodyBuf.length,
      },
      body: bodyBuf,
      ...netOpts,
    })
    if (res.status === 200) return res.body
    // Some CAs reject POST; fall through to GET.
  }
  const b64 = bodyBuf.toString('base64')
  const res = await requestRaw(withOperation(base, 'PKIOperation', b64), { ...netOpts })
  if (res.status !== 200) throw new Error(`PKIOperation failed (HTTP ${res.status})`)
  return res.body
}

// ── Public API ──────────────────────────────────────────────────────────────
/**
 * Enrol for a certificate via SCEP.
 *
 * @param {object} o
 * @param {string} o.url        SCEP server URL (e.g. https://host/scep/<alias>)
 * @param {string} o.challenge  SCEP challenge password
 * @param {object} o.subject    { CN, O?, OU?, C?, ST?, L?, email? }
 * @param {object} o.sans       { dns?, email?, ip?, uri?, upn? } (arrays)
 * @param {number} [o.keyBits]  RSA key size (default 2048)
 * @param {string} [o.caIdent]  CA identifier for GetCACert
 * @param {boolean}[o.insecureTLS] skip TLS verification of the SCEP endpoint
 *                               (only for private/self-signed CA fronting certs)
 * @returns {Promise<object>} { transactionId, pkiStatus, status, failInfo,
 *                              certificatePem, chainPem[], privateKeyPem,
 *                              csrPem, caCertPem, log[] }
 */
async function enroll(o) {
  const log = []
  const note = (m) => log.push(`${m}`)

  if (!o.url) throw new Error('SCEP url is required')
  if (!o.challenge) throw new Error('SCEP challenge is required')
  if (!o.subject || !o.subject.CN) throw new Error('subject.CN is required')
  const keyBits = o.keyBits || 2048
  const insecureTLS = !!o.insecureTLS
  if (insecureTLS) note('⚠ TLS verification of the SCEP endpoint is DISABLED for this request.')

  // Resolve and validate the target once, then pin the address for every call.
  let parsedUrl
  try { parsedUrl = new URL(o.url) } catch { throw new Error(`Invalid SCEP url: ${o.url}`) }
  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
    throw new Error(`Unsupported SCEP url scheme: ${parsedUrl.protocol}`)
  }
  note(`Resolving ${parsedUrl.hostname}…`)
  const pinned = await resolvePinnedAddress(parsedUrl.hostname)
  const netOpts = { insecureTLS, pinned }

  note('Negotiating capabilities (GetCACaps)…')
  const caps = await getCACaps(o.url, netOpts)
  const mdName    = caps.has('SHA-256') || caps.has('SHA-256/AES') ? 'sha256' : 'sha1'
  const cipherOid = caps.has('AES') ? pki.oids['aes256-CBC'] : pki.oids['des-EDE3-CBC']
  const canPost   = caps.has('POSTPKIOperation') || caps.has('SCEPStandard')
  note(`Capabilities: digest=${mdName}, cipher=${caps.has('AES') ? 'AES-256-CBC' : '3DES-CBC'}, POST=${canPost}`)

  note('Fetching CA/RA certificate (GetCACert)…')
  const { recipient, chain } = await getCACert(o.url, o.caIdent, netOpts)
  note(`Recipient: ${recipient.subject.getField('CN') ? recipient.subject.getField('CN').value : '(no CN)'}`)

  note(`Generating RSA-${keyBits} key pair and CSR…`)
  const { keys, csr, selfSigned, subjectAttrs } =
    makeKeyAndCsr({ subject: o.subject, sans: o.sans || {}, challenge: o.challenge, keyBits, mdName })
  const csrDer = asn1.toDer(pki.certificationRequestToAsn1(csr)).getBytes()

  const transId = crypto.createHash('sha256')
    .update(asn1.toDer(pki.publicKeyToAsn1(keys.publicKey)).getBytes(), 'binary')
    .digest('base64')
  const senderNonce = crypto.randomBytes(16).toString('binary')

  note(`Building pkiMessage (PKCSReq, transactionId=${transId})…`)
  const pkiMessageDer = buildPkiMessage(csrDer, recipient, selfSigned, keys.privateKey, subjectAttrs, {
    mdName, cipherOid, transId, senderNonce, messageType: '19',
  })

  note('Submitting enrolment request (PKIOperation)…')
  const respBuf = await pkiOperation(o.url, pkiMessageDer, canPost, netOpts)

  note('Parsing CA response…')
  const parsed = parseResponse(respBuf, keys.privateKey)

  const statusMap = { '0': 'SUCCESS', '2': 'FAILURE', '3': 'PENDING' }
  const status = statusMap[parsed.pkiStatus] || `UNKNOWN(${parsed.pkiStatus})`
  note(`pkiStatus = ${status}`)

  const out = {
    transactionId: transId,
    pkiStatus: parsed.pkiStatus,
    status,
    failInfo: null,
    certificatePem: null,
    chainPem: [],
    privateKeyPem: pki.privateKeyToPem(keys.privateKey),
    csrPem: pki.certificationRequestToPem(csr),
    caCertPem: pki.certificateToPem(recipient),
    log,
  }

  if (parsed.pkiStatus === '2') {
    out.failInfo = FAIL_INFO[parsed.failInfo] || `failInfo=${parsed.failInfo}`
    note(`Failure: ${out.failInfo}`)
    return out
  }
  if (parsed.pkiStatus === '3') {
    note('Request is PENDING manual approval at the CA.')
    return out
  }

  if (parsed.certs.length) {
    // The leaf is the issued cert whose public key matches our key.
    const wantSpki = asn1.toDer(pki.publicKeyToAsn1(keys.publicKey)).getBytes()
    const leaf = parsed.certs.find(
      (c) => asn1.toDer(pki.publicKeyToAsn1(c.publicKey)).getBytes() === wantSpki
    ) || parsed.certs[0]
    out.certificatePem = pki.certificateToPem(leaf)
    out.chainPem = parsed.certs
      .filter((c) => c !== leaf)
      .map((c) => pki.certificateToPem(c))
    note(`Issued certificate: ${leaf.subject.getField('CN') ? leaf.subject.getField('CN').value : '(no CN)'}`)
  }
  return out
}

module.exports = { enroll }

// Internal helpers exposed for the offline loopback test only.
module.exports.__internals = {
  OID, asn1, pki, md, digestOid, algId, dnToAsn1,
  attr, printable, octet, oidVal, sortedAttrSet, buildSubjectAttrs,
  isPrivateIp, resolvePinnedAddress, withOperation,
  getCACaps, getCACert, makeKeyAndCsr, buildPkiMessage, pkiOperation, parseResponse,
}
