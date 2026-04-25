# Production Security

Ce document fige le socle de sécurité production de Virtual Easyjet pour la web app, l'API et le service ACARS.

## Variables d'environnement

### API

- `NODE_ENV=production`
- `API_PORT`
- `DATABASE_URL`
- `CORS_ORIGIN`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_TTL`
- `JWT_REFRESH_TTL`
- `BLOB_READ_WRITE_TOKEN`

### ACARS service

- `NODE_ENV=production`
- `ACARS_PORT`
- `DATABASE_URL`
- `CORS_ORIGIN`
- `JWT_ACCESS_SECRET`
- `ACARS_RESUME_TIMEOUT_MINUTES`
- `ACARS_OVERSPEED_GRACE_SECONDS`
- `ACARS_HARD_LANDING_THRESHOLD_FPM`

### Web

- `NODE_ENV=production`
- `WEB_API_BASE_URL`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_ACARS_CURRENT_VERSION`
- `ACARS_DOWNLOAD_URL`
- `NEXT_PUBLIC_ACARS_DOWNLOAD_URL`

## Règles appliquées

### Rate limiting

API :

- `POST /api/auth/login` : strict
- `POST /api/auth/register` : strict
- `POST /api/users/me/avatar` : modéré
- écritures `POST/PATCH/DELETE /api/admin/*` : protégées
- `GET` publics sensibles : quota plus large mais borné

ACARS :

- `POST /acars/sessions`
- `POST /acars/sessions/:id/telemetry`
- `POST /acars/sessions/:id/complete`
- `GET /acars/health`

Quand la limite est atteinte, l'API renvoie `429 Too Many Requests` avec `Retry-After`.

### Anti brute-force login

- contrôle par IP et identifiant
- blocage temporaire après trop d'échecs
- logs sans mot de passe, sans refresh token, sans données sensibles

### CORS

En production, `CORS_ORIGIN` ne doit jamais contenir `*`.

Valeur recommandée :

```env
CORS_ORIGIN="https://virtual-easyjet-web.vercel.app,https://virtualeasyjet.example.com"
```

En développement, `localhost` et `127.0.0.1` restent autorisés.

### Headers sécurité

Web :

- `Content-Security-Policy`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`

API et ACARS :

- `Content-Security-Policy` minimal pour les routes HTTP
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`
- suppression de `X-Powered-By`

## Vercel Firewall recommandé

Pour la préproduction et la production :

- activer le WAF / Firewall Vercel
- ajouter des protections Bot Management sur les routes publiques si disponible
- surveiller particulièrement :
  - `/api/auth/login`
  - `/api/auth/register`
  - `/api/public/*`
  - `/api/acars/live`
- si vous publiez l'API sur Vercel, limiter les origines et garder les routes admin non indexées

## Rotation des secrets

À faire avant mise en ligne puis régulièrement :

- régénérer `JWT_ACCESS_SECRET`
- régénérer `JWT_REFRESH_SECRET`
- régénérer `BLOB_READ_WRITE_TOKEN` si suspicion de fuite
- redéployer l'API, le web et le service ACARS après rotation
- invalider les refresh tokens actifs si une fuite est suspectée

## Checklist avant mise en ligne

- `NODE_ENV=production` partout
- `CORS_ORIGIN` sans wildcard
- domaines publics finalisés
- PostgreSQL privé uniquement
- `BLOB_READ_WRITE_TOKEN` présent côté API
- builds OK :
  - `pnpm --filter @va/api build`
  - `pnpm --filter @va/acars-service build`
  - `pnpm --filter @va/web build`
- santé publique minimale :
  - `GET /api/health`
  - `GET /acars/health`
- vérifier que `/api/admin/*` est inaccessible sans compte admin
- vérifier que le login finit bien en `429` après dépassement
- vérifier que l'upload avatar refuse les fichiers > 2 Mo ou hors PNG/JPG/JPEG/WebP

## Notes d'exploitation

- Le rate limiting actuel est applicatif et mémoire locale. Sur une architecture serverless multi-instance, il réduit nettement l'abus mais n'est pas un substitut complet à un WAF ou à un store distribué.
- Les endpoints publics ne doivent jamais retourner de `passwordHash`, de refresh token, de secret JWT, de `DATABASE_URL` ni de token Blob.
- Les healthchecks publics doivent rester minimaux et ne pas exposer de configuration interne.
