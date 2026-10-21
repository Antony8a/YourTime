# Producto

Fuente única de las **reglas de negocio**. Si algo aquí cambia, el resto de documentos solo lo
referencia.

## Qué es YourTime

Una app móvil donde una persona **publica una tarea** que necesita resolver, otras personas
**se postulan** proponiendo un precio, y quien publicó **elige a una** para que la haga.

YourTime conecta a las dos partes. **No procesa pagos**: el precio se acuerda y se paga directamente
entre ambas personas, fuera de la plataforma.

## Roles

No hay roles fijos. Cualquier persona puede publicar y puede postularse, según el momento.

- **Quien publica** (poster): crea la tarea, revisa postulaciones, elige, finaliza o cancela.
- **Quien se postula** (applicant): explora tareas, se postula, retira su postulación.

## Flujo

```
Publicar ─▶ Abierta ─▶ Postulaciones ─▶ Elegir ─▶ Asignada ─▶ En camino ─▶ En servicio ─▶ Finalizada
                                                     │            │
                                                     └─ cancelar ─┘  (quien publica, antes de empezar)
```

1. La persona publica una tarea con categoría, descripción, presupuesto, ubicación (o remota) y
   fecha opcional.
2. Las demás la ven en **Explorar**, con la distancia a cada una, y se postulan con un precio y un
   mensaje.
3. Quien publicó ve las postulaciones, con la calificación de cada postulante, y **elige
   exactamente una**. Las demás pasan a "no seleccionada" en la misma operación.
4. Al elegir empieza el **servicio**: ambas personas pasan a una pantalla de seguimiento (ver
   "Servicio en vivo") y **ven los datos de contacto** de la otra.
5. Quien hace el servicio lo conduce paso a paso: **iniciar ruta**, **iniciar servicio** y
   **finalizar**. Al finalizar, ambas personas se califican.

### Estados de la tarea

| Estado        | Significado                                  | Se puede editar | Recibe postulaciones |
| ------------- | -------------------------------------------- | --------------- | -------------------- |
| `open`        | Publicada, sin elegir                        | Sí              | Sí                   |
| `assigned`    | Ya se eligió a alguien; aún no sale          | No              | No                   |
| `en_route`    | La persona elegida va hacia el lugar         | No              | No                   |
| `in_progress` | El servicio está en marcha                   | No              | No                   |
| `completed`   | Finalizada                                   | No              | No                   |
| `cancelled`   | Cancelada por quien publicó antes de empezar | No              | No                   |

`assigned`, `en_route` e `in_progress` son los estados **activos**: el servicio está contratado y
sin terminar.

Transiciones: `open → assigned → en_route → in_progress → completed`. Las tareas remotas se saltan
`en_route` (`assigned → in_progress`). Además, `open|assigned|en_route → cancelled` y
`assigned|en_route → open` cuando quien hace el servicio renuncia.

### Estados de la postulación

`pending → accepted | rejected | withdrawn`

- Solo se puede **retirar** una postulación `pending`. Una `accepted` no se retira: quien hace el
  servicio puede **renunciar** mientras no haya empezado (ver abajo), y quien publicó puede cancelar.
- Quien retiró, o renunció a un servicio, puede **volver a postularse** mientras la tarea siga
  abierta.
- Quien fue **rechazada** no puede volver a postularse a esa tarea.
- Cada persona tiene como máximo una postulación por tarea.

## Un servicio a la vez

Para que cada servicio reciba atención completa, cada persona puede tener, al mismo tiempo:

- **un servicio contratado** (como quien publica), y
- **un servicio en realización** (como quien lo hace).

Son dos límites independientes: quien está haciendo un servicio sí puede contratar otro, y quien
está contratando uno sí puede hacer otro.

- Contar como "en curso" significa estar en `assigned`, `en_route` o `in_progress`. Al finalizar o
  cancelar, la persona queda libre.
- **Se aplica al elegir.** Postularse y publicar siguen siendo libres: la restricción es contratar.
  - Si quien publica ya tiene un servicio contratado en curso, no puede elegir a nadie más hasta
    que termine (`client_busy`).
  - Si el postulante ya está haciendo otro servicio, no se le puede elegir (`worker_busy`). La
    tarjeta del postulante muestra **"Ocupado ahora"** y el botón de elegir queda desactivado, para
    saberlo antes de intentarlo.
- La base de datos lo garantiza con índices únicos parciales, así que si dos personas intentan
  contratar al mismo trabajador a la vez, solo una lo consigue.

## Servicio en vivo

Cuando se elige a alguien, la tarea se convierte en un servicio con una pantalla propia, pensada
como la de un viaje en una app de transporte, pero aquí lo que se contrata es **tiempo**.

**Quien hace el servicio** está obligada a avanzar por estos pasos, y no se puede saltar ninguno:

1. **Iniciar ruta** (tareas presenciales). Exige compartir su ubicación: así quien publicó empieza
   a verla. Pasa a `en_route`.
