# Inventra — Sistema de gestión de inventarios

Aplicación web **funcional** de inventarios para pequeñas y medianas empresas, construida con **HTML5, CSS3 y JavaScript ES6+ (ES Modules)**, sin frameworks ni dependencias externas, y diseñada desde el primer día para migrar a **React + API REST** sin reescribir la lógica de negocio.

> ⚠️ **Demostración frontend.** La autenticación, los permisos y la persistencia se simulan en el navegador (LocalStorage). No es una aplicación segura para producción sin un backend. Ver [`docs/SECURITY.md`](docs/SECURITY.md).

---

## Características

| Módulo | Qué hace |
|---|---|
| **Dashboard** | 8 KPI calculados en vivo (valor, activos, stock bajo, agotados, entradas, salidas, rotación anualizada, cobertura en días), hallazgos automáticos en lenguaje natural, evolución del valor (SVG), entradas vs. salidas, productos más movidos, valor por categoría, alertas, últimos movimientos y productos críticos. Período 7/30/90 días. |
| **Existencias** | Saldo por producto con estado visual (Disponible, Stock bajo, Agotado, Sobre stock, Bloqueado), medidor de nivel, chips de filtro rápido, valor total. |
| **Productos** | CRUD completo con validación, selects dependientes (categoría → subcategoría, centro → ubicación), stock inicial trazable, baja lógica, eliminación física solo sin movimientos, acciones masivas, ficha con kardex reciente. |
| **Categorías · Ubicaciones · Proveedores · Usuarios** | CRUD genérico (una sola fábrica), búsqueda, filtros, activar/desactivar, reglas de integridad referencial. |
| **Entradas · Salidas · Ajustes** | Formulario con **vista previa de impacto** (stock actual → saldo resultante, alertas de mínimo/máximo), confirmación, registro atómico, costo promedio ponderado, ajuste por conteo físico con justificación obligatoria. |
| **Historial** | Trazabilidad completa (stock anterior/nuevo, usuario, centro, documento), filtros combinables con rango de fechas, exportación. |
| **Roles y permisos** | RBAC por capacidades con función central `hasPermission()`, matriz de permisos y editor de roles. |
| **Auditoría** | Bitácora de todas las operaciones con valores antes/después. |
| **Reportes** | Valoración por categoría, **Análisis ABC (Pareto)**, rotación/cobertura/inventario inmovilizado, movimientos por motivo y **kardex** por producto. |
| **Exportación** | CSV (con protección contra inyección de fórmulas), JSON e impresión/PDF del navegador. Respaldo e importación completos. |
| **UX** | Tema claro/oscuro/sistema, responsive (desktop → móvil con tablas en tarjetas y modales tipo *sheet*), búsqueda global `⌘K`, skeletons, empty/error states, toasts, diálogos de confirmación, accesibilidad WCAG 2.1 AA (auditado con axe-core). |

## Tecnologías

- HTML5 semántico · CSS3 (custom properties, `color-mix`, `backdrop-filter`, temas por variables) · JavaScript ES2022 (módulos nativos, `async/await`, `import()` dinámico)
- Gráficos SVG propios · iconografía SVG propia · tipografía del sistema
- Persistencia: `LocalStorage` detrás de un adaptador intercambiable
- **Cero dependencias** en tiempo de ejecución

## Instalación y ejecución

Los ES Modules no funcionan con `file://`, así que la app debe servirse por HTTP. Cualquiera de estas opciones:

```bash
# Opción 1 (Node 18+)
npm start                 # → http://localhost:5173

# Opción 2 (Python)
python3 -m http.server 5173

# Opción 3: extensión "Live Server" de VS Code sobre index.html
```

### Usuarios demo (contraseña: `demo1234`)

| Rol | Correo | Puede |
|---|---|---|
| Administrador | admin@inventra.demo | Todo, incluido stock negativo (permiso especial) |
| Supervisor | supervisor@inventra.demo | Productos, movimientos, ajustes, reportes, exportar |
| Operador | operador@inventra.demo | Entradas y salidas; sin ajustes |
| Consulta | consulta@inventra.demo | Solo lectura + reportes |

La pantalla de inicio de sesión tiene accesos rápidos para cada rol.

### Pruebas

```bash
npm test                  # 31 pruebas de dominio y servicios en Node
```

O abre `http://localhost:5173/tests/` para ejecutarlas en el navegador.

## Estructura

```text
inventra/
├── index.html                 # Shell HTML + CSP
├── assets/favicon.svg
├── css/                       # Design system por capas
│   ├── reset.css · variables.css (tokens) · themes.css (claro/oscuro)
│   ├── layout.css · components.css · forms.css · tables.css · dashboard.css
│   └── responsive.css
├── js/
│   ├── app.js                 # Bootstrap: tema → datos → sesión → layout → router
│   ├── theme-boot.js          # Aplica el tema antes del primer pintado
│   ├── config/                # constants, permissions (catálogo), routes (+ navegación)
│   ├── core/                  # router, store, storage (adaptadores), events, theme, errors
│   ├── domain/                # ⭐ Lógica pura: inventory, analytics, products, query, access
│   ├── data/                  # Datos demo + generador determinista (seed.js)
│   ├── services/              # "Backend" simulado con interfaz de API (async)
│   ├── components/            # UI reutilizable (tabla, modal, formularios, gráficos…)
│   ├── views/                 # Pantallas (una por ruta, carga diferida)
│   └── utils/                 # html seguro, formatters, validators, dates, dom, permissions
├── tests/                     # Runner propio + pruebas (Node y navegador)
└── docs/                      # Arquitectura, BD, componentes, API, seguridad, pruebas, migración
```

## Datos demo

El generador (`js/data/seed.js`) simula **~100 días de operación** con las mismas reglas de dominio de la app: 45 productos industriales en 8 categorías, 4 centros de trabajo, 12 ubicaciones, 8 proveedores, consumos, compras con *lead time* y punto de reorden, producción, devoluciones, daños y conteos cíclicos (~1.800 movimientos). Los estados finales incluyen productos agotados, bajo mínimo, con sobre stock, bloqueados y sin rotación para que alertas, KPI y reportes muestren casos reales. Sin datos personales reales.

Se puede restablecer en **Configuración → Datos**.

## Documentación

- [Arquitectura](docs/ARCHITECTURE.md) · [Modelo de datos](docs/DATABASE.md) · [`schema.sql`](docs/schema.sql)
- [Componentes](docs/COMPONENTS.md) · [API REST futura](docs/API.md) · [Seguridad](docs/SECURITY.md)
- [Pruebas](docs/TESTING.md) · [Roadmap y fases](docs/ROADMAP.md) · **[Migración a React](docs/REACT-MIGRATION.md)**
