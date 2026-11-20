/**
 * Post-login redirect target from a ?redirect= query parameter.
 * Only same-site absolute paths are allowed (prevents open redirects such as
 * ?redirect=//evil.example or ?redirect=https://evil.example).
 */
export function safeRedirect(target: string | null): string {
  if (!target || !target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) return '/dashboard';
  if (target.startsWith('/login') || target.startsWith('/register') || target.startsWith('/sso-callback')) return '/dashboard';
  return target;
}
