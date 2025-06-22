"""
Auth Service Python SDK

A Python client library for the Auth Service API
"""

import json
import time
import base64
import requests
from typing import Dict, Any, Optional
from urllib.parse import urljoin


class AuthServiceError(Exception):
    """Base exception for Auth Service SDK"""
    pass


class AuthenticationError(AuthServiceError):
    """Raised when authentication fails"""
    pass


class AuthServiceSDK:
    """
    Python SDK for Auth Service API
    
    Usage:
        # Initialize
        auth = AuthServiceSDK(
            base_url='https://your-auth-service.com',
            tenant_id='your-tenant-id'
        )
        
        # Login
        result = auth.login('user@example.com', 'password123')
        
        # Get profile
        profile = auth.get_profile()
    """
    
    def __init__(self, base_url: str = 'http://localhost:3001', 
                 api_key: Optional[str] = None,
                 tenant_id: Optional[str] = None,
                 timeout: int = 30):
        """
        Initialize the Auth Service SDK
        
        Args:
            base_url: Base URL of the auth service
            api_key: API key for server-to-server authentication
            tenant_id: Default tenant ID
            timeout: Request timeout in seconds
        """
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.tenant_id = tenant_id
        self.timeout = timeout
        
        self.access_token: Optional[str] = None
        self.refresh_token: Optional[str] = None
        
        # Create session for connection pooling
        self.session = requests.Session()
    
    def _make_request(self, method: str, endpoint: str, 
                     data: Optional[Dict] = None,
                     skip_auth: bool = False,
                     skip_refresh: bool = False) -> Dict[str, Any]:
        """Make HTTP request to the API"""
        url = urljoin(self.base_url, endpoint)
        
        headers = {
            'Content-Type': 'application/json',
        }
        
        # Add API key if available
        if self.api_key:
            headers['X-API-Key'] = self.api_key
        
        # Add access token if available and not skipped
        if self.access_token and not skip_auth:
            headers['Authorization'] = f'Bearer {self.access_token}'
        
        try:
            response = self.session.request(
                method=method,
                url=url,
                headers=headers,
                json=data,
                timeout=self.timeout
            )
            
            if response.status_code == 401 and not skip_refresh and self.refresh_token:
                # Try to refresh token
                try:
                    self.refresh_tokens()
                    # Retry the original request
                    return self._make_request(method, endpoint, data, skip_auth, skip_refresh=True)
                except AuthServiceError:
                    self.clear_tokens()
                    raise AuthenticationError('Authentication failed and token refresh failed')
            
            if not response.ok:
                try:
                    error_data = response.json()
                    message = error_data.get('message', f'HTTP {response.status_code}')
                except (ValueError, KeyError):
                    message = f'HTTP {response.status_code}'
                
                if response.status_code == 401:
                    raise AuthenticationError(message)
                else:
                    raise AuthServiceError(message)
            
            return response.json()
            
        except requests.exceptions.RequestException as e:
            raise AuthServiceError(f'Request failed: {str(e)}')
    
    def set_tokens(self, access_token: str, refresh_token: str):
        """Store authentication tokens"""
        self.access_token = access_token
        self.refresh_token = refresh_token
    
    def clear_tokens(self):
        """Clear stored tokens"""
        self.access_token = None
        self.refresh_token = None
    
    def register(self, email: str, password: str, name: str, 
                tenant_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Register a new user
        
        Args:
            email: User email
            password: User password
            name: User full name
            tenant_id: Tenant ID (uses default if not provided)
            
        Returns:
            Dictionary containing user data
        """
        data = {
            'email': email,
            'password': password,
            'name': name,
            'tenantId': tenant_id or self.tenant_id
        }
        
        if not data['tenantId']:
            raise ValueError('tenant_id is required')
        
        return self._make_request('POST', '/auth/register', data, skip_auth=True)
    
    def login(self, email: str, password: str, 
              tenant_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Login user
        
        Args:
            email: User email
            password: User password
            tenant_id: Tenant ID (uses default if not provided)
            
        Returns:
            Dictionary containing tokens and user data
        """
        data = {
            'email': email,
            'password': password,
            'tenantId': tenant_id or self.tenant_id
        }
        
        if not data['tenantId']:
            raise ValueError('tenant_id is required')
        
        result = self._make_request('POST', '/auth/login', data, skip_auth=True)
        
        # Store tokens
        if 'accessToken' in result and 'refreshToken' in result:
            self.set_tokens(result['accessToken'], result['refreshToken'])
        
        return result
    
    def logout(self):
        """Logout user"""
        if self.refresh_token:
            try:
                self._make_request('POST', '/auth/logout', {
                    'refreshToken': self.refresh_token
                })
            except AuthServiceError:
                pass  # Ignore logout errors
        
        self.clear_tokens()
    
    def get_profile(self) -> Dict[str, Any]:
        """Get current user profile"""
        return self._make_request('GET', '/auth/profile')
    
    def update_profile(self, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update user profile"""
        return self._make_request('PATCH', '/auth/profile', updates)
    
    def change_password(self, old_password: str, new_password: str) -> Dict[str, Any]:
        """Change user password"""
        data = {
            'oldPassword': old_password,
            'newPassword': new_password
        }
        return self._make_request('PATCH', '/auth/change-password', data)
    
    def refresh_tokens(self) -> Dict[str, Any]:
        """Refresh access token"""
        if not self.refresh_token:
            raise AuthServiceError('No refresh token available')
        
        data = {'refreshToken': self.refresh_token}
        result = self._make_request('POST', '/auth/refresh', data, 
                                  skip_auth=True, skip_refresh=True)
        
        self.set_tokens(result['accessToken'], result['refreshToken'])
        return result
    
    def request_password_reset(self, email: str, 
                             tenant_id: Optional[str] = None) -> Dict[str, Any]:
        """Request password reset"""
        data = {
            'email': email,
            'tenantId': tenant_id or self.tenant_id
        }
        
        if not data['tenantId']:
            raise ValueError('tenant_id is required')
        
        return self._make_request('POST', '/auth/reset-password/request', 
                                data, skip_auth=True)
    
    def reset_password(self, token: str, new_password: str) -> Dict[str, Any]:
        """Reset password with token"""
        data = {
            'token': token,
            'newPassword': new_password
        }
        return self._make_request('POST', '/auth/reset-password/confirm', 
                                data, skip_auth=True)
    
    def is_authenticated(self) -> bool:
        """Check if user is authenticated"""
        return self.access_token is not None
    
    def get_token_info(self) -> Optional[Dict[str, Any]]:
        """Get user info from access token"""
        if not self.access_token:
            return None
        
        try:
            # Decode JWT payload (without signature verification)
            payload_part = self.access_token.split('.')[1]
            # Add padding if needed
            payload_part += '=' * (4 - len(payload_part) % 4)
            payload = json.loads(base64.urlsafe_b64decode(payload_part))
            
            return {
                'user_id': payload.get('sub'),
                'email': payload.get('email'),
                'tenant_id': payload.get('tenantId'),
                'exp': payload.get('exp'),
                'iat': payload.get('iat'),
            }
        except (ValueError, KeyError, IndexError):
            return None
    
    def is_token_expired(self) -> bool:
        """Check if access token is expired"""
        token_info = self.get_token_info()
        if not token_info or 'exp' not in token_info:
            return True
        
        return time.time() >= token_info['exp']
    
    def __enter__(self):
        """Context manager entry"""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit - close session"""
        self.session.close()


# Usage examples
if __name__ == '__main__':
    # Example usage
    auth = AuthServiceSDK(
        base_url='http://localhost:3001',
        tenant_id='test-tenant'
    )
    
    try:
        # Register
        user = auth.register(
            email='test@example.com',
            password='Password123!',
            name='Test User'
        )
        print(f"Registered user: {user['user']['email']}")
        
        # Login
        result = auth.login('test@example.com', 'Password123!')
        print(f"Logged in as: {result['user']['email']}")
        
        # Get profile
        profile = auth.get_profile()
        print(f"Profile: {profile}")
        
        # Update profile
        updated = auth.update_profile({'name': 'Updated Name'})
        print(f"Updated profile: {updated}")
        
    except AuthServiceError as e:
        print(f"Auth error: {e}")
    except Exception as e:
        print(f"Unexpected error: {e}")
    finally:
        auth.logout()
        print("Logged out")