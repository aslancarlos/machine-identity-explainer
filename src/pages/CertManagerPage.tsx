import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Search, FileText, Server, Activity, RefreshCw, XCircle,
  Shield, AlertTriangle, ExternalLink, Key, Clock,
  Layers, CheckCircle, ArrowRight,
} from 'lucide-react'

// ── Lifecycle stages ──────────────────────────────────────────────────────────

const STAGES = [
  { icon: Search,     key: 'discovery',  color: 'text-mi-cyan',  bg: 'bg-mi-cyan/10',  border: 'border-mi-cyan/20'  },
  { icon: FileText,   key: 'issuance',   color: 'text-pki',      bg: 'bg-pki/10',      border: 'border-pki/20'      },
  { icon: Server,     key: 'deployment', color: 'text-k8s',      bg: 'bg-k8s/10',      border: 'border-k8s/20'      },
  { icon: Activity,   key: 'monitoring', color: 'text-mi-gold',  bg: 'bg-mi-gold/10',  border: 'border-mi-gold/20'  },
  { icon: RefreshCw,  key: 'renewal',    color: 'text-spiffe',   bg: 'bg-spiffe/10',   border: 'border-spiffe/20'   },
  { icon: XCircle,    key: 'revocation', color: 'text-mi-red',   bg: 'bg-mi-red/10',   border: 'border-mi-red/20'   },
]

// ── Best practices ────────────────────────────────────────────────────────────

const PRACTICES = [
  { icon: RefreshCw,     key: 'automate',    color: 'text-spiffe',   nistKey: 'practice_automate_nist'    },
  { icon: Clock,         key: 'shortlived',  color: 'text-mi-cyan',  nistKey: 'practice_shortlived_nist'  },
  { icon: Layers,        key: 'inventory',   color: 'text-pki',      nistKey: 'practice_inventory_nist'   },
  { icon: Shield,        key: 'policy',      color: 'text-mi-gold',  nistKey: 'practice_policy_nist'      },
  { icon: Search,        key: 'ctlogs',      color: 'text-k8s',      nistKey: 'practice_ctlogs_nist'      },
  { icon: Key,           key: 'keyprotect',  color: 'text-mtls',     nistKey: 'practice_keyprotect_nist'  },
  { icon: AlertTriangle, key: 'alerts',      color: 'text-mi-red',   nistKey: 'practice_alerts_nist'      },
]

// ── Automation tools ──────────────────────────────────────────────────────────

const TOOLS = [
  { badge: 'K8s',   key: 'certmanager',  color: 'text-k8s',      border: 'border-k8s/20',      bg: 'bg-k8s/5',      name: 'cert-manager'         },
  { badge: 'NGTS',  key: 'ngts',         color: 'text-mi-gold',  border: 'border-mi-gold/20',  bg: 'bg-mi-gold/5',  name: 'PANW Strata NGTS'     },
  { badge: 'ACME',  key: 'letsencrypt',  color: 'text-spiffe',   border: 'border-spiffe/20',   bg: 'bg-spiffe/5',   name: "Let's Encrypt"        },
  { badge: 'CLM',   key: 'venafi',       color: 'text-mi-cyan',  border: 'border-mi-cyan/20',  bg: 'bg-mi-cyan/5',  name: 'Venafi'               },
]

// ── Common mistakes ───────────────────────────────────────────────────────────

