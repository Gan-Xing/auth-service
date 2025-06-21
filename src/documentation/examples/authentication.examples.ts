/**
 * 认证 API 使用示例
 * 
 * 这个文件包含了认证服务各种使用场景的完整示例代码
 */

// ========================
// 基础认证流程示例
// ========================

export const authenticationExamples = {
  // 用户注册示例
  userRegistration: {
    description: "用户注册完整流程",
    code: `
// 1. 用户注册
const registerResponse = await fetch('https://auth.example.com/auth/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY',
    'X-Tenant-ID': 'your-tenant-id'
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePassword123!',
    firstName: 'John',
    lastName: 'Doe',
    phoneNumber: '+1234567890',
    country: 'US'
  })
});

const registerData = await registerResponse.json();
console.log('Registration result:', registerData);

// 2. 发送邮箱验证码
const verificationResponse = await fetch('https://auth.example.com/auth/send-verification-code', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'user@example.com',
    type: 'email'
  })
});

// 3. 使用验证码完成注册
const completeRegistrationResponse = await fetch('https://auth.example.com/auth/register-with-code', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePassword123!',
    firstName: 'John',
    lastName: 'Doe',
    verificationCode: '123456'
  })
});

const userData = await completeRegistrationResponse.json();
console.log('User created:', userData);
`,
  },

  // 用户登录示例
  userLogin: {
    description: "用户登录和Token管理",
    code: `
// 1. 用户登录
const loginResponse = await fetch('https://auth.example.com/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'SecurePassword123!'
  })
});

const loginData = await loginResponse.json();
const { accessToken, refreshToken } = loginData.data;

// 2. 使用 Access Token 访问受保护的资源
const profileResponse = await fetch('https://auth.example.com/auth/profile', {
  headers: {
    'Authorization': \`Bearer \${accessToken}\`
  }
});

const profile = await profileResponse.json();
console.log('User profile:', profile);

// 3. Token 刷新
const refreshResponse = await fetch('https://auth.example.com/auth/refresh', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    refreshToken: refreshToken
  })
});

const newTokens = await refreshResponse.json();
console.log('New tokens:', newTokens);

// 4. 用户登出
const logoutResponse = await fetch('https://auth.example.com/auth/logout', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${accessToken}\`
  }
});
`,
  },

  // OAuth 第三方登录示例
  oauthLogin: {
    description: "第三方 OAuth 登录集成",
    code: `
// 1. GitHub OAuth 登录
const githubAuthUrl = 'https://auth.example.com/auth/oauth/github';
// 重定向用户到 GitHub 授权页面
window.location.href = githubAuthUrl;

// 2. 处理 OAuth 回调 (在你的回调页面中)
const urlParams = new URLSearchParams(window.location.search);
const code = urlParams.get('code');
const state = urlParams.get('state');

if (code) {
  // 获取访问令牌
  const tokenResponse = await fetch('https://auth.example.com/auth/oauth/github/callback', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      code: code,
      state: state
    })
  });
  
  const tokens = await tokenResponse.json();
  
  // 存储 tokens 并重定向到应用主页
  localStorage.setItem('accessToken', tokens.data.accessToken);
  localStorage.setItem('refreshToken', tokens.data.refreshToken);
  
  window.location.href = '/dashboard';
}

// 3. Google OAuth 登录 (类似流程)
const googleAuthUrl = 'https://auth.example.com/auth/oauth/google';
window.location.href = googleAuthUrl;
`,
  },

  // 密码重置示例
  passwordReset: {
    description: "密码重置完整流程",
    code: `
// 1. 请求密码重置
const resetRequestResponse = await fetch('https://auth.example.com/auth/request-password-reset', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: JSON.stringify({
    email: 'user@example.com'
  })
});

console.log('Password reset email sent');

// 2. 用户点击邮件中的链接后，使用重置 token 重置密码
const resetToken = 'reset-token-from-email-link';
const resetPasswordResponse = await fetch('https://auth.example.com/auth/reset-password', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    token: resetToken,
    newPassword: 'NewSecurePassword123!'
  })
});

const resetResult = await resetPasswordResponse.json();
console.log('Password reset result:', resetResult);

// 3. 用户登录密码修改 (已登录用户)
const changePasswordResponse = await fetch('https://auth.example.com/auth/change-password', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': \`Bearer \${accessToken}\`
  },
  body: JSON.stringify({
    currentPassword: 'CurrentPassword123!',
    newPassword: 'NewPassword123!'
  })
});
`,
  }
};

