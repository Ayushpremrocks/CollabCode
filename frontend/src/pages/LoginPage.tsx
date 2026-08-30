import { SignIn } from '@clerk/clerk-react';

/**
 * Clerk-hosted Sign In page.
 * Replaces the custom login form — Clerk handles credential validation, MFA,
 * OAuth providers, and session creation. On success, Clerk redirects to /dashboard.
 */
export function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <SignIn
        path="/login"
        routing="path"
        signUpUrl="/register"
        forceRedirectUrl="/dashboard"
        appearance={{
          variables: {
            colorPrimary: '#6366f1',
            colorBackground: '#111827',
            colorText: '#f9fafb',
            colorInputBackground: '#1f2937',
            colorInputText: '#f9fafb',
            borderRadius: '0.5rem',
          },
          elements: {
            card: 'shadow-2xl shadow-indigo-500/10 border border-gray-800',
            headerTitle: 'text-white',
            headerSubtitle: 'text-gray-400',
            socialButtonsBlockButton: 'border-gray-700 text-gray-300 hover:bg-gray-800',
            dividerLine: 'bg-gray-700',
            dividerText: 'text-gray-500',
            formFieldLabel: 'text-gray-300',
            footerActionLink: 'text-indigo-400 hover:text-indigo-300',
          },
        }}
      />
    </div>
  );
}
