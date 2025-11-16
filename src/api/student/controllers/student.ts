import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::student.student",
  ({ strapi }) => ({
    /**
     * Controlador de registro de estudiante
     * Crea un usuario en el sistema de autenticación y un perfil de estudiante asociado
     *
     * @param {Object} ctx - Contexto de Koa que contiene la petición HTTP
     * @param {Object} ctx.request.body - Datos del estudiante a registrar
     * @param {string} ctx.request.body.email - Email del estudiante (requerido)
     * @param {string} ctx.request.body.password - Contraseña del estudiante (requerido)
     * @param {string} ctx.request.body.first_name - Nombre del estudiante (requerido)
     * @param {string} ctx.request.body.last_name - Apellido del estudiante (requerido)
     * @param {string} [ctx.request.body.phone] - Teléfono del estudiante (opcional)
     * @param {string} [ctx.request.body.date_of_birth] - Fecha de nacimiento (opcional)
     * @param {string} [ctx.request.body.gender] - Género del estudiante (opcional)
     *
     * @returns {Object} Respuesta con el usuario creado, perfil de estudiante y JWT
     * @throws {BadRequest} Si faltan campos requeridos o el email ya existe
     * @throws {InternalServerError} Si ocurre un error durante el registro
     */
    async signup(ctx) {
      try {
        const {
          email,
          password,
          first_name,
          last_name,
          phone,
          date_of_birth,
          gender,
        } = ctx.request.body;

        if (!email || !password || !first_name || !last_name) {
          return ctx.badRequest(
            "Email, password, first name, and last name are required"
          );
        }

        const user = await strapi.plugins[
          "users-permissions"
        ].services.user.add({
          username: email,
          email: email,
          password: password,
          confirmed: true,
          role: 1,
        });

        const student = await strapi.documents("api::student.student").create({
          data: {
            user: user.id,
            first_name,
            last_name,
            phone,
            date_of_birth,
            gender,
            publishedAt: new Date(),
          },
        });

        const jwt = strapi.plugins["users-permissions"].services.jwt.issue({
          id: user.id,
        });

        ctx.send({
          message: "Student registered successfully",
          jwt,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
          },
          student: {
            id: student.id,
            first_name: student.first_name,
            last_name: student.last_name,
            phone: student.phone,
            date_of_birth: student.date_of_birth,
            gender: student.gender,
          },
        });
      } catch (error) {
        console.error("Signup error:", error);
        if (error.message.includes("Email or Username are already taken")) {
          return ctx.badRequest("Email already exists");
        }
        ctx.internalServerError("An error occurred during signup");
      }
    },

    /**
     * Controlador de inicio de sesión de estudiante
     * Autentica las credenciales del usuario y retorna el JWT junto con los datos del estudiante
     *
     * @param {Object} ctx - Contexto de Koa que contiene la petición HTTP
     * @param {Object} ctx.request.body - Credenciales de inicio de sesión
     * @param {string} ctx.request.body.email - Email del estudiante (requerido)
     * @param {string} ctx.request.body.password - Contraseña del estudiante (requerido)
     *
     * @returns {Object} Respuesta con JWT, datos del usuario y perfil del estudiante
     * @throws {BadRequest} Si faltan credenciales o son inválidas
     * @throws {NotFound} Si no se encuentra el perfil de estudiante asociado
     */
    async login(ctx) {
      try {
        const { email, password } = ctx.request.body;

        if (!email || !password) {
          return ctx.badRequest("Email and password are required");
        }

        const user = await strapi
          .query("plugin::users-permissions.user")
          .findOne({
            where: { email: email },
          });

        if (!user) {
          return ctx.badRequest("Invalid email or password");
        }

        const validPassword = await strapi.plugins[
          "users-permissions"
        ].services.user.validatePassword(password, user.password);

        if (!validPassword) {
          return ctx.badRequest("Invalid email or password");
        }

        const students = await strapi
          .documents("api::student.student")
          .findMany({
            filters: {
              user: user.id,
            },
          });

        if (!students || students.length === 0) {
          return ctx.notFound("Student profile not found");
        }

        const student = students[0];

        const jwt = strapi.plugins["users-permissions"].services.jwt.issue({
          id: user.id,
        });

        ctx.send({
          message: "Student logged in successfully",
          jwt,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
          },
          student: {
            id: student.id,
            first_name: student.first_name,
            last_name: student.last_name,
            phone: student.phone,
            date_of_birth: student.date_of_birth,
            gender: student.gender,
          },
        });
      } catch (error) {
        console.error("Login error:", error);
        ctx.badRequest("Invalid email or password");
      }
    },
  })
);
