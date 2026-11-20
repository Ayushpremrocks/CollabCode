import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useSignIn, useSignUp } from '@clerk/clerk-react';
import { useAuth } from '../../contexts/AuthContext';
import { safeRedirect } from '../../utils/redirect';
import { Icon, Logo, type IconName } from '../ui/icons';

const AUTH_FEATURES: { icon: IconName; color: string; title: string; text: string }[] = [
  { icon: 'users', color: 'var(--cc-cyan)', title: 'Edit together, live', text: 'Named cursors and conflict-free syncing.' },
  { icon: 'tag', color: 'var(--cc-accent)', title: 'See who wrote each line', text: 'Every line is colour-coded by its author.' },
  { icon: 'bug', color: 'var(--cc-pink)', title: 'AI fixes, verified', text: 'Fixes are re-run before you approve them.' },
];
import { motion, useReducedMotion } from 'motion/react';

interface AuthPageLayoutProps {
  initialMode: 'signin' | 'signup';
}

type CodeStep = 'signup' | 'second-factor' | 'reset';
type SecondFactor = { strategy: string; emailAddressId?: string; phoneNumberId?: string };

function getClerkErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err !== null && 'errors' in err) {
    const clerkErr = err as { errors: Array<{ message?: string; longMessage?: string }> };
    if (clerkErr.errors && clerkErr.errors.length > 0) {
      return clerkErr.errors[0].longMessage || clerkErr.errors[0].message || fallback;
    }
  }
  if (err instanceof Error) {
    return err.message;
  }
  return fallback;
}

