import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle, XCircle, MinusCircle } from 'lucide-react'

function Cell({ value }: { value: boolean | string }) {
  if (value === true)      return <CheckCircle size={15} className="text-spiffe mx-auto" />
  if (value === false)     return <XCircle     size={15} className="text-mi-red mx-auto" />
  if (value === 'partial') return <MinusCircle size={15} className="text-mi-gold mx-auto" />
  if (value === 'opt')     return <span className="text-mi-gold text-xs">opt</span>

  const colorMap: Record<string, string> = {
    low: 'text-spiffe', medium: 'text-mi-gold', high: 'text-mi-red',
    fast: 'text-spiffe', slow: 'text-mi-red',
    baixa: 'text-spiffe', média: 'text-mi-gold',
    rápida: 'text-spiffe', lenta: 'text-mi-red',
    baja: 'text-spiffe', media: 'text-mi-gold',
    alta: 'text-mi-red',
  }
  const cls = colorMap[String(value).toLowerCase()] ?? 'text-slate-400'
  return <span className={`text-xs font-semibold ${cls}`}>{value as string}</span>
}

const methodColors = ['text-mi-red', 'text-k8s', 'text-mi-gold', 'text-pki']

export default function ComparePage() {
  const { t } = useTranslation()
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  const methods  = t('compare.methods',  { returnObjects: true }) as string[]
  const criteria = t('compare.criteria', { returnObjects: true }) as Array<{ label: string; values: (boolean | string)[] }>
  const bestFor  = t('compare.best_for', { returnObjects: true }) as Array<{ method: string; color: string; use: string }>

  const bfColor: Record<string, string> = {
    'mi-red':  'text-mi-red',
    'k8s':     'text-k8s',
    'mi-gold': 'text-mi-gold',
    'pki':     'text-pki',
  }

  return (
    <div ref={ref} className="py-24 px-6">
      <div className="max-w-5xl mx-auto space-y-16">

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center space-y-4"
        >
          <span className="badge bg-mi-cyan/10 text-mi-cyan border border-mi-cyan/20">
            {t('compare.badge')}
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold">{t('compare.title')}</h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">{t('compare.subtitle')}</p>
        </motion.div>

        {/* Comparison table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="rounded-xl border border-border overflow-x-auto"
        >
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="border-b border-border bg-bg-muted/50">
                <th className="text-left px-5 py-3 text-slate-400 font-semibold w-48">Criteria</th>
                {methods.map((m, i) => (
                  <th key={i} className={`px-4 py-3 font-bold text-center ${methodColors[i % methodColors.length]}`}>
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {criteria.map((row, i) => (
                <tr key={i} className={`border-b border-border/50 ${i % 2 === 0 ? 'bg-bg-card' : 'bg-bg'}`}>
                  <td className="px-5 py-3 text-slate-300 font-medium">{row.label}</td>
                  {row.values.map((v, j) => (
                    <td key={j} className="px-4 py-3 text-center">
                      <Cell value={v} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>

        {/* Best for cards */}
        <div className="grid sm:grid-cols-2 gap-4">
          {bestFor.map((b, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.2 + i * 0.08 }}
              className="section-card space-y-2"
            >
              <p className={`font-bold ${bfColor[b.color] ?? 'text-mi-cyan'}`}>{b.method}</p>
              <p className="text-sm text-slate-400 leading-relaxed">{b.use}</p>
            </motion.div>
          ))}
        </div>

      </div>
    </div>
  )
}
