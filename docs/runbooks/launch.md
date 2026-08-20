# Runbook de lanzamiento

## Responsables

Asignar antes de comenzar: responsable técnico, responsable operativo del bar, aprobador
de producción y custodio del backup. Una misma persona puede cubrir más de un rol, pero
cada casilla debe tener nombre y canal de contacto.

## Checklist previo

- [ ] CI verde en el commit candidato.
- [ ] Migraciones aplicadas primero en preview y pruebas SQL/RLS aprobadas.
- [ ] Registro público deshabilitado y
      [runbook de usuarios](user-provisioning.md) completado: dos admins y staff activos.
- [ ] Proyectos y claves de preview/producción comparados por `PROJECT_REF`.
- [ ] UAT completada en la terminal real y en ancho móvil.
- [ ] Alta de producto, ajuste, cuenta, alta/edición/anulación y cierre verificados.
- [ ] Precio histórico sin cambios al modificar el producto.
- [ ] E2E concurrente confirma que dos cierres paralelos devuelven el mismo recibo.
- [ ] Backup manual cifrado descargado y checksum verificado.
- [ ] Rollback de Cloudflare conocido por el responsable técnico.

## Secuencia

1. Congelar cambios funcionales.
2. Aplicar migraciones compatibles a producción.
3. Ejecutar **Backup completo posterior a migración** y comprobar que terminó bien.
4. Confirmar aceptación e inicio/cierre de sesión de los dos admins y staff de producción.
5. Cargar catálogo y conteo físico inicial; reconciliar el total con el responsable.
6. Ejecutar **Desplegar Cloudflare Pages** hacia `production`.
7. Realizar smoke sin alterar ventas: login, catálogo, inventario e historial vacío.
8. Abrir operación y observar la primera cuenta de extremo a extremo.
9. Registrar commit, migración, backup, despliegue, hora y responsables.

## Criterios de aborto

- El frontend productivo apunta al `PROJECT_REF` incorrecto.
- Un usuario anónimo o inactivo accede a datos.
- Una corrección no devuelve exactamente las unidades esperadas.
- El cierre duplica recibos o permite editar una cuenta cerrada.
- No existe backup verificable previo.

Ante un criterio de aborto, detener nuevas cuentas, conservar evidencia y seguir el
runbook de incidentes.

## Primeras 24 horas

- Revisar al cambio de turno stock de tres productos de alta rotación.
- Comparar recibos con movimientos de inventario.
- Confirmar ejecución del backup diario.
- Registrar errores de operador antes de decidir cambios urgentes.
