import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Box, Server, Cpu, Wifi, Code, GitBranch } from 'lucide-react'

const typeIcons: Record<string, React.ElementType> = {
  container: Box,
  server: Server,
  cpu: Cpu,
  wifi: Wifi,
  code: Code,
  git: GitBranch,
}

const typeColors = ['text-mi-cyan', 'text-k8s', 'text-mi-gold', 'text-mtls', 'text-spiffe', 'text-pki']
const bgColors   = ['bg-mi-cyan/10', 'bg-k8s/10', 'bg-mi-gold/10', 'bg-mtls/10', 'bg-spiffe/10', 'bg-pki/10']

export default function WhatIsPage() {
  const { t } = useTranslation()
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  const types   = t('whatis.types',    { returnObjects: true }) as Array<{ icon: string; label: string; desc: string }>
  const vsItems = t('whatis.vs_items', { returnObjects: true }) as Array<{ aspect: string; human: string; machine: string }>

  return (
    <div ref={ref} className="py-24 px-6">
      <div className="max-w-5xl mx-auto space-y-20">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center space-y-4"
        >
          <span className="badge bg-mi-cyan/10 text-mi-cyan border border-mi-cyan/20">
            {t('whatis.badge')}
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold">{t('whatis.title')}</h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">{t('whatis.subtitle')}</p>
        </motion.div>

        {/* Types grid */}
        <div className="space-y-6">
          <motion.h2
            initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-2xl font-bold"
          >
            {t('whatis.types_title')}
          </motion.h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {types.map((item, i) => {
              const Icon = typeIcons[item.icon] ?? Box
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.5, delay: 0.15 + i * 0.08 }}
                  className="section-card space-y-3 hover:border-mi-cyan/30 transition-colors"
                >
                  <div className={`w-10 h-10 rounded-xl ${bgColors[i % bgColors.length]} flex items-center justify-center`}>
                    <Icon size={18} className={typeColors[i % typeColors.length]} />
                  </div>
                  <h3 className={`font-semibold ${typeColors[i % typeColors.length]}`}>{item.label}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Human vs Machine table */}
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="space-y-6"
        >
          <h2 className="text-2xl font-bold">{t('whatis.vs_title')}</h2>
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-muted/50">
                  <th className="text-left px-5 py-3 text-slate-400 font-semibold w-1/3">Aspect</th>
                  <th className="text-left px-5 py-3 text-slate-300 font-semibold w-1/3">Human Identity</th>
                  <th className="text-left px-5 py-3 text-mi-cyan font-semibold w-1/3">Machine Identity</th>
                </tr>
              </thead>
              <tbody>
                {vsItems.map((row, i) => (
                  <tr key={i} className={`border-b border-border/50 ${i % 2 === 0 ? 'bg-bg-card' : 'bg-bg'}`}>
                    <td className="px-5 py-3 text-slate-400 font-medium">{row.aspect}</td>
                    <td className="px-5 py-3 text-slate-500">{row.human}</td>
                    <td className="px-5 py-3 text-mi-cyan font-medium">{row.machine}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

      </div>
    </div>
  )
}
