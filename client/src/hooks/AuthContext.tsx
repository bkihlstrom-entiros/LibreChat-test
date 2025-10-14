import {
  useRef,
  useMemo,
  useState,
  useEffect,
  ReactNode,
  useContext,
  useCallback,
  createContext,
} from 'react';
import { debounce } from 'lodash';
import { useRecoilState } from 'recoil';
import { useNavigate } from 'react-router-dom';
import { setTokenHeader, SystemRoles } from 'librechat-data-provider';
import type * as t from 'librechat-data-provider';
import {
  useGetRole,
  useGetUserQuery,
  useLoginUserMutation,
  useLogoutUserMutation,
  useRefreshTokenMutation,
  useGetStartupConfig,
} from '~/data-provider';
import { TAuthConfig, TUserContext, TAuthContext, TResError } from '~/common';
import useTimeout from './useTimeout';
import store from '~/store';

const AuthContext = createContext<TAuthContext | undefined>(undefined);

const AuthContextProvider = ({
  authConfig,
  children,
}: {
  authConfig?: TAuthConfig;
  children: ReactNode;
}) => {
  const [user, setUser] = useRecoilState(store.user);
  const [token, setToken] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const logoutRedirectRef = useRef<string | undefined>(undefined);
  const bypassAuthInitialized = useRef<boolean>(false);

  // Get startup config to check for bypassAuth
  const { data: startupConfig, isLoading: configLoading } = useGetStartupConfig();
  const bypassAuth = startupConfig?.interface?.bypassAuth === true;

  // Debug log config state
  useEffect(() => {
    console.log('[AuthContext] Config state:', { 
      configLoading, 
      bypassAuth, 
      hasConfig: !!startupConfig 
    });
  }, [configLoading, bypassAuth, startupConfig]);

  const { data: userRole = null } = useGetRole(SystemRoles.USER, {
    enabled: !!(isAuthenticated && (user?.role ?? '')),
  });
  const { data: adminRole = null } = useGetRole(SystemRoles.ADMIN, {
    enabled: !!(isAuthenticated && user?.role === SystemRoles.ADMIN),
  });

  const navigate = useNavigate();

  const setUserContext = useMemo(
    () =>
      debounce((userContext: TUserContext) => {
        const { token, isAuthenticated, user, redirect } = userContext;
        setUser(user);
        setToken(token);
        //@ts-ignore - ok for token to be undefined initially
        setTokenHeader(token);
        setIsAuthenticated(isAuthenticated);

        // Use a custom redirect if set
        const finalRedirect = logoutRedirectRef.current || redirect;
        // Clear the stored redirect
        logoutRedirectRef.current = undefined;

        if (finalRedirect == null) {
          return;
        }

        if (finalRedirect.startsWith('http://') || finalRedirect.startsWith('https://')) {
          window.location.href = finalRedirect;
        } else {
          navigate(finalRedirect, { replace: true });
        }
      }, 50),
    [navigate, setUser],
  );
  const doSetError = useTimeout({ callback: (error) => setError(error as string | undefined) });

  const loginUser = useLoginUserMutation({
    onSuccess: (data: t.TLoginResponse) => {
      const { user, token, twoFAPending, tempToken } = data;
      if (twoFAPending) {
        // Redirect to the two-factor authentication route.
        navigate(`/login/2fa?tempToken=${tempToken}`, { replace: true });
        return;
      }
      setError(undefined);
      setUserContext({ token, isAuthenticated: true, user, redirect: '/c/new' });
    },
    onError: (error: TResError | unknown) => {
      const resError = error as TResError;
      doSetError(resError.message);
      navigate('/login', { replace: true });
    },
  });
  const logoutUser = useLogoutUserMutation({
    onSuccess: (data) => {
      setUserContext({
        token: undefined,
        isAuthenticated: false,
        user: undefined,
        redirect: data.redirect ?? '/login',
      });
    },
    onError: (error) => {
      doSetError((error as Error).message);
      setUserContext({
        token: undefined,
        isAuthenticated: false,
        user: undefined,
        redirect: '/login',
      });
    },
  });
  const refreshToken = useRefreshTokenMutation();

  const logout = useCallback(
    (redirect?: string) => {
      // Prevent logout in bypass auth mode
      if (bypassAuth) {
        console.log('Logout disabled in bypass auth mode');
        return;
      }
      if (redirect) {
        logoutRedirectRef.current = redirect;
      }
      logoutUser.mutate(undefined);
    },
    [logoutUser, bypassAuth],
  );

  // Disable user query in bypass auth mode OR while config is loading
  const userQuery = useGetUserQuery({ 
    enabled: !bypassAuth && !configLoading && !!(token ?? '') 
  });

  const login = (data: t.TLoginUser) => {
    loginUser.mutate(data);
  };

  const silentRefresh = useCallback(() => {
    // Skip refresh in bypass auth mode
    if (bypassAuth) {
      console.log('[AuthContext] Silent refresh skipped - bypass auth enabled');
      return;
    }
    // Skip refresh while config is loading
    if (configLoading) {
      console.log('[AuthContext] Silent refresh skipped - config loading');
      return;
    }
    if (authConfig?.test === true) {
      console.log('Test mode. Skipping silent refresh.');
      return;
    }
    console.log('[AuthContext] Running silent refresh...');
    refreshToken.mutate(undefined, {
      onSuccess: (data: t.TRefreshTokenResponse | undefined) => {
        const { user, token = '' } = data ?? {};
        if (token) {
          setUserContext({ token, isAuthenticated: true, user });
        } else {
          console.log('Token is not present. User is not authenticated.');
          if (authConfig?.test === true) {
            return;
          }
          navigate('/login');
        }
      },
      onError: (error) => {
        console.log('refreshToken mutation error:', error);
        if (authConfig?.test === true) {
          return;
        }
        navigate('/login');
      },
    });
  }, [bypassAuth, configLoading]);

  useEffect(() => {
    // Skip normal auth flow in bypass auth mode
    if (bypassAuth) {
      console.log('[AuthContext] Skipping normal auth flow - bypass auth enabled');
      return;
    }
    
    // Don't run auth checks while config is still loading
    // This prevents the 401 error before we know if bypass auth is enabled
    if (configLoading) {
      console.log('[AuthContext] Waiting for config to load...');
      return;
    }
    
    if (userQuery.data) {
      setUser(userQuery.data);
    } else if (userQuery.isError) {
      doSetError((userQuery.error as Error).message);
      navigate('/login', { replace: true });
    }
    if (error != null && error && isAuthenticated) {
      doSetError(undefined);
    }
    if (token == null || !token || !isAuthenticated) {
      silentRefresh();
    }
  }, [
    token,
    isAuthenticated,
    userQuery.data,
    userQuery.isError,
    userQuery.error,
    error,
    setUser,
    navigate,
    silentRefresh,
    setUserContext,
    bypassAuth,
    configLoading,
  ]);

  // Handle bypass authentication mode
  useEffect(() => {
    if (bypassAuth && !bypassAuthInitialized.current && startupConfig) {
      console.log('[AuthContext] Initializing bypass auth mode');
      bypassAuthInitialized.current = true;
      // Create a guest user and mark as authenticated
      const guestUser: t.TUser = {
        id: 'guest',
        username: 'Guest',
        email: 'guest@localhost',
        name: 'Guest User',
        avatar: '',
        role: 'user',
        provider: 'local',
        plugins: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setUser(guestUser);
      setIsAuthenticated(true);
      setToken('bypass-auth-token');
      setTokenHeader('bypass-auth-token');
      console.log('[AuthContext] Bypass auth initialized, user set to guest');
      // Don't navigate here - let the normal flow handle it
    }
  }, [bypassAuth, startupConfig, setUser]);

  useEffect(() => {
    const handleTokenUpdate = (event) => {
      console.log('tokenUpdated event received event');
      const newToken = event.detail;
      setUserContext({
        token: newToken,
        isAuthenticated: true,
        user: user,
      });
    };

    window.addEventListener('tokenUpdated', handleTokenUpdate);

    return () => {
      window.removeEventListener('tokenUpdated', handleTokenUpdate);
    };
  }, [setUserContext, user]);

  // Make the provider update only when it should
  const memoedValue = useMemo(
    () => ({
      user,
      token,
      error,
      login,
      logout,
      setError,
      roles: {
        [SystemRoles.USER]: userRole,
        [SystemRoles.ADMIN]: adminRole,
      },
      isAuthenticated,
    }),

    [user, error, isAuthenticated, token, userRole, adminRole],
  );

  return <AuthContext.Provider value={memoedValue}>{children}</AuthContext.Provider>;
};

const useAuthContext = () => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuthContext should be used inside AuthProvider');
  }

  return context;
};

export { AuthContextProvider, useAuthContext, AuthContext };
