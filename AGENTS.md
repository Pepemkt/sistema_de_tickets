# AGENTS.md

Reglas de operacion para agentes en este proyecto. Objetivo: despliegues predecibles, sin romper produccion ni pisar configuraciones.

## 1) Principios

- Tratar produccion como entorno persistente: no reinicializar configuraciones sin pedido explicito.
- Priorizar cambios minimos y reversibles.
- Separar siempre local vs produccion.

## 2) Archivos canonicos por entorno

- Local: `docker-compose.yml`
- Produccion: `docker-compose.prod.yml`
- Guia de despliegue: `DEPLOY.md`

Nunca usar `docker-compose.yml` para levantar el VPS.

## 3) Reglas duras de deploy (VPS)

- Nunca ejecutar `cp .env.example .env` durante actualizaciones.
- Nunca sobrescribir `.env` si ya existe.
- Antes de deploy, exigir:
  - `APP_DOMAIN` definido en `.env`
  - `NEXT_PUBLIC_APP_URL` apuntando al dominio HTTPS real
- Usar solo:
  - `docker compose -f docker-compose.prod.yml up -d --build`
  - `docker compose -f docker-compose.prod.yml exec app npx prisma db push`

## 4) Redes y Traefik

- `traefik` vive en stack separado (`/opt/traefik`) y red externa `proxy`.
- En produccion:
  - `app` debe estar en `proxy` e `internal`.
  - `db` debe estar solo en `internal`.
- `app` debe incluir label:
  - `traefik.docker.network=proxy`
- No exponer `3000:3000` en produccion.

## 5) Mercado Pago (critico)

- `Public Key` y `Access Token` no son intercambiables.
  - `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` -> frontend
  - `mercadoPagoAccessToken` -> backend
- Fuente efectiva del token backend:
  - primero DB (`PlatformConfig.mercadoPagoAccessToken`)
  - luego `.env` (`MERCADOPAGO_ACCESS_TOKEN`)
- Al cambiar de cuenta MP:
  - actualizar Public Key en `.env`
  - actualizar Access Token en DB (admin/settings o SQL)
  - actualizar webhook en MP al endpoint:
    - `https://<dominio>/api/mercadopago/webhook`
  - guardar nuevo webhook secret en admin/settings

## 6) Prisma y seed

- Actualmente no hay `prisma/migrations` versionadas.
- En produccion usar `prisma db push` (no `migrate deploy`).
- `npm run db:seed` no se ejecuta en cada deploy.
  - Usarlo solo para alta/rotacion de usuarios iniciales.
- `SEED_CREATE_DEMO_EVENT` debe quedar en `false` en produccion.

## 7) Checklist obligatorio post-deploy

- `docker compose -f docker-compose.prod.yml ps`
- `docker compose -f docker-compose.prod.yml logs --tail=100 app`
- `docker logs --tail=100 traefik`
- `curl -I https://<dominio>/login`
- Verificar compra MP (crear preferencia y redireccion).

## 8) Cambios que requieren confirmacion explicita del usuario

- Rotar o reemplazar credenciales (MP, SMTP, secrets).
- Borrar volúmenes o datos de Postgres.
- Cambiar reglas de red/proxy/firewall.
- Forzar reset de configuraciones guardadas en DB.

## 9) Errores frecuentes y respuesta esperada

- `Host('')` o Traefik sin ruta:
  - revisar `APP_DOMAIN` en `.env`
- `PA_UNAUTHORIZED_RESULT_FROM_POLICIES`:
  - validar token real usado por backend (`users/me`)
  - comprobar que no se haya guardado Public Key como Access Token
- Pago aprobado sin tickets/email:
  - revisar webhook en MP + webhook secret en la app
