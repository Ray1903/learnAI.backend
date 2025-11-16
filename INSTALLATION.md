# 🚀 LearnAI Backend - Guía de Instalación Completa

## 📋 Requisitos Previos

### 1. Software Necesario
- **Node.js** v18 o superior
- **PostgreSQL** v12 o superior
- **npm** o **yarn**
- **Git**

### 2. Extensiones de PostgreSQL
- **pgvector** (para búsqueda semántica)

---

## 🛠️ Instalación Paso a Paso

### Paso 1: Clonar el Repositorio
```bash
git clone <repository-url>
cd learnAI.backend
```

### Paso 2: Instalar Dependencias
```bash
npm install
```

### Paso 3: Configurar PostgreSQL y pgvector

#### 3.1 Instalar PostgreSQL
**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
```

**macOS (con Homebrew):**
```bash
brew install postgresql
brew services start postgresql
```

**Windows:**
- Descargar desde [postgresql.org](https://www.postgresql.org/download/windows/)

#### 3.2 Instalar pgvector
```bash
# Ubuntu/Debian
sudo apt install postgresql-14-pgvector

# macOS
brew install pgvector

# Desde código fuente (si no está disponible en paquetes)
git clone --branch v0.8.1 https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install
```

#### 3.3 Crear Base de Datos
```bash
# Conectar a PostgreSQL
sudo -u postgres psql

# Crear base de datos
CREATE DATABASE learnAI;

# Crear usuario (opcional)
CREATE USER learnai_user WITH PASSWORD 'tu_password_seguro';
GRANT ALL PRIVILEGES ON DATABASE learnAI TO learnai_user;

# Habilitar pgvector
\c learnAI
CREATE EXTENSION vector;

# Verificar instalación
SELECT * FROM pg_extension WHERE extname = 'vector';

\q
```

### Paso 4: Configurar Variables de Entorno

#### 4.1 Copiar archivo de ejemplo
```bash
cp .env.example .env
```

#### 4.2 Editar `.env`
```bash
# Configuración básica de Strapi
HOST=0.0.0.0
PORT=1337
APP_KEYS="tu_app_key_aqui_debe_ser_muy_segura"
API_TOKEN_SALT=tu_api_token_salt_seguro
ADMIN_JWT_SECRET=tu_admin_jwt_secret_muy_seguro
TRANSFER_TOKEN_SALT=tu_transfer_token_salt_seguro
JWT_SECRET=tu_jwt_secret_super_seguro
ENCRYPTION_KEY=tu_encryption_key_de_32_caracteres

# ⚠️ CRÍTICO: Configuración de OpenAI
OPENAI_API_KEY=sk-tu_openai_api_key_aqui

# Configuración de PostgreSQL
DATABASE_CLIENT=postgres
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=learnAI
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=tu_password_postgres
DATABASE_SSL=false

# URL completa (alternativa)
# DATABASE_URL=postgresql://postgres:password@localhost:5432/learnAI
```

#### 4.3 Obtener API Key de OpenAI
1. Ve a [platform.openai.com](https://platform.openai.com)
2. Crea una cuenta o inicia sesión
3. Ve a "API Keys"
4. Crea una nueva API key
5. Cópiala al archivo `.env`

### Paso 5: Generar Claves Seguras
```bash
# Generar claves aleatorias (Linux/macOS)
openssl rand -base64 32

# O usar Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Paso 6: Inicializar la Base de Datos
```bash
# Ejecutar migraciones
npm run build
npm run strapi admin:create-user

# Seguir las instrucciones para crear un usuario admin
```

### Paso 7: Ejecutar el Servidor
```bash
# Modo desarrollo
npm run develop

# Modo producción
npm run build
npm run start
```

---

## ✅ Verificación de Instalación

### 1. Verificar que el servidor esté funcionando
```bash
curl http://localhost:1337/admin
# Debería retornar código 200
```

### 2. Verificar pgvector
```bash
# Conectar a la base de datos
psql -h localhost -U postgres -d learnAI

# Verificar extensión
SELECT * FROM pg_extension WHERE extname = 'vector';

# Debería mostrar la extensión instalada
```

### 3. Verificar OpenAI
- Sube un documento PDF
- Verifica que se generen embeddings automáticamente
- Prueba la búsqueda semántica

---

## 🔧 Configuración Adicional

### Configuración de Producción

#### 1. Variables de Entorno de Producción
```bash
NODE_ENV=production
DATABASE_SSL=true
```

#### 2. Configuración de Nginx (opcional)
```nginx
server {
    listen 80;
    server_name tu-dominio.com;

    location / {
        proxy_pass http://localhost:1337;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

#### 3. PM2 para Producción
```bash
# Instalar PM2
npm install -g pm2

# Crear archivo ecosystem.config.js
module.exports = {
  apps: [{
    name: 'learnai-backend',
    script: 'npm',
    args: 'start',
    env: {
      NODE_ENV: 'production'
    }
  }]
}

# Ejecutar con PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## 🚨 Solución de Problemas Comunes

### Error: "pgvector extension not found"
```bash
# Verificar que pgvector esté instalado
sudo apt list --installed | grep pgvector

# Reinstalar si es necesario
sudo apt install postgresql-14-pgvector
```

### Error: "OpenAI API key not found"
```bash
# Verificar que la variable esté configurada
echo $OPENAI_API_KEY

# Verificar en el archivo .env
cat .env | grep OPENAI_API_KEY
```

### Error: "Database connection failed"
```bash
# Verificar que PostgreSQL esté corriendo
sudo systemctl status postgresql

# Verificar conexión
psql -h localhost -U postgres -d learnAI -c "SELECT 1;"
```

### Error: "Port 1337 already in use"
```bash
# Encontrar proceso usando el puerto
sudo lsof -i :1337

# Matar proceso si es necesario
sudo kill -9 <PID>
```

---

## 📚 Recursos Adicionales

- [Documentación de Strapi](https://docs.strapi.io/)
- [Documentación de pgvector](https://github.com/pgvector/pgvector)
- [API de OpenAI](https://platform.openai.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

---

## 🎯 Próximos Pasos

Una vez instalado correctamente:

1. **Lee la [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)** para entender los endpoints
2. **Sube tu primer documento** usando la API
3. **Prueba la búsqueda semántica** con consultas de ejemplo
4. **Configura el frontend** para conectar con este backend

¡Tu sistema LearnAI está listo para funcionar! 🚀
