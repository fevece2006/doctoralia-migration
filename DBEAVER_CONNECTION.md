# Instrucciones de Conexión a la Base de Datos

Este documento proporciona instrucciones detalladas para conectarse a la base de datos PostgreSQL del proyecto Doctoralia Migration usando diferentes herramientas.

## 📋 Información de Conexión

| Parámetro | Valor |
|-----------|-------|
| **Host** | `localhost` |
| **Puerto** | `5432` |
| **Base de Datos** | `doctoralia_migration` |
| **Usuario Principal** | `postgres` |
| **Contraseña Principal** | `postgres` |
| **Usuario Alternativo** | `admin` |
| **Contraseña Alternativa** | `admin123` |

---

## 🔧 Opción 1: DBeaver (Recomendado)

DBeaver es un cliente SQL universal gratuito que tiene mejor compatibilidad con diferentes versiones de PostgreSQL.

### Paso 1: Descargar e Instalar DBeaver

1. Descarga DBeaver Community Edition desde: https://dbeaver.io/download/
2. Instala la aplicación siguiendo el asistente de instalación

### Paso 2: Crear Nueva Conexión

1. Abre DBeaver
2. Haz clic en el botón **"Nueva Conexión"** (ícono de enchufe con +) o presiona `Ctrl+Shift+N`
3. Selecciona **PostgreSQL** de la lista de bases de datos
4. Haz clic en **"Siguiente"**

### Paso 3: Configurar la Conexión

Completa los siguientes campos:

```
┌─────────────────────────────────────────┐
│ Connection Settings                     │
├─────────────────────────────────────────┤
│ Host:          localhost                │
│ Port:          5432                     │
│ Database:      doctoralia_migration     │
│ Authentication: Database Native         │
│ Username:      postgres                 │
│ Password:      postgres                 │
│                                         │
│ ☑ Show all databases                    │
│ ☑ Save password                         │
└─────────────────────────────────────────┘
```

### Paso 4: Probar la Conexión

1. Haz clic en **"Test Connection"**
2. Si es la primera vez, DBeaver descargará automáticamente los drivers de PostgreSQL
3. Deberías ver un mensaje: **"Connected"** ✅

### Paso 5: Finalizar

1. Haz clic en **"Finish"**
2. La conexión aparecerá en el panel izquierdo (Database Navigator)
3. Expande la conexión para ver las tablas:
   - `patients` (100 registros)
   - `doctors`
   - `treatments`
   - `doctor_availability`
   - `appointments`

### Consultas de Ejemplo en DBeaver

```sql
-- Ver todos los pacientes
SELECT * FROM patients LIMIT 10;

-- Contar registros
SELECT 
  (SELECT COUNT(*) FROM patients) as total_patients,
  (SELECT COUNT(*) FROM doctors) as total_doctors,
  (SELECT COUNT(*) FROM appointments) as total_appointments;

-- Ver pacientes con formato peruano
SELECT 
  id,
  full_name,
  document_number as DNI,
  phone_number,
  email
FROM patients
WHERE document_number IS NOT NULL
ORDER BY id
LIMIT 10;
```

---

## 💻 Opción 2: pgAdmin

Si prefieres usar pgAdmin (aunque puede tener problemas de compatibilidad con versiones diferentes de PostgreSQL):

### Configuración en pgAdmin

1. Haz clic derecho en **Servers** → **Register** → **Server**
2. En la pestaña **General**:
   - Name: `Doctoralia Migration`
3. En la pestaña **Connection**:
   ```
   Host name/address: localhost
   Port: 5432
   Maintenance database: doctoralia_migration
   Username: postgres
   Password: postgres
   ☑ Save password
   ```
4. Haz clic en **Save**

**Nota**: Si experimentas errores de autenticación con pgAdmin, usa DBeaver o la línea de comandos.

---

## 🖥️ Opción 3: Línea de Comandos (psql)

La forma más directa y confiable de acceder a la base de datos:

### Conectarse usando Docker

```powershell
# Conectar con usuario postgres
docker exec -it doctoralia-migration-db-1 psql -U postgres -d doctoralia_migration

# Conectar con usuario admin
docker exec -it doctoralia-migration-db-1 psql -U admin -d doctoralia_migration
```

### Comandos Útiles en psql

```sql
-- Listar todas las tablas
\dt

-- Describir estructura de tabla
\d patients

-- Ver datos
SELECT * FROM patients LIMIT 5;

-- Contar registros
SELECT COUNT(*) FROM patients;

-- Salir
\q
```

---

## 🔍 Verificación de Datos

