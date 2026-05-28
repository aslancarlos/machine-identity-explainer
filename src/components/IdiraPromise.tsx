import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * IDIRA promise band — same visual system as conjur-explainer,
 * different content (machine identity / network vs workload).
 */
export default function IdiraPromise() {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section className="px-6 lg:px-10 py-24">
      <div className="max-w-7xl mx-auto">
        <div ref={ref} className="idira-promise">
          <div className="relative z-10 max-w-[760px]">
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
              className="flex items-center gap-4 font-mono text-[12.5px] uppercase tracking-[0.12em] text-slate-400/80"
            >
              <span className="w-9 h-px bg-idira-blue inline-block" />
              {t('promise.eyebrow')}
            </motion.p>

            <motion.h3
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, delay: 0.15, ease: [0.2, 0.7, 0.2, 1] }}
              className="mt-10 text-[clamp(36px,5vw,64px)] font-bold leading-[1.05] tracking-[-0.025em] max-w-[20ch]"
            >
              {t('promise.claim_pre')}{' '}
              <mark className="bg-transparent text-idira-cyan font-bold">
                {t('promise.claim_mark')}
              </mark>
            </motion.h3>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, delay: 0.25, ease: [0.2, 0.7, 0.2, 1] }}
              className="mt-7 text-[15px] leading-[1.65] text-slate-300 max-w-[58ch]"
            >
              {t('promise.detail')}
            </motion.p>
          </div>
        </div>
      </div>
    </section>
  )
}
