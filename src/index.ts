import type { Core } from '@strapi/strapi';

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    try {
      // Configurar pgvector automáticamente al iniciar Strapi
      console.log('🔧 Configurando pgvector...');
      
      // Crear la extensión pgvector si no existe
      await strapi.db.connection.raw('CREATE EXTENSION IF NOT EXISTS vector;');
      
      // Verificar que pgvector está instalado
      const result = await strapi.db.connection.raw(
        "SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';"
      );
      
      if (result.rows && result.rows.length > 0) {
        const version = result.rows[0].extversion;
        console.log(`✅ pgvector v${version} configurado correctamente`);
        
        // Configurar parámetros de rendimiento para vectores
        try {
          await strapi.db.connection.raw('SET ivfflat.probes = 10;');
          console.log('✅ Parámetros de rendimiento configurados');
        } catch (paramError) {
          console.log('ℹ️  Parámetros de rendimiento no configurados (normal en primera ejecución)');
        }
        
        console.log('🚀 Base de datos lista para embeddings');
      } else {
        console.warn('⚠️  pgvector no está disponible. Instala la extensión pgvector en PostgreSQL');
        console.warn('   Comando: CREATE EXTENSION vector;');
      }
      
    } catch (error) {
      console.error('❌ Error configurando pgvector:', error.message);
      console.warn('⚠️  El sistema funcionará sin búsqueda semántica');
      console.warn('   Para habilitar pgvector, asegúrate de que esté instalado en PostgreSQL');
    }
  },
};
