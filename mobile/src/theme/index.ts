/**
 * FlowOS mobile - src/theme/index.ts
 * Branded Material 3 (Paper) theme + spacing tokens.
 */
import { MD3LightTheme, configureFonts } from 'react-native-paper';

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const radius = { sm: 8, md: 12, lg: 20 };

export const theme = {
  ...MD3LightTheme,
  roundness: 3,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#2563EB',
    primaryContainer: '#DBEAFE',
    secondary: '#0EA5E9',
    background: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceVariant: '#EEF2F7',
    error: '#EF4444',
    onSurface: '#0F172A',
    onSurfaceVariant: '#475569',
    outline: '#CBD5E1',
  },
  fonts: configureFonts({ config: { fontFamily: 'System' } }),
};

export type AppTheme = typeof theme;

/** Status -> color mapping for queue entry/queue badges. */
export const statusColors: Record<string, string> = {
  WAITING: '#F59E0B',
  CALLED: '#2563EB',
  SERVING: '#0EA5E9',
  COMPLETED: '#16A34A',
  NO_SHOW: '#EF4444',
  CANCELLED: '#94A3B8',
  OPEN: '#16A34A',
  PAUSED: '#F59E0B',
  CLOSED: '#94A3B8',
  // Business verification statuses.
  PENDING_VERIFICATION: '#F59E0B',
  APPROVED: '#16A34A',
  REJECTED: '#EF4444',
};

/** Short, friendly labels for business statuses (chips/badges). */
export const businessStatusLabels: Record<string, string> = {
  PENDING_VERIFICATION: 'Pending review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};
