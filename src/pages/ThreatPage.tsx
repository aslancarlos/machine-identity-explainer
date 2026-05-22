import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Key, Clock, Ghost, Shuffle, Eye, Server, AlertTriangle } from 'lucide-react'

const threatIcons: Record<string, React.ElementType> = {
  key: Key,
  clock: Clock,
  ghost: Ghost,
  shuffle: Shuffle,
  eye: Eye,
  server: Server,
}

const severityStyle: Record<string, { badge: string; border: string; dot: string }> = {
  critical: { badge: 'bg-mi-red/10 text-mi-red border-mi-red/20',   border: 'border-mi-red/20',   dot: 'bg-mi-red'    },
  high:     { badge: 'bg-mtls/10 text-mtls border-mtls/20',          border: 'border-mtls/20',     dot: 'bg-mtls'      },
  medium:   { badge: 'bg-mi-gold/10 text-mi-gold border-mi-gold/20', border: 'border-mi-gold/20',  dot: 'bg-mi-gold'   },
}

export default function ThreatPage() {
  const { t } = useTranslation()
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  const items = t('threats.items', { returnObjects: true }) as Array<{
    icon: string; severity: string; title: string; desc: string; example: string
  }>

  return (
    <div ref={ref} className="py-24 px-6">
      <div className="max-w-5xl mx-auto space-y-16">

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center space-y-4"
        >
          <span className="badge bg-mi-red/10 text-mi-red border border-mi-red/20">
            {t('threats.badge')}
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold">{t('threats.title')}</h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">{t('threats.subtitle')}</p>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-6">
          {items.map((item, i) => {
            const Icon = threatIcons[item.icon] ?? AlertTriangle
            const s = severityStyle[item.severity] ?? severityStyle.medium
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.1 + i * 0.08 }}
                className={`section-card space-y-4 ${s.border}`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-mi-red/10 flex items-center justify-center shrink-0">
                    <Icon size={18} className="text-mi-red" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-white">{item.title}</h3>
                      <span className={`badge text-[10px] ${s.badge}`}>{item.severity}</span>
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 pt-1 border-t border-border/50">
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${s.dot}`} />
                  <p className="text-xs text-slate-500 font-mono leading-relaxed">{item.example}</p>
                </div>
              </motion.div>
            )
          })}
        </div>

      </div>
    </div>
  )
}
