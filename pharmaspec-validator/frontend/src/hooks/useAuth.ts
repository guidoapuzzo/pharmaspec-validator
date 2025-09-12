import { useState, useEffect, useCallback, useContext, createContext, ReactNode } from 'react';
import { User, AuthToken, LoginCredentials, AuthState } from '@/types';
import { authApi } from '@/services/api';

// Auth Context
interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Auth Provider Component
interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    isLoading: true,
    error: null,
    isAuthenticated: false,
  });

  // Initialize auth state from localStorage
  useEffect(() => {
    const initAuth = () => {
      const token = localStorage.getItem('access_token');
      const userStr = localStorage.getItem('user');
      
      if (token && userStr) {
        try {
          const user = JSON.parse(userStr);
          setAuthState({
            user,
            token,
            isLoading: false,
            error: null,
            isAuthenticated: true,
          });
          
          // Verify token is still valid by fetching user profile
          authApi.getProfile()
            .then((profile) => {
              setAuthState(prev => ({
                ...prev,
                user: profile,
              }));
            })
            .catch(() => {
              // Token invalid, clear auth
              localStorage.removeItem('access_token');
              localStorage.removeItem('refresh_token');
              localStorage.removeItem('user');
              setAuthState({
                user: null,
                token: null,
                isLoading: false,
                error: null,
                isAuthenticated: false,
              });
            });
        } catch (error) {
          console.error('Error parsing user from localStorage:', error);
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token'); 
          localStorage.removeItem('user');
          setAuthState({
            user: null,
            token: null,
            isLoading: false,
            error: null,
            isAuthenticated: false,
          });
        }
      } else {
        setAuthState(prev => ({
          ...prev,
          isLoading: false,
        }));
      }
    };

    initAuth();
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    setAuthState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      const authResponse: AuthToken = await authApi.login(credentials);
      const user: User = await authApi.getProfile();

      // Store in localStorage
      localStorage.setItem('access_token', authResponse.access_token);
      localStorage.setItem('refresh_token', authResponse.refresh_token);
      localStorage.setItem('user', JSON.stringify(user));

      setAuthState({
        user,
        token: authResponse.access_token,
        isLoading: false,
        error: null,
        isAuthenticated: true,
      });
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.message || 'Login failed';
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      throw error;
    }
  }, []);

  const logout = useCallback(() => {
    // Clear localStorage
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');

    // Reset auth state
    setAuthState({
      user: null,
      token: null,
      isLoading: false,
      error: null,
      isAuthenticated: false,
    });

    // Call logout API endpoint
    authApi.logout().catch(console.error);
  }, []);

  const refreshToken = useCallback(async () => {
    const refresh = localStorage.getItem('refresh_token');
    if (!refresh) {
      logout();
      return;
    }

    try {
      const authResponse: AuthToken = await authApi.refreshToken({ refresh_token: refresh });
      
      localStorage.setItem('access_token', authResponse.access_token);
      localStorage.setItem('refresh_token', authResponse.refresh_token);

      setAuthState(prev => ({
        ...prev,
        token: authResponse.access_token,
        error: null,
      }));
    } catch (error) {
      console.error('Token refresh failed:', error);
      logout();
    }
  }, [logout]);

  const clearError = useCallback(() => {
    setAuthState(prev => ({
      ...prev,
      error: null,
    }));
  }, []);

  const contextValue: AuthContextType = {
    ...authState,
    login,
    logout,
    refreshToken,
    clearError,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Hook for checking user permissions
export function usePermissions() {
  const { user } = useAuth();
  
  return {
    isAdmin: user?.role === 'admin',
    isEngineer: user?.role === 'engineer' || user?.role === 'admin',
    canViewAuditTrail: user?.role === 'admin',
    canManageUsers: user?.role === 'admin',
    canViewAllProjects: user?.role === 'admin',
  };
}