// ── Left Column: Subtle Animated Product Preview ──────────────────────────────
function MiniProductPreview() {
  const shouldReduceMotion = useReducedMotion();
  const [activeStep, setActiveStep] = useState<0 | 1>(0);

  useEffect(() => {
    if (shouldReduceMotion) return;
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev === 0 ? 1 : 0));
    }, 4200);
    return () => clearInterval(interval);
  }, [shouldReduceMotion]);

  return (
    <div
      className="rounded-md border p-3 text-xs font-mono"
      style={{
        background: '#090D12',
        borderColor: 'var(--cc-border)',
      }}
    >
      {/* Terminal Titlebar */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b" style={{ borderColor: 'var(--cc-border-subtle)' }}>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: '#F85149', opacity: 0.8 }} />
          <span className="w-2 h-2 rounded-full" style={{ background: '#D29922', opacity: 0.8 }} />
          <span className="w-2 h-2 rounded-full" style={{ background: '#3FB950', opacity: 0.8 }} />
          <span className="ml-2 text-[11px]" style={{ color: 'var(--cc-text-muted)' }}>
            main.cpp
          </span>
        </div>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-semibold"
          style={{ background: 'var(--cc-accent-dim)', color: 'var(--cc-accent)' }}
        >
          Sandbox
        </span>
      </div>

      {/* Code window */}
      <div className="space-y-1 text-[11px] leading-relaxed">
        <div className="flex gap-2">
          <span className="select-none text-right w-3" style={{ color: 'var(--cc-text-muted)' }}>1</span>
          <span style={{ color: '#E6EDF3' }}>
            <span style={{ color: 'var(--cc-info)' }}>int</span> compute(<span style={{ color: 'var(--cc-info)' }}>int</span> a, <span style={{ color: 'var(--cc-info)' }}>int</span> b) &#123;
          </span>
        </div>

        {activeStep === 0 ? (
          <div className="flex gap-2">
            <span className="select-none text-right w-3" style={{ color: 'var(--cc-text-muted)' }}>2</span>
            <span style={{ color: '#F85149' }}>
              &nbsp;&nbsp;<span style={{ color: 'var(--cc-info)' }}>return</span> a / b; <span className="opacity-70">// runtime exception</span>
            </span>
          </div>
        ) : (
          <>
            <div className="flex gap-2" style={{ background: 'rgba(63,185,80,0.12)' }}>
              <span className="select-none text-right w-3" style={{ color: 'var(--cc-success)' }}>+</span>
              <span style={{ color: 'var(--cc-success)' }}>
                &nbsp;&nbsp;<span style={{ color: 'var(--cc-info)' }}>if</span> (b == 0) <span style={{ color: 'var(--cc-info)' }}>return</span> 0;
              </span>
            </div>
            <div className="flex gap-2">
              <span className="select-none text-right w-3" style={{ color: 'var(--cc-text-muted)' }}>3</span>
              <span style={{ color: '#E6EDF3' }}>
                &nbsp;&nbsp;<span style={{ color: 'var(--cc-info)' }}>return</span> a / b;
              </span>
            </div>
          </>
        )}

        <div className="flex gap-2">
          <span className="select-none text-right w-3" style={{ color: 'var(--cc-text-muted)' }}>{activeStep === 0 ? 3 : 4}</span>
          <span style={{ color: '#E6EDF3' }}>&#125;</span>
        </div>
      </div>

      {/* Status banner */}
      <div className="mt-3 pt-2.5 border-t flex items-center justify-between" style={{ borderColor: 'var(--cc-border-subtle)' }}>
        {activeStep === 0 ? (
          <div className="flex items-center gap-1.5" style={{ color: 'var(--cc-error)' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-ping" style={{ background: 'var(--cc-error)' }} />
            <span className="text-[11px] font-medium">Runtime Error: division by zero</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5" style={{ color: 'var(--cc-success)' }}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span className="text-[11px] font-medium">Verified in Sandbox: exit 0</span>
          </div>
        )}

        <div className="flex items-center gap-1">
          <span
            className="text-[10px] px-1.5 py-0.5 rounded font-mono"
            style={{
              background: activeStep === 0 ? 'var(--cc-warning-dim)' : 'var(--cc-success-dim)',
              color: activeStep === 0 ? 'var(--cc-warning)' : 'var(--cc-success)',
              border: `1px solid ${activeStep === 0 ? 'rgba(210,153,34,0.3)' : 'rgba(63,185,80,0.3)'}`,
            }}
          >
            {activeStep === 0 ? 'AI DEBUG AGENT' : 'VERIFIED FIX'}
          </span>
        </div>
      </div>
    </div>
  );
}

export function AuthPageLayout({ initialMode }: AuthPageLayoutProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = safeRedirect(searchParams.get('redirect'));
  const { isAuthenticated, loading: authLoading } = useAuth();
  const shouldReduceMotion = useReducedMotion();

  // Mode state
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status & error states
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Email verification state for Clerk sign-up requirement
  const [codeStep, setCodeStep] = useState<CodeStep | null>(null);
  const verifying = codeStep !== null;
  const [secondFactor, setSecondFactor] = useState<SecondFactor | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [isVerifyingSubmitting, setIsVerifyingSubmitting] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  // Clerk hooks
  const { isLoaded: isSignInLoaded, signIn, setActive: setSignInActive } = useSignIn();
  const { isLoaded: isSignUpLoaded, signUp, setActive: setSignUpActive } = useSignUp();


  // If already authenticated, redirect to /dashboard
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirectTo, { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate, redirectTo]);

  const switchMode = (newMode: 'signin' | 'signup') => {
    setMode(newMode);
    setError(null);
    setCodeStep(null);
    setVerificationCode('');
    setVerificationError(null);
    const query = redirectTo !== '/dashboard' ? `?redirect=${encodeURIComponent(redirectTo)}` : '';
    navigate((newMode === 'signin' ? '/login' : '/register') + query, { replace: true });
  };

  // Google OAuth handler
  const handleGoogleAuth = async () => {
    setError(null);
    setIsGoogleLoading(true);

    try {
      if (mode === 'signin') {
        if (!isSignInLoaded || !signIn) {
          setIsGoogleLoading(false);
          return;
        }
        await signIn.authenticateWithRedirect({
          strategy: 'oauth_google',
          redirectUrl: '/sso-callback',
          redirectUrlComplete: redirectTo,
        });
      } else {
        if (!isSignUpLoaded || !signUp) {
          setIsGoogleLoading(false);
          return;
        }
        await signUp.authenticateWithRedirect({
          strategy: 'oauth_google',
          redirectUrl: '/sso-callback',
          redirectUrlComplete: redirectTo,
        });
      }
    } catch (err: unknown) {
      setIsGoogleLoading(false);
      setError(getClerkErrorMessage(err, 'Failed to initialize Google authentication.'));
    }
  };

  type SignInResult = NonNullable<typeof signIn>;

  /**
   * Completes a sign-in attempt. Besides "complete", Clerk can ask for a second factor
   * (2FA) or — with Client Trust enabled — verification of a new device
   * ("needs_client_trust"). Previously anything but "complete" was a dead end.
   */
  const finishSignIn = async (result: SignInResult) => {
    const status = result.status as string;
    if (status === 'complete') {
      await setSignInActive?.({ session: result.createdSessionId });
      navigate(redirectTo, { replace: true });
      return;
    }
    if (status === 'needs_second_factor' || status === 'needs_client_trust') {
      await startSecondFactor(result);
      return;
    }
    if (status === 'needs_new_password') {
      setError('This account needs a new password. Use "Forgot password?" to set one.');
      return;
    }
    setError(`Sign-in requires a step this page does not support yet (${status}).`);
  };

  const startSecondFactor = async (result: SignInResult) => {
    const factors = (result.supportedSecondFactors ?? []) as unknown as SecondFactor[];
    const factor = ['totp', 'email_code', 'phone_code']
      .map((strategy) => factors.find((f) => f.strategy === strategy))
      .find(Boolean) ?? { strategy: 'email_code' };
    await prepareSecondFactor(result, factor);
    setSecondFactor(factor);
    setVerificationCode('');
    setVerificationError(null);
    setCodeStep('second-factor');
  };

  const prepareSecondFactor = async (result: SignInResult, factor: SecondFactor) => {
    if (factor.strategy === 'totp') return; // authenticator app: nothing to send
    const params = factor.strategy === 'phone_code'
      ? { strategy: 'phone_code', phoneNumberId: factor.phoneNumberId }
      : { strategy: 'email_code', emailAddressId: factor.emailAddressId };
    await result.prepareSecondFactor(params as Parameters<SignInResult['prepareSecondFactor']>[0]);
  };

  // Forgot password → Clerk emails a reset code
  const handleForgotPassword = async () => {
    if (!isSignInLoaded || !signIn) return;
    if (!email.trim()) {
      setError('Enter your email address first, then click "Forgot password?".');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await signIn.create({ strategy: 'reset_password_email_code', identifier: email.trim() });
      setVerificationCode('');
      setNewPassword('');
      setVerificationError(null);
      setCodeStep('reset');
    } catch (err: unknown) {
      setError(getClerkErrorMessage(err, 'Could not send a password reset code.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Sign In handler
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSignInLoaded || !signIn) return;

    if (!email.trim() || !password) {
      setError('Please provide both your email and password.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const result = await signIn.create({
        identifier: email.trim(),
        password,
      });

      await finishSignIn(result);
    } catch (err: unknown) {
      setError(getClerkErrorMessage(err, 'Invalid email or password.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Sign Up handler
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSignUpLoaded || !signUp) return;

    if (!email.trim() || !password) {
      setError('Please provide an email and password.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const result = await signUp.create({
        emailAddress: email.trim(),
        password,
      });

      if (result.status === 'complete') {
        await setSignUpActive({ session: result.createdSessionId });
        navigate(redirectTo, { replace: true });
      } else if (result.status === 'missing_requirements') {
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
        setCodeStep('signup');
      } else {
        setError(`Account creation status: ${result.status}`);
      }
    } catch (err: unknown) {
      setError(getClerkErrorMessage(err, 'Failed to create account. Please check your information.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Verification Code handler (when Clerk requires email code during sign up)
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode.trim()) {
      setVerificationError('Please enter the 6-digit verification code.');
      return;
    }
    if (codeStep === 'second-factor' || codeStep === 'reset') {
      await handleSignInCode();
      return;
    }
    if (!isSignUpLoaded || !signUp) return;

    setVerificationError(null);
    setIsVerifyingSubmitting(true);

    try {
      const result = await signUp.attemptEmailAddressVerification({
        code: verificationCode.trim(),
      });

      if (result.status === 'complete') {
        await setSignUpActive({ session: result.createdSessionId });
        navigate(redirectTo, { replace: true });
      } else {
        setVerificationError(`Verification status: ${result.status}`);
      }
    } catch (err: unknown) {
      setVerificationError(getClerkErrorMessage(err, 'Invalid verification code. Please try again.'));
    } finally {
      setIsVerifyingSubmitting(false);
    }
  };

  /** Second-factor and password-reset codes belong to the sign-in attempt. */
  const handleSignInCode = async () => {
    if (!isSignInLoaded || !signIn) return;
    if (codeStep === 'reset' && newPassword.length < 8) {
      setVerificationError('Choose a new password with at least 8 characters.');
      return;
    }
    setVerificationError(null);
    setIsVerifyingSubmitting(true);
    try {
      const result = codeStep === 'reset'
        ? await signIn.attemptFirstFactor({ strategy: 'reset_password_email_code', code: verificationCode.trim(), password: newPassword })
        : await signIn.attemptSecondFactor({ strategy: (secondFactor?.strategy ?? 'email_code'), code: verificationCode.trim() } as Parameters<typeof signIn.attemptSecondFactor>[0]);
      const status = result.status as string;
      if (status === 'complete') {
        await setSignInActive?.({ session: result.createdSessionId });
        navigate(redirectTo, { replace: true });
      } else if (status === 'needs_second_factor' || status === 'needs_client_trust') {
        await startSecondFactor(result);
      } else {
        setVerificationError(`Verification status: ${status}`);
      }
    } catch (err: unknown) {
      setVerificationError(getClerkErrorMessage(err, 'Invalid code. Please try again.'));
    } finally {
      setIsVerifyingSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    if (codeStep === 'reset') {
      await handleForgotPassword();
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 4000);
      return;
    }
    if (codeStep === 'second-factor') {
      if (!signIn || !secondFactor || secondFactor.strategy === 'totp') return;
      try {
        await prepareSecondFactor(signIn, secondFactor);
        setResendSuccess(true);
        setTimeout(() => setResendSuccess(false), 4000);
      } catch (err: unknown) {
        setVerificationError(getClerkErrorMessage(err, 'Failed to resend code. Please try again in a moment.'));
      }
      return;
    }
    if (!isSignUpLoaded || !signUp) return;
    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 4000);
    } catch (err: unknown) {
      setVerificationError(getClerkErrorMessage(err, 'Failed to resend code. Please try again in a moment.'));
    }
  };

  const isFormReady = isSignInLoaded && isSignUpLoaded && !authLoading;

  return (
    <div
      className="min-h-screen flex flex-col justify-between"
      style={{
        background: 'var(--cc-bg)',
        color: 'var(--cc-text)',
        fontFamily: 'var(--cc-font-ui)',
      }}
    >
      {/* Top Navigation Bar */}
      <header
        className="w-full border-b shrink-0 px-4 sm:px-8 py-3.5 flex items-center justify-between"
        style={{
          background: 'var(--cc-surface)',
          borderColor: 'var(--cc-border)',
        }}
      >
        <Link to="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
          <Logo size={28} />
          <span className="font-semibold text-base tracking-tight" style={{ color: 'var(--cc-text)' }}>CollabCode</span>
        </Link>

        <div className="flex items-center gap-3 text-xs">
          <Link
            to="/"
            className="text-xs transition-colors hover:text-white"
            style={{ color: 'var(--cc-text-sec)' }}
          >
            ← Back to Home
          </Link>
        </div>
      </header>

      {/* Main Two-Column Container */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">

          {/* LEFT SIDE: Product Introduction / Branding */}
          <motion.div
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            className="lg:col-span-6 flex flex-col justify-center space-y-6"
          >
            {/* Header & Tagline */}
            <div>
              <span className="cc-chip mb-4">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--cc-success)' }} />
                Real-time collaborative editor
              </span>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
                <span style={{ color: 'var(--cc-text)' }}>Write code together.</span>
                <br />
                <span className="cc-gradient-text">Fix it with AI.</span>
              </h1>
              <p className="mt-3 text-sm sm:text-base leading-relaxed" style={{ color: 'var(--cc-text-sec)' }}>
                Share a room, edit live with named cursors, and let an AI agent verify fixes before you accept them.
              </p>
            </div>

            <ul className="space-y-3">
              {AUTH_FEATURES.map((f) => (
                <li key={f.title} className="flex items-start gap-3">
                  <span className="cc-tile w-8 h-8" style={{ ['--tile' as string]: f.color }}><Icon name={f.icon} size={15} /></span>
                  <div>
                    <div className="text-sm font-medium" style={{ color: 'var(--cc-text)' }}>{f.title}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--cc-text-muted)' }}>{f.text}</div>
                  </div>
                </li>
              ))}
            </ul>

            {/* Subtle Animated Product Visual */}
            <div className="pt-2">
              <MiniProductPreview />
            </div>
          </motion.div>

          {/* RIGHT SIDE: Authentication Form Card */}
          <motion.div
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="lg:col-span-6 w-full max-w-md mx-auto"
          >
            <div
              className="rounded-lg border shadow-xl p-6 sm:p-7"
              style={{
                background: 'var(--cc-surface)',
                borderColor: 'var(--cc-border)',
              }}
            >
              {/* Card Header with Mode Toggle */}
              <div className="flex items-center justify-between pb-5 mb-5 border-b" style={{ borderColor: 'var(--cc-border-subtle)' }}>
                <div>
                  <h2 className="text-lg font-bold tracking-tight" style={{ color: 'var(--cc-text)' }}>
                    {codeStep === 'reset' ? 'Reset password'
                      : codeStep === 'second-factor' ? 'Two-step verification'
                      : verifying ? 'Verify Email' : mode === 'signin' ? 'Sign in to workspace' : 'Create an account'}
                  </h2>
                  <p className="text-xs mt-1" style={{ color: 'var(--cc-text-sec)' }}>
                    {codeStep === 'second-factor' && secondFactor?.strategy === 'totp'
                      ? 'Enter the code from your authenticator app'
                      : codeStep === 'second-factor' && secondFactor?.strategy === 'phone_code'
                      ? 'Enter the code we texted to your phone'
                      : verifying
                      ? `Code sent to ${email}`
                      : mode === 'signin'
                      ? 'Continue to your CollabCode rooms'
                      : 'Join collaborative coding sessions'}
                  </p>
                </div>

                {!verifying && (
                  <div
                    className="flex p-0.5 rounded border text-xs font-medium"
                    style={{ background: 'var(--cc-bg)', borderColor: 'var(--cc-border)' }}
                  >
                    <button
                      type="button"
                      onClick={() => switchMode('signin')}
                      className="px-2.5 py-1 rounded transition-colors cursor-pointer"
                      style={{
                        background: mode === 'signin' ? 'var(--cc-surface-el)' : 'transparent',
                        color: mode === 'signin' ? 'var(--cc-text)' : 'var(--cc-text-muted)',
                      }}
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => switchMode('signup')}
                      className="px-2.5 py-1 rounded transition-colors cursor-pointer"
                      style={{
                        background: mode === 'signup' ? 'var(--cc-surface-el)' : 'transparent',
                        color: mode === 'signup' ? 'var(--cc-text)' : 'var(--cc-text-muted)',
                      }}
                    >
                      Sign Up
                    </button>
                  </div>
                )}
              </div>

              {/* Email Verification Subflow (if triggered during sign up) */}
              {verifying ? (
                <form onSubmit={handleVerifyCode} className="space-y-4">
                  {verificationError && (
                    <div
                      className="p-3 rounded border text-xs flex items-start gap-2"
                      style={{
                        background: 'var(--cc-error-dim)',
                        borderColor: 'rgba(248,81,73,0.35)',
                        color: 'var(--cc-error)',
                      }}
                    >
                      <span className="font-bold">●</span>
                      <div>
                        <div className="font-semibold">Verification failed</div>
                        <div className="mt-0.5 text-[11px] opacity-90">{verificationError}</div>
                      </div>
                    </div>
                  )}

                  {resendSuccess && (
                    <div
                      className="p-3 rounded border text-xs flex items-start gap-2"
                      style={{
                        background: 'var(--cc-success-dim)',
                        borderColor: 'rgba(63,185,80,0.35)',
                        color: 'var(--cc-success)',
                      }}
                    >
                      <span className="font-bold">✓</span>
                      <div>Verification code resent to your email.</div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-mono mb-1.5" style={{ color: 'var(--cc-text-sec)' }}>
                      6-DIGIT VERIFICATION CODE
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456"
                      autoFocus
                      className="w-full text-center font-mono text-lg tracking-[0.35em] px-3 py-2.5 rounded border focus:outline-none transition-colors"
                      style={{
                        background: 'var(--cc-surface-el)',
                        borderColor: 'var(--cc-border)',
                        color: 'var(--cc-text)',
                      }}
                    />
                  </div>

                  {codeStep === 'reset' && (
                    <div>
                      <label className="block text-xs font-mono mb-1.5" style={{ color: 'var(--cc-text-sec)' }}>
                        NEW PASSWORD
                      </label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        autoComplete="new-password"
                        className="w-full text-sm px-3 py-2.5 rounded border focus:outline-none transition-colors"
                        style={{ background: 'var(--cc-surface-el)', borderColor: 'var(--cc-border)', color: 'var(--cc-text)' }}
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isVerifyingSubmitting || verificationCode.length < 6}
                    className="w-full py-2.5 rounded font-semibold text-xs tracking-wide uppercase transition-opacity flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: 'var(--cc-accent)',
                      color: '#0D1117',
                    }}
                  >
                    {isVerifyingSubmitting ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-[#0D1117] border-t-transparent rounded-full animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      'Verify & Continue'
                    )}
                  </button>

                  <div className="flex items-center justify-between pt-2 text-xs" style={{ color: 'var(--cc-text-muted)' }}>
                    <button
                      type="button"
                      onClick={() => setCodeStep(null)}
                      className="hover:underline cursor-pointer"
                    >
                      ← Back
                    </button>
                    {!(codeStep === 'second-factor' && secondFactor?.strategy === 'totp') && (
                    <button
                      type="button"
                      onClick={handleResendCode}
                      className="hover:underline cursor-pointer"
                      style={{ color: 'var(--cc-accent)' }}
                    >
                      Resend code
                    </button>
                    )}
                  </div>
                </form>
              ) : (
                /* Standard Sign In / Sign Up Form */
                <div className="space-y-4">
                  {/* Google OAuth Button */}
                  <button
                    type="button"
                    onClick={handleGoogleAuth}
                    disabled={isGoogleLoading || !isFormReady}
                    className="w-full py-2.5 px-3 rounded border text-xs font-medium flex items-center justify-center gap-2.5 transition-colors cursor-pointer hover:bg-[#1E2631] disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: 'var(--cc-surface-el)',
                      borderColor: 'var(--cc-border)',
                      color: 'var(--cc-text)',
                    }}
                  >
                    {isGoogleLoading ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                        <span>Connecting to Google...</span>
                      </>
                    ) : (
                      <>
                        {/* Official Google 'G' Logo SVG */}
                        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                          />
                        </svg>
                        <span>Continue with Google</span>
                      </>
                    )}
                  </button>

                  {/* Technical Divider */}
                  <div className="relative flex items-center justify-center my-3">
                    <div className="w-full border-t" style={{ borderColor: 'var(--cc-border)' }} />
                    <span
                      className="absolute px-3 text-[10px] font-mono tracking-widest uppercase select-none"
                      style={{ background: 'var(--cc-surface)', color: 'var(--cc-text-muted)' }}
                    >
                      or continue with email
                    </span>
                  </div>

                  {/* Error Notification */}
                  {error && (
                    <motion.div
                      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 rounded border text-xs flex items-start gap-2.5"
                      style={{
                        background: 'var(--cc-error-dim)',
                        borderColor: 'rgba(248,81,73,0.35)',
                        color: 'var(--cc-error)',
                      }}
                    >
                      <span className="font-bold text-sm leading-none mt-0.5">●</span>
                      <div className="flex-1">
                        <div className="font-semibold text-xs tracking-wide">Authentication failed</div>
                        <div className="mt-0.5 text-[11px] leading-relaxed opacity-90">{error}</div>
                      </div>
                    </motion.div>
                  )}

                  {/* Form */}
                  <form onSubmit={mode === 'signin' ? handleSignIn : handleSignUp} className="space-y-3.5">
                    {/* Email Field */}
                    <div>
                      <label className="block text-xs font-mono mb-1" style={{ color: 'var(--cc-text-sec)' }}>
                        EMAIL ADDRESS
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="developer@domain.com"
                        className="w-full text-xs px-3 py-2 rounded border focus:outline-none transition-colors"
                        style={{
                          background: 'var(--cc-surface-el)',
                          borderColor: 'var(--cc-border)',
                          color: 'var(--cc-text)',
                        }}
                      />
                    </div>

                    {/* Password Field */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-mono" style={{ color: 'var(--cc-text-sec)' }}>
                          PASSWORD
                        </label>
                        {mode === 'signin' ? (
                          <button
                            type="button"
                            onClick={handleForgotPassword}
                            disabled={isSubmitting || !isFormReady}
                            className="text-[11px] hover:underline cursor-pointer disabled:opacity-50"
                            style={{ color: 'var(--cc-accent)' }}
                          >
                            Forgot password?
                          </button>
                        ) : (
                          <span className="text-[11px]" style={{ color: 'var(--cc-text-muted)' }}>
                            Min 8 characters
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••••••"
                          className="w-full text-xs px-3 py-2 pr-9 rounded border focus:outline-none transition-colors"
                          style={{
                            background: 'var(--cc-surface-el)',
                            borderColor: 'var(--cc-border)',
                            color: 'var(--cc-text)',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs transition-colors hover:text-white cursor-pointer"
                          style={{ color: 'var(--cc-text-muted)' }}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Confirm Password (Sign Up only) */}
                    {mode === 'signup' && (
                      <div>
                        <label className="block text-xs font-mono mb-1" style={{ color: 'var(--cc-text-sec)' }}>
                          CONFIRM PASSWORD
                        </label>
                        <div className="relative">
                          <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            required
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••••••"
                            className="w-full text-xs px-3 py-2 pr-9 rounded border focus:outline-none transition-colors"
                            style={{
                              background: 'var(--cc-surface-el)',
                              borderColor: 'var(--cc-border)',
                              color: 'var(--cc-text)',
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs transition-colors hover:text-white cursor-pointer"
                            style={{ color: 'var(--cc-text-muted)' }}
                            aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                          >
                            {showConfirmPassword ? (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={isSubmitting || !isFormReady}
                      className="w-full mt-2 py-2.5 rounded font-semibold text-xs tracking-wide uppercase transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110 active:scale-[0.99]"
                      style={{
                        background: 'var(--cc-accent)',
                        color: '#0D1117',
                      }}
                    >
                      {isSubmitting ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-[#0D1117] border-t-transparent rounded-full animate-spin" />
                          <span>{mode === 'signin' ? 'Signing in...' : 'Creating account...'}</span>
                        </>
                      ) : (
                        <span>{mode === 'signin' ? 'Sign In to Workspace' : 'Create Account'}</span>
                      )}
                    </button>
                  </form>

                  {/* Card Footer Switch Link */}
                  <div className="pt-3 border-t text-center text-xs" style={{ borderColor: 'var(--cc-border-subtle)', color: 'var(--cc-text-sec)' }}>
                    {mode === 'signin' ? (
                      <span>
                        Don&apos;t have an account?{' '}
                        <button
                          type="button"
                          onClick={() => switchMode('signup')}
                          className="font-medium hover:underline transition-colors cursor-pointer"
                          style={{ color: 'var(--cc-accent)' }}
                        >
                          Create account
                        </button>
                      </span>
                    ) : (
                      <span>
                        Already have an account?{' '}
                        <button
                          type="button"
                          onClick={() => switchMode('signin')}
                          className="font-medium hover:underline transition-colors cursor-pointer"
                          style={{ color: 'var(--cc-accent)' }}
                        >
                          Sign in
                        </button>
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Security note */}
            <div className="mt-4 text-center">
              <span className="text-[11px] font-mono" style={{ color: 'var(--cc-text-muted)' }}>
                Protected by Clerk Authentication &bull; Spring Security JWT
              </span>
            </div>
          </motion.div>

        </div>
      </main>

      {/* Footer */}
      <footer
        className="w-full border-t shrink-0 px-4 py-3 text-center text-xs"
        style={{
          borderColor: 'var(--cc-border-subtle)',
          color: 'var(--cc-text-muted)',
          background: 'rgba(13, 17, 23, 0.7)',
        }}
      >
        <span className="font-mono text-[11px]">
          CollabCode &copy; {new Date().getFullYear()} &bull; Real-time collaborative workspace with verified execution
        </span>
      </footer>
    </div>
  );
}
