# LearnAI Backend - API Documentation

## Descripción General

Este backend proporciona un sistema completo de chat asistido por IA para estudiantes, incluyendo funcionalidades de subida de documentos, procesamiento de texto, **búsqueda semántica con embeddings** y asistente de estudio inteligente.

### 🚀 Nuevas Funcionalidades con pgvector
- **Búsqueda Semántica**: Encuentra información relevante por significado, no solo palabras clave
- **Embeddings Automáticos**: Generación automática de vectores para todos los documentos
- **Chat Contextual Mejorado**: El asistente encuentra el contenido más relevante automáticamente
- **Análisis de Similitud**: Búsqueda avanzada basada en similitud coseno

## ⚠️ Importante: Diferencia entre `id` y `documentId`

### Cuándo usar cada uno:

**`id` (número entero)**:
- ✅ **Para relaciones en base de datos**: Cuando vinculas chunks con documentos
- ✅ **Para búsquedas semánticas**: El sistema usa `files_students.id` internamente
- ✅ **Para operaciones CRUD**: Crear, leer, actualizar, eliminar registros
- 📍 **Ejemplo**: `"studentId": 4`, `"document_id": "3"`

**`documentId` (string UUID)**:
- ✅ **Para API de Strapi**: Identificador único de documento en Strapi
- ✅ **Para operaciones de contenido**: Cuando trabajas con el CMS
- ✅ **Para referencias externas**: URLs y enlaces públicos
- 📍 **Ejemplo**: `"documentId": "hpy2yj6wjzrq1dd1f4c58fm7"`

### Regla Simple:
- **Base de datos interna** → usa `id` (número)
- **API de Strapi** → usa `documentId` (string)

### 📋 Tabla de Referencia Rápida

| Endpoint | Parámetro | Tipo | Ejemplo | Descripción |
|----------|-----------|------|---------|-------------|
| `POST /api/documents/upload` | `student` | `number` | `4` | ID numérico del estudiante |
| `POST /api/documents/search` | `studentId` | `number` | `4` | ID numérico del estudiante |
| `POST /api/chat` | `student` | `number` | `4` | ID numérico del estudiante |
| `GET /api/chat/{id}` | `{id}` | `string` | `"abc123def456"` | documentId UUID de la sesión |
| `POST /api/chat/message` | `sessionId` | `string` | `"abc123def456"` | documentId UUID de la sesión |

### ⚠️ Errores Comunes:
- ❌ Usar `studentId: "abc123"` (string) en búsquedas
- ❌ Usar `sessionId: 123` (number) en mensajes
- ✅ Usar `studentId: 4` (number) en búsquedas
- ✅ Usar `sessionId: "abc123def456"` (string) en mensajes

## Configuración

### Variables de Entorno

Copia `.env.example` a `.env` y configura las siguientes variables:

```bash
# Configuración básica de Strapi
HOST=0.0.0.0
PORT=1337
APP_KEYS="your_app_keys_here"
API_TOKEN_SALT=your_api_token_salt
ADMIN_JWT_SECRET=your_admin_jwt_secret
TRANSFER_TOKEN_SALT=your_transfer_token_salt
JWT_SECRET=your_jwt_secret
ENCRYPTION_KEY=your_encryption_key

# Configuración de OpenAI (REQUERIDA para embeddings)
OPENAI_API_KEY=your_openai_api_key_here

# Configuración de PostgreSQL con pgvector
# Asegúrate de que pgvector esté instalado: CREATE EXTENSION vector;
DATABASE_URL=postgresql://user:password@localhost:5432/learnai_db
```

### Instalación

```bash
npm install
npm run develop
```

## Autenticación

### Tipos de Autenticación

El backend utiliza dos tipos de autenticación:

#### 1. **JWT de Usuario (Política `global::token-jwt`)**
- **Uso**: Todos los endpoints personalizados de la API
- **Obtención**: Response de `/api/students/signup` o `/api/students/login`
- **Header**: `Authorization: Bearer <jwt_token>`
- **Expiración**: 30 días (configurable)
- **Endpoints protegidos**: `/api/chat/*`, `/api/documents/*`

