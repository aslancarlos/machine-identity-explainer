import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Clock, Eye, ShieldCheck } from 'lucide-react'

const icons: Record<string, React.ElementType> = {
  alert: AlertTriangle,
  clock: Clock,
  eye: Eye,
}

export default function ProblemSection() {
  const { t } = useTranslation()
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  const items = t('problem.items', { returnObjects: true }) as Array<{
    icon: string; title: string; desc: string
  }>

  return (
    <section id="problem" ref={ref} className="py-24 px-6">
      <div className="max-w-6xl mx-auto space-y-16">

        <div className="space-y-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="text-center space-y-3"
          >
            <span className="badge bg-mi-red/10 text-mi-red border border-mi-red/20">
              {t('problem.badge')}
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold">{t('problem.title')}</h2>
          </motion.div>

          <div className="grid sm:grid-cols-3 gap-6">
            {items.map((item, i) => {
              const Icon = icons[item.icon] ?? AlertTriangle
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.1 + i * 0.1 }}
                  className="section-card space-y-3"
                >
                  <div className="w-10 h-10 rounded-xl bg-mi-red/10 flex items-center justify-center">
                    <Icon size={18} className="text-mi-red" />
                  </div>
                  <h3 className="font-semibold text-white">{item.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
                </motion.div>
              )
            })}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="relative section-card bg-gradient-to-br from-mi-cyan/5 to-bg-card border-mi-cyan/20"
        >
          <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-mi-cyan/5 to-transparent pointer-events-none" />
          <div className="relative flex flex-col sm:flex-row gap-6 items-start">
            <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-mi-cyan/10 flex items-center justify-center">
              <ShieldCheck size={22} className="text-mi-cyan" />
            </div>
            <div className="space-y-2">
              <span className="badge bg-mi-cyan/10 text-mi-cyan border border-mi-cyan/20 text-xs">
                {t('problem.solution_badge')}
              </span>
              <h3 className="text-xl font-bold text-white">{t('problem.solution_title')}</h3>
              <p className="text-slate-400 leading-relaxed max-w-2xl">{t('problem.solution_desc')}</p>
            </div>
          </div>
        </motion.div>

      </div>
    </section>
  )
}
