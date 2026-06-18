import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useInView } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { ShieldX, ScrollText, Search, Database, ArrowRight } from 'lucide-react'

const TOOLS = [
  { to: '/ztpki',    icon: ShieldX,    color: 'text-mi-red',  key: 'ztpki', featured: true },
  { to: '/scep',     icon: ScrollText, color: 'text-mtls',    key: 'scep'  },
  { to: '/tls-scan', icon: Search,     color: 'text-spiffe',  key: 'tlsscan' },
  { to: '/clm',      icon: Database,   color: 'text-mi-gold', key: 'clm'   },
]

export default function LiveTools() {
  const { t } = useTranslation()
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section id="live-tools" ref={ref} className="py-24 px-6">
      <div className="max-w-6xl mx-auto space-y-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center space-y-3"
        >
          <span className="badge bg-mi-cyan/10 text-mi-cyan border border-mi-cyan/20">
            {t('livetools.badge')}
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold">{t('livetools.title')}</h2>
          <p className="text-text-2 max-w-2xl mx-auto">{t('livetools.subtitle')}</p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {TOOLS.map((tool, i) => {
            const Icon = tool.icon
            return (
              <motion.div
                key={tool.to}
                initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.1 + i * 0.08 }}
              >
                <Link
                  to={tool.to}
                  className={`group section-card flex h-full flex-col gap-3 transition-colors hover:border-mi-cyan/40 ${
                    tool.featured ? 'ring-1 ring-mi-red/30' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Icon size={24} className={tool.color} />
                    {tool.featured && (
                      <span className="badge bg-mi-red/10 text-mi-red border border-mi-red/20 !px-2 !py-0.5 text-[10px]">
                        {t('livetools.new')}
                      </span>
                    )}
                  </div>
                  <div className="font-semibold text-text">{t(`livetools.${tool.key}_title`)}</div>
                  <div className="text-sm text-text-2 flex-1">{t(`livetools.${tool.key}_desc`)}</div>
                  <div className="flex items-center gap-1 text-sm font-semibold text-mi-cyan">
                    {t('livetools.open')} <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
