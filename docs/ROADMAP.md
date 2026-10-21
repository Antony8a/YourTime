# Hoja de ruta

Estado del producto y lo que sigue. Las reglas de lo que ya existe están en
[`PRODUCT.md`](PRODUCT.md).

## Hecho

- Cuentas con correo y contraseña, sesión renovable, perfil y preferencias.
- Moneda por cuenta, con tareas que conservan su moneda y presupuesto en unidades menores.
- Publicar, editar, cancelar y finalizar tareas; categorías; búsqueda por texto y categoría.
- Postulaciones con precio propio; elegir, descartar y retirar; elección atómica y concurrente.
- Distancia a cada tarea, radio preferido, filtros opcionales y ordenación por cercanía. Nunca
  bloquea postularse.
- Un servicio contratado y uno en realización por persona, garantizado por la base de datos.
- Servicio en vivo estilo transporte: iniciar ruta, iniciar servicio y finalizar, con mapa, ruta,
  posición en vivo, tiempo estimado, cronómetro, renunciar y cancelar.
- Calificación de 1 a 5 estrellas al finalizar, con comentario y una respuesta; visible junto al
  nombre de cada postulante y de quien publica, y en el perfil público.
- Balance de lo ganado y lo gastado por periodo, por moneda, con atajos, flechas y calendario.
- Conversión de referencia: equivalentes «≈» en la moneda de la cuenta en tareas, postulaciones y
  servicios, y balance total convertido con el cambio del día de cada servicio.
- Privacidad de ubicación (aproximada para terceros) y de contacto (solo entre las dos partes).
- App móvil con sistema de diseño propio, modo claro y oscuro, estados de carga, vacío y error.
- Pruebas unitarias y de extremo a extremo, y CI.

## Siguiente

Ordenado por lo que más cambia la experiencia.

1. **Notificaciones push** (Expo): nueva postulación, fuiste elegido, "ya salió", "llegó". Hoy hay
   que tener la app abierta para enterarse, y el servicio en vivo depende de ello.
2. **Seguimiento en segundo plano** con una tarea nativa de ubicación, para que quien viaja pueda
   bloquear el teléfono sin que el mapa se congele.
3. **Tiempo real** (SSE o WebSocket) en lugar de sondear cada 5 s.
4. **Recuperar contraseña y verificar correo.** Requiere enviar correo (proveedor transaccional).
5. **Tiempos límite del servicio:** liberar a quien nunca inició la ruta y cerrar servicios
   abandonados, para que nadie quede bloqueado por la regla de un servicio a la vez.
6. **Proveedor de mapas y rutas** con contrato y servidor propio (hoy son servidores públicos de
   prueba).
7. **Revocación de sesiones:** lista de tokens de renovación por dispositivo y "cerrar en todos".
8. **Chat entre las dos partes** para coordinar sin compartir el teléfono.
9. **Moderación de reseñas:** reportar una reseña abusiva y revisarla. Hoy no se pueden editar ni
   borrar, y ninguna se revisa.
10. **Selector de fecha y hora real** en el formulario (hoy son atajos: hoy, mañana, en 3 días…).

## Después

- Fotos en las tareas y en el perfil, con almacenamiento de objetos.
- Mapa para elegir y ver la ubicación (hoy se usa la ubicación del dispositivo).
- PostGIS con índice GiST para la búsqueda por radio cuando haya muchas tareas abiertas.
- Límite de peticiones compartido (Redis) al escalar a varias instancias.
- Panel de moderación: suspender cuentas, revisar reportes.
- Pagos o custodia dentro de la plataforma. Es una decisión de producto grande, con implicaciones
  legales y de cumplimiento; se descartó a propósito del alcance actual.
- Aplicación web y publicación en las tiendas (EAS Build).

## Deuda conocida

- La paginación por `offset` puede repetir u omitir elementos si cambian los datos entre páginas;
  aceptable ahora, migrar a cursor si molesta.
- En web, los tokens se guardan en `localStorage`; en iOS y Android usan el llavero del sistema.
- Los tipos de cambio vienen de fuentes públicas gratuitas (open.er-api.com, con respaldo en un
  espejo comunitario), sin garantía de servicio y con atribución obligatoria (se muestra en el
  balance). Para producción, contratar un proveedor con SLA. Son valores de referencia, no de
  transacción.
- Las pantallas no tienen pruebas automáticas de interfaz; se verificaron recorriendo la app en un
  navegador contra la API real.
