# Liga JS Family 2VS2 — implementación inicial

**Web:** `/liga.html` (misma sesión Supabase de `index.html`/`torneos.html`).
**Android:** JS Torneos Jugadores v1.6.8 (WebView del mismo dominio GitHub Pages).
**Base de datos:** proyecto JS Torneos, migraciones alojadas en Supabase:
- `js_liga_2vs2_tables`
- `js_liga_2vs2_state_api`
- `js_liga_2vs2_actions`

## Aislamiento

La nueva liga usa exclusivamente `public.js_liga_*` y NO reescribe las tablas de torneos tradicionales ni el estado de JS Guardian alojado en Samsung.

## Autenticación y permisos

- Autenticación mediante Supabase Auth de JS Torneos (Google o correo).
- Los jugadores necesitan un perfil en `js_player_profiles` con ID Free Fire verificado y región conocida (SAC, NA o US).
- Los administradores se determinan en el servidor con `js_admins.uid`.
- Todas las tablas nuevas tienen RLS habilitado y permisos de acceso directo revocados a `anon` y `authenticated`.
- Las llamadas pasan por los RPC `js_liga_estado()` (consulta) y `js_liga_accion(p_accion,p_datos)` (mutaciones transaccionales).
- Nunca agregar una credencial service_role al HTML, JS o APK.

## Flujo

1. JS inicia la temporada desde el panel de liga de su cuenta.
2. Un titular invita por web a un jugador verificado. El invitado confirma.
3. Cada equipo puede registrar un suplente fijo; si se activa, reemplaza a uno de los titulares **antes** de comenzar un encuentro.
4. Desde «Desafíos», un jugador que forme parte de la alineación activa reta a otro dúo. Deben aceptar cuatro participantes en dos minutos.
5. El ganador y el perdedor informan sus resultados. Solo cuatro declaraciones compatibles actualizan los marcadores; discrepancias quedan para JS.
6. Se impide repetir un equipo hasta que **ambos dúos** hayan jugado contra otros dos equipos distintos, máximo tres cruces por temporada.
7. El administrador puede anular, resolver, editar premio y finalizar una temporada. Los datos cerrados permanecen guardados.

## Pendientes para futura versión

- Vincular identidades WhatsApp ↔ Supabase Auth mediante código de un solo uso, sin asociarlas por apodo o ID escrito.
- Notificaciones automáticas de JS Guardian por privado.
- Búsqueda automática de rivales (opcional, tras validar los desafíos manuales).
- Importar equipos históricos de Guardian solo previa revisión y consentimiento; **nunca** mezclar puntos automáticamente.

## Calidad

- La APK v1.6.8 mantiene el mismo certificado de firma de v1.6.7.
- Se probó en una transacción reversible el alta de dúos, suplente, aceptaciones, confirmaciones compatibles, puntuación y antirrevancha.
- Requiere una prueba final con cuatro cuentas reales antes de repartir premios.
