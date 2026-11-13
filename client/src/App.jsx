import React, { Suspense } from 'react'
import { Route, Routes, Navigate } from 'react-router-dom'
import { AuthLayout, GuestLayout } from './pages/Layout'
import AuthPage from './pages/AuthPage'
import HomePage from './pages/HomePage'
import { Toaster } from 'react-hot-toast'

const BuilderPage = React.lazy(() => import('./pages/BuilderPage'))
const PreviewPage = React.lazy(() => import('./pages/PreviewPage'))
const PublishPage = React.lazy(() => import('./pages/PublishPage'))

const RouteFallback = () => (
  <div
    role="status"
    aria-label="Loading page"
    className="flex min-h-screen w-full items-center justify-center bg-canvas"
  >
    <div className="h-5 w-5 rounded-full border border-white/10 border-t-white/90 animate-spin" />
  </div>
)

const App = () => {
  return (
    <div className="min-h-screen bg-canvas text-ink font-sans antialiased">
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 3500,
          style: {
            background: 'rgba(17, 17, 17, 0.85)',
            color: '#fafafa',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            fontSize: '13px',
            letterSpacing: '-0.01em',
            padding: '10px 14px',
            borderRadius: '8px',
            boxShadow: 'none',
          },
          success: {
            iconTheme: {
              primary: '#fafafa',
              secondary: '#050505',
            },
          },
          error: {
            iconTheme: {
              primary: '#fafafa',
              secondary: '#050505',
            },
          },
        }}
      />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Login Routes */}
          <Route element={<GuestLayout />}>
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/register" element={<AuthPage mode="register" />} />
          </Route>

          {/* Protected Routes */}
          <Route element={<AuthLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/builder/:id" element={<BuilderPage />} />
            <Route path="/preview/:id" element={<PreviewPage />} />
          </Route>

          {/* Public routes */}
          <Route path="/publish/:id" element={<PublishPage />} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </div>
  )
}

export default App