import { AuthPageLayout } from '../components/auth/AuthPageLayout';

/**
 * CollabCode Sign In Page.
 * Uses custom developer-tool UI powered by Clerk's headless useSignIn hook.
 * Fully supports Google OAuth, Email/Password authentication, and seamless redirection.
 */
export function LoginPage() {
  return <AuthPageLayout initialMode="signin" />;
}
