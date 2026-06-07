/**
 * FlowOS mobile - src/config.ts
 * Runtime configuration. On the Android emulator, the host machine is 10.0.2.2;
 * on iOS simulator it's localhost. Override for a physical device / deployed API.
 */
import { Platform } from 'react-native';

const HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

export const API_BASE_URL = `http://${HOST}:4000/api/v1`;
export const SOCKET_URL = `http://${HOST}:4000`;
