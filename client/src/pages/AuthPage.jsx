import React, { useState } from 'react'
import LoginLeft from '../components/LoginLeft'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertCircleIcon,
  ArrowRightIcon,
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  Loader2Icon,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAppContext } from '../context/useAppContext'

const formContainerVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.985 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 260,
      damping: 26,
      staggerChildren: 0.06,
    },
  },
}

const fieldVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 26,
    },
  },
}

const AuthPage = ({ mode }) => {
  const { login, register } = useAppContext()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState('')
  const [focusedField, setFocusedField] = useState(null)

  const isLogin = mode === 'login'

  const isNameValid = name.trim().length >= 2
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const isPasswordValid = password.length >= 6

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode == 'login') {
        await login(email, password)
      } else {
        await register(name, email, password)
      }
      navigate('/')
    } catch (err) {
      setError(
        err.message ||
          (mode === 'login' ? 'Invalid email or password' : 'Registration failed')
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full bg-canvas text-ink">
      {/* Left Panel - Asymmetrical Branding & Visual */}
      <LoginLeft />

      {/* Right Panel - Centered Auth Form */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-12 sm:px-12">
        {/* Mobile Brand Header */}
        <div className="mb-10 flex items-center gap-2.5 lg:hidden">
          <div className="flex size-8 items-center justify-center rounded-lg border border-hairline bg-surface-elevated">
            <img src="/logo.svg" alt="Builder AI" className="size-4 invert" />
          </div>
          <span className="font-display text-base font-medium tracking-tight text-ink">
            Builder AI
          </span>
        </div>

        <motion.div
          key={mode}
          variants={formContainerVariants}
          initial="hidden"
          animate="visible"
          className="w-full max-w-[380px]"
        >
          {/* Header */}
          <motion.div variants={fieldVariants} className="mb-8">
            <h1 className="font-display text-3xl font-medium tracking-tight text-ink">
              {isLogin ? 'Sign in' : 'Create an account'}
            </h1>
            <p className="mt-2 text-sm text-ink-secondary">
              {isLogin
                ? 'Enter your credentials to access your workspace.'
                : 'Get started in seconds with your workspace details.'}
            </p>
          </motion.div>

          {/* Error Banner */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="auth-error"
                initial={{ opacity: 0, y: -6, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -6, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mb-6 overflow-hidden"
              >
                <div className="flex items-start gap-2.5 rounded-lg border border-white/15 bg-surface-elevated px-3.5 py-3 text-xs text-ink">
                  <AlertCircleIcon
                    size={15}
                    className="mt-0.5 text-ink-secondary"
                  />
                  <span>{error}</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
          <form className="space-y-5" onSubmit={handleSubmit}>
            <AnimatePresence initial={false}>
              {!isLogin && (
                <motion.div
                  key="name-field"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="space-y-2 pb-0.5">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="auth-name"
                        className="text-xs font-medium text-ink-secondary"
                      >
                        Full name
                      </label>
                      {isNameValid && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="flex items-center gap-1 font-mono text-[10px] text-ink-secondary"
                        >
                          <CheckIcon size={11} className="text-ink" />
                        </motion.span>
                      )}
                    </div>
                    <motion.div
                      whileHover={{ y: -0.5 }}
                      transition={{ duration: 0.15 }}
                      className={`group relative rounded-lg border bg-surface transition-colors duration-200 ${
                        focusedField === 'name'
                          ? 'border-white/35 bg-surface-elevated'
                          : 'border-hairline hover:border-hairline-strong'
                      }`}
                    >
                      <input
                        id="auth-name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onFocus={() => setFocusedField('name')}
                        onBlur={() => setFocusedField(null)}
                        required
                        autoComplete="name"
                        className="w-full bg-transparent px-3.5 py-2.5 text-sm text-ink placeholder-ink-subtle focus:outline-none"
                        placeholder="John Doe"
                      />
                    </motion.div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email Field */}
            <motion.div variants={fieldVariants} className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="auth-email"
                  className="text-xs font-medium text-ink-secondary"
                >
                  Email address
                </label>
                {isEmailValid && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-1 font-mono text-[10px] text-ink-secondary"
                  >
                    <CheckIcon size={11} className="text-ink" />
                  </motion.span>
                )}
              </div>
              <motion.div
                whileHover={{ y: -0.5 }}
                transition={{ duration: 0.15 }}
                className={`group relative rounded-lg border bg-surface transition-colors duration-200 ${
                  focusedField === 'email'
                    ? 'border-white/35 bg-surface-elevated'
                    : 'border-hairline hover:border-hairline-strong'
                }`}
              >
                <input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  required
                  autoComplete="email"
                  className="w-full bg-transparent px-3.5 py-2.5 text-sm text-ink placeholder-ink-subtle focus:outline-none"
                  placeholder="you@example.com"
                />
              </motion.div>
            </motion.div>

            {/* Password Field */}
            <motion.div variants={fieldVariants} className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="auth-password"
                  className="text-xs font-medium text-ink-secondary"
                >
                  Password
                </label>
                {!isLogin && password.length > 0 && (
                  <span className="font-mono text-[10px] text-ink-muted">
                    {isPasswordValid ? 'Strong' : `${password.length}/6+ chars`}
                  </span>
                )}
              </div>
              <motion.div
                whileHover={{ y: -0.5 }}
                transition={{ duration: 0.15 }}
                className={`group relative flex items-center rounded-lg border bg-surface transition-colors duration-200 ${
                  focusedField === 'password'
                    ? 'border-white/35 bg-surface-elevated'
                    : 'border-hairline hover:border-hairline-strong'
                }`}
              >
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  required
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  className="w-full bg-transparent py-2.5 pl-3.5 pr-10 text-sm text-ink placeholder-ink-subtle focus:outline-none"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 flex size-7 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink cursor-pointer"
                >
                  {showPassword ? <EyeOffIcon size={15} /> : <EyeIcon size={15} />}
                </button>
              </motion.div>
            </motion.div>

            {/* Submit Button */}
            <motion.div variants={fieldVariants} className="pt-2">
              <motion.button
                type="submit"
                disabled={loading}
                whileHover={loading ? {} : { scale: 1.008 }}
                whileTap={loading ? {} : { scale: 0.985 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="group relative flex w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-canvas transition-colors hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {loading ? (
                    <motion.span
                      key="loading"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="flex items-center gap-2"
                    >
                      <Loader2Icon size={15} className="animate-spin" />
                      <span>
                        {isLogin ? 'Signing in...' : 'Creating account...'}
                      </span>
                    </motion.span>
                  ) : (
                    <motion.span
                      key="idle"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="flex items-center gap-2"
                    >
                      <span>{isLogin ? 'Sign in' : 'Create account'}</span>
                      <ArrowRightIcon
                        size={15}
                        className="transition-transform duration-200 group-hover:translate-x-0.5"
                      />
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            </motion.div>
          </form>

          {/* Footer Switch */}
          <motion.p
            variants={fieldVariants}
            className="mt-8 border-t border-hairline pt-6 text-center text-xs text-ink-muted"
          >
            {isLogin ? (
              <>
                New to Builder AI?{' '}
                <Link
                  to="/register"
                  className="font-medium text-ink transition-colors hover:text-ink-secondary"
                >
                  Create an account
                </Link>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <Link
                  to="/login"
                  className="font-medium text-ink transition-colors hover:text-ink-secondary"
                >
                  Sign in here
                </Link>
              </>
            )}
          </motion.p>
        </motion.div>
      </div>
    </div>
  )
}

export default AuthPage
