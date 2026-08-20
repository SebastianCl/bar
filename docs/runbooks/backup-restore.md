# Runbook de backup y restauración

## Objetivo y retención

- Backup diario de datos a las 04:00 de Bogotá, retenido 7 días.
- Backup completo semanal los domingos a las 04:30, retenido 28 días.
- Backup completo mensual, disponible 90 días en GitHub para su exportación.
- Archivo externo propiedad del bar con las 12 copias mensuales más recientes.
- Backup completo manual inmediatamente después de cada migración productiva, retenido
  28 días.
- Cifrado `age` antes de subir el artefacto a GitHub.
- RPO lógico máximo objetivo: 24 horas. RTO objetivo: 4 horas; debe verificarse y medirse
  en los ensayos trimestrales.

GitHub Artifact no ofrece aquí la retención anual requerida. Durante la primera semana de
cada mes, el custodio descarga el artefacto mensual cifrado a almacenamiento propiedad del
bar, verifica su checksum y rota la copia número 13. La retención real en GitHub no puede
superar el máximo configurado por la organización.
Los planes pagos de Supabase pueden aportar backups físicos/PITR adicionales; este
runbook no los reemplaza.

## Preparación única

1. En una máquina segura, instalar `age` y ejecutar:

   ```sh
   age-keygen -o age-key-backup.txt
   ```

2. Guardar la identidad privada fuera de GitHub, idealmente en dos custodias cifradas.
3. Crear la variable de repositorio `BACKUP_AGE_RECIPIENT` con el valor público `age1…`.
4. Crear el secreto `SUPABASE_DB_URL` con la URI PostgreSQL de producción. Si la
   contraseña contiene símbolos, debe estar codificada para URL.
5. Ejecutar manualmente **Backup cifrado diario** y descargar el primer artefacto.

Las migraciones de producción se aplican manualmente, por lo que el backup posterior no
se dispara con el push del repositorio: hacerlo podría capturar el esquema anterior. Tras
cada `supabase db push` exitoso, ejecutar **Backup completo posterior a migración** antes
de continuar el lanzamiento.

Nunca guardar la identidad privada de `age` ni `SUPABASE_DB_URL` en el repositorio.

## Contenido y límites

El diario ejecuta solo el dump de datos. Los respaldos semanal y mensual usan los tres
comandos oficiales:

```sh
supabase db dump --db-url "$SUPABASE_DB_URL" -f roles.sql --role-only
supabase db dump --db-url "$SUPABASE_DB_URL" -f schema.sql
supabase db dump --db-url "$SUPABASE_DB_URL" -f data.sql --data-only --use-copy \
  -x storage.buckets_vectors -x storage.vector_indexes
```

El artefacto contiene `data.sql` y un manifiesto; semanal/mensual añaden `roles.sql` y
`schema.sql`. El procedimiento oficial conserva los datos administrados incluidos los
usuarios Auth, pero no los objetos binarios de Storage. Cambios personalizados al esquema
de `auth` o `storage` requieren un `db diff` separado. Configuración de Auth/SMTP, claves y
secretos del proyecto se reconstruyen manualmente y no deben suponerse dentro del dump.
Véanse [backup con CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
y [límites de backups de plataforma](https://supabase.com/docs/guides/platform/backups).

## Verificación mensual

1. Descargar un artefacto semanal y su `.sha256`.
2. Ejecutar `sha256sum --check ARCHIVO.sha256`.
3. Verificar que la clave privada descifra el archivo sin extraerlo en una ubicación
   compartida.
4. Registrar fecha, responsable, artefacto y resultado en el sistema operativo del bar.

## Ensayo de restauración trimestral

No restaurar por primera vez sobre producción.

1. Crear un proyecto Supabase desechable y obtener su URI PostgreSQL.
2. En una carpeta temporal privada:

   ```sh
   sha256sum --check bar-weekly-RUN.tar.gz.age.sha256
   age --decrypt -i age-key-backup.txt bar-weekly-RUN.tar.gz.age > backup.tar.gz
   mkdir restore
   tar -xzf backup.tar.gz -C restore
   ```

3. Revisar que `manifest.txt`, `roles.sql`, `schema.sql` y `data.sql` existan y no estén
   vacíos.
4. Antes del esquema, revisar la advertencia oficial sobre privilegios por defecto. En un
   proyecto desechable nuevo, ejecutar con un rol administrador:

   ```sql
   alter default privileges in schema public
     revoke all on tables from anon, authenticated;
   ```

5. Restaurar en una sola transacción y detenerse ante el primer error:

   ```sh
   psql --dbname "$RESTORE_DB_URL" \
     --single-transaction \
     --set ON_ERROR_STOP=1 \
     --file restore/roles.sql \
     --file restore/schema.sql \
     --command 'SET session_replication_role = replica' \
     --file restore/data.sql
   ```

6. Aplicar cualquier migración posterior al timestamp del manifiesto.
7. Reconfigurar Auth/SMTP y claves del proyecto; validar login, conteos, RLS, stock,
   cuentas y recibos con un usuario recuperado.
8. Destruir de forma segura los archivos descifrados y el proyecto desechable.

## Restauración por incidente

1. Declarar mantenimiento y registrar la hora del último dato correcto.
2. Tomar un backup del estado dañado antes de intervenir.
3. Preferir reparación transaccional o PITR si el alcance está identificado.
4. Restaurar primero en un proyecto nuevo, validar y luego cambiar el frontend al nuevo
   proyecto en una ventana aprobada.
5. Reconfigurar Auth/SMTP, URLs y claves que no forman parte del dump lógico.
6. Ejecutar smoke tests y reconciliar movimientos posteriores al punto recuperado.
7. Rotar credenciales temporales y documentar pérdida de datos real frente al RPO.
