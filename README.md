# Planeii · PLANEI OS

Plataforma de gestión operativa para viajes grupales de mujeres. Las organizadoras gestionan
cada viaje (itinerario y costos, viajeras, pagos, proveedores, notas, equipo) y publican una
página de venta con formulario de solicitud, métricas y panel de solicitudes.

Nació en Lovable y se migró a una estructura estándar: TanStack Start sobre Cloudflare Workers,
con Supabase como base de datos, autenticación y archivos.

## Documentación

| Documento | Contenido |
|---|---|
| [docs/evaluacion-plataforma.md](docs/evaluacion-plataforma.md) | Si vale la pena salir de Lovable y plan para convertir PlanEII en plataforma |
| [docs/estado.md](docs/estado.md) | Estado del repo: checks, seguridad, bugs, deuda técnica |
| [docs/stack.md](docs/stack.md) | Tecnologías, versiones, scripts y variables de entorno |
| [docs/secciones.md](docs/secciones.md) | Secciones de la app, pestañas del viaje y de la landing |
| [docs/arquitectura.md](docs/arquitectura.md) | Grafos de arquitectura, capas, modelo de datos y permisos |
| [docs/flujos.md](docs/flujos.md) | Diagramas de los flujos implementados |
| [docs/migracion.md](docs/migracion.md) | Qué se cambió respecto a Lovable y cómo terminar la puesta en marcha |
| [AGENTS.md](AGENTS.md) | Reglas de arquitectura del editor de páginas de venta |
| [docs/historial-lovable/](docs/historial-lovable/) | Planes históricos del agente de Lovable |

## Desarrollo local

Requisitos: [Bun](https://bun.sh) 1.4 o superior y un proyecto Supabase (remoto o local con
`bunx supabase start`).

```bash
bun install
cp .env.example .env          # completá las credenciales de Supabase
bun run db:push               # aplica las migraciones al proyecto vinculado
bun run dev                   # http://localhost:8080
```

El primer usuario necesita el rol owner para crear viajes: registrate y ejecutá
`supabase/snippets/grant-owner.sql` con tu email.

## Comprobaciones

```bash
bun run typecheck
bun run lint
bun run test        # tests unitarios
bun run build
```

## Despliegue

```bash
bun run deploy      # build + wrangler deploy
```

Los secretos y variables del Worker se describen en [docs/migracion.md](docs/migracion.md).
