export default {
  routes: [
    // Custom student signup (creates user + student profile)
    {
      method: "POST",
      path: "/students/signup",
      handler: "student.signup",
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    // Student login
    {
      method: "POST",
      path: "/students/login",
      handler: "student.login",
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};
