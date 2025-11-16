export default () => ({
  upload: {
    enable: true,
    config: {
      provider: "local",
      providerOptions: {
        sizeLimit: 10000000,
      },
    },
  },
});
