# Configuración de Autenticación - LearnAI Backend

## Resumen

Este documento describe cómo está configurada la autenticación en el backend de LearnAI.

## Tipos de Autenticación

### 1. **Política JWT Personalizada (`global::token-jwt`)**

**Ubicación:** `/src/policies/token-jwt.ts`

**Uso:** Rutas personalizadas que requieren autenticación de usuario

**Funcionalidad:**
- Valida el JWT del header `Authorization: Bearer <token>`
- Extrae información del usuario autenticado
- Busca y asocia el perfil de estudiante
- Almacena en `ctx.state`:
  - `ctx.state.user` - Usuario autenticado
  - `ctx.state.userId` - ID del usuario
  - `ctx.state.student` - Perfil del estudiante
  - `ctx.state.studentId` - ID del estudiante

**Endpoints que usan esta política:**

#### Chat Session (`/api/chat/*`)
- `POST /api/chat` - Crear sesión de chat
- `GET /api/chat/:documentId` - Obtener sesión de chat
- `POST /api/chat/message` - Enviar mensaje
- `GET /api/chat/:sessionId/study-questions` - Generar preguntas de estudio

#### Documents (`/api/documents/*`)
- `POST /api/documents/upload` - Subir documento
- `GET /api/documents/student/:studentId` - Obtener documentos del estudiante
- `GET /api/documents/:documentId/content` - Obtener contenido del documento
- `DELETE /api/documents/:documentId` - Eliminar documento
- `POST /api/documents/:documentId/embeddings` - Generar embeddings
- `POST /api/documents/search` - Buscar documentos similares
- `GET /api/documents/embeddings/stats` - Estadísticas de embeddings
- `POST /api/documents/embeddings/regenerate` - Regenerar embeddings

### 2. **Autenticación de Strapi por Defecto**

**Uso:** Content Types nativos y panel de administración

**Endpoints:**
- `/api/students` - CRUD de estudiantes (requiere API Token de Strapi)
- `/api/chat-sessions` - CRUD de sesiones de chat (requiere API Token de Strapi)
- `/api/files-students` - CRUD de archivos (requiere API Token de Strapi)
- `/api/document-chunks` - CRUD de chunks (requiere API Token de Strapi)
- `/api/chat-messages` - CRUD de mensajes (requiere API Token de Strapi)
- `/admin/*` - Panel de administración

**Header requerido:**
```
Authorization: Bearer <strapi_api_token>
```

### 3. **Endpoints Públicos (sin autenticación)**

**Ubicación:** `/src/api/student/routes/custom.ts`

**Endpoints:**
- `POST /api/students/signup` - Registro de nuevo estudiante
- `POST /api/students/login` - Inicio de sesión

## Configuración

### Archivo de Política JWT
```typescript
// src/policies/token-jwt.ts
export default async (ctx) => {
  // Valida JWT y extrae información del usuario
  // Retorna true si es válido, false si no
}
```

### Configuración de Rutas
```typescript
// Ejemplo: src/api/chat-session/routes/custom.ts
{
  method: "POST",
  path: "/chat",
  handler: "chat-session.create",
  config: {
    policies: ["global::token-jwt"],  // Aplica política JWT
    auth: false,                       // Desactiva auth de Strapi
  },
}
```

## Flujo de Autenticación

1. **Usuario se registra/inicia sesión**
   - `POST /api/students/signup` o `POST /api/students/login`
   - Recibe JWT en la respuesta

2. **Usuario hace peticiones autenticadas**
   - Incluye `Authorization: Bearer <jwt>` en headers
   - La política `token-jwt` valida el token
   - Si es válido, extrae usuario y estudiante
   - El controlador accede a `ctx.state.user` y `ctx.state.student`

3. **Acceso administrativo**
   - Usa API Token generado desde el panel de Strapi
   - Accede directamente a los Content Types nativos

## Tokens

### JWT de Login (Usuario)
- **Obtención:** Response de `/api/students/login` o `/api/students/signup`
- **Expiración:** Según configuración de users-permissions (por defecto 30 días)
- **Uso:** Endpoints personalizados con política `global::token-jwt`

### API Token de Strapi (Administrador)
- **Obtención:** Settings → API Tokens en panel admin
- **Expiración:** No expira (puede ser revocado manualmente)
- **Uso:** Content Types nativos y acceso administrativo

## Seguridad

- Todos los endpoints de usuario requieren JWT válido
- Los endpoints públicos están limitados a signup/login
- Los Content Types nativos requieren API Token de Strapi
- La política JWT valida la firma y expiración del token
- Se verifica que el usuario exista en la base de datos