#### 2. **API Token de Strapi**
- **Uso**: Content Types nativos y panel de administración
- **Obtención**: Settings → API Tokens en el panel admin
- **Header**: `Authorization: Bearer <strapi_api_token>`
- **Expiración**: No expira (puede ser revocado)
- **Endpoints**: `/api/students`, `/api/chat-sessions`, `/api/files-students`, etc.

### Endpoints Públicos (sin autenticación)
- `POST /api/students/signup` - Registro
- `POST /api/students/login` - Inicio de sesión

---

## Endpoints de la API

### Autenticación de Estudiantes

#### Registro de Estudiante
```http
POST /api/students/signup
Content-Type: application/json

{
  "email": "estudiante@ejemplo.com",
  "password": "password123",
  "first_name": "Juan",
  "last_name": "Pérez",
  "phone": "+1234567890",
  "date_of_birth": "1995-05-15",
  "gender": "male"  // Valores permitidos: "male" | "female" | "other"
}
```

**Respuesta:**
```json
{
  "message": "Student registered successfully",
  "jwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "estudiante@ejemplo.com",
    "email": "estudiante@ejemplo.com"
  },
  "student": {
    "id": 1,
    "first_name": "Juan",
    "last_name": "Pérez",
    "phone": "+1234567890",
    "date_of_birth": "1995-05-15",
    "gender": "male"
  }
}
```

#### Inicio de Sesión
```http
POST /api/students/login
Content-Type: application/json

{  
  "email": "estudiante@ejemplo.com",
  "password": "password123"
}
```

**Respuesta:**
```json
{
  "message": "Login successful",
  "jwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "estudiante@ejemplo.com",
    "email": "estudiante@ejemplo.com"
  },
  "student": {
    "id": 1,
    "first_name": "Juan",
    "last_name": "Pérez"
  }
}
```

**Nota:** Guarda el `jwt` para usarlo en los siguientes requests con el header `Authorization: Bearer <jwt>`

### Gestión de Documentos

**Nota:** Todos los endpoints de documentos requieren autenticación JWT.

#### Subir Documento
```http
POST /api/documents/upload
Content-Type: multipart/form-data
Authorization: Bearer {jwt_token}

Form Data:
- file: [archivo PDF, DOCX o TXT]
- title: "Mi Documento de Estudio"
- student: {student_id}  // ← Número entero (ej: 4)
```

**Respuesta:**
```json
{
  "message": "Documento subido y procesado correctamente",
  "data": {
    "id": 1,
    "documentId": "abc123",
    "title": "Mi Documento de Estudio",
    "summary": "Resumen generado por IA del documento...",
    "file": {
      "id": 1,
      "name": "documento.pdf",
      "url": "/uploads/documento.pdf",
      "size": 1024000
    },
    "chunksCount": 5
  }
}
```

#### Obtener Documentos del Estudiante
```http
GET /api/documents/student/{studentId}
Authorization: Bearer {jwt_token}
```

#### Obtener Contenido del Documento
```http
GET /api/documents/{documentId}/content
Authorization: Bearer {jwt_token}
```

#### Eliminar Documento
```http
DELETE /api/documents/{documentId}
Authorization: Bearer {jwt_token}
```

### Búsqueda Semántica y Embeddings

#### Buscar Contenido Similar
```http
POST /api/documents/search
Content-Type: application/json
Authorization: Bearer {jwt_token}

{
  "query": "¿Qué es la fotosíntesis?",
  "studentId": 4,  // ← Número entero (ID de base de datos)
  "limit": 5,
  "threshold": 0.7
}
```

**Respuesta:**
```json
{
  "message": "Búsqueda semántica completada",
  "data": {
    "query": "¿Qué es la fotosíntesis?",
    "results": [
      {
        "id": "chunk_id",
        "content": "La fotosíntesis es el proceso por el cual las plantas...",
        "similarity": 0.89,
        "documentTitle": "Biología Básica",
        "chunkIndex": 3
      }
    ],
    "count": 1
  }
}
```

#### Generar Embeddings para Documento
```http
POST /api/documents/{documentId}/embeddings
Authorization: Bearer {jwt_token}
```

#### Estadísticas de Embeddings
```http
GET /api/documents/embeddings/stats
Authorization: Bearer {jwt_token}
```

**Respuesta:**
```json
{
  "message": "Estadísticas de embeddings obtenidas",
  "data": {
    "totalChunks": 150,
    "chunksWithEmbeddings": 145,
    "embeddingCoverage": 96.67
  }
}
```

