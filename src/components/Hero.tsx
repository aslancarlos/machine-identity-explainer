import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: [0.2, 0.7, 0.2, 1] },
})

/**
 * IDIRA Hero (machine-identity flavour) — modeled after
 * paloaltonetworks.com/idira. Same visual system as the secrets-manager
 * site, with content focused on open standards (SPIFFE/SPIRE/mTLS).
 */
export default function Hero() {
  const { t } = useTranslation()

  return (
    <section className="relative overflow-hidden bg-idira-deep text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 hero-mesh" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 hero-grid" />

      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-10 pt-28 pb-32 lg:pt-32 lg:pb-40">
        {/* Eyebrow */}
        <motion.div
          {...fadeUp(0.1)}
          className="inline-flex items-center gap-2.5 text-[12px] font-mono uppercase tracking-[0.12em] text-idira-cyan bg-[rgba(0,212,255,0.12)] px-3.5 py-2 rounded-full"
        >
          <span className="relative inline-flex">
            <span className="w-1.5 h-1.5 rounded-full bg-idira-cyan" />
            <span className="absolute -inset-1 rounded-full bg-idira-cyan/30 animate-ping" />
          </span>
          {t('hero.eyebrow')}
        </motion.div>

        {/* Headline */}
        <motion.h1
          {...fadeUp(0.2)}
          className="mt-8 max-w-[18ch] font-semibold leading-[0.92] tracking-[-0.04em] text-[clamp(48px,8.5vw,116px)]"
        >
          {t('hero.title')}{' '}
          <em className="not-italic idira-shimmer">{t('hero.titleAccent')}</em>
          <span className="text-idira-orange">.</span>
        </motion.h1>

        {/* Lede */}
        <motion.p
          {...fadeUp(0.3)}
          className="mt-7 max-w-[60ch] text-[clamp(17px,1.4vw,20px)] leading-[1.55] text-slate-300"
        >
          {t('hero.subtitle')}
        </motion.p>

        {/* CTAs */}
        <motion.div {...fadeUp(0.4)} className="mt-10 flex flex-wrap gap-3.5">
          <Link to="/flow" className="idira-cta idira-cta-primary">
            <span>{t('hero.cta_spiffe')}</span>
            <ArrowRight size={16} className="idira-cta-arrow" />
          </Link>
          <Link to="/compare" className="idira-cta idira-cta-on-deep">
            <span>{t('hero.cta_compare')}</span>
            <ArrowRight size={14} className="idira-cta-arrow" />
          </Link>
          <Link to="/kubernetes" className="idira-cta idira-cta-on-deep">
            <span>{t('hero.cta_k8s')}</span>
            <ArrowRight size={14} className="idira-cta-arrow" />
          </Link>
        </motion.div>

        {/* Open primitives strip */}
        <motion.div {...fadeUp(0.55)} className="mt-20 pt-8 border-t border-white/10">
          <div className="text-[11.5px] font-mono uppercase tracking-[0.16em] text-slate-400 mb-5">
            {t('hero.logoStripLabel')}
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-x-8 gap-y-4 items-center">
            {['SPIFFE', 'SPIRE', 'X.509', 'JWT', 'mTLS', 'CNCF'].map(label => (
              <div
                key={label}
                className="text-[15px] font-semibold tracking-[-0.01em] text-white/85"
              >
                {label}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Concept-count stat strip */}
        <motion.div
          {...fadeUp(0.65)}
          className="mt-12 grid grid-cols-2 lg:grid-cols-4 border border-white/10 rounded-2xl overflow-hidden bg-white/[0.02] backdrop-blur-sm"
        >
          <StatCell value="06" unit={t('hero.stat1_unit')} label={t('hero.stat1_label')} />
          <StatCell value="01" unit={t('hero.stat2_unit')} label={t('hero.stat2_label')} />
          <StatCell value="00" unit={t('hero.stat3_unit')} label={t('hero.stat3_label')} accent />
          <StatCell value="∞"  unit={t('hero.stat4_unit')} label={t('hero.stat4_label')} />
        </motion.div>

        {/* Scroll hint */}
        <motion.a
          {...fadeUp(0.8)}
          href="#problem"
          className="mt-16 inline-flex items-center gap-2 text-[12.5px] font-mono uppercase tracking-[0.1em] text-slate-400 hover:text-idira-cyan transition-colors"
        >
          {t('hero.cta_explore')}
          <ArrowDown size={14} className="animate-bounce" aria-hidden="true" />
        </motion.a>
      </div>
    </section>
  )
}

function StatCell({
  value, unit, label, accent = false,
}: { value: string; unit: string; label: string; accent?: boolean }) {
  return (
    <div className="p-6 lg:p-7 border-r border-b last:border-r-0 [&:nth-child(2n)]:border-r-0 lg:[&:nth-child(2n)]:border-r lg:last:border-r-0 [&:nth-child(n+3)]:border-b-0 lg:[&]:border-b-0 border-white/10">
      <div className="flex items-baseline gap-2.5 leading-none tabular-nums">
        <span
          className={`font-bold tracking-[-0.04em] text-[clamp(36px,4.6vw,56px)] ${
            accent ? 'text-idira-orange' : 'text-white'
          }`}
        >
          {value}
        </span>
        <span className="text-[13.5px] font-mono text-slate-400">{unit}</span>
      </div>
      <div className="mt-3 text-[13px] font-mono text-slate-400">{label}</div>
    </div>
  )
}
