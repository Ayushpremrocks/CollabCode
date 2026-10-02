import { AuthPageLayout } from '../components/auth/AuthPageLayout';

/**
 * CollabCode Register / Sign Up Page.
 * Uses custom developer-tool UI powered by Clerk's headless useSignUp hook.
 * Fully supports Google OAuth, Email/Password account creation, email verification code step, and redirection.
 */
export function RegisterPage() {
  return <AuthPageLayout initialMode="signup" />;
}
