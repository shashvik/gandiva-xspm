import axios from 'axios';

// API URL from environment or default
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

// Token storage keys
const TOKEN_KEY = 'cspm_access_token';
const REFRESH_TOKEN_KEY = 'cspm_refresh_token';
const USER_INFO_KEY = 'cspm_user_info';

// Axios instance with auth headers
export const authAxios = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add interceptor to include token in requests
authAxios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add interceptor to handle token expiration
authAxios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If error is 401 and we haven't already tried refreshing
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Try to refresh the token
        const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
        if (!refreshToken) {
          // No refresh token, logout user
          logout();
          return Promise.reject(error);
        }
        
        const response = await axios.post(`${API_URL}/auth/refresh`, {}, {
          headers: {
            Authorization: `Bearer ${refreshToken}`
          }
        });
        
        // Update stored token
        const { access_token } = response.data;
        localStorage.setItem(TOKEN_KEY, access_token);
        
        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return axios(originalRequest);
      } catch (refreshError) {
        // If refresh failed, logout user
        logout();
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

// Login function
export const login = async (username: string, password: string) => {
  try {
    const response = await axios.post(`${API_URL}/auth/login`, {
      username,
      password
    });
    
    const { access_token, refresh_token, username: user, role } = response.data;
    
    // Store tokens and user info
    localStorage.setItem(TOKEN_KEY, access_token);
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh_token);
    localStorage.setItem(USER_INFO_KEY, JSON.stringify({ username: user, role }));
    
    return { username: user, role };
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
};

// Register function
export const register = async (username: string, password: string, email: string) => {
  try {
    const response = await axios.post(`${API_URL}/auth/register`, {
      username,
      password,
      email
    });
    
    return response.data;
  } catch (error) {
    console.error('Registration failed:', error);
    throw error;
  }
};

// Logout function
export const logout = () => {
  // Remove tokens and user info from localStorage
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_INFO_KEY);
  
  // Optional: call logout endpoint to invalidate the token on the server
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      authAxios.post('/auth/logout');
    }
  } catch (error) {
    console.error('Error during logout:', error);
  }
};

// Check if user is authenticated
export const isAuthenticated = (): boolean => {
  return !!localStorage.getItem(TOKEN_KEY);
};

// Get user info
export const getUserInfo = () => {
  const userInfo = localStorage.getItem(USER_INFO_KEY);
  return userInfo ? JSON.parse(userInfo) : null;
};

// Get JWT token
export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
}; 