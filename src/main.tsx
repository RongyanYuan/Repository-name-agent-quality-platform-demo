import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { QualityProvider } from './store'
import './styles.css'

const root = document.getElementById('root')

if (!root) throw new Error('Root element #root was not found')

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <QualityProvider>
        <App />
      </QualityProvider>
    </BrowserRouter>
  </StrictMode>
)

