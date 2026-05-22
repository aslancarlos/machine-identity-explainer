import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Shield, Lock, Eye } from 'lucide-react'

const principleIcons: Record<string, React.ElementType> = {
  shield: Shield,
  lock: Lock,
  eye: Eye,
}

const principleColors = ['text-mi-cyan', 'text-mi-gold', 'text-mi-red']
const principleBgs    = ['bg-mi-cyan/10', 'bg-mi-gold/10', 'bg-mi-red/10']

export default function ZeroTrustPage() {
  const { t } = useTranslation()
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  const principles = t('zerotrust.principles', { returnObjects: true }) as Array<{ icon: string; title: string; desc: string }>
  const stack      = t('zerotrust.stack',      { returnObjects: true }) as Array<{ layer: string; color: string; tech: string; desc: string }>

  const layerColor: Record<string, string> = {
    'mi-gold': 'text-mi-gold border-mi-gold/30 bg-mi-gold/5',
    'mi-cyan': 'text-mi-cyan border-mi-cyan/30 bg-mi-cyan/5',
    'spiffe':  'text-spiffe  border-spiffe/30  bg-spiffe/5',
    'pki':     'text-pki     border-pki/30     bg-pki/5',
    'k8s':     'text-k8s     border-k8s/30     bg-k8s/5',
  }

  return (
    <div ref={ref} className="py-24 px-6">
      <div className="max-w-5xl mx-auto space-y-20">

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center space-y-4"
        >
          <span className="badge bg-spiffe/10 text-spiffe border border-spiffe/20">
            {t('zerotrust.badge')}
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold">{t('zerotrust.title')}</h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">{t('zerotrust.subtitle')}</p>
        </motion.div>

        {/* Three principles */}
        <div className="grid sm:grid-cols-3 gap-6">
          {principles.map((p, i) => {
            const Icon = principleIcons[p.icon] ?? Shield
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.1 + i * 0.1 }}
                className="section-card space-y-4 text-center"
              >
                <div className={`w-14 h-14 rounded-2xl ${principleBgs[i % principleBgs.length]} flex items-center justify-center mx-auto`}>
                  <Icon size={24} className={principleColors[i % principleColors.length]} />
                </div>
                <h3 className={`font-bold ${principleColors[i % principleColors.length]}`}>{p.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{p.desc}</p>
              </motion.div>
            )
          })}
        </div>

        {/* Stack */}
        <div className="space-y-6">
          <motion.h2
            initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="text-2xl font-bold"
          >
            {t('zerotrust.stack_title')}
          </motion.h2>
          <div className="space-y-3">
            {stack.map((layer, i) => {
              const cls = layerColor[layer.color] ?? 'text-mi-cyan border-mi-cyan/30 bg-mi-cyan/5'
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }} animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.4, delay: 0.4 + i * 0.07 }}
                  className={`flex items-center gap-4 rounded-xl border p-4 ${cls}`}
                >
                  <div className="w-36 shrink-0">
                    <p className="text-xs font-mono font-semibold opacity-70">{layer.layer}</p>
                    <p className="text-sm font-bold mt-0.5">{layer.tech}</p>
                  </div>
                  <div className="w-px self-stretch bg-current opacity-20" />
                  <p className="text-sm opacity-80 leading-relaxed">{layer.desc}</p>
                </motion.div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}
