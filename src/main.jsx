import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from './context/AuthContext.jsx'
import { MembershipProvider } from './context/MembershipContext.jsx'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <MembershipProvider><App /></MembershipProvider>
    </AuthProvider>
  </StrictMode>,
)