2. **Iniciar servicio**, al llegar. Pasa a `in_progress` y arranca un cronómetro. Si según su
   ubicación aún está lejos del destino, la app lo avisa y pide confirmar: es una ayuda, no un
   bloqueo, porque el GPS no siempre acierta.
3. **Finalizar servicio.** Pasa a `completed`. Quien publicó también puede **confirmar la
   finalización** una vez iniciado el servicio, para que un olvido no la deje bloqueada.

**La pantalla** muestra, para ambas personas: el mapa con el destino y la ruta, la posición de quien
viene y el tiempo estimado de llegada y la distancia, el estado paso a paso, el cronómetro durante
el servicio, los datos de la otra persona (con su calificación y botones para llamar o escribir), el
detalle del servicio y el **precio acordado**, y los botones que correspondan. Las **tareas
remotas** no tienen mapa ni ruta: van de "asignada" a "en servicio".

**Cancelar y renunciar**

- Quien publicó puede **cancelar** hasta que el servicio empiece. Una vez en servicio ya no: debe
  finalizarse.
- Quien hace el servicio puede **renunciar** antes de empezarlo: la tarea vuelve a quedar abierta,
  su postulación se retira y ambas personas quedan libres.

**Ubicación en vivo**

- Solo mientras el servicio está activo, la app de quien lo hace envía su posición cada pocos
  segundos y quien publicó la ve moverse en el mapa. Al finalizar, cancelar o renunciar, esa posición
  **se borra**.
- La ven únicamente las dos personas del servicio. Nadie más.
- El seguimiento funciona mientras la pantalla del servicio está abierta; no se rastrea en segundo
  plano (ver `ROADMAP.md`).
- Se calcula el tiempo estimado por calles con un servicio de rutas; si no está disponible, se dibuja
  una línea recta y se estima a 25 km/h. Detalles y avisos de producción en `ARCHITECTURE.md`.

Una **barra "servicio en curso"** aparece sobre la navegación mientras se tiene uno, como cliente o
como trabajador, y lleva de vuelta a la pantalla.

## Moneda

La moneda es **una preferencia de la cuenta** (código ISO 4217, por ejemplo `COP`, `USD`, `EUR`).

- Se elige al registrarse (por defecto se sugiere según la región del dispositivo) y se cambia desde
  el perfil.
- Una tarea **conserva la moneda con la que se publicó**: por defecto la de la cuenta de quien
  publica. Cambiar la moneda de la cuenta no reescribe tareas existentes.
- Las postulaciones se expresan en la **moneda de la tarea**.
- **Lo que se acuerda y se paga nunca se convierte.** El precio de una tarea y de una postulación
  es siempre el de su moneda. La conversión es solo una **referencia** para comparar.
- **Conversión de referencia.** Cuando una tarea, una postulación o un servicio está en una moneda
  distinta a la de la cuenta, se muestra debajo, en pequeño, su equivalente con el tipo de cambio
  **del día**: `20 US$ – 40 US$` y debajo `≈ 63.075 COP – 126.151 COP`. Lo mismo al escribir el
  precio de una postulación (se actualiza mientras se escribe). Los equivalentes grandes se
  redondean a unidades enteras; no se muestran centavos en una aproximación. Si todavía no hay
  tipos de cambio, la línea simplemente no aparece.
- **Tipos de cambio.** Una vez al día (y de nuevo si el día no tiene) el servidor guarda los tipos de
  cambio, con historial: así un servicio antiguo se convierte con el cambio **del día en que se
  finalizó**, no con el de hoy. Para un día sin registro se usa el día más cercano disponible y se
  avisa que es aproximado.
- Los importes viajan como **enteros en unidades menores** (centavos). Cuántos decimales tiene cada
  moneda es una decisión de presentación del cliente (por ejemplo `JPY` y `CLP` no tienen
  decimales). Ver `packages/shared-utils/src/currency.ts`.
- Tipos de presupuesto: `fixed` (rango para todo el trabajo), `hourly` (rango por hora) y
  `negotiable` (sin monto; quien se postula propone).

## Ubicación y distancia

Una tarea que queda lejos puede ser poco viable, pero **la distancia solo informa la decisión de la
persona, nunca la bloquea**.

- Cada cuenta puede guardar su **ubicación** (coordenadas y ciudad) y un **radio preferido** en km.
  Sin radio significa "sin límite".
- Toda tarea listada incluye `distance_km` (si hay ubicación de origen) y un indicador
  `within_preferred_radius`: `true` dentro del radio, `false` fuera, `null` si no hay nada que
  comparar. La app lo muestra como una insignia verde o ámbar y un aviso informativo.
- **Postularse siempre es posible**, esté la tarea cerca o lejos.
- Es **parametrizable** y opcional como filtro de navegación:
  - `max_distance_km`: oculta tareas presenciales más lejanas que ese valor.
  - `preferred_radius=true`: aplica el radio guardado de la persona.
  - `sort=distance`: ordena de la más cercana a la más lejana.
  - `lat` / `lng`: usan otro origen en lugar de la ubicación guardada.
