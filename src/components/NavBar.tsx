import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Shield, ChevronDown, Menu, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const LANGS = ['en', 'pt', 'es'] as const

interface DropItem {
  to: string
  labelKey: string
  subKey: string
  color?: string
}

const CONCEPTS: DropItem[] = [
  { to: '/what-is',   labelKey: 'nav.whatismi',   subKey: 'nav.whatismi_sub',   color: 'text-mi-cyan'  },
  { to: '/threats',   labelKey: 'nav.threats',    subKey: 'nav.threats_sub',    color: 'text-mi-red'   },
  { to: '/zero-trust',labelKey: 'nav.zerotrust',  subKey: 'nav.zerotrust_sub',  color: 'text-spiffe'   },
]

const TECHNOLOGIES: DropItem[] = [
  { to: '/certificates', labelKey: 'nav.certificates', subKey: 'nav.certificates_sub', color: 'text-pki'     },
  { to: '/spiffe',       labelKey: 'nav.spiffe',        subKey: 'nav.spiffe_sub',        color: 'text-mi-gold' },
  { to: '/mtls',         labelKey: 'nav.mtls',          subKey: 'nav.mtls_sub',          color: 'text-mtls'    },
  { to: '/kubernetes',   labelKey: 'nav.kubernetes',    subKey: 'nav.kubernetes_sub',    color: 'text-k8s'     },
]

const TOOLS: DropItem[] = [
  { to: '/flow',    labelKey: 'nav.flow',    subKey: 'nav.flow_sub',    color: 'text-mi-gold' },
  { to: '/compare', labelKey: 'nav.compare', subKey: 'nav.compare_sub', color: 'text-mi-cyan' },
]

const dropVariants = {
  hidden:  { opacity: 0, y: -6, scale: 0.97 },
  visible: { opacity: 1, y: 0,  scale: 1    },
}

function DropdownMenu({ items }: { items: DropItem[] }) {
  const { t } = useTranslation()
  const location = useLocation()
  const isActive = (to: string) => location.pathname === to
  return (
    <>
      {items.map(item => (
        <Link
          key={item.to}
          to={item.to}
          className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/5 ${isActive(item.to) ? 'bg-white/5' : ''}`}
        >
          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${item.color?.replace('text-', 'bg-') ?? 'bg-slate-500'}`} />
          <div className="min-w-0">
            <div className={`text-sm font-semibold ${isActive(item.to) ? (item.color ?? 'text-mi-cyan') : 'text-slate-200'}`}>
              {t(item.labelKey)}
            </div>
            <div className="text-xs text-slate-500 mt-0.5 truncate">{t(item.subKey)}</div>
          </div>
        </Link>
      ))}
    </>
  )
}

export default function NavBar() {
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const navRef = useRef<HTMLElement>(null)
  const current = LANGS.find(l => i18n.language.startsWith(l)) ?? 'en'

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    setOpenMenu(null)
    setMobileOpen(false)
  }, [location.pathname])

  const toggle = (key: string) => setOpenMenu(prev => (prev === key ? null : key))
  const isActive = (to: string) => location.pathname === to

  const desktopMenuBtn = (key: string, items: DropItem[], label: string) => (
    <div className="relative">
      <button
        onClick={() => toggle(key)}
        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ${
          openMenu === key || items.some(p => isActive(p.to))
            ? 'text-white bg-white/5'
            : 'text-slate-400 hover:text-white hover:bg-white/5'
        }`}
      >
        {label}
        <ChevronDown size={13} className={`transition-transform ${openMenu === key ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {openMenu === key && (
          <motion.div
            variants={dropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute top-full left-0 mt-2 w-72 bg-bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
          >
            <DropdownMenu items={items} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )

  return (
    <nav
      ref={navRef}
      className="fixed top-0 inset-x-0 z-50 bg-bg/90 backdrop-blur border-b border-border"
    >
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">

        <Link to="/" className="flex items-center gap-2 text-mi-cyan font-semibold shrink-0">
          <Shield size={18} />
          <span className="hidden sm:block text-sm font-bold leading-tight">
            Machine Identity <span className="text-slate-400 font-normal">| Security</span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-1 text-sm">
          {desktopMenuBtn('concepts',     CONCEPTS,     t('nav.concepts'))}
          {desktopMenuBtn('technologies', TECHNOLOGIES, t('nav.technologies'))}
          {desktopMenuBtn('tools',        TOOLS,        t('nav.tools'))}
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1">
            {LANGS.map(lang => (
              <button
                key={lang}
                onClick={() => i18n.changeLanguage(lang)}
                className={`px-2 py-0.5 rounded text-xs font-semibold transition-colors ${
                  current === lang
                    ? 'bg-mi-cyan/20 text-mi-cyan border border-mi-cyan/30'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            onClick={() => setMobileOpen(prev => !prev)}
            className="md:hidden p-1.5 text-slate-400 hover:text-white transition-colors"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="md:hidden overflow-hidden border-t border-border bg-bg"
          >
            <div className="px-4 py-4 space-y-1">
              {[
                { label: t('nav.concepts'),     items: CONCEPTS     },
                { label: t('nav.technologies'), items: TECHNOLOGIES },
                { label: t('nav.tools'),        items: TOOLS        },
              ].map(group => (
                <div key={group.label}>
                  <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest px-2 pb-1 pt-3">
                    {group.label}
                  </p>
                  {group.items.map(item => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive(item.to) ? 'bg-white/5' : 'hover:bg-white/5'}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${item.color?.replace('text-', 'bg-') ?? 'bg-slate-500'}`} />
                      <span className={`text-sm font-medium ${isActive(item.to) ? item.color : 'text-slate-300'}`}>
                        {t(item.labelKey)}
                      </span>
                    </Link>
                  ))}
                </div>
              ))}

              <div className="flex items-center gap-2 px-2 pt-3">
                {LANGS.map(lang => (
                  <button
                    key={lang}
                    onClick={() => i18n.changeLanguage(lang)}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                      current === lang
                        ? 'bg-mi-cyan/20 text-mi-cyan border border-mi-cyan/30'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {lang.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}
