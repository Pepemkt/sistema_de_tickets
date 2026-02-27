# AGENTS.md

Reglas operativas para agentes en este proyecto.
Objetivo: despliegues predecibles, reversibles y sin perdida de configuracion ni datos.

## 0) Alcance y precedencia

- Este archivo define la politica de ejecucion para agentes.
- Si hay conflicto entre documentos, prevalece la regla mas conservadora para produccion.
- Produccion se considera entorno persistente: no se reinicializa ni se "recrea" sin autorizacion explicita.

## 1) Principios

- Cambios minimos, auditables y reversibles.
- Separar siempre local vs produccion.
- Nunca asumir defaults en secretos o credenciales.
- Antes de ejecutar, validar precondiciones; si falla una, abortar.

## 2) Archivos canonicos por entorno

- Local: `docker-compose.yml`
- Produccion (VPS): `docker-compose.prod.yml`
- Guia operativa: `DEPLOY.md`

Regla dura:
- Nunca usar `docker-compose.yml` para levantar el VPS.

## 3) Reglas duras de deploy (VPS)

- Nunca ejecutar `cp .env.example .env` durante actualizaciones.
- Nunca sobrescribir `.env` si ya existe.
- Nunca exponer `3000:3000` en produccion.
- Ejecutar deploy solo con:
  - `docker compose -f docker-compose.prod.yml up -d --build`
  - `docker compose -f docker-compose.prod.yml exec app npx prisma db push`

## 4) Comandos prohibidos sin confirmacion explicita

- `git reset --hard`
- `docker compose down -v`
- `docker volume rm ...`
- `docker system prune` / `docker volume prune`
- `npx prisma migrate reset`
- `npx prisma db push --accept-data-loss`
- Cualquier borrado masivo de datos o secretos

## 5) Preflight bloqueante (obligatorio antes de deploy)

Validar TODO lo siguiente; si algo falla, abortar deploy:

- Existe `.env` en el VPS.
- `APP_DOMAIN` esta definido y no vacio.
- `NEXT_PUBLIC_APP_URL`:
  - esta definido
  - usa `https://`
  - su host coincide exactamente con `APP_DOMAIN`
- `SEED_CREATE_DEMO_EVENT="false"` en produccion.
- Red Docker externa `proxy` existe.
- Servicio Traefik del host esta operativo.
- No hay intencion de rotar credenciales sin autorizacion.

## 6) Redes y Traefik

- `traefik` vive en stack separado (`/opt/traefik`) y usa red externa `proxy`.
- En produccion:
  - `app` debe estar en redes `proxy` e `internal`.
  - `db` debe estar solo en `internal`.
- `app` debe incluir el label:
  - `traefik.docker.network=proxy`
- El router debe usar `Host(${APP_DOMAIN})` y TLS por `websecure`.

## 7) Flujo oficial de deploy

### 7.1 Primera instalacion

- Se permite `cp .env.example .env` solo si `.env` no existe.
- Completar secretos reales y dominio final HTTPS.
- Ejecutar:
  - `docker compose -f docker-compose.prod.yml up -d --build`
  - `docker compose -f docker-compose.prod.yml exec app npx prisma db push`
- `npm run db:seed` solo si se requiere alta inicial de usuarios.

### 7.2 Actualizaciones futuras

- Actualizar codigo sin comandos destructivos.
- Verificar que `.env` exista y permanezca intacto.
- Ejecutar:
  - `docker compose -f docker-compose.prod.yml up -d --build`
  - `docker compose -f docker-compose.prod.yml exec app npx prisma db push`
- No ejecutar seed por defecto.

## 8) Prisma y seed

- Mientras no haya `prisma/migrations` versionadas, usar `prisma db push` en produccion.
- No usar `migrate deploy` hasta adoptar migraciones versionadas.
- `npm run db:seed` no se ejecuta en cada deploy.
- `SEED_CREATE_DEMO_EVENT` debe permanecer en `false` en produccion.

## 9) Mercado Pago (critico)