// ========================
// 租户管理示例
// ========================

export const tenantManagementExamples = {
  // 创建租户
  createTenant: {
    description: "创建新租户",
    code: `
// 创建租户
const tenantResponse = await fetch('https://auth.example.com/tenant', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Acme Corporation',
    domain: 'acme.com',
    settings: {
      allowRegistration: true,
      requireEmailVerification: true,
      passwordPolicy: {
        minLength: 8,
        requireNumbers: true,
        requireSymbols: true
      }
    }
  })
});

const tenant = await tenantResponse.json();
const tenantId = tenant.data.id;
const apiKey = tenant.data.apiKey;

console.log('Tenant created:', { tenantId, apiKey });
`,
  },

  // API Key 管理
  apiKeyManagement: {
    description: "API Key 创建和管理",
    code: `
// 1. 创建新的 API Key
const createKeyResponse = await fetch('https://auth.example.com/tenant/api-keys', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_EXISTING_API_KEY'
  },
  body: JSON.stringify({
    name: 'Production API Key',
    permissions: ['auth:read', 'auth:write', 'users:read'],
    expiresAt: '2024-12-31T23:59:59.000Z'
  })
});

const newApiKey = await createKeyResponse.json();

// 2. 获取 API Key 列表
const listKeysResponse = await fetch('https://auth.example.com/tenant/api-keys', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY'
  }
});

const apiKeys = await listKeysResponse.json();

// 3. 删除 API Key
const deleteKeyResponse = await fetch(\`https://auth.example.com/tenant/api-keys/\${keyId}\`, {
  method: 'DELETE',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY'
  }
});
`,
  }
};

// ========================
// 前端集成示例
// ========================

export const frontendIntegrationExamples = {
  // React 集成示例
  reactIntegration: {
    description: "React 应用集成示例",
    code: `
// AuthContext.js - React Context for authentication
import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState(
    localStorage.getItem('accessToken')
  );

  // 检查用户登录状态
  useEffect(() => {
    if (accessToken) {
      fetchUserProfile();
    } else {
      setLoading(false);
    }
  }, [accessToken]);

  const fetchUserProfile = async () => {
    try {
      const response = await fetch('https://auth.example.com/auth/profile', {
        headers: {
          'Authorization': \`Bearer \${accessToken}\`
        }
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData.data);
      } else {
        // Token 可能过期，尝试刷新
        await refreshToken();
      }
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await fetch('https://auth.example.com/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer YOUR_API_KEY'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      
      if (data.success) {
        const { accessToken, refreshToken, user } = data.data;
        
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        
        setAccessToken(accessToken);
        setUser(user);
        
        return { success: true };
      } else {
        return { success: false, error: data.message };
      }
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setAccessToken(null);
    setUser(null);
  };

  const refreshToken = async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        logout();
        return;
      }

      const response = await fetch('https://auth.example.com/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refreshToken })
      });

      const data = await response.json();
      
      if (data.success) {
        const { accessToken } = data.data;
        localStorage.setItem('accessToken', accessToken);
        setAccessToken(accessToken);
      } else {
        logout();
      }
    } catch (error) {
      logout();
    }
  };

  const value = {
    user,
    login,
    logout,
    loading,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// ProtectedRoute.js - 受保护的路由组件
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  return isAuthenticated ? children : <Navigate to="/login" />;
};

// Login.js - 登录组件
import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(email, password);
    
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error);
    }
    
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
      />
      {error && <div className="error">{error}</div>}
      <button type="submit" disabled={loading}>
        {loading ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
};
`,
  },

  // Vue.js 集成示例
  vueIntegration: {
    description: "Vue.js 应用集成示例",
    code: `
// auth.js - Vue 3 Composition API 示例
import { ref, computed } from 'vue';

const user = ref(null);
const accessToken = ref(localStorage.getItem('accessToken'));

export const useAuth = () => {
  const isAuthenticated = computed(() => !!user.value);

  const login = async (email, password) => {
    try {
      const response = await fetch('https://auth.example.com/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer YOUR_API_KEY'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      
      if (data.success) {
        accessToken.value = data.data.accessToken;
        user.value = data.data.user;
        
        localStorage.setItem('accessToken', data.data.accessToken);
        localStorage.setItem('refreshToken', data.data.refreshToken);
        
        return { success: true };
      }
      
      return { success: false, error: data.message };
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  };

  const logout = () => {
    user.value = null;
    accessToken.value = null;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  };

  const fetchProfile = async () => {
    if (!accessToken.value) return;

    try {
      const response = await fetch('https://auth.example.com/auth/profile', {
        headers: {
          'Authorization': \`Bearer \${accessToken.value}\`
        }
      });

      if (response.ok) {
        const data = await response.json();
        user.value = data.data;
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    }
  };

  return {
    user,
    isAuthenticated,
    login,
    logout,
    fetchProfile
  };
};

// LoginForm.vue
<template>
  <form @submit.prevent="handleLogin">
    <div>
      <input
        v-model="email"
        type="email"
        placeholder="Email"
        required
      />
    </div>
    <div>
      <input
        v-model="password"
        type="password"
        placeholder="Password"
        required
      />
    </div>
    <div v-if="error" class="error">{{ error }}</div>
    <button type="submit" :disabled="loading">
      {{ loading ? 'Logging in...' : 'Login' }}
    </button>
  </form>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from './auth';

const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

const router = useRouter();
const { login } = useAuth();

const handleLogin = async () => {
  loading.value = true;
  error.value = '';

  const result = await login(email.value, password.value);
  
  if (result.success) {
    router.push('/dashboard');
  } else {
    error.value = result.error;
  }
  
  loading.value = false;
};
</script>
`,
  }
};

