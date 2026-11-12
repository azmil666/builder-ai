import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAppContext } from '../context/useAppContext'
import Loading from '../components/Loading'

const BaseShell = ({ children }) => {
  return (
    <div className="relative min-h-screen w-full bg-canvas text-ink font-sans antialiased selection:bg-ink selection:text-canvas">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(255,255,255,0.035),transparent)]"
      />
      <div className="relative z-10 flex min-h-screen w-full flex-col">
        {children}
      </div>
    </div>
  )
}

export function AuthLayout() {
  const { user, loadingUser } = useAppContext()

  if (loadingUser) return <Loading />
  if (!user) return <Navigate to="/login" replace />

  return (
    <BaseShell>
      <Outlet />
    </BaseShell>
  )
}

export function GuestLayout() {
  const { user, loadingUser } = useAppContext()

  if (loadingUser) return <Loading />
  if (user) return <Navigate to="/" replace />

  return (
    <BaseShell>
      <Outlet />
    </BaseShell>
  )
}
