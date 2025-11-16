# Guía de Embeddings y Búsqueda Semántica - LearnAI

## Descripción General

El sistema LearnAI ahora incluye capacidades avanzadas de búsqueda semántica utilizando embeddings de OpenAI y pgvector en PostgreSQL. Esto permite al asistente de IA encontrar información más relevante en los documentos del estudiante basándose en el significado semántico, no solo en coincidencias de palabras clave.

## Arquitectura de Embeddings

### Componentes Principales

1. **EmbeddingsService** (`/src/services/embeddings.ts`)
   - Genera embeddings usando OpenAI text-embedding-3-small
   - Implementa búsqueda por similitud coseno
   - Integra con pgvector para búsquedas eficientes

2. **DocumentProcessorService** (actualizado)
   - Genera embeddings automáticamente al procesar documentos
   - Divide documentos en chunks optimizados para embeddings

3. **OpenAIService** (mejorado)
   - Utiliza búsqueda semántica para encontrar contexto relevante
   - Mejora la calidad de respuestas del asistente

## Configuración de Base de Datos

### Requisitos Previos

Asegúrate de que pgvector esté instalado en tu PostgreSQL:

```sql
-- Crear la extensión pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Verificar instalación
SELECT * FROM pg_extension WHERE extname = 'vector';
```

### Esquema de Datos

Los embeddings se almacenan en el modelo `document-chunk`:

```json
{
  "content": "texto del chunk",
  "chunk_index": 1,
  "embedding": [0.1, -0.2, 0.3, ...], // Vector de 1536 dimensiones
  "embedding_model": "text-embedding-3-small",
  "document_student": "relación con documento"
}
```

## API de Embeddings

### Endpoints Disponibles

#### 1. Generar Embeddings para Documento
```http
POST /api/documents/{documentId}/embeddings
Authorization: Bearer {jwt_token}
```

**Respuesta:**
```json
{
  "message": "Embeddings generados correctamente para el documento"
}
```

#### 2. Búsqueda Semántica
```http
POST /api/documents/search
Content-Type: application/json
Authorization: Bearer {jwt_token}

{
  "query": "¿Qué es la fotosíntesis?",
  "studentId": "student_document_id",
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
        "content": "La fotosíntesis es el proceso...",
        "similarity": 0.89,
        "documentTitle": "Biología Básica",
        "chunkIndex": 3
      }
    ],
    "count": 1
  }
}
```

#### 3. Estadísticas de Embeddings
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

#### 4. Regenerar Todos los Embeddings
```http
POST /api/documents/embeddings/regenerate
Authorization: Bearer {jwt_token}
```

## Flujo de Procesamiento

### 1. Subida de Documento

```mermaid
graph TD
    A[Usuario sube documento] --> B[Extraer texto]
    B --> C[Dividir en chunks]
    C --> D[Generar embeddings]
    D --> E[Guardar en PostgreSQL]
    E --> F[Documento listo para búsqueda]
```

### 2. Chat con Búsqueda Semántica

```mermaid
graph TD
    A[Usuario envía mensaje] --> B[Generar embedding del mensaje]
    B --> C[Buscar chunks similares con pgvector]
    C --> D[Seleccionar top 5 más relevantes]
    D --> E[Enviar contexto a OpenAI]
    E --> F[Generar respuesta contextual]
    F --> G[Responder al usuario]
```

## Configuración y Optimización

### Variables de Entorno

```bash
# Configuración de OpenAI (requerida)
OPENAI_API_KEY=your_openai_api_key_here

# Configuración de PostgreSQL con pgvector
DATABASE_URL=postgresql://user:password@localhost:5432/learnai_db
```

### Parámetros de Búsqueda

- **Modelo de Embeddings**: `text-embedding-3-small` (1536 dimensiones)
- **Umbral de Similitud**: 0.7 (ajustable según necesidades)
- **Límite de Resultados**: 5 chunks por búsqueda
- **Tamaño de Chunk**: 1000 caracteres (optimizado para contexto)

### Optimización de Rendimiento

