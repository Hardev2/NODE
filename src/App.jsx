import { useEffect, useId, useState } from 'react'
import { authMessage, isSupabaseConfigured, returnedAuthError, setRememberPreference, supabase } from './lib/supabase'
import NotesDesk from './notes/NotesDesk'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const primaryButton =
  'node-btn flex w-full cursor-pointer items-center justify-center gap-2 px-4 py-3 font-sans text-sm font-semibold tracking-[0.16em] uppercase transition-colors duration-200 focus-visible:outline-none disabled:cursor-wait disabled:opacity-80'

const fieldClass =
  'node-field w-full px-3.5 py-2.5 text-base transition-colors duration-200 placeholder:text-[#5f8b86] focus-visible:outline-none'

function EyeIcon({ off }) {
  if (off) {
    return (
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M3 3l18 18" strokeLinecap="round" />
        <path d="M10.6 10.6a2 2 0 002.8 2.8" strokeLinecap="round" />
        <path d="M9.9 5.2A10.8 10.8 0 0112 5c5.2 0 8.8 4.2 10 7-0.5 1.2-1.4 2.6-2.6 3.8M6.1 6.7C4.2 8 2.9 9.9 2 12c1.2 2.8 4.8 7 10 7 1.5 0 2.9-.3 4.1-.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  )
}

function FieldError({ id, message }) {
  if (!message) return null
  return (
    <p id={id} className="mt-1.5 font-sans text-sm text-alert" role="alert">
      {message}
    </p>
  )
}

function Spinner({ tone = 'light' }) {
  const border = tone === 'dark' ? 'border-[#134E4A]/30 border-t-[#134E4A]' : 'border-white/40 border-t-white'
  return <span className={`size-4 animate-spin rounded-full border-2 ${border}`} aria-hidden="true" />
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.55-5.17 3.55-8.65z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3c-1.08.72-2.45 1.16-4.06 1.16-3.12 0-5.77-2.11-6.71-4.94H1.29v3.09A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.29 14.31A7.2 7.2 0 0 1 4.91 12c0-.8.14-1.58.38-2.31V6.6H1.29A12 12 0 0 0 0 12c0 1.94.46 3.77 1.29 5.4l4-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.95 1.14 15.24 0 12 0 7.31 0 3.25 2.69 1.29 6.6l4 3.09C6.23 6.86 8.88 4.75 12 4.75z" />
    </svg>
  )
}

function emailError(value) {
  const trimmed = value.trim()
  if (!trimmed) return 'Enter your email address.'
  if (!EMAIL_PATTERN.test(trimmed)) return 'Use a full address, like name@studio.com.'
  return ''
}

function passwordError(value) {
  if (!value) return 'Enter your password.'
  if (value.length < 8) return 'Use at least 8 characters.'
  return ''
}

export default function App() {
  const emailId = useId()
  const passwordId = useId()
  const nextPasswordId = useId()
  const confirmId = useId()
  const rememberId = useId()
  const emailErrorId = useId()
  const passwordErrorId = useId()
  const nextPasswordErrorId = useId()
  const confirmErrorId = useId()
  const noticeId = useId()
  const formErrorId = useId()

  const [email, setEmail] = useState('')
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [nextPassword, setNextPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [mode, setMode] = useState('sign-in')
  const [slide, setSlide] = useState('forward')
  const [switched, setSwitched] = useState(false)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(null)
  const [notice, setNotice] = useState('')
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (mode !== 'signed-in') document.title = 'NODE'
  }, [mode])

  useEffect(() => {
    if (!supabase) {
      setReady(true)
      return
    }

    let recovering = false
    let active = true

    const callbackError = returnedAuthError()

    supabase.auth.getSession().then(({ data }) => {
      if (!active || recovering) return
      const sessionUser = data.session?.user
      if (sessionUser) {
        setEmail(sessionUser.email ?? '')
        setUserId(sessionUser.id)
        setMode('signed-in')
      } else if (callbackError) {
        setFormError(authMessage({ message: callbackError }))
      }
      setReady(true)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        recovering = true
        setEmail(session?.user?.email ?? '')
        setMode('recovery')
        setReady(true)
        return
      }
      if (event === 'SIGNED_IN' && session?.user && !recovering) {
        setEmail(session.user.email ?? '')
        setUserId(session.user.id)
        setPassword('')
        setMode('signed-in')
        setReady(true)
        return
      }
      if (event === 'SIGNED_OUT') {
        setUserId('')
        setMode('sign-in')
        setPassword('')
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  function requireSupabase() {
    if (supabase) return true
    setFormError('Add your Supabase URL and anon key to a .env file, then restart the dev server.')
    return false
  }

  const motionClass = switched ? (slide === 'forward' ? 'node-enter-forward' : 'node-enter-back') : ''

  function openSignIn() {
    if (mode === 'sign-in') return
    setSwitched(true)
    setSlide('back')
    setErrors({})
    setFormError('')
    setNotice('')
    setConfirmPassword('')
    setMode('sign-in')
    requestAnimationFrame(() => document.getElementById('tab-sign-in')?.focus())
  }

  function openSignUp() {
    if (mode === 'sign-up') return
    setSwitched(true)
    setSlide('forward')
    setErrors({})
    setFormError('')
    setNotice('')
    setConfirmPassword('')
    setMode('sign-up')
    requestAnimationFrame(() => document.getElementById('tab-sign-up')?.focus())
  }

  async function onSubmit(event) {
    event.preventDefault()
    setNotice('')
    setFormError('')
    const next = {
      email: emailError(email),
      password: passwordError(password),
    }
    setErrors(next)
    if (next.email) {
      document.getElementById(emailId)?.focus()
      return
    }
    if (next.password) {
      document.getElementById(passwordId)?.focus()
      return
    }
    if (!requireSupabase()) return

    setBusy('sign-in')
    setRememberPreference(remember)
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setBusy(null)
    if (error) {
      setFormError(authMessage(error))
      return
    }
    setEmail(data.user?.email ?? email.trim())
    setUserId(data.user?.id ?? '')
    setPassword('')
    setShowPassword(false)
    setMode('signed-in')
  }

  async function createAccount(event) {
    event.preventDefault()
    setNotice('')
    setFormError('')
    const next = {
      email: emailError(email),
      password: passwordError(password),
    }
    if (!confirmPassword) next.confirmPassword = 'Enter the password again.'
    else if (password !== confirmPassword) next.confirmPassword = 'Those passwords do not match.'
    setErrors(next)
    if (next.email) {
      document.getElementById(emailId)?.focus()
      return
    }
    if (next.password) {
      document.getElementById(passwordId)?.focus()
      return
    }
    if (next.confirmPassword) {
      document.getElementById(confirmId)?.focus()
      return
    }
    if (!requireSupabase()) return

    setBusy('sign-up')
    setRememberPreference(remember)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: window.location.origin },
    })
    setBusy(null)
    if (error) {
      setFormError(authMessage(error))
      return
    }
    setPassword('')
    setConfirmPassword('')
    setShowPassword(false)
    if (data.session) {
      setEmail(data.user?.email ?? email.trim())
      setUserId(data.user?.id ?? '')
      setMode('signed-in')
      return
    }
    setSwitched(true)
    setSlide('back')
    setMode('sign-in')
    setNotice('Check your email to confirm the account, then come back and sign in.')
  }

  async function signInWithGoogle() {
    setNotice('')
    setFormError('')
    if (!requireSupabase()) return

    setBusy('google')
    setRememberPreference(remember)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) {
      setBusy(null)
      setFormError(authMessage(error))
    }
  }

  async function sendReset() {
    setFormError('')
    const problem = emailError(email)
    setErrors((current) => ({ ...current, email: problem || undefined }))
    if (problem) {
      document.getElementById(emailId)?.focus()
      setNotice('')
      return
    }
    if (!requireSupabase()) return

    setBusy('reset')
    setNotice('')
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    })
    setBusy(null)
    if (error) {
      setFormError(authMessage(error))
      return
    }
    setNotice('If that account exists, a reset link is on its way. Open it in this browser.')
  }

  async function updatePassword(event) {
    event.preventDefault()
    setFormError('')
    const next = {}
    const problem = passwordError(nextPassword)
    if (problem) next.nextPassword = problem
    if (!confirmPassword) next.confirmPassword = 'Enter the password again.'
    else if (nextPassword !== confirmPassword) next.confirmPassword = 'Those passwords do not match.'
    setErrors(next)
    if (next.nextPassword) {
      document.getElementById(nextPasswordId)?.focus()
      return
    }
    if (next.confirmPassword) {
      document.getElementById(confirmId)?.focus()
      return
    }
    if (!requireSupabase()) return

    setBusy('update')
    const { data, error } = await supabase.auth.updateUser({ password: nextPassword })
    setBusy(null)
    if (error) {
      setFormError(authMessage(error))
      return
    }
    setEmail(data.user?.email ?? email)
    setUserId(data.user?.id ?? '')
    setNextPassword('')
    setConfirmPassword('')
    setShowPassword(false)
    setMode('signed-in')
  }

  async function signOut() {
    setFormError('')
    if (!supabase) {
      setMode('sign-in')
      return
    }
    setBusy('out')
    const { error } = await supabase.auth.signOut()
    setBusy(null)
    if (error) {
      setFormError(authMessage(error))
      return
    }
    setUserId('')
    setPassword('')
    setShowPassword(false)
    setErrors({})
    setNotice('')
    setMode('sign-in')
  }

  const describedBy = [notice ? noticeId : null, formError ? formErrorId : null].filter(Boolean).join(' ') || undefined

  if (ready && mode === 'signed-in' && userId) {
    return (
      <NotesDesk
        userId={userId}
        email={email}
        onSignOut={signOut}
        signingOut={busy === 'out'}
      />
    )
  }

  return (
    <main className="node-gate">
      <a
        href="#sign-in"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-20 focus:bg-[#f0fdfa] focus:px-3 focus:py-2 focus:text-[#134e4a]"
      >
        Skip to sign in
      </a>

      <section className="node-stage" aria-labelledby="desk-title">
        <svg className="node-web" viewBox="0 0 800 900" aria-hidden="true">
          <g fill="none" stroke="rgba(240,253,250,0.35)" strokeWidth="1.25">
            <path d="M70 150 L250 300 L170 560 L430 470 L650 210" />
            <path d="M250 300 L530 390 L710 650" />
            <path d="M430 470 L290 760" />
          </g>
          <g fill="#f0fdfa">
            <circle cx="70" cy="150" r="3.5" />
            <circle cx="250" cy="300" r="4" />
            <circle cx="170" cy="560" r="3.5" />
            <circle cx="530" cy="390" r="3.5" />
            <circle cx="650" cy="210" r="4" />
            <circle cx="710" cy="650" r="3.5" />
            <circle cx="290" cy="760" r="3.5" />
          </g>
          <circle cx="430" cy="470" r="8" fill="#F97316" />
          <circle cx="430" cy="470" r="3" fill="#F0FDFA" />
        </svg>

        <div className="node-stage-inner">
          <header className="rise flex justify-end">
            <p className="node-kicker text-[#f0fdfa]/70">
              {mode === 'sign-up' ? '02 / New account' : mode === 'recovery' ? 'Reset' : '01 / Sign in'}
            </p>
          </header>

          <div className="rise mt-8" style={{ animationDelay: '80ms' }}>
            <p className="node-mark">
              <span className="sr-only">NODE</span>
              <span aria-hidden="true">
                N<span className="node-o">O</span>DE
              </span>
            </p>
            <div key={mode} className={motionClass}>
              <h1 id="desk-title" className="node-title">
                {mode === 'sign-up'
                  ? 'Open a new node.'
                  : mode === 'recovery'
                    ? 'Set a new password.'
                    : 'Your notes stay on this node.'}
              </h1>
              <p className="node-lede">
                {mode === 'sign-up'
                  ? 'This creates a new account. Notes you add stay with that user.'
                  : mode === 'recovery'
                    ? 'Choose a password you have not used here before.'
                    : 'Sign in to the notes on your account. Each note stays with that user.'}
              </p>
            </div>
          </div>

          <footer className="node-foot rise mt-10 items-end justify-between gap-6" style={{ animationDelay: '160ms' }}>
            <p>Private by account</p>
            <p>Est. 2026</p>
          </footer>
        </div>
      </section>

      <section id="sign-in" className="node-panel" aria-labelledby="sign-in-title">
        <div className="node-card rise" style={{ animationDelay: '120ms' }}>
          {!ready ? (
            <p className="text-3xl font-medium tracking-tight">Opening NODE…</p>
          ) : mode === 'recovery' ? (
            <>
              <p className="node-kicker text-[#0f766e]">Reset</p>
              <h2 id="sign-in-title" className="mt-2 text-3xl font-medium tracking-tight">
                Choose a new password.
              </h2>
              <p className="mt-3 font-sans text-sm leading-relaxed text-[#245e58]">
                This replaces the password on {email || 'your account'}.
              </p>
              <form className="mt-6 space-y-3.5" onSubmit={updatePassword} noValidate>
                <div>
                  <label htmlFor={nextPasswordId} className="mb-1.5 block font-sans text-sm font-semibold text-[#134e4a]">
                    New password
                  </label>
                  <input
                    id={nextPasswordId}
                    name="new-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={nextPassword}
                    aria-invalid={errors.nextPassword ? 'true' : 'false'}
                    aria-describedby={errors.nextPassword ? nextPasswordErrorId : undefined}
                    onChange={(event) => {
                      setNextPassword(event.target.value)
                      if (errors.nextPassword) setErrors((current) => ({ ...current, nextPassword: undefined }))
                    }}
                    className={fieldClass}
                  />
                  <FieldError id={nextPasswordErrorId} message={errors.nextPassword} />
                </div>
                <div>
                  <label htmlFor={confirmId} className="mb-1.5 block font-sans text-sm font-semibold text-[#134e4a]">
                    Confirm password
                  </label>
                  <input
                    id={confirmId}
                    name="confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    aria-invalid={errors.confirmPassword ? 'true' : 'false'}
                    aria-describedby={errors.confirmPassword ? confirmErrorId : undefined}
                    onChange={(event) => {
                      setConfirmPassword(event.target.value)
                      if (errors.confirmPassword) setErrors((current) => ({ ...current, confirmPassword: undefined }))
                    }}
                    className={fieldClass}
                  />
                  <FieldError id={confirmErrorId} message={errors.confirmPassword} />
                </div>
                {formError ? (
                  <p id={formErrorId} className="font-sans text-sm text-alert" role="alert">
                    {formError}
                  </p>
                ) : null}
                <button type="submit" disabled={busy === 'update'} aria-busy={busy === 'update'} className={primaryButton}>
                  {busy === 'update' ? (
                    <>
                      <Spinner />
                      Saving
                    </>
                  ) : (
                    'Save password'
                  )}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="node-switch" role="group" aria-label="Account">
                <button
                  type="button"
                  id="tab-sign-in"
                  aria-pressed={mode !== 'sign-up'}
                  onClick={openSignIn}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  id="tab-sign-up"
                  aria-pressed={mode === 'sign-up'}
                  onClick={openSignUp}
                >
                  Create account
                </button>
              </div>

              <div key={mode === 'sign-up' ? 'sign-up' : 'sign-in'} className={motionClass}>
                {mode === 'sign-up' ? (
                  <>
                    <h2 id="sign-in-title" tabIndex={-1} className="text-3xl font-medium tracking-tight">
                      Create your account.
                    </h2>
                    <p className="mt-2 font-sans text-sm leading-relaxed text-[#245e58]">
                      This is for a new NODE account. It does not sign in to one you already have.
                    </p>

                    <form className="mt-4 space-y-3" onSubmit={createAccount} noValidate>
                      <button
                        type="button"
                        onClick={signInWithGoogle}
                        disabled={Boolean(busy)}
                        className="node-google flex w-full cursor-pointer items-center justify-center gap-3 px-4 py-3 font-sans text-sm font-semibold tracking-[0.12em] uppercase transition-colors duration-200 focus-visible:outline-none disabled:cursor-wait disabled:opacity-70"
                      >
                        {busy === 'google' ? <Spinner tone="dark" /> : <GoogleIcon />}
                        {busy === 'google' ? 'Opening Google' : 'Sign up with Google'}
                      </button>
                      <div className="flex items-center gap-3 font-sans text-xs font-semibold tracking-[0.18em] text-[#245e58] uppercase">
                        <span className="node-rule" />
                        or
                        <span className="node-rule" />
                      </div>
                      <div>
                        <label htmlFor={emailId} className="mb-1.5 block font-sans text-sm font-semibold text-[#134e4a]">
                          Email
                        </label>
                        <input
                          id={emailId}
                          name="email"
                          type="email"
                          autoComplete="email"
                          inputMode="email"
                          value={email}
                          aria-invalid={errors.email ? 'true' : 'false'}
                          aria-describedby={errors.email ? emailErrorId : undefined}
                          onChange={(event) => {
                            setEmail(event.target.value)
                            if (errors.email) setErrors((current) => ({ ...current, email: undefined }))
                          }}
                          className={`${fieldClass} font-sans`}
                          placeholder="name@studio.com"
                        />
                        <FieldError id={emailErrorId} message={errors.email} />
                      </div>
                      <div>
                        <label htmlFor={passwordId} className="mb-1.5 block font-sans text-sm font-semibold text-[#134e4a]">
                          Password
                        </label>
                        <div className="relative">
                          <input
                            id={passwordId}
                            name="new-password"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            value={password}
                            aria-invalid={errors.password ? 'true' : 'false'}
                            aria-describedby={errors.password ? passwordErrorId : undefined}
                            onChange={(event) => {
                              setPassword(event.target.value)
                              if (errors.password) setErrors((current) => ({ ...current, password: undefined }))
                            }}
                            className={`${fieldClass} pr-12 font-sans`}
                            placeholder="At least 8 characters"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((current) => !current)}
                            aria-pressed={showPassword}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer p-1.5 text-[#245e58] transition-colors duration-200 hover:text-[#134e4a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d9488]"
                          >
                            <EyeIcon off={showPassword} />
                          </button>
                        </div>
                        <FieldError id={passwordErrorId} message={errors.password} />
                      </div>
                      <div>
                        <label htmlFor={confirmId} className="mb-1.5 block font-sans text-sm font-semibold text-[#134e4a]">
                          Confirm password
                        </label>
                        <input
                          id={confirmId}
                          name="confirm-password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          value={confirmPassword}
                          aria-invalid={errors.confirmPassword ? 'true' : 'false'}
                          aria-describedby={errors.confirmPassword ? confirmErrorId : undefined}
                          onChange={(event) => {
                            setConfirmPassword(event.target.value)
                            if (errors.confirmPassword) setErrors((current) => ({ ...current, confirmPassword: undefined }))
                          }}
                          className={`${fieldClass} font-sans`}
                          placeholder="Repeat the password"
                        />
                        <FieldError id={confirmErrorId} message={errors.confirmPassword} />
                      </div>
                      <label htmlFor={rememberId} className="flex cursor-pointer items-center gap-2 font-sans text-sm text-[#134e4a]">
                        <input
                          id={rememberId}
                          name="remember"
                          type="checkbox"
                          checked={remember}
                          onChange={(event) => setRemember(event.target.checked)}
                          className="size-4 cursor-pointer accent-[#0f766e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d9488] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f0fdfa]"
                        />
                        Remember this browser
                      </label>
                      {formError ? (
                        <p id={formErrorId} className="font-sans text-sm text-alert" role="alert">
                          {formError}
                        </p>
                      ) : null}
                      <button type="submit" disabled={Boolean(busy)} aria-busy={busy === 'sign-up'} className={primaryButton}>
                        {busy === 'sign-up' ? (
                          <>
                            <Spinner />
                            Creating account
                          </>
                        ) : (
                          'Create account'
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={openSignIn}
                        disabled={Boolean(busy)}
                        className="node-link w-full cursor-pointer py-2 font-sans text-sm font-semibold underline-offset-4 transition-colors duration-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d9488] disabled:cursor-wait disabled:opacity-70"
                      >
                        Already have an account? Sign in
                      </button>
                    </form>
                  </>
                ) : (
                  <>
                    <h2 id="sign-in-title" tabIndex={-1} className="text-3xl font-medium tracking-tight">
                      Welcome back.
                    </h2>
                    <p className="mt-2 font-sans text-sm leading-relaxed text-[#245e58]">
                      {isSupabaseConfigured
                        ? 'Use the email and password for an account you already have.'
                        : 'Copy .env.example to .env and add your Supabase project URL and anon key. Restart the dev server after saving it.'}
                    </p>

                    <form className="mt-4 space-y-3" onSubmit={onSubmit} noValidate>
                      <button
                        type="button"
                        onClick={signInWithGoogle}
                        disabled={Boolean(busy)}
                        className="node-google flex w-full cursor-pointer items-center justify-center gap-3 px-4 py-3 font-sans text-sm font-semibold tracking-[0.12em] uppercase transition-colors duration-200 focus-visible:outline-none disabled:cursor-wait disabled:opacity-70"
                      >
                        {busy === 'google' ? <Spinner tone="dark" /> : <GoogleIcon />}
                        {busy === 'google' ? 'Opening Google' : 'Continue with Google'}
                      </button>
                      <div className="flex items-center gap-3 font-sans text-xs font-semibold tracking-[0.18em] text-[#245e58] uppercase">
                        <span className="node-rule" />
                        or
                        <span className="node-rule" />
                      </div>
                      <div>
                        <label htmlFor={emailId} className="mb-1.5 block font-sans text-sm font-semibold text-[#134e4a]">
                          Email
                        </label>
                        <input
                          id={emailId}
                          name="email"
                          type="email"
                          autoComplete="email"
                          inputMode="email"
                          value={email}
                          aria-invalid={errors.email ? 'true' : 'false'}
                          aria-describedby={errors.email ? emailErrorId : undefined}
                          onChange={(event) => {
                            setEmail(event.target.value)
                            if (errors.email) setErrors((current) => ({ ...current, email: undefined }))
                          }}
                          className={`${fieldClass} font-sans`}
                          placeholder="name@studio.com"
                        />
                        <FieldError id={emailErrorId} message={errors.email} />
                      </div>

                      <div>
                        <label htmlFor={passwordId} className="mb-1.5 block font-sans text-sm font-semibold text-[#134e4a]">
                          Password
                        </label>
                        <div className="relative">
                          <input
                            id={passwordId}
                            name="password"
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="current-password"
                            value={password}
                            aria-invalid={errors.password ? 'true' : 'false'}
                            aria-describedby={errors.password ? passwordErrorId : describedBy}
                            onChange={(event) => {
                              setPassword(event.target.value)
                              if (errors.password) setErrors((current) => ({ ...current, password: undefined }))
                            }}
                            className={`${fieldClass} pr-12 font-sans`}
                            placeholder="At least 8 characters"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((current) => !current)}
                            aria-pressed={showPassword}
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer p-1.5 text-[#245e58] transition-colors duration-200 hover:text-[#134e4a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d9488]"
                          >
                            <EyeIcon off={showPassword} />
                          </button>
                        </div>
                        <FieldError id={passwordErrorId} message={errors.password} />
                      </div>

                      <div className="flex items-center justify-between gap-4 font-sans">
                        <label htmlFor={rememberId} className="flex cursor-pointer items-center gap-2 text-sm text-[#134e4a]">
                          <input
                            id={rememberId}
                            name="remember"
                            type="checkbox"
                            checked={remember}
                            onChange={(event) => setRemember(event.target.checked)}
                            className="size-4 cursor-pointer accent-[#0f766e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d9488] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f0fdfa]"
                          />
                          Remember this browser
                        </label>
                        <button
                          type="button"
                          onClick={sendReset}
                          disabled={Boolean(busy)}
                          className="node-link cursor-pointer text-sm font-semibold underline-offset-4 transition-colors duration-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d9488] disabled:cursor-wait disabled:opacity-70"
                        >
                          {busy === 'reset' ? 'Sending' : 'Forgot password'}
                        </button>
                      </div>

                      <p id={noticeId} className="min-h-5 font-sans text-sm text-[#245e58]" aria-live="polite">
                        {notice}
                      </p>
                      {formError ? (
                        <p id={formErrorId} className="font-sans text-sm text-alert" role="alert">
                          {formError}
                        </p>
                      ) : null}

                      <button type="submit" disabled={Boolean(busy)} aria-busy={busy === 'sign-in'} className={primaryButton}>
                        {busy === 'sign-in' ? (
                          <>
                            <Spinner />
                            Checking
                          </>
                        ) : (
                          'Sign in'
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={openSignUp}
                        disabled={Boolean(busy)}
                        className="node-link w-full cursor-pointer py-2 font-sans text-sm font-semibold underline-offset-4 transition-colors duration-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d9488] disabled:cursor-wait disabled:opacity-70"
                      >
                        New here? Create an account
                      </button>
                    </form>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  )
}
