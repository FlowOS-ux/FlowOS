/**
 * FlowOS mobile - src/navigation/RootNavigator.tsx
 * Chooses the navigation tree by auth state + role:
 *   no user        -> Auth stack (Login/Register)
 *   owner/staff     -> Business tabs (+ Queue Manager)
 *   customer        -> Customer tabs (+ Business Details)
 */
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { navigationRef } from './navigationRef';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../auth/AuthContext';
import { theme } from '../theme';
import type {
  AuthStackParamList,
  CustomerStackParamList,
  BusinessStackParamList,
  AdminStackParamList,
} from './types';

import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import VerifyEmailScreen from '../screens/auth/VerifyEmailScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ExploreScreen from '../screens/customer/ExploreScreen';
import BusinessDetailsScreen from '../screens/customer/BusinessDetailsScreen';
import ActivityScreen from '../screens/customer/ActivityScreen';
import AIAssistantScreen from '../screens/customer/AIAssistantScreen';
import BusinessesScreen from '../screens/business/BusinessesScreen';
import CreateBusinessScreen from '../screens/business/CreateBusinessScreen';
import BusinessSetupScreen from '../screens/business/BusinessSetupScreen';
import QueueFormScreen from '../screens/business/QueueFormScreen';
import QueueManagerScreen from '../screens/business/QueueManagerScreen';
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import BusinessReviewScreen from '../screens/admin/BusinessReviewScreen';
import NotificationsScreen from '../screens/shared/NotificationsScreen';
import ProfileScreen from '../screens/shared/ProfileScreen';
import Splash from '../components/Splash';
import ConnectionErrorScreen from '../components/ConnectionErrorScreen';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const CustomerStack = createNativeStackNavigator<CustomerStackParamList>();
const BusinessStack = createNativeStackNavigator<BusinessStackParamList>();
const AdminStack = createNativeStackNavigator<AdminStackParamList>();
const CustomerTab = createBottomTabNavigator();
const BusinessTab = createBottomTabNavigator();
const AdminTab = createBottomTabNavigator();

const tabIcon =
  (name: string) =>
  ({ color, size }: { color: string; size: number }) =>
    <Icon name={name} color={color} size={size} />;

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      <AuthStack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </AuthStack.Navigator>
  );
}

function CustomerTabs() {
  return (
    <CustomerTab.Navigator
      screenOptions={{ tabBarActiveTintColor: theme.colors.primary, headerShown: true }}
    >
      <CustomerTab.Screen
        name="Explore"
        component={ExploreScreen}
        options={{ tabBarIcon: tabIcon('compass-outline') }}
      />
      <CustomerTab.Screen
        name="Assistant"
        component={AIAssistantScreen}
        options={{ title: 'Assistant', tabBarIcon: tabIcon('robot-happy-outline') }}
      />
      <CustomerTab.Screen
        name="Activity"
        component={ActivityScreen}
        options={{ title: 'My Queues', tabBarIcon: tabIcon('ticket-confirmation-outline') }}
      />
      <CustomerTab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ tabBarIcon: tabIcon('bell-outline') }}
      />
      <CustomerTab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarIcon: tabIcon('account-outline') }}
      />
    </CustomerTab.Navigator>
  );
}

function CustomerNavigator() {
  return (
    <CustomerStack.Navigator>
      <CustomerStack.Screen
        name="CustomerTabs"
        component={CustomerTabs}
        options={{ headerShown: false }}
      />
      <CustomerStack.Screen
        name="BusinessDetails"
        component={BusinessDetailsScreen}
        options={{ title: 'Business' }}
      />
    </CustomerStack.Navigator>
  );
}

function BusinessTabs() {
  return (
    <BusinessTab.Navigator
      screenOptions={{ tabBarActiveTintColor: theme.colors.primary, headerShown: true }}
    >
      <BusinessTab.Screen
        name="Businesses"
        component={BusinessesScreen}
        options={{ title: 'Dashboard', tabBarIcon: tabIcon('view-dashboard-outline') }}
      />
      <BusinessTab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ tabBarIcon: tabIcon('bell-outline') }}
      />
      <BusinessTab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarIcon: tabIcon('account-outline') }}
      />
    </BusinessTab.Navigator>
  );
}

function BusinessNavigator() {
  return (
    <BusinessStack.Navigator>
      <BusinessStack.Screen
        name="BusinessTabs"
        component={BusinessTabs}
        options={{ headerShown: false }}
      />
      <BusinessStack.Screen
        name="CreateBusiness"
        component={CreateBusinessScreen}
        options={{ title: 'Create Business' }}
      />
      <BusinessStack.Screen
        name="BusinessSetup"
        component={BusinessSetupScreen}
        options={{ title: 'Business Setup' }}
      />
      <BusinessStack.Screen
        name="QueueForm"
        component={QueueFormScreen}
        options={({ route }) => ({ title: route.params.queue ? 'Edit Queue' : 'Create Queue' })}
      />
      <BusinessStack.Screen
        name="QueueManager"
        component={QueueManagerScreen}
        options={({ route }) => ({ title: route.params.queueName })}
      />
    </BusinessStack.Navigator>
  );
}

function AdminTabs() {
  return (
    <AdminTab.Navigator
      screenOptions={{ tabBarActiveTintColor: theme.colors.primary, headerShown: true }}
    >
      <AdminTab.Screen
        name="Pending"
        component={AdminDashboardScreen}
        options={{ title: 'Verification', tabBarIcon: tabIcon('clipboard-check-outline') }}
      />
      <AdminTab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarIcon: tabIcon('account-outline') }}
      />
    </AdminTab.Navigator>
  );
}

function AdminNavigator() {
  return (
    <AdminStack.Navigator>
      <AdminStack.Screen
        name="AdminTabs"
        component={AdminTabs}
        options={{ headerShown: false }}
      />
      <AdminStack.Screen
        name="BusinessReview"
        component={BusinessReviewScreen}
        options={{ title: 'Review business' }}
      />
    </AdminStack.Navigator>
  );
}

export default function RootNavigator() {
  const { user, initializing, bootError, retryRestore } = useAuth();

  if (initializing) {
    return <Splash />;
  }

  // Saved session couldn't be restored because the backend was unreachable — show a
  // recoverable connection screen (and keep retrying) instead of the login screen.
  if (!user && bootError === 'network') {
    return <ConnectionErrorScreen onRetry={retryRestore} />;
  }

  const isAdmin = user?.role === 'PLATFORM_ADMIN';
  const isBusiness = user?.role === 'BUSINESS_OWNER' || user?.role === 'STAFF';

  return (
    <NavigationContainer ref={navigationRef}>
      {!user ? (
        <AuthNavigator />
      ) : isAdmin ? (
        <AdminNavigator />
      ) : isBusiness ? (
        <BusinessNavigator />
      ) : (
        <CustomerNavigator />
      )}
    </NavigationContainer>
  );
}
