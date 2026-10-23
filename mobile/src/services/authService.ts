import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'jwt_token';

// Global callback for handling 401 Unauthorized
let onLogoutCallback: (() => void) | null = null;

export const setOnLogoutCallback = (callback: () => void) => {
  onLogoutCallback = callback;
};

export const triggerLogout = () => {
  if (onLogoutCallback) {
    onLogoutCallback();
  }
};

export const saveToken = async (token: string): Promise<void> => {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch (error) {
    console.error('Error saving token:', error);
  }
};

export const getToken = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch (error) {
    console.error('Error getting token:', error);
    return null;
  }
};

export const removeToken = async (): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch (error) {
    console.error('Error removing token:', error);
  }
};
