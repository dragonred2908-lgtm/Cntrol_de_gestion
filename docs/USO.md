# Manual de uso

NÚCLEO CONTROL ordena el trabajo diario: cada encargo entra como orden, avanza por estados y queda registrado quién hizo qué.

## Qué resuelve

- Un único listado de órdenes, sin depender de mensajes sueltos.
- Trazabilidad: cada cambio de estado y cada nota quedan en la actividad y la auditoría.
- Avisos al grupo de Telegram sin salir de la herramienta.
- Indicadores del día y reportes para revisar carga y tiempos.

## Roles

| Rol | Dónde trabaja | Puede |
|---|---|---|
| `developer` | Web | Todo, incluida la configuración técnica |
| `admin` | Web | Gestión completa salvo ajustes técnicos |
| `viewer` | Web | Consulta sin modificar |
| `operator` | Telegram | No tiene acceso web: crea y actualiza órdenes desde el grupo |

Un `operator` no debe recibir el PIN: su canal es el bot.

## Pantallas

Las rutas son hash, sin recarga completa del navegador:

| Ruta | Pantalla |
|---|---|
| `#/hoy` | Panel del día: carga, pendientes y estado general |
| `#/ordenes` | Listado y tablero completo de órdenes |
| `#/ordenes/:id` | Detalle de una orden |
| `#/equipo` | Integrantes, roles y carga por persona |
| `#/telegram` | Estado del bot, prueba de conexión y envíos |
| `#/reportes` | Indicadores y análisis por IA |
| `#/auditoria` | Historial de cambios |
| `#/ajustes` | Preferencias, sesión y datos |

## Ciclo de vida y prioridad

Estados, siempre en este orden:

```
recibida → en_cuenta → en_proceso → finalizada
```

Prioridades: `baja`, `media`, `alta`, `urgente`. No se inventan valores nuevos: son las claves canónicas del sistema.

## Crear una orden

1. Entra en `#/ordenes` y pulsa el botón de nueva orden.
2. Rellena título, descripción, prioridad y responsable.
3. Guarda: la orden aparece como `recibida` y se anuncia en el grupo si Telegram está configurado.

Desde Telegram, `/nuevaorden` crea la orden con una conversación guiada.

## Mover en el kanban

En `#/ordenes`, arrastra la tarjeta a la columna siguiente o cambia el estado desde el detalle. El cambio se refleja al instante para el resto del equipo (Socket.IO + SSE) y, si no hay red, queda en cola y se envía al recuperar la conexión.

## Notas

En el detalle de la orden (`#/ordenes/:id`) añade notas fechadas: decisiones, bloqueos, teléfonos, acuerdos. Las notas no se sobrescriben, se acumulan.

## Recordatorios y comunicados

- **Recordatorio**: aviso puntual a la persona asignada, con la orden como referencia.
- **Comunicado (broadcast)**: mensaje a todo el grupo, para cambios de proceso o avisos generales.

Ambos se envían a Telegram desde la app y quedan en el historial de la orden cuando corresponde.

## Reportes

`#/reportes` muestra los agregados del periodo: órdenes por estado, prioridad y departamento, y carga por integrante. El análisis por IA usa esos mismos datos (ver [PRIVACIDAD.md](./PRIVACIDAD.md): incluye nombres de integrantes).

## Auditoría

`#/auditoria` responde a «¿quién cambió esto y cuándo?». Registra transiciones de estado, creación y borrado de órdenes y notas. Para revisar un incidente, filtra por fecha y por persona.

## Ajustes

`#/ajustes`: preferencias de interfaz, estado de la persistencia, exportación y restablecimiento de datos, y «Cerrar sesión» (la sesión caduca sola a las 12 h).

## En el móvil

La interfaz es responsive: en escritorio se ve la barra lateral plegable; en móvil, un menú lateral desplegable y la lista de órdenes a pantalla completa. Crea y mueve órdenes igual; para trabajo rápido en el móvil, Telegram suele ser más cómodo.
