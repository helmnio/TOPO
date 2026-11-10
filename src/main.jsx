import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@material-symbols/font-400/outlined.css'
import './index.css'
import { applyTheme } from './theme'
import App from './App.jsx'

applyTheme()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
