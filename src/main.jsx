import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@material-symbols/font-400/outlined.css'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
