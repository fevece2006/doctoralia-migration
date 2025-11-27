# Doctoralia Migration Pipeline - Complete Professional Implementation

Este proyecto implementa un **pipeline profesional y reproducible** para:
1. **Scraping** de datos públicos de doctores desde Doctoralia.pe
2. **Generación** de datos ficticios de pacientes usando Faker
3. **Generación** de citas médicas realistas
4. **Carga** de todos los datos en una base de datos PostgreSQL usando Prisma ORM

## 🏗️ Arquitectura y Patrones de Diseño

### Patrones Implementados
- **Facade Pattern**: Simplifica operaciones complejas de scraping y database
- **Repository Pattern**: Encapsula lógica de acceso a datos
- **Strategy Pattern**: Diferentes estrategias de scraping y generación
- **Factory Pattern**: Creación de objetos (patients, appointments)
- **Template Method Pattern**: Define el esqueleto del pipeline
- **Singleton Pattern**: Gestión de instancias de browser

### Principios SOLID
✅ **Single Responsibility**: Cada clase tiene una única responsabilidad  
✅ **Open/Closed**: Extensible sin modificar código existente  
✅ **Liskov Substitution**: Las abstracciones son sustituibles  
✅ **Interface Segregation**: Interfaces específicas y enfocadas  
✅ **Dependency Inversion**: Dependencia de abstracciones, no implementaciones

### Clean Code
- Nombres descriptivos y semánticos
- Funciones pequeñas y enfocadas
- Comentarios JSDoc para documentación
- Manejo robusto de errores
- Logging estructurado con Pino
- Código TypeScript fuertemente tipado

## 📋 Requisitos

- **Docker** & **Docker Compose**
- **Node.js 20.x** (opcional, para desarrollo local)
- **npm** o **yarn**

## 🚀 Inicio Rápido

### 1. Configuración

Copia el archivo de ejemplo y ajusta las variables:

```bash
cp .env.example .env
```

Edita `.env` según tus necesidades:

```env
# Ciudades y especialidades a scrapear
SCRAPE_CITIES=Lima,Arequipa,Trujillo
SCRAPE_SPECIALTIES=Medicina general,Pediatría,Dermatología

# Cantidad de datos a generar
DOCTORS_PER_SEARCH=5
PATIENTS_COUNT=100
APPOINTMENT_FILL_RATE=0.7

# Configuración de scraping
PLAYWRIGHT_HEADLESS=1
MAX_CONCURRENCY=2

# Limpiar base de datos antes de ejecutar
CLEAR_DATABASE=true
LOG_LEVEL=info
```

### 2. Ejecutar con Docker

```bash
docker-compose up --build
```

El pipeline ejecutará automáticamente:
1. ✅ Inicialización de base de datos PostgreSQL
2. ✅ Scraping de perfiles de doctores desde Doctoralia.pe
3. ✅ Generación de pacientes ficticios
4. ✅ Generación de disponibilidad y tratamientos
5. ✅ Creación de citas médicas realistas
6. ✅ Validación de integridad de datos
7. ✅ Reporte de estadísticas

### 3. Desarrollo Local (Opcional)

```bash
# Instalar dependencias
npm install

# Generar cliente Prisma
npm run prisma:generate

# Ejecutar en modo desarrollo
npm run dev

# Compilar TypeScript
npm run build

# Ejecutar versión compilada
npm start
```

## 📊 Estructura del Proyecto

```
doctoralia-migration/
├── src/
│   ├── pipeline/
│   │   └── index.ts              # Orquestador principal del pipeline
│   ├── scraping/
│   │   ├── playwrightScraper.ts  # Clase base para scraping con Playwright
│   │   └── doctorScraper.ts      # Scraper especializado para Doctoralia
│   ├── generator/
│   │   ├── patients.ts           # Generador de pacientes ficticios
│   │   └── appointments.ts       # Generador de citas médicas
│   ├── db/
│   │   └── seed.ts               # Servicio de seeding a base de datos
│   ├── types/
│   │   └── dtos.ts               # DTOs y tipos TypeScript
│   └── utils/
│       └── logger.ts             # Logger estructurado con Pino
├── prisma/
│   └── schema.prisma             # Schema de base de datos
├── docker-compose.yml            # Orquestación de contenedores
├── Dockerfile                    # Imagen de la aplicación
├── tsconfig.json                 # Configuración TypeScript
└── package.json                  # Dependencias y scripts
```

## 🗄️ Modelo de Datos

### Entidades Principales

**doctors**
- Información del doctor (nombre, especialidad, ciudad)
- Rating y número de reseñas
- Datos de contacto
- URL del perfil original

**treatments**
- Servicios/tratamientos ofrecidos por el doctor
- Precio y moneda
- Duración en minutos

**doctor_availability**
- Horarios disponibles del doctor
- Modalidad (presencial/online)
- Rango de fechas

**patients**
- Datos ficticios generados con Faker
- DNI, teléfono, email
- Datos realistas para Perú

**appointments**
- Citas médicas vinculadas a doctor, paciente y tratamiento
- Estado (scheduled, completed, cancelled, no_show)
- Fechas y horarios

## 🔧 Características Técnicas

