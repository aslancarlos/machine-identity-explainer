import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

export default function MtlsPage() {
  const { t } = useTranslation()
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  const handshake   = t('mtls.handshake',   { returnObjects: true }) as Array<{ step: string; label: string; desc: string }>
  const vs          = t('mtls.vs',          { returnObjects: true }) as Array<{ aspect: string; tls: string; mtls: string }>
  const enforcement = t('mtls.enforcement', { returnObjects: true }) as Array<{ tool: string; color: string; desc: string }>

  const toolColor: Record<string, string> = {
    'mi-cyan': 'text-mi-cyan',
    'spiffe':  'text-spiffe',
    'mi-gold': 'text-mi-gold',
    'pki':     'text-pki',
  }

  return (
    <div ref={ref} className="py-24 px-6">
      <div className="max-w-5xl mx-auto space-y-20">

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center space-y-4"
        >
          <span className="badge bg-mtls/10 text-mtls border border-mtls/20">
            {t('mtls.badge')}
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold">{t('mtls.title')}</h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">{t('mtls.subtitle')}</p>
        </motion.div>

        {/* mTLS handshake steps */}
        <div className="space-y-6">
          <motion.h2
            initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-2xl font-bold"
          >
            {t('mtls.handshake_title')}
          </motion.h2>
          <div className="space-y-3">
            {handshake.map((h, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }} animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.4, delay: 0.15 + i * 0.08 }}
                className="flex items-start gap-4 section-card"
              >
                <div className="w-8 h-8 rounded-full bg-mtls/10 flex items-center justify-center shrink-0 text-mtls font-mono text-sm font-bold">
                  {h.step}
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-white">{h.label}</p>
                  <p className="text-sm text-slate-400">{h.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* TLS vs mTLS */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="space-y-6"
        >
          <h2 className="text-2xl font-bold">{t('mtls.vs_title')}</h2>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-muted/50">
                  <th className="text-left px-5 py-3 text-slate-400 font-semibold">Aspect</th>
                  <th className="text-left px-5 py-3 text-slate-300 font-semibold">TLS</th>
                  <th className="text-left px-5 py-3 text-mtls font-semibold">mTLS</th>
                </tr>
              </thead>
              <tbody>
                {vs.map((row, i) => (
                  <tr key={i} className={`border-b border-border/50 ${i % 2 === 0 ? 'bg-bg-card' : 'bg-bg'}`}>
                    <td className="px-5 py-3 text-slate-400 font-medium">{row.aspect}</td>
                    <td className="px-5 py-3 text-slate-500">{row.tls}</td>
                    <td className="px-5 py-3 text-mtls font-medium">{row.mtls}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Enforcement tools */}
        <div className="space-y-6">
          <motion.h2
            initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="text-2xl font-bold"
          >
            {t('mtls.enforcement_title')}
          </motion.h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {enforcement.map((e, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.45 + i * 0.08 }}
                className="section-card space-y-2"
              >
                <p className={`font-bold ${toolColor[e.color] ?? 'text-mi-cyan'}`}>{e.tool}</p>
                <p className="text-sm text-slate-400 leading-relaxed">{e.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