- `Public Key` y `Access Token` no son intercambiables:
  - `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` -> frontend
  - `mercadoPagoAccessToken` / `MERCADOPAGO_ACCESS_TOKEN` -> backend
- Precedencia efectiva del Access Token backend:
  - 1) DB (`PlatformConfig.mercadoPagoAccessToken`)
  - 2) `.env` (`MERCADOPAGO_ACCESS_TOKEN`)
- Al cambiar de cuenta MP:
  - actualizar Public Key en `.env`
  - actualizar Access Token en DB (admin/settings o SQL)
  - actualizar webhook en MP a `https://<dominio>/api/mercadopago/webhook`
  - guardar nuevo webhook secret en admin/settings

## 10) Checklist obligatorio post-deploy (con criterio de exito)

- `docker compose -f docker-compose.prod.yml ps`
  - Exito: `app` y `db` en estado `Up`
- `docker compose -f docker-compose.prod.yml logs --tail=100 app`
  - Exito: sin errores de arranque, Prisma o variables faltantes
- `docker logs --tail=100 traefik`
  - Exito: router activo sin errores de certificado/routing
- `curl -I https://<dominio>/login`
  - Exito: respuesta HTTP `200`, `301` o `302` valida
- Prueba funcional MP:
  - crear preferencia y redirigir a checkout
  - confirmar recepcion de webhook 2xx
  - validar efecto final esperado (tickets/email)

## 11) Control de cambios funcionales (bloqueante)

- Regla dura: el agente NO puede modificar comportamiento funcional sin confirmacion explicita del usuario.
- "Cambio funcional" incluye:
  - agregar, eliminar o alterar flujos de negocio
  - cambiar validaciones, permisos, defaults o reglas de calculo
  - modificar endpoints, contratos de API, payloads o respuestas
  - eliminar pantallas, rutas, acciones o integraciones
  - cambiar orden/resultado de procesos (pagos, emails, tickets, webhooks)
- Permitido sin preguntar (solo si no cambia comportamiento):
  - refactor interno equivalente
  - mejoras de estilo/formato/tipos/lint
  - comentarios, logs no invasivos, tests, documentacion
- Protocolo obligatorio antes de tocar codigo funcional:
  - enviar "Propuesta de Impacto" con: archivo, funcion, comportamiento actual, comportamiento propuesto, riesgo
  - esperar aprobacion textual del usuario: `APROBADO CAMBIO FUNCIONAL`
  - sin esa frase, detenerse y no aplicar cambios funcionales
- Si el usuario pide "arreglar" sin detallar alcance:
  - asumir modo conservador
  - hacer solo cambios no funcionales o correcciones minimas
  - pedir confirmacion antes de eliminar o simplificar funcionalidades existentes
- Regla anti-regresion:
  - nunca eliminar funcionalidad existente para resolver otra cosa, salvo pedido explicito
  - si se reemplaza una funcionalidad, mantener compatibilidad o plan de migracion aprobado

## 12) Cambios que requieren confirmacion explicita del usuario

- Rotar o reemplazar credenciales (MP, SMTP, secrets).
- Borrar volumenes o datos de Postgres.
- Cambiar reglas de red/proxy/firewall.
- Forzar reset de configuraciones guardadas en DB.
- Cualquier accion destructiva o no reversible.

## 13) Errores frecuentes y respuesta esperada

- `Host('')` o Traefik sin ruta:
  - revisar `APP_DOMAIN` en `.env` y labels de router
- `PA_UNAUTHORIZED_RESULT_FROM_POLICIES`:
  - validar token real backend (`users/me`)
  - confirmar que no se guardo Public Key como Access Token
- Pago aprobado sin tickets/email:
  - revisar webhook en MP
  - revisar webhook secret configurado en app
  - revisar logs de procesamiento post-pago

## 14) Politica de salida del agente (obligatoria)

- Antes de ejecutar: informar preflight y riesgos.
- Despues de ejecutar: reportar comandos usados y evidencia de exito/fallo.
- Si una validacion critica falla: detenerse y pedir confirmacion, sin improvisar bypass.
