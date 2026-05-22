import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Shield, Clock, Layers, RefreshCw } from 'lucide-react'

const benefitIcons: Record<string, React.ElementType> = {
  shield: Shield,
  clock: Clock,
  layers: Layers,
  refresh: RefreshCw,
}

const benefitColors = ['text-mi-cyan', 'text-mi-gold', 'text-spiffe', 'text-pki']
const benefitBgs    = ['bg-mi-cyan/10', 'bg-mi-gold/10', 'bg-spiffe/10', 'bg-pki/10']

export default function SpiffePage() {
  const { t } = useTranslation()
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  const benefits = t('spiffe.benefits', { returnObjects: true }) as Array<{
    icon: string; title: string; desc: string
  }>

  return (
    <div ref={ref} className="py-24 px-6">
      <div className="max-w-5xl mx-auto space-y-20">

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center space-y-4"
        >
          <span className="badge bg-mi-gold/10 text-mi-gold border border-mi-gold/20">
            {t('spiffe.badge')}
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold">{t('spiffe.title')}</h1>
          <p className="text-lg text-slate-400 max-w-3xl mx-auto leading-relaxed">{t('spiffe.subtitle')}</p>
        </motion.div>

        {/* SVID explainer */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="section-card bg-gradient-to-br from-mi-gold/5 to-bg-card border-mi-gold/20 space-y-4"
        >
          <h2 className="text-xl font-bold text-white">{t('spiffe.svid_title')}</h2>
          <p className="text-slate-400 leading-relaxed max-w-3xl">{t('spiffe.svid_desc')}</p>
          <div className="code-block text-mi-gold mt-4">
            <span className="text-slate-500">// SPIFFE ID in X.509 SAN field</span>{'\n'}
            <span className="text-mi-cyan">SubjectAltName: URI:</span>
            <span className="text-mi-gold">{t('spiffe.sample_id')}</span>
          </div>
        </motion.div>

        {/* Benefits */}
        <div className="space-y-6">
          <motion.h2
            initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-2xl font-bold"
          >
            Why SPIFFE / SPIRE?
          </motion.h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {benefits.map((b, i) => {
              const Icon = benefitIcons[b.icon] ?? Shield
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.25 + i * 0.08 }}
                  className="section-card space-y-3"
                >
                  <div className={`w-10 h-10 rounded-xl ${benefitBgs[i % benefitBgs.length]} flex items-center justify-center`}>
                    <Icon size={18} className={benefitColors[i % benefitColors.length]} />
                  </div>
                  <h3 className={`font-semibold ${benefitColors[i % benefitColors.length]}`}>{b.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{b.desc}</p>
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Attestation */}
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="section-card space-y-4"
        >
          <h2 className="text-xl font-bold text-white">{t('spiffe.attestation_title')}</h2>
          <p className="text-slate-400 leading-relaxed">{t('spiffe.attestation_desc')}</p>
          <div className="grid sm:grid-cols-3 gap-3 pt-2">
            {[
              { label: 'K8s selector', code: 'k8s:ns:payments\nk8s:sa:checkout-api', color: 'text-k8s'    },
              { label: 'Docker',       code: 'docker:label:app=api\ndocker:sha:abc123', color: 'text-mtls'   },
              { label: 'AWS EC2',      code: 'aws:account:123456\naws:role:checkout',  color: 'text-mi-gold'},
            ].map(item => (
              <div key={item.label} className="rounded-lg bg-bg-muted border border-border p-4 space-y-2">
                <p className={`text-xs font-semibold ${item.color}`}>{item.label}</p>
                <pre className="text-xs text-slate-500 font-mono whitespace-pre-wrap">{item.code}</pre>
              </div>
            ))}
          </div>
        </motion.div>

      </div>
    </div>
  )
}
