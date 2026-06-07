/**
 * FlowOS mobile - web shim for react-native-keychain.
 * Token persistence on web is handled by src/storage/tokens.web.ts (localStorage),
 * so this only exists to keep the native module out of the web bundle if imported.
 */
module.exports = {
  setGenericPassword: async () => true,
  getGenericPassword: async () => false,
  resetGenericPassword: async () => true,
};