### Scraping Resiliente
- ✅ Reintentos automáticos con backoff exponencial
- ✅ Manejo robusto de errores
- ✅ Selectores múltiples para mayor confiabilidad
- ✅ User-Agent y headers realistas
- ✅ Bloqueo de recursos innecesarios (imágenes, CSS)
- ✅ Rate limiting para evitar bloqueos

### Generación de Datos
- ✅ Datos realistas con Faker (locale español)
- ✅ DNI peruanos válidos (8 dígitos)
- ✅ Teléfonos móviles peruanos (formato 9XXXXXXXX)
- ✅ Distribución realista de estados de citas
- ✅ Validación de overlapping de citas

### Base de Datos
- ✅ Prisma ORM con TypeScript
- ✅ Migraciones automáticas
- ✅ Índices optimizados para queries frecuentes
- ✅ Constraints y relaciones bien definidas
- ✅ Batch inserts para mejor rendimiento

### Logging y Monitoreo
- ✅ Logging estructurado con Pino
- ✅ Niveles de log configurables
- ✅ Pretty printing para desarrollo
- ✅ Timestamps ISO 8601
- ✅ Metadata contextual en cada log

## 📈 Estadísticas de Ejemplo

Después de ejecutar el pipeline, verás estadísticas como:

```
========================================
Database Statistics:
  Doctors: 30
  Treatments: 60
  Availability Slots: 420
  Patients: 100
  Appointments: 294
========================================
Appointments by status:
  scheduled: 89
  completed: 156
  cancelled: 31
  no_show: 18
========================================
```

## 🔍 Validación de Datos

El pipeline incluye validación automática de integridad:
- ✅ Verificación de referencias foráneas
- ✅ Detección de registros huérfanos
- ✅ Validación de constraints
- ✅ Reporte de issues encontrados

## 🛠️ Scripts Disponibles

```bash
npm run build          # Compilar TypeScript
npm start              # Ejecutar pipeline
npm run dev            # Modo desarrollo con hot-reload
npm run prisma:generate # Generar cliente Prisma
npm run prisma:push    # Push schema a base de datos
npm run prisma:studio  # Abrir Prisma Studio (GUI)
```

## 🐳 Docker Compose

Servicios incluidos:
- **db**: PostgreSQL 14 con datos persistentes
- **app**: Aplicación Node.js con Playwright

```bash
# Levantar servicios
docker-compose up --build

# Ver logs
docker-compose logs -f app

# Parar servicios
docker-compose down

# Limpiar volúmenes (elimina datos)
docker-compose down -v
```

## 📝 Variables de Entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| `SCRAPE_CITIES` | Ciudades a scrapear (separadas por coma) | `Lima,Arequipa` |
| `SCRAPE_SPECIALTIES` | Especialidades médicas | `Medicina general,Pediatría` |
| `DOCTORS_PER_SEARCH` | Doctores por búsqueda | `5` |
| `PATIENTS_COUNT` | Pacientes a generar | `100` |
| `APPOINTMENT_FILL_RATE` | % de slots a llenar (0-1) | `0.7` |
| `PLAYWRIGHT_HEADLESS` | Modo headless (1/0) | `1` |
| `MAX_CONCURRENCY` | Operaciones concurrentes | `2` |
| `CLEAR_DATABASE` | Limpiar DB antes | `true` |
| `LOG_LEVEL` | Nivel de logging | `info` |

## 🧪 Testing y Calidad

El código sigue mejores prácticas:
- **TypeScript**: Tipado estático fuerte
- **ESLint**: Linting (configurar según preferencia)
- **Prettier**: Formateo consistente
- **Error Handling**: Try-catch en todos los puntos críticos
- **Validation**: Validación de datos entrada/salida

## 🚨 Troubleshooting

### Error: No se encuentran doctores
- Verifica que las URLs de Doctoralia sean correctas
- Revisa los logs para ver qué selectores fallan
- Aumenta `LOG_LEVEL=debug` para más información

### Error: Base de datos no se conecta
- Verifica que Docker esté corriendo
- Asegúrate de que el puerto 5432 no esté en uso
- Revisa `DATABASE_URL` en `.env`

### Error: Playwright no puede iniciar navegador
- Ejecuta: `npx playwright install --with-deps`
- Verifica que haya suficiente memoria disponible

## 📚 Documentación Adicional

- [Prisma Docs](https://www.prisma.io/docs)
- [Playwright Docs](https://playwright.dev)
- [Faker.js Docs](https://fakerjs.dev)
- [Pino Logger](https://getpino.io)

## 👨‍💻 Desarrollo

### Arquitectura por Capas

1. **Pipeline Layer**: Orquestación del flujo completo
2. **Scraping Layer**: Extracción de datos de Doctoralia
3. **Generation Layer**: Generación de datos ficticios
4. **Data Access Layer**: Persistencia en PostgreSQL
5. **Utils Layer**: Logging, configuración, helpers

### Principios de Diseño

- **Separation of Concerns**: Cada módulo tiene responsabilidad clara
- **DRY (Don't Repeat Yourself)**: Código reutilizable
- **KISS (Keep It Simple)**: Soluciones simples y directas
- **YAGNI (You Aren't Gonna Need It)**: Solo lo necesario

## 📄 Licencia

MIT

---

**Nota**: Este proyecto fue desarrollado siguiendo las mejores prácticas de ingeniería de software profesional, incluyendo Clean Code, SOLID, Design Patterns y arquitectura escalable.