// ========================
// 后端集成示例
// ========================

export const backendIntegrationExamples = {
  // Node.js Express 集成
  nodeExpressIntegration: {
    description: "Node.js Express 应用集成",
    code: `
// middleware/auth.js - JWT 验证中间件
const jwt = require('jsonwebtoken');
const axios = require('axios');

// 获取 JWKS (JSON Web Key Set) 用于验证 JWT
let jwks = null;
const getJWKS = async () => {
  if (!jwks) {
    const response = await axios.get('https://auth.example.com/.well-known/jwks.json');
    jwks = response.data;
  }
  return jwks;
};

const verifyJWT = async (token) => {
  const jwksData = await getJWKS();
  
  // 解码 JWT header 获取 kid
  const decoded = jwt.decode(token, { complete: true });
  const kid = decoded.header.kid;
  
  // 找到对应的公钥
  const key = jwksData.keys.find(k => k.kid === kid);
  if (!key) {
    throw new Error('No matching key found');
  }
  
  // 验证 JWT
  const publicKey = \`-----BEGIN CERTIFICATE-----\\n\${key.x5c[0]}\\n-----END CERTIFICATE-----\`;
  return jwt.verify(token, publicKey, { algorithms: ['RS256'] });
};

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = await verifyJWT(token);
    
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = { authMiddleware };

// app.js - Express 应用主文件
const express = require('express');
const { authMiddleware } = require('./middleware/auth');

const app = express();
app.use(express.json());

// 公开路由
app.get('/public', (req, res) => {
  res.json({ message: 'This is a public endpoint' });
});

// 受保护的路由
app.get('/protected', authMiddleware, (req, res) => {
  res.json({ 
    message: 'This is a protected endpoint',
    user: req.user 
  });
});

// 用户特定的路由
app.get('/user/profile', authMiddleware, (req, res) => {
  const userId = req.user.sub;
  
  // 获取用户数据的逻辑
  res.json({
    userId,
    message: 'User profile data'
  });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
`,
  },

  // Python Flask 集成
  pythonFlaskIntegration: {
    description: "Python Flask 应用集成",
    code: `
# auth.py - Flask JWT 验证
import jwt
import requests
from functools import wraps
from flask import request, jsonify, current_app

# 获取 JWKS
def get_jwks():
    response = requests.get('https://auth.example.com/.well-known/jwks.json')
    return response.json()

def verify_jwt(token):
    # 获取 JWKS
    jwks = get_jwks()
    
    # 解码 JWT header
    header = jwt.get_unverified_header(token)
    kid = header['kid']
    
    # 找到对应的公钥
    key = None
    for k in jwks['keys']:
        if k['kid'] == kid:
            key = k
            break
    
    if not key:
        raise Exception('No matching key found')
    
    # 构建公钥
    public_key = f"-----BEGIN CERTIFICATE-----\\n{key['x5c'][0]}\\n-----END CERTIFICATE-----"
    
    # 验证 JWT
    decoded = jwt.decode(token, public_key, algorithms=['RS256'])
    return decoded

def auth_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'No token provided'}), 401
        
        token = auth_header[7:]
        
        try:
            decoded = verify_jwt(token)
            request.user = decoded
            return f(*args, **kwargs)
        except Exception as e:
            return jsonify({'error': 'Invalid token'}), 401
    
    return decorated_function

# app.py - Flask 应用主文件
from flask import Flask, jsonify, request
from auth import auth_required

app = Flask(__name__)

@app.route('/public')
def public():
    return jsonify({'message': 'This is a public endpoint'})

@app.route('/protected')
@auth_required
def protected():
    return jsonify({
        'message': 'This is a protected endpoint',
        'user': request.user
    })

@app.route('/user/profile')
@auth_required
def user_profile():
    user_id = request.user['sub']
    
    # 获取用户数据的逻辑
    return jsonify({
        'userId': user_id,
        'message': 'User profile data'
    })

if __name__ == '__main__':
    app.run(debug=True)
`,
  }
};