const PITFALLS = ['expiry', 'wildcard', 'gitkeys', 'manual']

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CertManagerPage() {
  const { t } = useTranslation()
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  const fade = (delay = 0) => ({
    initial: { opacity: 0, y: 20 },
    animate: inView ? { opacity: 1, y: 0 } : {},
    transition: { duration: 0.5, delay },
  })

  return (
    <div ref={ref} className="py-24 px-6">
      <div className="max-w-5xl mx-auto space-y-20">

        {/* Header */}
        <motion.div {...fade(0)} className="text-center space-y-4">
          <span className="badge bg-pki/10 text-pki border border-pki/20">
            <RefreshCw size={11} className="mr-1.5" /> {t('certmgr.badge')}
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold">
            {t('certmgr.title')}{' '}
            <span className="text-pki">{t('certmgr.title_accent')}</span>
          </h1>
          <p className="text-lg text-slate-400 max-w-3xl mx-auto leading-relaxed">
            {t('certmgr.subtitle')}
          </p>
        </motion.div>

        {/* Venafi CTA */}
        <motion.div {...fade(0.05)}>
          <div className="rounded-2xl border border-mi-cyan/30 bg-gradient-to-br from-mi-cyan/5 via-bg-card to-bg-muted p-8 space-y-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="badge bg-mi-cyan/10 text-mi-cyan border border-mi-cyan/20 text-xs">
                    Venafi Trust Protection Platform
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-white">{t('certmgr.venafi_title')}</h2>
                <p className="text-slate-400 leading-relaxed max-w-2xl">{t('certmgr.venafi_desc')}</p>
              </div>
              <a
                href="https://latamlab.venafi.cloud"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-mi-cyan text-bg font-bold text-sm hover:bg-mi-cyan/80 transition-colors shrink-0 whitespace-nowrap"
              >
                {t('certmgr.venafi_cta')} <ArrowRight size={15} />
              </a>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {(['venafi_feat1', 'venafi_feat2', 'venafi_feat3', 'venafi_feat4'] as const).map(k => (
                <div key={k} className="flex items-center gap-2 text-sm text-slate-300">
                  <CheckCircle size={14} className="text-mi-cyan shrink-0" />
                  {t(`certmgr.${k}`)}
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Lifecycle stages */}
        <div className="space-y-8">
          <motion.div {...fade(0.1)} className="space-y-2">
            <h2 className="text-2xl font-bold">{t('certmgr.lifecycle_title')}</h2>
            <p className="text-slate-400 leading-relaxed max-w-3xl">{t('certmgr.lifecycle_subtitle')}</p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {STAGES.map((s, i) => {
              const Icon = s.icon
              return (
                <motion.div
                  key={s.key}
                  initial={{ opacity: 0, y: 16 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.4, delay: 0.12 + i * 0.06 }}
                  className={`rounded-xl border ${s.border} ${s.bg} p-5 space-y-3`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.bg} border ${s.border}`}>
                      <Icon size={16} className={s.color} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-mono font-bold ${s.color} opacity-60`}>{String(i + 1).padStart(2, '0')}</span>
                      <span className={`text-sm font-bold ${s.color}`}>{t(`certmgr.stage_${s.key}`)}</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{t(`certmgr.stage_${s.key}_desc`)}</p>
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Best Practices */}
        <div className="space-y-8">
          <motion.div {...fade(0.2)} className="space-y-2">
            <h2 className="text-2xl font-bold">{t('certmgr.practices_title')}</h2>
            <p className="text-slate-400 leading-relaxed max-w-3xl">{t('certmgr.practices_subtitle')}</p>
          </motion.div>

          <div className="space-y-3">
            {PRACTICES.map((p, i) => {
              const Icon = p.icon
              return (
                <motion.div
                  key={p.key}
                  initial={{ opacity: 0, x: -16 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.4, delay: 0.22 + i * 0.05 }}
                  className="section-card flex items-start gap-4"
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-bg-muted border border-border`}>
                    <Icon size={16} className={p.color} />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white text-sm">{t(`certmgr.practice_${p.key}`)}</span>
                      <span className={`font-mono text-[10px] ${p.color} bg-bg-muted px-1.5 py-0.5 rounded border border-border`}>
                        {t(`certmgr.${p.nistKey}`)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{t(`certmgr.practice_${p.key}_desc`)}</p>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Automation Tools */}
        <div className="space-y-8">
          <motion.div {...fade(0.3)} className="space-y-2">
            <h2 className="text-2xl font-bold">{t('certmgr.tools_title')}</h2>
            <p className="text-slate-400 leading-relaxed max-w-3xl">{t('certmgr.tools_subtitle')}</p>
          </motion.div>

          <div className="grid sm:grid-cols-2 gap-4">
            {TOOLS.map((tool, i) => (
              <motion.div
                key={tool.key}
                initial={{ opacity: 0, y: 16 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: 0.32 + i * 0.07 }}
                className={`rounded-xl border ${tool.border} ${tool.bg} p-5 space-y-3`}
              >
                <div className="flex items-center gap-3">
                  <span className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded border ${tool.border} ${tool.color}`}>
                    {tool.badge}
                  </span>
                  <span className="font-bold text-white text-sm">{tool.name}</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{t(`certmgr.tool_${tool.key}`)}</p>
                {tool.key === 'venafi' && (
                  <a
                    href="https://latamlab.venafi.cloud"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1.5 text-xs ${tool.color} hover:opacity-80 transition-opacity font-semibold`}
                  >
                    {t('certmgr.venafi_cta')} <ExternalLink size={11} />
                  </a>
                )}
              </motion.div>
            ))}
          </div>
        </div>

        {/* Common Mistakes */}
        <div className="space-y-8">
          <motion.div {...fade(0.4)} className="space-y-2">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <AlertTriangle size={22} className="text-mi-gold" /> {t('certmgr.pitfalls_title')}
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 gap-4">
            {PITFALLS.map((p, i) => (
              <motion.div
                key={p}
                initial={{ opacity: 0, y: 12 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.4, delay: 0.42 + i * 0.06 }}
                className="section-card border-mi-red/10 bg-mi-red/5 space-y-2"
              >
                <div className="flex items-center gap-2">
                  <XCircle size={14} className="text-mi-red shrink-0" />
                  <span className="font-semibold text-white text-sm">{t(`certmgr.pitfall_${p}_title`)}</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed pl-5">{t(`certmgr.pitfall_${p}_desc`)}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bottom Venafi CTA */}
        <motion.div {...fade(0.5)}>
          <div className="rounded-2xl border border-pki/30 bg-gradient-to-br from-pki/5 to-bg-card p-8 text-center space-y-4">
            <p className="text-slate-400 text-sm">{t('certmgr.cta_label')}</p>
            <h3 className="text-xl font-bold text-white">{t('certmgr.cta_title')}</h3>
            <a
              href="https://latamlab.venafi.cloud"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-pki text-white font-bold text-sm hover:bg-pki/80 transition-colors"
            >
              latamlab.venafi.cloud <ExternalLink size={14} />
            </a>
          </div>
        </motion.div>

      </div>
    </div>
  )
}
