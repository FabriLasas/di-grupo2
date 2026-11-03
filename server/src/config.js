export function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT || 4000),
    jwtSecret: env.JWT_SECRET || 'dev-secret',
    production: env.NODE_ENV === 'production',
    // 'lax' si web y API comparten dominio; 'none' si están en dominios distintos (exige HTTPS)
    cookieSameSite: env.COOKIE_SAMESITE === 'none' ? 'none' : 'lax',
    mpAccessToken: env.MP_ACCESS_TOKEN || '',
    mpWebhookSecret: env.MP_WEBHOOK_SECRET || '',
    publicUrl: env.PUBLIC_URL || 'http://localhost:4000',
    webUrl: env.WEB_URL || 'http://localhost:5173',
    localUrl: env.LOCAL_URL || 'http://localhost:5174',
  }
}
