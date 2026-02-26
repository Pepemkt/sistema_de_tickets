# Aiderbrand

Plataforma de gestion y venta de entradas a eventos con experiencia profesional:

- Checkout con Mercado Pago.
- Emision automatica de tickets PDF.
- QR unico por ticket con firma.
- Scanner QR para check-in en puerta.
- Envio de entradas por email.
- Editor visual de ticket con preview en vivo, logo e imagen de fondo.
- Roles de acceso (`ADMIN` y `SCANNER`).
- Configuracion de credenciales Mercado Pago desde interfaz.
- Configuracion SMTP desde interfaz para envio de emails.

## Stack

- Next.js 15 + TypeScript
- Prisma + PostgreSQL
- Tailwind + Preline UI
- Mercado Pago REST
- PDF-lib + qrcode
- Nodemailer + SMTP
- html5-qrcode

## Puesta en marcha local

1. Instalar dependencias:

```bash
npm install
```

2. Crear `.env`:

```bash
cp .env.example .env
```

3. Levantar PostgreSQL (Docker):

```bash
docker compose up -d db
```

4. Aplicar schema:

```bash
npm run db:generate
npm run db:push
```

5. Seed inicial (usuarios + evento demo):

```bash
npm run db:seed
```

6. Iniciar app:

```bash
npm run dev
```

## Acceso inicial

- Admin: `admin / admin1234`
- Scanner: `scanner / scanner1234`

Si cambiaste `SEED_*` en `.env`, usa esos valores.

## Flujo principal

1. Admin crea/edita evento y ticket types.
2. Admin disena ticket (colores, textos, fondo, logo) con preview.
3. Comprador paga con Mercado Pago.
4. Webhook confirma pago.
5. Sistema emite tickets con QR y envia PDF por email.
6. Equipo de check-in valida QR en `/scan`.

## Secciones

- `/` catalogo publico de eventos
- `/login` autenticacion staff
- `/admin` dashboard admin
- `/admin/orders` ordenes y pagos
- `/admin/analytics` analytics de ventas y asistencia
- `/admin/events/new` crear eventos
- `/admin/events/:id/edit` editar eventos
- `/admin/events/:id/template` editor de ticket
- `/admin/users` gestion de usuarios y roles
- `/admin/settings` credenciales Mercado Pago + SMTP
- `/scan` scanner/check-in

## Simulacion de compras (modo dev)

Para probar sin pagar en Mercado Pago:

1. Asegura en `.env`:
   - `NEXT_PUBLIC_ENABLE_DEV_SIMULATIONS="true"`
2. Inicia sesion y entra a un evento.
3. En checkout veras el boton:
   - `Simular compra aprobada (dev)`

Esto crea una orden `PAID`, emite tickets y devuelve preview en:

- `/admin/orders/:id/preview`

Desde ahi puedes abrir el PDF final de cada ticket.
Si SMTP esta configurado, tambien enviara email real al comprador.

## Deploy en VPS (Docker Compose)

1. Subir codigo al VPS.
2. Configurar `.env` productivo con dominio HTTPS.
3. Levantar stack:

```bash
docker compose up -d --build
```

4. Aplicar schema:

```bash
docker compose exec app npm run db:push
```

5. Configurar proxy (Nginx/Caddy) al puerto `3000`.
6. Configurar webhook Mercado Pago a:

- `https://tu-dominio.com/api/mercadopago/webhook`

## Notas de seguridad

- Endurecer verificacion criptografica de webhook MP para produccion estricta.
- Forzar HTTPS y cookies seguras en produccion.
- Agregar auditoria y rate limit para endpoints de check-in.