#### Regenerar Todos los Embeddings
```http
POST /api/documents/embeddings/regenerate
Authorization: Bearer {jwt_token}
```

### Chat con Asistente de IA

#### Crear Sesión de Chat
```http
POST /api/chat
Content-Type: application/json
Authorization: Bearer {jwt_token}

{
  "title": "Sesión de Estudio - Matemáticas",
  "student": 4  // ← Número entero (ID de base de datos)
}
```

#### Listar Sesiones de Chat del Estudiante Autenticado
```http
GET /api/chat
Authorization: Bearer {jwt_token}
```

**Descripción:**
- Devuelve todas las sesiones de chat asociadas al estudiante autenticado (según el JWT).
- No requiere parámetros en la URL ni en el cuerpo.

**Respuesta:**
```json
{
  "message": "Sesiones de chat obtenidas correctamente",
  "data": [
    {
      "id": 15,
      "documentId": "abc123def456",
      "title": "Sesión de Estudio - Matemáticas",
      "student": 4,
      "createdAt": "2025-01-01T12:00:00.000Z",
      "updatedAt": "2025-01-01T12:10:00.000Z"
    }
  ]
}
```

#### Obtener Sesión de Chat
```http
GET /api/chat/{session_document_id}  // ← String UUID de Strapi
Authorization: Bearer {jwt_token}
```

#### Enviar Mensaje
```http
POST /api/chat/message
Content-Type: application/json
Authorization: Bearer {jwt_token}

{
  "sessionId": "abc123def456",  // ← String UUID de la sesión (documentId de Strapi)
  "message": "¿Puedes explicarme los conceptos principales de este documento?",
  "role": "user"
}
```

**Respuesta:**
```json
{
  "message": "Mensaje enviado correctamente",
  "userMessage": {
    "id": 1,
    "role": "user",
    "content": "¿Puedes explicarme los conceptos principales de este documento?"
  },
  "assistantMessage": {
    "id": 2,
    "role": "assistant",
    "content": "Basándome en los documentos que has subido, los conceptos principales son..."
  }
}
```

#### Generar Preguntas de Estudio
```http
GET /api/chat/{sessionId}/study-questions
Authorization: Bearer {jwt_token}
```

**Respuesta:**
```json
{
  "message": "Preguntas de estudio generadas correctamente",
  "studyQuestions": [
    {
      "documentTitle": "Matemáticas Básicas",
      "questions": [
        "¿Cuáles son las propiedades fundamentales de los números reales?",
        "¿Cómo se resuelven ecuaciones cuadráticas?",
        "¿Qué es una función y cuáles son sus características?"
      ]
    }
  ]
}
```

## Características del Asistente de IA

### Capacidades del Asistente

1. **Procesamiento de Documentos**: Extrae texto de PDFs, DOCX y archivos de texto
2. **Generación de Resúmenes**: Crea resúmenes automáticos de los documentos subidos
3. **🆕 Búsqueda Semántica**: Encuentra información relevante por significado usando embeddings
4. **🆕 Chat Contextual Inteligente**: Responde usando los chunks más relevantes automáticamente
5. **Preguntas de Estudio**: Genera preguntas relevantes para ayudar al aprendizaje
6. **Respuestas de Fallback**: Proporciona respuestas alternativas si falla la IA
7. **🆕 Análisis de Similitud**: Encuentra contenido relacionado sin palabras clave exactas

### Tipos de Archivo Soportados

- **PDF** (.pdf): Documentos de texto en formato PDF
- **Word** (.docx): Documentos de Microsoft Word
- **Texto** (.txt): Archivos de texto plano

### Funcionalidades de IA

- **Modelo de Chat**: GPT-4o-mini de OpenAI
- **🆕 Modelo de Embeddings**: text-embedding-3-small (1536 dimensiones)
- **Temperatura**: 0.7 para respuestas balanceadas
- **Límite de tokens**: 1000 tokens por respuesta
- **Chunking Inteligente**: División automática optimizada para embeddings
- **🆕 Contexto Semántico**: Selecciona automáticamente los chunks más relevantes
- **🆕 Umbral de Similitud**: 0.7 (configurable) para filtrar contenido relevante
- **🆕 Base de Datos Vectorial**: PostgreSQL con pgvector para búsquedas eficientes