Una vez conectado, verifica que los datos fueron generados correctamente:

```sql
-- 1. Verificar total de registros
SELECT 
  'Patients' as tabla, COUNT(*) as total FROM patients
UNION ALL
SELECT 'Doctors', COUNT(*) FROM doctors
UNION ALL
SELECT 'Treatments', COUNT(*) FROM treatments
UNION ALL
SELECT 'Availability', COUNT(*) FROM doctor_availability
UNION ALL
SELECT 'Appointments', COUNT(*) FROM appointments;

-- 2. Ver muestra de pacientes peruanos
SELECT 
  full_name as "Nombre Completo",
  document_number as "DNI",
  phone_number as "Teléfono",
  email as "Correo"
FROM patients
WHERE document_number IS NOT NULL
LIMIT 10;

-- 3. Ver doctores por especialidad
SELECT 
  specialty as "Especialidad",
  COUNT(*) as "Cantidad",
  ROUND(AVG(rating), 2) as "Rating Promedio"
FROM doctors
GROUP BY specialty
ORDER BY "Cantidad" DESC;

-- 4. Ver disponibilidad de doctores
SELECT 
  d.full_name as "Doctor",
  d.specialty as "Especialidad",
  da.day_of_week as "Día",
  da.start_time as "Desde",
  da.end_time as "Hasta"
FROM doctors d
JOIN doctor_availability da ON d.id = da.doctor_id
ORDER BY d.full_name, da.day_of_week
LIMIT 20;
```

---

## 🚨 Solución de Problemas

### Error: "FATAL: password authentication failed"

**Solución 1**: Verifica que el contenedor esté corriendo
```powershell
docker ps | findstr doctoralia
```

**Solución 2**: Reinicia el contenedor de la base de datos
```powershell
docker restart doctoralia-migration-db-1
```

**Solución 3**: Usa el usuario alternativo `admin/admin123`

### Error: "could not connect to server"

**Solución**: Verifica que el puerto 5432 esté mapeado correctamente
```powershell
docker port doctoralia-migration-db-1
# Debería mostrar: 5432/tcp -> 0.0.0.0:5432
```

### Error de versión en pgAdmin

**Solución**: DBeaver tiene mejor compatibilidad con diferentes versiones de PostgreSQL. Usa DBeaver en lugar de pgAdmin.

---

## 📊 Estructura de la Base de Datos

```
doctoralia_migration
│
├── patients
│   ├── id (bigint, PK)
│   ├── full_name (text)
│   ├── document_number (varchar(32))  // DNI peruano
│   ├── phone_number (varchar(32))     // Formato peruano +51
│   └── email (text)
│
├── doctors
│   ├── id (bigint, PK)
│   ├── full_name (text)
│   ├── specialty (text)
│   ├── city (text)
│   ├── address (text)
│   ├── phone_country_code (varchar(8))
│   ├── phone_number (varchar(32))
│   ├── rating (decimal)
│   ├── review_count (integer)
│   └── profile_url (text)
│
├── treatments
│   ├── id (bigint, PK)
│   ├── doctor_id (bigint, FK → doctors)
│   ├── name (text)
│   ├── description (text)
│   ├── price (decimal)
│   ├── currency (varchar(8))
│   └── duration_minutes (integer)
│
├── doctor_availability
│   ├── id (bigint, PK)
│   ├── doctor_id (bigint, FK → doctors)
│   ├── day_of_week (text)
│   ├── start_time (varchar(16))
│   └── end_time (varchar(16))
│
└── appointments
    ├── id (bigint, PK)
    ├── patient_id (bigint, FK → patients)
    ├── doctor_id (bigint, FK → doctors)
    ├── treatment_id (bigint, FK → treatments)
    ├── appointment_datetime (timestamp)
    ├── duration_minutes (integer)
    ├── status (text)
    └── notes (text)
```

---

## 🎯 Próximos Pasos

1. **Explorar los datos** usando las consultas de ejemplo
2. **Analizar la calidad** de los datos generados
3. **Ejecutar el pipeline nuevamente** si necesitas más datos:
   ```powershell
   docker-compose restart app
   ```
4. **Modificar configuración** en `.env` para ajustar cantidades:
   ```env
   PATIENTS_COUNT=200
   DOCTORS_PER_SEARCH=10
   ```

---

## 📞 Soporte

Si encuentras problemas de conexión:
1. Verifica que Docker Desktop esté corriendo
2. Asegúrate de que los contenedores estén activos: `docker ps`
3. Revisa los logs: `docker logs doctoralia-migration-db-1`
4. Usa la línea de comandos (psql) como alternativa confiable
