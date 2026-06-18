import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Play, Pause, RotateCcw } from 'lucide-react'

type CK = 'cyan' | 'gold' | 'spiffe' | 'pki' | 'k8s' | 'slate'

const C: Record<CK, { stroke: string; text: string; border: string; bg: string }> = {
  cyan:   { stroke: '#00d9ff', text: '#67e8f9', border: 'rgba(0,217,255,0.4)',    bg: 'rgba(0,217,255,0.10)'   },
  gold:   { stroke: '#f59e0b', text: '#fcd34d', border: 'rgba(245,158,11,0.4)',   bg: 'rgba(245,158,11,0.08)'  },
  spiffe: { stroke: '#10b981', text: '#6ee7b7', border: 'rgba(16,185,129,0.4)',   bg: 'rgba(16,185,129,0.10)'  },
  pki:    { stroke: '#7b5cf6', text: '#a78bfa', border: 'rgba(123,92,246,0.4)',   bg: 'rgba(123,92,246,0.10)'  },
  k8s:    { stroke: '#1f6feb', text: '#60a5fa', border: 'rgba(31,111,235,0.4)',   bg: 'rgba(31,111,235,0.10)'  },
  slate:  { stroke: '#64748b', text: '#94a3b8', border: 'rgba(100,116,139,0.35)', bg: 'rgba(15,30,48,0.7)'     },
}

interface N { id: string; x: number; y: number; w: number; h: number; label: string; sub: string; ck: CK; feat?: boolean; external?: boolean }
interface E { id: string; d: string; ck: CK; tag?: string; lx?: number; ly?: number }

// ViewBox: 820 × 460
// Cluster boundary: x=8,y=8 → x=510,y=345
// Nodes
const NODES: N[] = [
  { id:'workload', x:28,  y:50,  w:198, h:62,  label:'App Workload',      sub:'Spring Boot · .NET · Go',                     ck:'cyan'             },
  { id:'agent',    x:28,  y:165, w:198, h:58,  label:'SPIRE Agent',       sub:'DaemonSet · Workload API',                    ck:'gold'             },
  { id:'k8sapi',   x:308, y:118, w:168, h:62,  label:'K8s API Server',    sub:'Pod identity validation',                     ck:'slate'            },
  { id:'server',   x:568, y:55,  w:232, h:96,  label:'SPIRE Server',      sub:'spiffe://trust-domain',                       ck:'gold', feat:true   },
  { id:'ca',       x:568, y:210, w:190, h:62,  label:'Certificate Auth.', sub:'X.509 SVID signing',                          ck:'pki'              },
  { id:'serviceb', x:308, y:255, w:168, h:62,  label:'Service B',         sub:'mTLS target workload',                        ck:'spiffe'           },
  { id:'external', x:300, y:388, w:186, h:62,  label:'Secret Store',      sub:'Conjur / ASM',                                ck:'slate', external:true },
]

// Edges
const EDGES: E[] = [
  // Step 1 — K8s projects JWT; Agent detects workload via Workload API
  { id:'wa-api',   d:'M 127,112 L 127,165',                          ck:'gold',   tag:'Workload API', lx:148, ly:141 },
  // Step 2 — Agent attests to SPIRE Server
  { id:'attest',   d:'M 226,185 C 396,185 396,130 568,130',          ck:'gold',   tag:'attest',       lx:382, ly:153 },
  // Step 3a — Server validates with K8s API
  { id:'srv-k8s',  d:'M 568,88  C 520,88  476,130 476,149',          ck:'gold',   tag:'validate',     lx:521, ly:106 },
  // Step 3b — K8s confirms
  { id:'k8s-srv',  d:'M 476,162 C 520,170 568,115 568,115',          ck:'slate',  tag:'✓ ok',         lx:521, ly:146 },
  // Step 4 — SPIRE Server → CA → sign SVID
  { id:'srv-ca',   d:'M 663,151 L 663,210',                          ck:'pki',    tag:'sign CSR',     lx:676, ly:184 },
  // Step 4b — CA returns signed SVID to Server → Agent → Workload
  { id:'svid',     d:'M 568,75  C 396,75  226,73  226,73',           ck:'cyan',   tag:'X.509 SVID',   lx:382, ly:62  },
  // Step 5 — Workload → mTLS to Service B
  { id:'mtls',     d:'M 218,88  C 280,88  308,200 308,286',          ck:'spiffe', tag:'mTLS',         lx:256, ly:156 },
  // Step 6 — Service B validates against trust bundle
  { id:'verify',   d:'M 476,286 C 530,286 568,255 568,255',          ck:'pki',    tag:'verify trust', lx:515, ly:268 },
]

