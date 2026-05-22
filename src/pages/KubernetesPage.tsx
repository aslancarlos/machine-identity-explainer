import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle, MinusCircle, CheckSquare } from 'lucide-react'

export default function KubernetesPage() {
  const { t } = useTranslation()
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  const primitives = t('kubernetes.primitives', { returnObjects: true }) as Array<{
    name: string; color: string; strength: string; desc: string
  }>
  const hardening = t('kubernetes.hardening', { returnObjects: true }) as string[]

  const primColor: Record<string, string> = {
    'k8s':     'text-k8s border-k8s/20',
    'mi-gold': 'text-mi-gold border-mi-gold/20',
    'pki':     'text-pki border-pki/20',
    'spiffe':  'text-spiffe border-spiffe/20',
  }

  return (
    <div ref={ref} className="py-24 px-6">
      <div className="max-w-5xl mx-auto space-y-20">

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center space-y-4"
        >
          <span className="badge bg-k8s/10 text-k8s border border-k8s/20">
            {t('kubernetes.badge')}
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold">{t('kubernetes.title')}</h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">{t('kubernetes.subtitle')}</p>
        </motion.div>

        {/* Identity primitives */}
        <div className="space-y-6">
          <motion.h2
            initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-2xl font-bold"
          >
            {t('kubernetes.primitives_title')}
          </motion.h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {primitives.map((p, i) => {
              const cls = primColor[p.color] ?? 'text-mi-cyan border-mi-cyan/20'
              const isStrong = p.strength === 'strong'
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.15 + i * 0.1 }}
                  className={`section-card space-y-3 border ${cls.split(' ')[1]}`}
                >
                  <div className="flex items-center gap-2">
                    {isStrong
                      ? <CheckCircle size={16} className="text-spiffe shrink-0" />
                      : <MinusCircle size={16} className="text-mi-gold shrink-0" />
                    }
                    <h3 className={`font-bold ${cls.split(' ')[0]}`}>{p.name}</h3>
                    <span className={`ml-auto badge text-[10px] ${isStrong ? 'bg-spiffe/10 text-spiffe border-spiffe/20' : 'bg-mi-gold/10 text-mi-gold border-mi-gold/20'} border`}>
                      {p.strength}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed">{p.desc}</p>
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Hardening checklist */}
        <div className="space-y-6">
          <motion.h2
            initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="text-2xl font-bold"
          >
            {t('kubernetes.hardening_title')}
          </motion.h2>
          <div className="section-card space-y-3">
            {hardening.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -16 }} animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.4, delay: 0.45 + i * 0.06 }}
                className="flex items-start gap-3"
              >
                <CheckSquare size={15} className="text-spiffe shrink-0 mt-0.5" />
                <p className="text-sm text-slate-400 leading-relaxed">{item}</p>
              </motion.div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
