import { useTranslation } from 'react-i18next'
import { ExternalLink, Github, Shield } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Footer() {
  const { t } = useTranslation()

  return (
    <footer className="py-12 px-6 border-t border-border bg-bg-card/50">
      <div className="max-w-6xl mx-auto">
        <div className="grid sm:grid-cols-3 gap-8 mb-8">

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Shield size={18} className="text-mi-cyan" />
              <span className="font-bold text-white text-sm">Machine Identity</span>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">{t('footer.desc')}</p>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('footer.concepts')}</p>
            <ul className="space-y-2">
              {[
                { to: '/what-is',    label: 'What is Machine Identity', color: 'hover:text-mi-cyan'  },
                { to: '/threats',    label: 'Threat Landscape',          color: 'hover:text-mi-red'   },
                { to: '/spiffe',     label: 'SPIFFE / SPIRE',            color: 'hover:text-mi-gold'  },
                { to: '/mtls',       label: 'Mutual TLS',                color: 'hover:text-mtls'     },
                { to: '/zero-trust', label: 'Zero Trust',                color: 'hover:text-spiffe'   },
                { to: '/kubernetes', label: 'Kubernetes Identity',       color: 'hover:text-k8s'      },
              ].map(item => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={`text-xs text-slate-400 ${item.color} transition-colors flex items-center gap-1.5`}
                  >
                    <span className="w-1 h-1 rounded-full bg-current opacity-60 shrink-0" />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('footer.resources')}</p>
            <ul className="space-y-2">
              <li>
                <a href="https://spiffe.io/docs/" target="_blank" rel="noopener"
                  className="text-xs text-slate-400 hover:text-mi-cyan transition-colors flex items-center gap-1.5">
                  <ExternalLink size={10} /> {t('footer.spiffe_docs')}
                </a>
              </li>
              <li>
                <a href="https://github.com/spiffe/spire" target="_blank" rel="noopener"
                  className="text-xs text-slate-400 hover:text-mi-cyan transition-colors flex items-center gap-1.5">
                  <Github size={10} /> {t('footer.cncf')}
                </a>
              </li>
              <li>
                <a href="https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-207.pdf" target="_blank" rel="noopener"
                  className="text-xs text-slate-400 hover:text-mi-gold transition-colors flex items-center gap-1.5">
                  <ExternalLink size={10} /> {t('footer.nist_zt')}
                </a>
              </li>
              <li>
                <a href="https://github.com/aslancarlos/machine-identity-explainer" target="_blank" rel="noopener"
                  className="text-xs text-slate-400 hover:text-mi-cyan transition-colors flex items-center gap-1.5">
                  <Github size={10} /> {t('footer.github')}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-600">{t('footer.copyright')}</p>
          <p className="text-xs text-slate-600">
            {t('footer.built_with')}{' '}
            <span className="text-mi-gold">SPIFFE</span>{' '}
            <span className="text-slate-600">·</span>{' '}
            <span className="text-pki">X.509</span>{' '}
            <span className="text-slate-600">·</span>{' '}
            <span className="text-mi-cyan">Zero Trust</span>
          </p>
        </div>
      </div>
    </footer>
  )
}
