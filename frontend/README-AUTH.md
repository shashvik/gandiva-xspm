# Authentication Implementation Guide

This document explains how authentication is implemented in the Gandiva CSPM frontend application.

## Overview

The frontend authenticates with the Flask backend using JWT (JSON Web Token) authentication. When a user logs in, they receive an access token and a refresh token, which are stored in the browser's local storage. The access token is used for authenticating API requests, while the refresh token is used to obtain a new access token when the current one expires.

## Components

1. **Authentication Service**: `src/services/auth.ts`
   - Handles login, logout, and token management functions
   - Provides helper functions to check authentication status
   - Implements token refresh logic
   - Includes Axios interceptors to automatically handle token expiration

2. **Login Page**: `src/pages/Login.tsx` 
   - Provides a user-friendly login interface
   - Handles form validation and submission
   - Displays appropriate error messages
   - Redirects authenticated users to the dashboard

3. **Login Form**: `src/components/LoginForm.tsx`
   - Form component with username/password fields
   - Implements form validation
   - Displays login error feedback

4. **Protected Route**: `src/components/ProtectedRoute.tsx`
   - Higher Order Component (HOC) that wraps routes requiring authentication
   - Checks authentication status before rendering protected components
   - Redirects unauthenticated users to the login page
   - Preserves the intended destination URL for post-login navigation

5. **User Menu**: `src/components/TopNavBar.tsx`
   - Displays the current user's information
   - Provides logout functionality
   - Shows appropriate options based on user role

## Implementation Details

### Token Storage

Tokens are stored in the browser's local storage:
- `access_token`: Short-lived JWT for API authentication
- `refresh_token`: Longer-lived JWT for obtaining new access tokens
- `user_info`: Basic user information (username, role, etc.)

### Authentication Flow

1. **Login Process**:
   ```
   User enters credentials → Backend validates → Backend returns tokens → Frontend stores tokens → Redirect to dashboard
   ```

2. **API Request Authentication**:
   ```
   Request initiated → Interceptor adds token → Request sent → Response received
   ```

3. **Token Refresh Process**:
   ```
   API request fails with 401 → Interceptor catches error → Refresh token sent to backend → New access token received → Original request retried
   ```

4. **Logout Process**:
   ```
   User clicks logout → Tokens sent to backend for invalidation → Tokens removed from storage → Redirect to login
   ```

### Role-Based Access Control

The application implements role-based access control:
- `admin`: Full access to all features
- `user`: Limited access to dashboard and reporting features
- Additional roles can be configured as needed

## Code Examples

### Authentication Service

```typescript
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL;

// Create an axios instance that includes authentication
export const authAxios = axios.create({
  baseURL: API_URL
});

// Add token to requests
authAxios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle token refresh
authAxios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If the error is 401 and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Attempt to refresh the token
        const refreshToken = localStorage.getItem('refresh_token');
        const response = await axios.post(`${API_URL}/auth/refresh`, {
          refresh_token: refreshToken
        });
        
        // Store the new token
        localStorage.setItem('access_token', response.data.access_token);
        
        // Retry the original request
        originalRequest.headers.Authorization = `Bearer ${response.data.access_token}`;
        return axios(originalRequest);
      } catch (refreshError) {
        // If refresh fails, redirect to login
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export const login = async (username, password) => {
  const response = await axios.post(`${API_URL}/auth/login`, {
    username,
    password
  });
  
  localStorage.setItem('access_token', response.data.access_token);
  localStorage.setItem('refresh_token', response.data.refresh_token);
  localStorage.setItem('user_info', JSON.stringify(response.data.user));
  
  return response.data;
};

export const logout = async () => {
  try {
    await authAxios.post(`${API_URL}/auth/logout`);
  } finally {
    localStorage.clear();
  }
};

export const isAuthenticated = () => {
  return localStorage.getItem('access_token') !== null;
};

export const getUserInfo = () => {
  const userInfo = localStorage.getItem('user_info');
  return userInfo ? JSON.parse(userInfo) : null;
};

export const hasRole = (requiredRole) => {
  const userInfo = getUserInfo();
  return userInfo && userInfo.role === requiredRole;
};
```

### Protected Route Component

```tsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { isAuthenticated } from '../services/auth';

const ProtectedRoute = ({ children }) => {
  const location = useLocation();
  
  if (!isAuthenticated()) {
    // Redirect to login page, saving the current location
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  
  return children;
};

export default ProtectedRoute;
```

## Security Considerations

1. **Token Storage**:
   - Tokens are stored in local storage, which is vulnerable to XSS attacks
   - For higher security environments, consider using HTTP-only cookies
   - Implement token expiration and refresh policies

2. **Token Expiration**:
   - Access tokens should have a short lifespan (15-60 minutes)
   - Refresh tokens can have longer lifespans but should be revocable

3. **HTTPS**:
   - Always use HTTPS in production to protect tokens in transit
   - Enforce secure cookie attributes (Secure, HttpOnly) when applicable

4. **CORS**:
   - Ensure the backend has appropriate CORS settings
   - Restrict allowed origins to trusted domains

5. **Error Handling**:
   - Don't expose sensitive information in error messages
   - Implement proper logging for authentication failures

## Troubleshooting

### Common Issues

1. **"Authentication Required" message appears repeatedly**:
   - Check if the backend is running and accessible
   - Verify that the API URL in the `.env` file is correct
   - Check browser console for CORS errors
   - Try clearing local storage and logging in again

2. **Login succeeds but protected routes still redirect to login**:
   - Check browser console for error messages
   - Verify that tokens are properly stored in localStorage
   - Check if the token format is correct

3. **Token refresh not working**:
   - Verify that your backend refresh token endpoint is working correctly
   - Check if the refresh token is valid and not expired
   - Look for network errors in the browser console

4. **Cannot access admin features despite having admin role**:
   - Verify that the user info contains the correct role
   - Check if role-based restrictions are properly implemented
   - Try logging out and logging back in

### Debugging Tools

1. **Browser Developer Tools**:
   - Application tab → Local Storage: Check if tokens are stored
   - Network tab: Monitor auth-related requests
   - Console: Look for auth-related errors

2. **JWT Debugger**:
   - Use https://jwt.io/ to decode and verify tokens
   - Check token expiration times and claims

3. **Backend Logs**:
   - Check the backend authentication logs for errors
   - Monitor failed login attempts

## Future Improvements

1. **Multi-factor Authentication**:
   - Implement MFA for additional security
   - Support for app-based or email verification

2. **SSO Integration**:
   - Support for OAuth 2.0 / OpenID Connect
   - Integration with identity providers

3. **Session Management**:
   - Active session listing
   - Force logout from all devices
   - Inactivity timeout

4. **Security Enhancements**:
   - Move from local storage to HTTP-only cookies
   - Implement CSRF protection
   - Add rate limiting for login attempts 