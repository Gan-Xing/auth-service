/**
 * Auth Service JavaScript SDK
 * 
 * A simple JavaScript client for the Auth Service API
 * Works in both browser and Node.js environments
 */

class AuthServiceSDK {
  constructor(options = {}) {
    this.baseURL = options.baseURL || 'http://localhost:3001';
    this.apiKey = options.apiKey;
    this.tenantId = options.tenantId;
    this.accessToken = null;
    this.refreshToken = null;
    
    // Auto-load tokens from localStorage in browser
    if (typeof window !== 'undefined' && window.localStorage) {
      this.accessToken = localStorage.getItem('auth_access_token');
      this.refreshToken = localStorage.getItem('auth_refresh_token');
    }
  }

  /**
   * Make HTTP request to the API
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Add API Key if available
    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }

    // Add access token if available
    if (this.accessToken && !options.skipAuth) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const requestOptions = {
      method: options.method || 'GET',
      headers,
      ...options,
    };

    if (options.body && typeof options.body === 'object') {
      requestOptions.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url, requestOptions);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Request failed' }));
        throw new Error(error.message || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      // Try to refresh token if 401 and we have a refresh token
      if (error.message.includes('401') && this.refreshToken && !options.skipRefresh) {
        try {
          await this.refreshTokens();
          return await this.request(endpoint, { ...options, skipRefresh: true });
        } catch (refreshError) {
          this.clearTokens();
          throw refreshError;
        }
      }
      throw error;
    }
  }

  /**
   * Store tokens securely
   */
  setTokens(accessToken, refreshToken) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;

    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('auth_access_token', accessToken);
      localStorage.setItem('auth_refresh_token', refreshToken);
    }
  }

  /**
   * Clear stored tokens
   */
  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;

    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('auth_access_token');
      localStorage.removeItem('auth_refresh_token');
    }
  }

  /**
   * Register a new user
   */
  async register(userData) {
    const response = await this.request('/auth/register', {
      method: 'POST',
      body: {
        ...userData,
        tenantId: userData.tenantId || this.tenantId,
      },
      skipAuth: true,
    });

    return response;
  }

  /**
   * Login user
   */
  async login(credentials) {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: {
        ...credentials,
        tenantId: credentials.tenantId || this.tenantId,
      },
      skipAuth: true,
    });

    if (response.accessToken && response.refreshToken) {
      this.setTokens(response.accessToken, response.refreshToken);
    }

    return response;
  }

  /**
   * Logout user
   */
  async logout() {
    try {
      await this.request('/auth/logout', {
        method: 'POST',
        body: {
          refreshToken: this.refreshToken,
        },
      });
    } finally {
      this.clearTokens();
    }
  }

  /**
   * Get current user profile
   */
  async getProfile() {
    return await this.request('/auth/profile');
  }

  /**
   * Update user profile
   */
  async updateProfile(updates) {
    return await this.request('/auth/profile', {
      method: 'PATCH',
      body: updates,
    });
  }

  /**
   * Change password
   */
  async changePassword(oldPassword, newPassword) {
    return await this.request('/auth/change-password', {
      method: 'PATCH',
      body: {
        oldPassword,
        newPassword,
      },
    });
  }

  /**
   * Refresh access token
   */
  async refreshTokens() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await this.request('/auth/refresh', {
      method: 'POST',
      body: {
        refreshToken: this.refreshToken,
      },
      skipAuth: true,
      skipRefresh: true,
    });

    this.setTokens(response.accessToken, response.refreshToken);
    return response;
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email) {
    return await this.request('/auth/reset-password/request', {
      method: 'POST',
      body: {
        email,
        tenantId: this.tenantId,
      },
      skipAuth: true,
    });
  }

  /**
   * Reset password with token
   */
  async resetPassword(token, newPassword) {
    return await this.request('/auth/reset-password/confirm', {
      method: 'POST',
      body: {
        token,
        newPassword,
      },
      skipAuth: true,
    });
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.accessToken;
  }

  /**
   * Get user info from token (client-side only)
   */
  getTokenInfo() {
    if (!this.accessToken) return null;

    try {
      const payload = JSON.parse(atob(this.accessToken.split('.')[1]));
      return {
        userId: payload.sub,
        email: payload.email,
        tenantId: payload.tenantId,
        exp: payload.exp,
        iat: payload.iat,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  isTokenExpired() {
    const tokenInfo = this.getTokenInfo();
    if (!tokenInfo) return true;

    return Date.now() >= tokenInfo.exp * 1000;
  }
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuthServiceSDK;
} else if (typeof window !== 'undefined') {
  window.AuthServiceSDK = AuthServiceSDK;
}

// Usage Examples:

/*
// Browser usage
const authSDK = new AuthServiceSDK({
  baseURL: 'https://your-auth-service.com',
  tenantId: 'your-tenant-id'
});

// Login
try {
  const result = await authSDK.login({
    email: 'user@example.com',
    password: 'password123'
  });
  console.log('Logged in:', result.user);
} catch (error) {
  console.error('Login failed:', error.message);
}

// Get profile
if (authSDK.isAuthenticated()) {
  const profile = await authSDK.getProfile();
  console.log('User profile:', profile);
}

// Node.js usage with API Key
const authSDK = new AuthServiceSDK({
  baseURL: 'https://your-auth-service.com',
  apiKey: 'your-api-key',
  tenantId: 'your-tenant-id'
});

// Create user (server-side)
const newUser = await authSDK.register({
  email: 'newuser@example.com',
  password: 'SecurePass123!',
  name: 'New User'
});
*/