# Auth Service SDK Examples

This directory contains official SDK examples for integrating with the Auth Service API in various programming languages.

## Available SDKs

### JavaScript/TypeScript SDK
- **File**: `javascript/auth-sdk.js`
- **Environment**: Browser & Node.js
- **Features**: 
  - Automatic token management
  - Local storage integration (browser)
  - Automatic token refresh
  - Full API coverage

#### Usage
```javascript
// Browser
const authSDK = new AuthServiceSDK({
  baseURL: 'https://your-auth-service.com',
  tenantId: 'your-tenant-id'
});

// Login
const result = await authSDK.login({
  email: 'user@example.com',
  password: 'password123'
});

// Get profile
const profile = await authSDK.getProfile();
```

### Python SDK
- **File**: `python/auth_sdk.py`
- **Requirements**: `requests` library
- **Features**:
  - Context manager support
  - Type hints
  - Comprehensive error handling
  - Session pooling for performance

#### Installation
```bash
pip install requests
```

#### Usage
```python
from auth_sdk import AuthServiceSDK

# Initialize
auth = AuthServiceSDK(
    base_url='https://your-auth-service.com',
    tenant_id='your-tenant-id'
)

# Login
result = auth.login('user@example.com', 'password123')

# Get profile
profile = auth.get_profile()

# Context manager usage
with AuthServiceSDK(base_url='...', tenant_id='...') as auth:
    auth.login('user@example.com', 'password123')
    profile = auth.get_profile()
```

### Java SDK
- **File**: `java/AuthServiceSDK.java`
- **Dependencies**: OkHttp, Gson
- **Features**:
  - Builder pattern for initialization
  - Comprehensive exception handling
  - Type-safe data models
  - Connection pooling

#### Dependencies (Maven)
```xml
<dependencies>
    <dependency>
        <groupId>com.squareup.okhttp3</groupId>
        <artifactId>okhttp</artifactId>
        <version>4.12.0</version>
    </dependency>
    <dependency>
        <groupId>com.google.code.gson</groupId>
        <artifactId>gson</artifactId>
        <version>2.10.1</version>
    </dependency>
</dependencies>
```

#### Usage
```java
AuthServiceSDK auth = new AuthServiceSDK.Builder()
    .baseUrl("https://your-auth-service.com")
    .tenantId("your-tenant-id")
    .build();

// Login
AuthServiceSDK.LoginResult result = auth.login("user@example.com", "password123");

// Get profile
AuthServiceSDK.UserProfile profile = auth.getProfile();
```

## Common Features

All SDKs provide the following functionality:

### Authentication
- `register(email, password, name)` - Register new user
- `login(email, password)` - User login
- `logout()` - User logout
- `refreshTokens()` - Refresh access token

### User Management
- `getProfile()` - Get current user profile
- `updateProfile(updates)` - Update user profile
- `changePassword(oldPassword, newPassword)` - Change password

### Password Reset
- `requestPasswordReset(email)` - Request password reset
- `resetPassword(token, newPassword)` - Reset password with token

### Token Management
- `isAuthenticated()` - Check authentication status
- `getTokenInfo()` - Get token payload
- `isTokenExpired()` - Check token expiration

### Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `baseURL` | Auth service base URL | `http://localhost:3001` |
| `tenantId` | Default tenant ID | `null` |
| `apiKey` | API key for server-to-server auth | `null` |
| `timeout` | Request timeout | 30 seconds |

## Error Handling

All SDKs provide consistent error handling:

- **AuthenticationError**: Invalid credentials or expired tokens
- **AuthServiceError**: General API errors
- **NetworkError**: Connection issues

## Security Best Practices

1. **Store API Keys Securely**: Never hardcode API keys in client-side code
2. **Use HTTPS**: Always use HTTPS in production
3. **Token Storage**: 
   - Browser: Use secure localStorage or httpOnly cookies
   - Mobile: Use secure keychain/keystore
   - Server: Use secure environment variables
4. **Token Refresh**: Implement automatic token refresh for better UX
5. **Error Handling**: Handle authentication errors gracefully

## Integration Examples

### React.js Integration
```javascript
import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const authSDK = new AuthServiceSDK({
    baseURL: process.env.REACT_APP_AUTH_SERVICE_URL,
    tenantId: process.env.REACT_APP_TENANT_ID
  });
  
  useEffect(() => {
    if (authSDK.isAuthenticated()) {
      authSDK.getProfile()
        .then(setUser)
        .catch(() => authSDK.logout())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);
  
  const login = async (email, password) => {
    const result = await authSDK.login({ email, password });
    setUser(result.user);
    return result;
  };
  
  const logout = async () => {
    await authSDK.logout();
    setUser(null);
  };
  
  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
```

### Express.js Middleware
```javascript
const express = require('express');
const AuthServiceSDK = require('./auth-sdk');

const auth = new AuthServiceSDK({
  baseURL: process.env.AUTH_SERVICE_URL,
  apiKey: process.env.AUTH_SERVICE_API_KEY,
  tenantId: process.env.TENANT_ID
});

const authenticateUser = async (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
  
  try {
    // Verify token with auth service
    auth.setTokens(token, null);
    const user = await auth.getProfile();
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

app.use('/api/protected', authenticateUser);
```

### Spring Boot Integration
```java
@Component
public class AuthService {
    private final AuthServiceSDK authSDK;
    
    public AuthService(@Value("${auth.service.url}") String baseUrl,
                      @Value("${auth.service.api-key}") String apiKey,
                      @Value("${auth.service.tenant-id}") String tenantId) {
        this.authSDK = new AuthServiceSDK.Builder()
            .baseUrl(baseUrl)
            .apiKey(apiKey)
            .tenantId(tenantId)
            .build();
    }
    
    public AuthServiceSDK.UserProfile validateToken(String token) {
        try {
            authSDK.setTokens(token, null);
            return authSDK.getProfile();
        } catch (AuthServiceSDK.AuthenticationException e) {
            throw new UnauthorizedException("Invalid token");
        }
    }
}
```

## Support

For SDK-specific issues:
1. Check the example code in each SDK file
2. Review the API documentation at `/api/docs`
3. Create an issue in the project repository

## Contributing

To contribute additional SDK examples:
1. Follow the existing SDK patterns
2. Include comprehensive error handling
3. Add usage examples and documentation
4. Ensure security best practices
5. Test with the live Auth Service API