/**
 * FlowOS mobile - __tests__/deviceToken.test.ts
 * Device-token registration lifecycle: gated by pushEnabled, no-ops without a token
 * (FCM not wired), registers with the correct platform, and cleans up on logout.
 */
jest.mock('../src/push/pushProvider', () => ({ getPushToken: jest.fn() }));
jest.mock('../src/api/endpoints', () => ({
  notificationApi: { registerDevice: jest.fn(), removeDevice: jest.fn() },
}));

import { getPushToken } from '../src/push/pushProvider';
import { notificationApi } from '../src/api/endpoints';
import { registerDeviceToken, unregisterDeviceToken } from '../src/push/deviceToken';

const mockGetPushToken = getPushToken as jest.Mock;
const mockRegister = notificationApi.registerDevice as jest.Mock;
const mockRemove = notificationApi.removeDevice as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('device token registration', () => {
  it('is a no-op before anything is registered', async () => {
    await unregisterDeviceToken();
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it('does not register when push is disabled', async () => {
    mockGetPushToken.mockResolvedValue('fcm-token-abcdefghij');
    const result = await registerDeviceToken({ pushEnabled: false });
    expect(result).toBeNull();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('does not register when no token is available (FCM not wired)', async () => {
    mockGetPushToken.mockResolvedValue(null);
    const result = await registerDeviceToken({ pushEnabled: true });
    expect(result).toBeNull();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('registers the device with the correct platform when a token exists', async () => {
    mockGetPushToken.mockResolvedValue('fcm-token-abcdefghij');
    mockRegister.mockResolvedValue({});
    const result = await registerDeviceToken({ pushEnabled: true });
    expect(result).toBe('fcm-token-abcdefghij');
    expect(mockRegister).toHaveBeenCalledWith(
      'fcm-token-abcdefghij',
      expect.stringMatching(/^(IOS|ANDROID|WEB)$/),
    );
  });

  it('unregisters the previously registered token on logout', async () => {
    mockRemove.mockResolvedValue({});
    await unregisterDeviceToken();
    expect(mockRemove).toHaveBeenCalledWith('fcm-token-abcdefghij');
  });
});