- Las tareas **remotas** (`is_remote`) no tienen ubicación, siempre pasan los filtros de distancia y
  se marcan como "Remoto".
- Por defecto Explorar **no filtra**: muestra todo con su distancia. Filtrar es una elección de la
  persona.

### Privacidad de la ubicación

- Quien publica y la persona elegida ven la ubicación **exacta** y la dirección.
- Todas las demás personas reciben una posición **aproximada** (redondeada a 2 decimales, cerca de
  1 km), sin dirección. La distancia se calcula desde ese punto aproximado, de modo que mover el
  origen de búsqueda no permite triangular la dirección real.

## Privacidad de contacto

El correo y el teléfono solo se comparten entre quien publicó y la persona elegida, y solo después
de elegir. Antes, ninguna de las dos partes los ve.

## Calificaciones y reseñas

Cada persona tiene **una calificación de 1 a 5 estrellas**, que es el promedio de lo que otras
personas le dejaron, y la **cantidad de personas que la calificaron**. Se muestra siempre así:
`★ 4,8 (12)`. Si nadie la ha calificado, dice "Sin calificaciones". Se calcula igual como quien
publica y como quien hace la tarea: es una sola reputación por cuenta.

- **Cuándo se califica:** al **finalizar** el servicio. En ese momento la app abre sola la
  calificación para cada persona, incluso si estaba mirando la pantalla cuando la otra finalizó. Puede
  dejarse después desde la tarea, pero solo una vez por tarea y por persona.
- **Quién califica a quién:** solo participan quien publicó y la persona elegida, y cada una
  califica a la otra. Las personas que no fueron elegidas, o que no participaron, no pueden.
- **Qué contiene:** de 1 a 5 estrellas enteras y un comentario opcional (hasta 1000 caracteres).
  Una reseña no se edita ni se borra.
- **Respuesta:** la persona calificada puede **responder una sola vez** (hasta 1000 caracteres). La
  respuesta es pública y tampoco se edita. Quien escribió la reseña no puede responderse a sí misma.
- **Dónde se ve la calificación:**
  - **En cada postulación**, para que quien publica la vea antes de elegir (`★ 4,5 (2)` junto al
    nombre).
  - En quien publica la tarea, tanto en el listado como en el detalle, para quien decide
    postularse.
  - En el **perfil público** de cualquier persona, con todas sus reseñas, comentarios y
    respuestas. Tocar el nombre de un postulante o de quien publica abre ese perfil.
- **Privacidad:** el perfil público muestra nombre, foto, presentación, calificación y reseñas. Nunca
  correo ni teléfono. De cada reseña se ven el autor y el título de la tarea.

## Balance

Desde **Perfil → Mi balance** cada persona ve dos cifras de un periodo: lo que **ganó** haciendo
servicios y lo que **gastó** en servicios que pidió, con el detalle de cada uno y a quién corresponde.

- **Qué cuenta:** los servicios **finalizados** dentro del periodo, al precio acordado. Lo cancelado
  o todavía en curso no suma. El periodo se mide por la fecha de finalización.
- **Cada moneda va aparte, y además hay un total en tu moneda.** Una tarea conserva la moneda de
  quien la publicó, así que alguien puede ganar en COP, EUR y USD. Siempre se muestra un total por
  moneda y el **balance neto** (ganado menos gastado) por moneda, con los montos originales. Cuando
  hay más de una moneda, también se muestra todo sumado **en la moneda de la cuenta**
  (`≈ +625.941 COP`), convirtiendo cada servicio con el cambio del día en que se finalizó. Cada
  servicio de la lista trae su equivalente. Es una referencia, no un movimiento de dinero.
- **Elegir el periodo, de lo más rápido a lo más exacto:**
  1. _Atajos_: 7 días, 30 días, este mes, mes pasado, este año o todo el historial.
  2. _Flechas_ ‹ ›: mueven el periodo actual un mes (si es un mes), un año (si es un año) o su
     misma cantidad de días. No avanzan más allá de hoy.
  3. _Calendario_: se toca el primer día y luego el último, en cualquier orden. Un solo día también
     vale. No deja elegir días futuros.
- Tocar un servicio de la lista abre su tarea.

## Cuentas

- Registro con correo, contraseña (8 a 72 caracteres), nombre y moneda.
- Perfil: nombre, teléfono (E.164, opcional), presentación (opcional), moneda, ubicación y radio.
- No hay verificación de correo ni recuperación de contraseña todavía (ver `ROADMAP.md`).

## Fuera de alcance por ahora

Pagos o custodia de dinero dentro de la plataforma, chat, notificaciones push, seguimiento en
segundo plano, fotos en tareas, moderación de reseñas y panel de administración. Están en `ROADMAP.md`.
