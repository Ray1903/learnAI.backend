export default async (ctx) => {
  const strapi = global.strapi;

  const authorizationHeader =
    ctx.request?.header?.authorization || ctx.request?.header?.Authorization;

  if (!authorizationHeader) {
    return false;
  }

  const [scheme, token] = authorizationHeader.trim().split(" ");

  if (scheme !== "Bearer" || !token) {
    return false;
  }

  try {
    const jwtService = strapi.plugins["users-permissions"].services.jwt;
    const payload = await jwtService.verify(token);

    if (!payload?.id) {
      return false;
    }

    // Get user information
    const user = await strapi.plugins[
      "users-permissions"
    ].services.user.fetchAuthenticatedUser(payload.id);

    if (!user) {
      return false;
    }

    // Store user in context
    ctx.state.user = user;
    ctx.state.userId = payload.id;

    // Get student profile associated with user
    const studentEntries = await strapi
      .documents("api::student.student")
      .findMany({
        filters: {
          user: payload.id,
        },
        limit: 1,
        populate: {
          user: true,
        },
      });

    if (studentEntries?.length) {
      const [student] = studentEntries;
      ctx.state.student = student;
      ctx.state.studentId = student.id;
    }

    return true;
  } catch (error) {
    return false;
  }
};
