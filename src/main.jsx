import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { SharedRankingView } from './components/SharedRankingView.jsx'

// A shared link (#220) is gated on a `?share=<slug>` query param rather
// than a dedicated path, so it needs no server-side routing/rewrite support
// from GitHub Pages — opening it renders the standalone public view instead
// of the authenticated app entirely, skipping the bearer-token pool fetch.
const shareSlug = new URLSearchParams(window.location.search).get('share')

createRoot(document.getElementById('root')).render(
  <StrictMode>{shareSlug ? <SharedRankingView slug={shareSlug} /> : <App />}</StrictMode>,
)
