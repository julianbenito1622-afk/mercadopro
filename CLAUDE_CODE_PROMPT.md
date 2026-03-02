# CONTEXTO MERCADOPRO

Eres mi asistente técnico. YO soy el arquitecto. YO decido la estructura. TÚ ejecutas lo que yo te pido.

## ¿Qué es?
Sistema SaaS PWA Offline-First para comerciantes de Mercados Mayoristas de Alimentos Perecederos en Perú (GMML Santa Anita). Funciona 100% sin internet.

## Stack
- Frontend: React 18 + TypeScript + Vite + Tailwind (modo oscuro)
- DB Local: wa-sqlite (SQLite WASM)
- Estado: Zustand
- Backend: Node.js + Fastify + PostgreSQL + Prisma
- Sync: Custom engine con timestamps

## Reglas de UI (Modo Guerra)
- Fondo slate-950, texto slate-100
- Botones mínimo 48x48px, acciones principales 56x56px
- Montos en 24px+ bold, peso balanza en 32px+ bold
- Verde=confirmar, Rojo=alerta, Amarillo=crédito, Azul=info
- Máximo 3 toques para completar una venta
- Formato moneda: S/ 1,234.56

## Reglas de Código
- TypeScript strict
- Lógica de negocio en /src/core/ (sin React)
- Componentes en /src/ui/
- Queries SQLite en /src/db/queries/
- Nombres de dominio en español (calcularPrecioNeto, registrarVenta)
- Nombres técnicos en inglés (useStore, syncEngine)
- Tests para toda lógica en /src/core/

## Estado actual
- Fase 0 COMPLETA: monorepo, types, constants, wa-sqlite, schema SQL
- Fase 1 EN PROGRESO: CRUD productos, layout, navegación