1. **Índices en PostgreSQL**:
```sql
-- Crear índice para búsquedas por vector (automático con pgvector)
CREATE INDEX ON document_chunks USING ivfflat (embedding vector_cosine_ops);

-- Índice para filtros por estudiante
CREATE INDEX idx_document_chunks_student ON document_chunks(document_student);
```

2. **Configuración de pgvector**:
```sql
-- Ajustar parámetros para mejor rendimiento
SET ivfflat.probes = 10;
```

## Casos de Uso

### 1. Asistente Contextual Inteligente

El asistente ahora puede:
- Encontrar información específica en documentos largos
- Responder preguntas complejas usando múltiples fuentes
- Proporcionar citas precisas del contenido relevante

**Ejemplo:**
```
Usuario: "¿Cuál es la diferencia entre mitosis y meiosis?"
Asistente: "Basándome en tu documento de Biología Celular, la mitosis es..."
```

### 2. Búsqueda Avanzada de Contenido

Los estudiantes pueden buscar conceptos sin conocer las palabras exactas:

```
Búsqueda: "proceso de división celular"
Resultados: Encuentra contenido sobre mitosis, meiosis, citocinesis, etc.
```

### 3. Recomendaciones de Estudio

El sistema puede sugerir material relacionado:

```
Si estudias: "ecuaciones cuadráticas"
Sugiere: contenido sobre "funciones parabólicas", "discriminante", etc.
```

## Monitoreo y Mantenimiento

### Métricas Importantes

1. **Cobertura de Embeddings**: % de chunks con embeddings generados
2. **Calidad de Búsqueda**: Relevancia promedio de resultados
3. **Rendimiento**: Tiempo de respuesta de búsquedas
4. **Uso de API**: Llamadas a OpenAI para embeddings

### Comandos de Mantenimiento

```bash
# Verificar estadísticas
curl -H "Authorization: Bearer $JWT" \
  http://localhost:1337/api/documents/embeddings/stats

# Regenerar embeddings (usar con precaución)
curl -X POST -H "Authorization: Bearer $JWT" \
  http://localhost:1337/api/documents/embeddings/regenerate

# Buscar contenido similar
curl -X POST -H "Content-Type: application/json" \
  -H "Authorization: Bearer $JWT" \
  -d '{"query":"concepto a buscar","studentId":"student_id"}' \
  http://localhost:1337/api/documents/search
```

## Solución de Problemas

### Problemas Comunes

1. **Embeddings no se generan**
   - Verificar API key de OpenAI
   - Comprobar límites de rate limiting
   - Revisar logs de errores

2. **Búsquedas lentas**
   - Verificar índices de pgvector
   - Ajustar parámetros de ivfflat.probes
   - Considerar reducir el límite de resultados

3. **Resultados irrelevantes**
   - Ajustar umbral de similitud (aumentar para más precisión)
   - Revisar calidad de los chunks
   - Considerar re-procesar documentos

### Logs Útiles

```bash
# Ver logs de embeddings
grep "embedding" logs/strapi.log

# Monitorear búsquedas semánticas
grep "semantic search" logs/strapi.log

# Verificar errores de OpenAI
grep "OpenAI" logs/strapi.log
```

## Costos y Consideraciones

### Costos de OpenAI

- **text-embedding-3-small**: $0.00002 por 1K tokens
- **Estimación**: ~$0.01 por documento de 10 páginas
- **Optimización**: Los embeddings se generan una sola vez por chunk

### Almacenamiento

- **Embedding**: 1536 dimensiones × 4 bytes = ~6KB por chunk
- **Estimación**: ~60KB de embeddings por documento de 10 chunks

### Recomendaciones

1. Generar embeddings en lotes para reducir costos
2. Implementar cache para búsquedas frecuentes
3. Monitorear uso de API de OpenAI
4. Considerar límites por usuario/documento

## Próximas Mejoras

- [ ] Soporte para embeddings multiidioma
- [ ] Clustering automático de contenido similar
- [ ] Análisis de tendencias en búsquedas
- [ ] Integración con modelos de embeddings locales
- [ ] Búsqueda híbrida (semántica + keyword)
