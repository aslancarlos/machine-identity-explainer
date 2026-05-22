import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

export default function CertificatesPage() {
  const { t } = useTranslation()
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  const lifecycle = t('certificates.lifecycle', { returnObjects: true }) as Array<{ step: string; label: string; desc: string }>
  const tools     = t('certificates.tools',     { returnObjects: true }) as Array<{ name: string; color: string; desc: string }>

  const toolColor: Record<string, string> = {
    'k8s':     'text-k8s',
    'spiffe':  'text-spiffe',
    'mi-gold': 'text-mi-gold',
    'pki':     'text-pki',
  }

  const stepColors = [
    'bg-mi-cyan/10 text-mi-cyan border-mi-cyan/20',
    'bg-mi-gold/10 text-mi-gold border-mi-gold/20',
    'bg-spiffe/10 text-spiffe border-spiffe/20',
    'bg-k8s/10 text-k8s border-k8s/20',
    'bg-mtls/10 text-mtls border-mtls/20',
    'bg-mi-red/10 text-mi-red border-mi-red/20',
  ]

  return (
    <div ref={ref} className="py-24 px-6">
      <div className="max-w-5xl mx-auto space-y-20">

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center space-y-4"
        >
          <span className="badge bg-pki/10 text-pki border border-pki/20">
            {t('certificates.badge')}
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold">{t('certificates.title')}</h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">{t('certificates.subtitle')}</p>
        </motion.div>

        {/* Lifecycle */}
        <div className="space-y-6">
          <motion.h2
            initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-2xl font-bold"
          >
            {t('certificates.lifecycle_title')}
          </motion.h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {lifecycle.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.15 + i * 0.08 }}
                className="section-card space-y-3"
              >
                <div className={`inline-flex items-center gap-2 badge ${stepColors[i % stepColors.length]} border`}>
                  <span className="font-mono">{item.step}</span>
                  <span>{item.label}</span>
                </div>
                <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* X.509 structure */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="section-card space-y-4"
        >
          <h2 className="text-xl font-bold text-white">X.509 SVID structure</h2>
          <div className="code-block text-sm space-y-1">
            <div><span className="text-slate-500">Subject:</span>        <span className="text-mi-cyan">CN=checkout-api, O=payments-team</span></div>
            <div><span className="text-slate-500">Issuer:</span>         <span className="text-mi-gold">SPIRE Intermediate CA</span></div>
            <div><span className="text-slate-500">SubjectAltName:</span> <span className="text-spiffe">URI:spiffe://prod.example.com/ns/payments/sa/checkout-api</span></div>
            <div><span className="text-slate-500">NotBefore:</span>      <span className="text-white">2025-05-22T10:00:00Z</span></div>
            <div><span className="text-slate-500">NotAfter:</span>       <span className="text-mtls">2025-05-22T11:00:00Z</span> <span className="text-slate-600">(1h TTL)</span></div>
            <div><span className="text-slate-500">KeyUsage:</span>       <span className="text-white">digitalSignature, keyEncipherment</span></div>
            <div><span className="text-slate-500">ExtKeyUsage:</span>    <span className="text-white">serverAuth, clientAuth</span></div>
          </div>
        </motion.div>

        {/* Automation tools */}
        <div className="space-y-6">
          <motion.h2
            initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="text-2xl font-bold"
          >
            {t('certificates.tools_title')}
          </motion.h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {tools.map((tool, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.45 + i * 0.08 }}
                className="section-card space-y-2"
              >
                <p className={`font-bold ${toolColor[tool.color] ?? 'text-mi-cyan'}`}>{tool.name}</p>
                <p className="text-sm text-slate-400 leading-relaxed">{tool.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
