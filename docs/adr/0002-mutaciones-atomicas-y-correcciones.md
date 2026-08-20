# ADR-0002: Mutaciones atómicas y correcciones auditables

- Estado: aceptada
- Fecha: 2026-08-19

## Contexto

Una misma acción del operador puede cambiar el detalle de una cuenta, el inventario y
el historial. Además, una respuesta perdida puede provocar un reintento. El operador
debe poder editar una cantidad o “borrar” un consumo antes del cierre, devolviendo
siempre las unidades correspondientes.

## Decisión

- Cada comando de negocio se ejecuta mediante un único RPC PostgreSQL.
- Todos los comandos reciben un `request_id` UUID y rechazan su reutilización con un
  payload distinto.
- Los bloqueos siguen el orden cuenta → línea → producto.
- Agregar o aumentar una línea bloquea la operación si dejaría inventario negativo.
- Disminuir una línea devuelve la diferencia al inventario.
- “Borrar” es una anulación lógica: conserva la línea, registra actor, fecha y motivo, la
  excluye del total y devuelve toda su cantidad vigente.
- Los movimientos de inventario son append-only y conservan cantidades antes/después.
- Una cuenta cerrada y su recibo son inmutables. Repetir el cierre devuelve el mismo
  recibo.
- El precio, nombre y SKU se copian al registrar el consumo; nunca se reconstruye el
  pasado con el producto actual.

## Consecuencias

- No se pierden correcciones ni ventas históricas.
- Una caída entre sentencias no deja inventario descontado sin consumo, ni viceversa.
- Cambiar el producto de una línea se expresa como anular la línea y crear otra; no se
  reescribe su `product_id`.
- Las escrituras directas a tablas operativas deben permanecer revocadas para los roles
  del navegador.