const RAW: { nodes: string[]; edges: string[]; hi: string[] }[] = [
  { nodes:['workload','agent'],  edges:['wa-api'],                          hi:['workload','agent','wa-api']                              },
  { nodes:['server'],             edges:['attest'],                          hi:['agent','attest','server']                                },
  { nodes:['k8sapi'],             edges:['srv-k8s','k8s-srv'],              hi:['server','k8sapi','srv-k8s','k8s-srv']                    },
  { nodes:['ca'],                 edges:['srv-ca','svid'],                  hi:['server','ca','srv-ca','svid','workload']                  },
  { nodes:['serviceb'],           edges:['mtls'],                           hi:['workload','serviceb','mtls']                             },
  { nodes:[],                     edges:['verify'],                         hi:['serviceb','ca','verify','pki']                           },
  { nodes:['external'],           edges:[],                                 hi:['workload','agent','attest','server','ca','srv-ca','svid','serviceb','mtls','verify','external'] },
]

const CUM = RAW.reduce<{ nodes: Set<string>; edges: Set<string> }[]>((acc, s) => {
  const prev = acc[acc.length - 1] ?? { nodes: new Set<string>(), edges: new Set<string>() }
  acc.push({ nodes: new Set([...prev.nodes, ...s.nodes]), edges: new Set([...prev.edges, ...s.edges]) })
  return acc
}, [])

const TOTAL  = RAW.length
const AUTO_MS = 4000

