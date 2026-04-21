# Deploy Reproducible (VPS + Traefik)

Este proyecto tiene dos compose separados:

- `docker-compose.yml`: entorno local (puertos 3000 y 5432 expuestos).
- `docker-compose.prod.yml`: entorno VPS (sin exponer 3000, con labels de Traefik).

## Requisitos previos

- Traefik funcionando en el VPS, conectado a red Docker externa `proxy`.
- DNS `A` de tu subdominio apuntando al VPS.
- Puertos 80/443/22 permitidos.

## Primera instalación en VPS

```bash
mkdir -p /opt/tickets-app
cd /opt/tickets-app
git clone https://github.com/Pepemkt/sistema_de_tickets.git .
cp .env.example .env
```

Editar `.env`:

- `APP_DOMAIN=tickets.aiderbrand.com`
- `NEXT_PUBLIC_APP_URL=https://tickets.aiderbrand.com`
- Secrets reales (`QR_SIGNING_SECRET`, SMTP, Mercado Pago).
- Definir `SEED_SUPERADMIN_USERNAME` y `SEED_SUPERADMIN_PASSWORD` con valores seguros.
- Mantener `SEED_CREATE_DEMO_USERS="false"` en produccion.
- Mantener `SEED_CREATE_DEMO_EVENT="false"` en produccion.

Levantar:

```bash
docker network ls | grep proxy || docker network create proxy
docker compose -f docker-compose.prod.yml build app
docker compose -f docker-compose.prod.yml up -d db
docker compose -f docker-compose.prod.yml run --rm app npx prisma db push
docker compose -f docker-compose.prod.yml up -d app
docker compose -f docker-compose.prod.yml exec app npm run db:seed
```

Verificación:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=100 app
curl -I https://tickets.aiderbrand.com
```

## Actualizaciones futuras (flujo estable)

```bash
cd /opt/tickets-app
git pull --ff-only
test -f .env || { echo "Falta .env, abortando."; exit 1; }
docker compose -f docker-compose.prod.yml build app
docker compose -f docker-compose.prod.yml up -d db
docker compose -f docker-compose.prod.yml run --rm app npx prisma db push
docker compose -f docker-compose.prod.yml up -d app
```

Si cambiaste datos de usuarios seed y quieres reaplicarlos:

```bash
docker compose -f docker-compose.prod.yml exec app npm run db:seed
```

Importante:

- No ejecutar `cp .env.example .env` durante updates.
- No ejecutar seed en cada deploy, salvo que quieras rotar/reaplicar usuarios iniciales.
- No ejecutar `npm run config:sync` durante updates normales.
- No usar `git reset --hard` para actualizar el VPS.

## VPS compartido con Traefik ya existente

Si el VPS ya tiene otro stack corriendo Traefik en 80/443, **no uses** `docker-compose.prod.yml` tal cual.
Usa `docker-compose.vps.yml`, que mantiene la app y la base de tickets aisladas y conecta la app a la red Docker existente del reverse proxy.

### Topología esperada

- Stack actual existente: sigue intacto.
- Nuevo stack de tickets: `app` + `db` propios.
- Red Docker externa existente: `aiderbrand-system_proxy`.
- `db` de tickets queda solo en red interna; no expone puertos al host.

### Variables obligatorias en `.env`

- `APP_DOMAIN=tickets.tu-dominio.com`
- `NEXT_PUBLIC_APP_URL=https://tickets.tu-dominio.com`
- `DATABASE_URL=postgresql://<usuario>:<password-url-safe>@db:5432/<db>`
- `POSTGRES_DB=<db>`
- `POSTGRES_USER=<usuario>`
- `POSTGRES_PASSWORD=<password-url-safe>`
- `SEED_CREATE_DEMO_USERS="false"`
- `SEED_CREATE_DEMO_EVENT="false"`

> Importante: `DATABASE_URL` debe apuntar al host interno `db` del compose nuevo, no al Postgres del stack existente.

### Primera instalación en VPS compartido

```bash
mkdir -p /opt/tickets-app
cd /opt/tickets-app
git clone https://github.com/Pepemkt/sistema_de_tickets.git .
cp .env.example .env
```

Editar `.env` con:

- subdominio final HTTPS
- credenciales reales de la app
- credenciales propias para la DB del stack tickets
- `DATABASE_URL` alineada con `POSTGRES_DB`, `POSTGRES_USER` y `POSTGRES_PASSWORD`

Validar preflight:

```bash
test -f .env || { echo "Falta .env, abortando."; exit 1; }
docker network inspect aiderbrand-system_proxy >/dev/null
grep -q '^APP_DOMAIN=' .env
grep -q '^NEXT_PUBLIC_APP_URL=https://' .env
docker compose -f docker-compose.vps.yml config >/dev/null
```

Levantar:

```bash
docker compose -f docker-compose.vps.yml up -d db
docker compose -f docker-compose.vps.yml build app
docker compose -f docker-compose.vps.yml run --rm app npx prisma db push
docker compose -f docker-compose.vps.yml up -d app
```

Verificación:

```bash
docker compose -f docker-compose.vps.yml ps
docker compose -f docker-compose.vps.yml logs --tail=100 app
curl -I https://tickets.tu-dominio.com/login
```

### Actualizaciones futuras en VPS compartido

```bash
cd /opt/tickets-app
git pull --ff-only
test -f .env || { echo "Falta .env, abortando."; exit 1; }
docker compose -f docker-compose.vps.yml up -d db
docker compose -f docker-compose.vps.yml build app
docker compose -f docker-compose.vps.yml run --rm app npx prisma db push
docker compose -f docker-compose.vps.yml up -d app
```

Reglas duras para este escenario:

- No tocar `/opt/aiderbrand/aiderbrand-system`.
- No reiniciar ni recrear el Traefik existente.
- No reusar el Postgres del stack actual.
- No publicar `3000:3000` ni `5432:5432` en el host.

## Notas

- Si en el futuro agregas migraciones Prisma (`prisma/migrations`), usa `prisma migrate deploy` en lugar de `db push`.
- El contenedor de app no debe publicar `3000:3000` en producción; Traefik enruta internamente por red `proxy`.
- En el código actual, si existen credenciales de Mercado Pago o SMTP tanto en `.env` como en DB, la app resuelve primero `.env` y deja DB como fallback.
- `npm run config:sync` es una operación manual para sincronizar secretos desde `.env`; no forma parte del flujo normal de deploy.
