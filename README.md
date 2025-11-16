# 🚀 LearnAI Backend

Sistema completo de chat asistido por IA para estudiantes con **búsqueda semántica avanzada** usando pgvector y OpenAI embeddings.

## 🌟 Funcionalidades Principales

- 🔐 **Autenticación de Estudiantes** - Sistema completo de registro y login
- 📄 **Procesamiento de Documentos** - Soporte para PDF, DOCX, TXT
- 🧠 **Búsqueda Semántica** - Búsqueda inteligente con pgvector y OpenAI
- 💬 **Chat Contextual** - Asistente IA con contexto automático de documentos
- 📊 **Embeddings Automáticos** - Generación y almacenamiento vectorial
- 🔍 **API REST Completa** - Endpoints para todas las operaciones

## 📚 Documentación

- **[🛠️ Guía de Instalación](./INSTALLATION.md)** - Instrucciones completas paso a paso
- **[📖 Documentación de API](./API_DOCUMENTATION.md)** - Endpoints y ejemplos de uso
- **[⚠️ Diferencia entre `id` y `documentId`](./API_DOCUMENTATION.md#-importante-diferencia-entre-id-y-documentid)** - Guía importante para desarrolladores

## 🚀 Inicio Rápido

### 1. Instalación
```bash
git clone <repository-url>
cd learnAI.backend
npm install
```

### 2. Configuración
```bash
cp .env.example .env
# Editar .env con tus configuraciones
```

### 3. Base de Datos (PostgreSQL + pgvector)
```sql
CREATE DATABASE learnAI;
CREATE EXTENSION vector;
```

### 4. Ejecutar
```bash
npm run develop
```

**📋 Para instrucciones detalladas, consulta [INSTALLATION.md](./INSTALLATION.md)**

## 🔐 Student Authentication API

The application uses **Strapi's native authentication system** with extended student profiles:

### Authentication Endpoints

- **POST** `/api/students/signup` - Register a new student (creates user + profile)
- **POST** `/api/auth/local` - Login (Strapi native)
- **GET** `/api/students/me` - Get student profile with user data
- **PUT** `/api/students/profile` - Update student profile

### Quick Start Example

```bash
# Register a new student (creates user + student profile)
curl -X POST http://localhost:1337/api/students/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "student@example.com",
    "password": "securePassword123",
    "first_name": "John",
    "last_name": "Doe"
  }'

# Login using Strapi's native endpoint
curl -X POST http://localhost:1337/api/auth/local \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "student@example.com",
    "password": "securePassword123"
  }'

# Get student profile (replace TOKEN with JWT from login)
curl -X GET http://localhost:1337/api/students/me \
  -H "Authorization: Bearer TOKEN"

# Update student profile
curl -X PUT http://localhost:1337/api/students/profile \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Jane",
    "phone": "+1234567890"
  }'
```

## 🚀 Getting started with Strapi

Strapi comes with a full featured [Command Line Interface](https://docs.strapi.io/dev-docs/cli) (CLI) which lets you scaffold and manage your project in seconds.

### `develop`

Start your Strapi application with autoReload enabled. [Learn more](https://docs.strapi.io/dev-docs/cli#strapi-develop)

```
npm run develop
# or
yarn develop
```

### `start`

Start your Strapi application with autoReload disabled. [Learn more](https://docs.strapi.io/dev-docs/cli#strapi-start)

```
npm run start
# or
yarn start
```

### `build`

Build your admin panel. [Learn more](https://docs.strapi.io/dev-docs/cli#strapi-build)

```
npm run build
# or
yarn build
```

## ⚙️ Deployment

Strapi gives you many possible deployment options for your project including [Strapi Cloud](https://cloud.strapi.io). Browse the [deployment section of the documentation](https://docs.strapi.io/dev-docs/deployment) to find the best solution for your use case.

```
yarn strapi deploy
```

## 📚 Learn more

- [Resource center](https://strapi.io/resource-center) - Strapi resource center.
- [Strapi documentation](https://docs.strapi.io) - Official Strapi documentation.
- [Strapi tutorials](https://strapi.io/tutorials) - List of tutorials made by the core team and the community.
- [Strapi blog](https://strapi.io/blog) - Official Strapi blog containing articles made by the Strapi team and the community.
- [Changelog](https://strapi.io/changelog) - Find out about the Strapi product updates, new features and general improvements.

Feel free to check out the [Strapi GitHub repository](https://github.com/strapi/strapi). Your feedback and contributions are welcome!

## ✨ Community

- [Discord](https://discord.strapi.io) - Come chat with the Strapi community including the core team.
- [Forum](https://forum.strapi.io/) - Place to discuss, ask questions and find answers, show your Strapi project and get feedback or just talk with other Community members.
- [Awesome Strapi](https://github.com/strapi/awesome-strapi) - A curated list of awesome things related to Strapi.

---

<sub>🤫 Psst! [Strapi is hiring](https://strapi.io/careers).</sub>