export default function ArchitectureDiagram() {
  const { t } = useTranslation()
  const [step, setStep]       = useState(0)
  const [playing, setPlaying] = useState(true)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const go = useCallback((d: 1 | -1) =>
    setStep(s => Math.max(0, Math.min(TOTAL - 1, s + d))), [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') { go(1);  setPlaying(false) }
      if (e.key === 'ArrowLeft')  { go(-1); setPlaying(false) }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [go])

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (!playing) return
    timerRef.current = setInterval(() => {
      setStep(s => {
        if (s >= TOTAL - 1) { setPlaying(false); return s }
        return s + 1
      })
    }, AUTO_MS)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [playing])

  const vis  = CUM[step]
  const hi   = new Set(RAW[step].hi)

  const titles = t('architecture.step_titles', { returnObjects: true }) as string[]
  const descs  = t('architecture.flow',        { returnObjects: true }) as string[]

  const handlePlayPause = () => {
    if (playing) {
      setPlaying(false)
    } else {
      if (step >= TOTAL - 1) setStep(0)
      setPlaying(true)
    }
  }

  function node(n: N) {
    const visible = vis.nodes.has(n.id) || n.id === 'workload' || n.id === 'agent'
    const highlighted = hi.has(n.id)
    const col = C[n.ck]

    const alpha = visible ? (highlighted ? 1 : 0.35) : 0
    const borderA = highlighted ? col.border : `rgba(26,48,80,${visible ? 0.8 : 0})`

    return (
      <g key={n.id} style={{ transition: 'opacity 0.5s', opacity: alpha }}>
        {n.feat && (
          <rect x={n.x - 4} y={n.y - 4} width={n.w + 8} height={n.h + 8}
            rx={14} ry={14}
            fill="none" stroke={col.stroke} strokeWidth={1.5} strokeDasharray="6 3"
            style={{ opacity: highlighted ? 0.5 : 0.2 }}
          />
        )}
        {n.external && (
          <rect x={n.x - 4} y={n.y - 4} width={n.w + 8} height={n.h + 8}
            rx={10} ry={10}
            fill="none" stroke="#64748b" strokeWidth={1} strokeDasharray="4 4" opacity={0.4}
          />
        )}
        <rect x={n.x} y={n.y} width={n.w} height={n.h}
          rx={10} ry={10}
          fill={highlighted ? col.bg : 'rgba(12,24,40,0.8)'}
          stroke={borderA} strokeWidth={highlighted ? 1.5 : 1}
          style={{ transition: 'fill 0.4s, stroke 0.4s' }}
        />
        <text x={n.x + n.w / 2} y={n.y + 22} textAnchor="middle"
          fill={highlighted ? col.text : '#94a3b8'} fontSize={13} fontWeight={600}
          fontFamily="Inter, system-ui, sans-serif"
          style={{ transition: 'fill 0.4s' }}
        >
          {n.label}
        </text>
        <text x={n.x + n.w / 2} y={n.y + 40} textAnchor="middle"
          fill="#475569" fontSize={10} fontFamily="JetBrains Mono, monospace"
        >
          {n.sub}
        </text>
      </g>
    )
  }

  function edge(e: E) {
    const visible = vis.edges.has(e.id)
    const highlighted = hi.has(e.id)
    const col = C[e.ck]
    if (!visible) return null

    return (
      <g key={e.id} style={{ transition: 'opacity 0.5s', opacity: highlighted ? 1 : 0.25 }}>
        <defs>
          <marker id={`arr-${e.id}`} markerWidth={6} markerHeight={6} refX={5} refY={3} orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill={col.stroke} />
          </marker>
        </defs>
        <path d={e.d} fill="none" stroke={col.stroke} strokeWidth={highlighted ? 2 : 1.5}
          strokeDasharray={highlighted ? '6 3' : '4 4'}
          markerEnd={`url(#arr-${e.id})`}
          style={{ transition: 'stroke-width 0.3s, opacity 0.3s' }}
        />
        {e.tag && e.lx !== undefined && e.ly !== undefined && (
          <g>
            <rect x={e.lx - 2} y={e.ly - 9} width={e.tag.length * 6.5 + 4} height={14}
              rx={4} fill="rgba(5,13,26,0.85)" />
            <text x={e.lx} y={e.ly} fill={col.text} fontSize={9}
              fontFamily="JetBrains Mono, monospace" fontWeight={500}>
              {e.tag}
            </text>
          </g>
        )}
      </g>
    )
  }

  return (
    <section id="architecture" className="py-24 px-6 bg-bg-muted/40">
      <div className="max-w-5xl mx-auto space-y-10">

        <div className="text-center space-y-3">
          <span className="badge bg-mi-gold/10 text-mi-gold border border-mi-gold/20">
            {t('architecture.badge')}
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold">{t('architecture.title')}</h2>
        </div>

        <div className="rounded-2xl border border-border bg-bg-card overflow-hidden">

          {/* Step header */}
          <div className="border-b border-border px-5 py-3.5 flex items-center gap-3">
            <AnimatePresence mode="wait">
              <motion.div key={step}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}
                className="flex-1 min-w-0"
              >
                <p className="text-[10px] font-mono text-mi-gold/60 mb-0.5">
                  {t('architecture.step_of', { current: step + 1, total: TOTAL })}
                </p>
                <p className="text-sm font-semibold text-white leading-snug">{titles[step]}</p>
              </motion.div>
            </AnimatePresence>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button onClick={handlePlayPause}
                className="p-1.5 rounded-lg border border-border text-slate-400 hover:text-mi-gold hover:border-mi-gold/40 transition-colors"
                aria-label={playing ? 'Pause' : 'Play'}>
                {playing ? <Pause size={13} /> : <Play size={13} />}
              </button>
              <button onClick={() => { go(-1); setPlaying(false) }} disabled={step === 0}
                className="p-1.5 rounded-lg border border-border text-slate-400 hover:text-white hover:border-slate-500 disabled:opacity-25 disabled:cursor-not-allowed transition-colors">
                <ChevronLeft size={15} />
              </button>
              <button onClick={() => { go(1); setPlaying(false) }} disabled={step === TOTAL - 1}
                className="p-1.5 rounded-lg border border-border text-slate-400 hover:text-white hover:border-slate-500 disabled:opacity-25 disabled:cursor-not-allowed transition-colors">
                <ChevronRight size={15} />
              </button>
              <button onClick={() => { setStep(0); setPlaying(true) }}
                className="p-1.5 rounded-lg border border-border text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
                aria-label="Restart">
                <RotateCcw size={13} />
              </button>
            </div>
          </div>

          {/* SVG Diagram */}
          <div className="overflow-x-auto">
            <svg viewBox="0 0 820 470" className="w-full min-w-[600px]" style={{ maxHeight: 460 }}>

              {/* Cluster boundary */}
              <rect x={8} y={8} width={502} height={348} rx={16} ry={16}
                fill="none" stroke="#1a3050" strokeWidth={1.5} strokeDasharray="8 4" />
              <text x={20} y={26} fill="#1e3a5f" fontSize={10}
                fontFamily="JetBrains Mono, monospace" fontWeight={500}>
                Kubernetes Cluster
              </text>

              {/* Conjur Cloud label */}
              <rect x={552} y={38} width={260} height={250} rx={14} ry={14}
                fill="none" stroke="#f59e0b" strokeWidth={1} strokeDasharray="6 3" opacity={0.3} />
              <text x={565} y={56} fill="#78350f" fontSize={10}
                fontFamily="JetBrains Mono, monospace" fontWeight={500}>
                SPIRE Infrastructure
              </text>

              {/* Render edges first (behind nodes) */}
              {EDGES.map(edge)}

              {/* Render nodes */}
              {NODES.map(node)}
            </svg>
          </div>

          {/* Progress dots */}
          <div className="border-t border-border px-5 py-3 flex items-center justify-between gap-4">
            <div className="flex gap-1.5">
              {Array.from({ length: TOTAL }).map((_, i) => (
                <button key={i} onClick={() => { setStep(i); setPlaying(false) }}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === step ? 'w-6 bg-mi-gold' : i < step ? 'w-1.5 bg-mi-gold/40' : 'w-1.5 bg-border'
                  }`}
                  aria-label={`Step ${i + 1}`}
                />
              ))}
            </div>
            <p className="text-xs text-slate-500 font-mono hidden sm:block">← → arrow keys</p>
          </div>
        </div>

        {/* Step description */}
        <AnimatePresence mode="wait">
          <motion.div key={step}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}
            className="section-card max-w-3xl mx-auto"
          >
            <p className="text-sm text-slate-400 leading-relaxed">{descs[step]}</p>
          </motion.div>
        </AnimatePresence>

      </div>
    </section>
  )
}
