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
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec app npx prisma db push
docker compose -f docker-compose.prod.yml exec app npm run config:sync
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
git fetch --all
git reset --hard origin/main
test -f .env || { echo "Falta .env, abortando."; exit 1; }
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec app npx prisma db push
docker compose -f docker-compose.prod.yml exec app npm run config:sync
```

Si cambiaste datos de usuarios seed y quieres reaplicarlos:

```bash
docker compose -f docker-compose.prod.yml exec app npm run db:seed
```

Importante:

- No ejecutar `cp .env.example .env` durante updates.
- No ejecutar seed en cada deploy, salvo que quieras rotar/reaplicar usuarios iniciales.

## Notas

- Si en el futuro agregas migraciones Prisma (`prisma/migrations`), usa `prisma migrate deploy` en lugar de `db push`.
- El contenedor de app no debe publicar `3000:3000` en producción; Traefik enruta internamente por red `proxy`.
- En producción, las credenciales de Mercado Pago y SMTP guardadas desde `/admin/settings` se persisten en DB y tienen prioridad sobre `.env`.
- `npm run config:sync` sincroniza en DB los valores existentes en `.env` (solo campos presentes; no borra campos en DB).
