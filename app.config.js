module.exports = ({ config }) => ({
  ...config,
  plugins: [
    "expo-font",
    "expo-image",
    [
      "expo-location",
      {
        "locationAlwaysAndWhenInUsePermission": "FORGE uses background location to continue tracking rucks while the app is in the background.",
        "isIosBackgroundLocationEnabled": true,
        "isAndroidBackgroundLocationEnabled": true
      }
    ],
    [
      "expo-notifications",
      {
        "icon": "./assets/icon.png",
        "color": "#04080F",
        "sounds": []
      }
    ]
  ],
  experiments: {
    ...config.experiments,
    ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}),
  },
});
