module.exports = ({ config }) => ({
  ...config,
  plugins: [
    "expo-font",
    "expo-image"
  ],
  experiments: {
    ...config.experiments,
    ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}),
  },
});
