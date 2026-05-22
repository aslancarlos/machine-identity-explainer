import { BrowserRouter as Router, Routes, Route, Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import NavBar from './components/NavBar'
import Footer from './components/Footer'
import HomePage from './pages/HomePage'
import WhatIsPage from './pages/WhatIsPage'
import ThreatPage from './pages/ThreatPage'
import SpiffePage from './pages/SpiffePage'
import MtlsPage from './pages/MtlsPage'
import CertificatesPage from './pages/CertificatesPage'
import ZeroTrustPage from './pages/ZeroTrustPage'
import KubernetesPage from './pages/KubernetesPage'
import FlowPage from './pages/FlowPage'
import ComparePage from './pages/ComparePage'
import CertInfoPage from './pages/CertInfoPage'
import TLSScanPage from './pages/TLSScanPage'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-bg text-white">
      <NavBar />
      <main className="flex-1 pt-14">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

export default function App() {
  return (
    <Router>
      <ScrollToTop />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/"            element={<HomePage />}      />
          <Route path="/what-is"     element={<WhatIsPage />}    />
          <Route path="/threats"     element={<ThreatPage />}    />
          <Route path="/spiffe"      element={<SpiffePage />}    />
          <Route path="/mtls"        element={<MtlsPage />}      />
          <Route path="/certificates"element={<CertificatesPage />} />
          <Route path="/zero-trust"  element={<ZeroTrustPage />} />
          <Route path="/kubernetes"  element={<KubernetesPage />}/>
          <Route path="/flow"        element={<FlowPage />}      />
          <Route path="/compare"     element={<ComparePage />}   />
          <Route path="/cert-info"   element={<CertInfoPage />}  />
          <Route path="/tls-scan"    element={<TLSScanPage />}   />
        </Route>
      </Routes>
    </Router>
  )
}
