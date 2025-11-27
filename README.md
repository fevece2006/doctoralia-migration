# Doctoralia Migration - Pipeline

Este proyecto implementa un pipeline reproducible para obtener datos públicos de Doctoralia.pe, generar datos ficticios (pacientes y citas) y cargar todo en una base PostgreSQL usando Prisma.


## Requisitos
- Docker & Docker Compose
- Node 20.x (localmente para desarrollo opcional)

## Para levantar la aplicación usa:
```
docker-compose up -d
```

## O si necesitas reconstruir antes:
```
docker-compose up --build -d
```

## Para verificar que está corriendo:

```
docker ps
```

## Para ver logs en tiempo real:

```
docker logs doctoralia-migration-app-1 -f
```