## Estructura de Datos

### Modelos Principales

#### Student
- `user`: Relación con usuario de autenticación
- `first_name`: Nombre del estudiante
- `last_name`: Apellido del estudiante
- `phone`: Teléfono (opcional)
- `date_of_birth`: Fecha de nacimiento (opcional)
- `gender`: Género (opcional). Valores permitidos: `"male"`, `"female"`, `"other"`

#### Files-Student (Documentos)
- `title`: Título del documento
- `file`: Archivo subido (media)
- `summary`: Resumen generado por IA
- `student`: Relación con estudiante
- `document_chunks`: Chunks del documento

#### Document-Chunk
- `content`: Contenido del chunk
- `chunk_index`: Índice del chunk
- `🆕 embedding`: Vector de embeddings (1536 dimensiones)
- `🆕 embedding_model`: Modelo usado para generar embeddings
- `document_student`: Relación con documento

#### Chat-Session
- `title`: Título de la sesión
- `student`: Relación con estudiante
- `chat_messages`: Mensajes del chat

#### Chat-Message
- `role`: Rol del mensaje. Valores permitidos: `"user"`, `"assistant"`
- `message_index`: Índice del mensaje
- `content`: Contenido del mensaje
- `metadata`: Metadatos adicionales (JSON)
- `agent_name`: Nombre del agente
- `chat_session`: Relación con sesión

## Manejo de Errores

### Códigos de Error Comunes

- **400 Bad Request**: Datos faltantes o inválidos
- **401 Unauthorized**: Token JWT inválido o faltante
- **404 Not Found**: Recurso no encontrado
- **500 Internal Server Error**: Error del servidor

### Respuestas de Error

```json
{
  "error": {
    "status": 400,
    "name": "BadRequestError",
    "message": "Faltan campos obligatorios",
    "details": {}
  }
}
```

## Consideraciones de Seguridad

1. **Autenticación JWT**: Todos los endpoints personalizados requieren token JWT obtenido del login
2. **Política de Autenticación**: La política `global::token-jwt` valida el token y extrae información del usuario
3. **Contexto de Usuario**: Los controladores tienen acceso a `ctx.state.user` y `ctx.state.student`
4. **Validación de Archivos**: Solo se permiten tipos de archivo específicos (PDF, DOCX, TXT)
5. **Límites de Tamaño**: Los archivos tienen límites de tamaño configurables
6. **API Key**: La clave de OpenAI debe mantenerse segura en variables de entorno
7. **Separación de Autenticación**: 
   - JWT de usuario para endpoints personalizados
   - API Token de Strapi para content types nativos y admin

## Desarrollo y Testing

### Comandos Útiles

```bash
# Desarrollo
npm run develop

# Construcción
npm run build

# Producción
npm run start

# Consola de Strapi
npm run console
```

### Testing de Endpoints

Puedes usar herramientas como Postman o curl para probar los endpoints. Asegúrate de:

1. **Configurar pgvector** en PostgreSQL: `CREATE EXTENSION vector;`
2. Registrar un estudiante primero
3. Usar el JWT token en las cabeceras de autorización
4. Subir documentos antes de crear sesiones de chat
5. **Configurar la API key de OpenAI** en el archivo .env
6. **Verificar embeddings**: Usar `/api/documents/embeddings/stats` para monitorear

### Ejemplo de Flujo Completo con Embeddings

```bash
# 1. Registrar estudiante
curl -X POST http://localhost:1337/api/students/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"123456","first_name":"Test","last_name":"User"}'

# Guardar el JWT de la respuesta
export JWT="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# 2. Subir documento (embeddings se generan automáticamente)
curl -X POST http://localhost:1337/api/documents/upload \
  -H "Authorization: Bearer $JWT" \
  -F "file=@documento.pdf" \
  -F "student=4"  # ← Usar ID numérico del estudiante

# 3. Verificar embeddings
curl -H "Authorization: Bearer $JWT" \
  http://localhost:1337/api/documents/embeddings/stats

# 4. Buscar contenido similar
curl -X POST http://localhost:1337/api/documents/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT" \
  -d '{"query":"fotosíntesis","studentId":4}'  # ← Usar ID numérico

# 5. Crear chat (usará búsqueda semántica automáticamente)
curl -X POST http://localhost:1337/api/chat/message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT" \
  -d '{"sessionId":"abc123def456","message":"¿Qué es la fotosíntesis?"}'  # ← Usar documentId UUID
```