// ========================
// 移动应用集成示例
// ========================

export const mobileIntegrationExamples = {
  // React Native 集成
  reactNativeIntegration: {
    description: "React Native 移动应用集成",
    code: `
// AuthService.js - React Native 认证服务
import AsyncStorage from '@react-native-async-storage/async-storage';

class AuthService {
  constructor() {
    this.baseURL = 'https://auth.example.com';
    this.apiKey = 'YOUR_API_KEY';
  }

  async login(email, password) {
    try {
      const response = await fetch(\`\${this.baseURL}/auth/login\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${this.apiKey}\`
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      
      if (data.success) {
        await AsyncStorage.setItem('accessToken', data.data.accessToken);
        await AsyncStorage.setItem('refreshToken', data.data.refreshToken);
        await AsyncStorage.setItem('user', JSON.stringify(data.data.user));
        
        return { success: true, user: data.data.user };
      }
      
      return { success: false, error: data.message };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async logout() {
    try {
      const accessToken = await AsyncStorage.getItem('accessToken');
      
      if (accessToken) {
        await fetch(\`\${this.baseURL}/auth/logout\`, {
          method: 'POST',
          headers: {
            'Authorization': \`Bearer \${accessToken}\`
          }
        });
      }
      
      await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'user']);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  async refreshToken() {
    try {
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      
      if (!refreshToken) {
        throw new Error('No refresh token');
      }

      const response = await fetch(\`\${this.baseURL}/auth/refresh\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refreshToken })
      });

      const data = await response.json();
      
      if (data.success) {
        await AsyncStorage.setItem('accessToken', data.data.accessToken);
        return data.data.accessToken;
      }
      
      throw new Error(data.message);
    } catch (error) {
      await this.logout();
      throw error;
    }
  }

  async getStoredUser() {
    try {
      const userString = await AsyncStorage.getItem('user');
      return userString ? JSON.parse(userString) : null;
    } catch (error) {
      return null;
    }
  }

  async isAuthenticated() {
    const accessToken = await AsyncStorage.getItem('accessToken');
    return !!accessToken;
  }
}

export default new AuthService();

// AuthContext.js - React Native Context
import React, { createContext, useContext, useState, useEffect } from 'react';
import AuthService from './AuthService';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      const isAuth = await AuthService.isAuthenticated();
      if (isAuth) {
        const storedUser = await AuthService.getStoredUser();
        setUser(storedUser);
      }
    } catch (error) {
      console.error('Auth check error:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const result = await AuthService.login(email, password);
    if (result.success) {
      setUser(result.user);
    }
    return result;
  };

  const logout = async () => {
    await AuthService.logout();
    setUser(null);
  };

  const value = {
    user,
    login,
    logout,
    loading,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// LoginScreen.js - 登录界面
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from './AuthContext';

export const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    
    const result = await login(email, password);
    
    if (result.success) {
      navigation.navigate('Home');
    } else {
      Alert.alert('Login Failed', result.error);
    }
    
    setLoading(false);
  };

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 24, marginBottom: 20 }}>Login</Text>
      
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        style={{ borderWidth: 1, padding: 10, marginBottom: 10 }}
      />
      
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        secureTextEntry
        style={{ borderWidth: 1, padding: 10, marginBottom: 20 }}
      />
      
      <TouchableOpacity
        onPress={handleLogin}
        disabled={loading}
        style={{ 
          backgroundColor: loading ? '#ccc' : '#007bff',
          padding: 15,
          alignItems: 'center'
        }}
      >
        <Text style={{ color: 'white' }}>
          {loading ? 'Logging in...' : 'Login'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};
`,
  }
};