## Funcionalidades Implementadas ✅

- ✅ **Búsqueda Semántica**: Implementada con pgvector y OpenAI embeddings
- ✅ **Chat Contextual Inteligente**: Selección automática de contenido relevante
- ✅ **Procesamiento de Documentos**: PDF, DOCX, TXT con extracción automática
- ✅ **Embeddings Automáticos**: Generación y almacenamiento vectorial
- ✅ **API REST Completa**: Endpoints para todas las operaciones

## 📖 Ejemplos Prácticos de Uso

### Ejemplo 1: Búsqueda Semántica Básica
```json
POST /api/documents/search
{
  "query": "¿Qué son las pruebas de software?",
  "studentId": 4,
  "limit": 3,
  "threshold": 0.7
}

// Respuesta
{
  "message": "Búsqueda semántica completada",
  "data": {
    "query": "¿Qué son las pruebas de software?",
    "results": [
      {
        "id": 1,
        "content": "Las pruebas de software son procesos...",
        "similarity": 0.85,
        "documentTitle": "Material Clases.pdf",
        "chunkIndex": 1
      }
    ],
    "count": 1
  }
}
```

### Ejemplo 2: Diferencia entre `id` y `documentId`
```json
// ✅ Correcto: Usar studentId (número) para búsquedas
POST /api/documents/search
{
  "query": "metodologías ágiles",
  "studentId": 4  // ← número entero (id de base de datos)
}

// ✅ Correcto: documentId (string) para operaciones de Strapi
GET /api/documents/hpy2yj6wjzrq1dd1f4c58fm7  // ← string UUID

// ❌ Incorrecto: Mezclar tipos
POST /api/documents/search
{
  "studentId": "hpy2yj6wjzrq1dd1f4c58fm7"  // ← Esto no funcionará
}
```

### Ejemplo 3: Chat con Contexto Automático
```json
POST /api/chat/message
{
  "sessionId": "abc123def456",  // ← String UUID (documentId de Strapi)
  "message": "Explícame las metodologías de desarrollo ágil"
}

// El sistema automáticamente:
// 1. Genera embedding de la pregunta
// 2. Busca contenido relevante (threshold 0.7)
// 3. Incluye contexto en la respuesta del chat
```

### Ejemplo 4: Respuestas de API - Tipos de ID
```json
// Respuesta de registro de estudiante
POST /api/student/signup → {
  "student": {
    "id": 4,                    // ← Número (usar para búsquedas)
    "documentId": "xyz789abc"   // ← String (usar para operaciones Strapi)
  }
}

// Respuesta de crear sesión de chat
POST /api/chat → {
  "data": {
    "id": 15,                   // ← Número (ID de base de datos)
    "documentId": "abc123def456" // ← String (usar para mensajes)
  }
}

// Respuesta de subir documento
POST /api/documents/upload → {
  "data": {
    "id": 8,                    // ← Número (ID de base de datos)
    "documentId": "doc456xyz"   // ← String (usar para referencias)
  }
}
```

## 🔗 Enlaces Útiles

- **[Guía de Instalación Completa](./INSTALLATION.md)** - Instrucciones paso a paso
- **[Configuración de pgvector](https://github.com/pgvector/pgvector)** - Documentación oficial
- **[OpenAI API](https://platform.openai.com/docs)** - Documentación de embeddings
- ✅ **Procesamiento Automático**: Generación de embeddings al subir documentos
- ✅ **API de Búsqueda**: Endpoints para búsqueda semántica manual
- ✅ **Estadísticas**: Monitoreo de cobertura de embeddings

## Próximas Funcionalidades

- [ ] Soporte para más tipos de archivo (PPT, Excel)
- [ ] Embeddings multiidioma
- [ ] Clustering automático de contenido
- [ ] Análisis de sentimientos en las conversaciones
- [ ] Generación de flashcards automáticas
- [ ] Integración con calendarios de estudio
- [ ] Métricas de progreso del estudiante
- [ ] Búsqueda híbrida (semántica + keywords)
