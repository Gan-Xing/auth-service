package com.authservice.sdk;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import okhttp3.*;
import java.io.IOException;
import java.util.Base64;
import java.util.concurrent.TimeUnit;

/**
 * Auth Service Java SDK
 * 
 * A Java client library for the Auth Service API
 * 
 * Usage:
 * AuthServiceSDK auth = new AuthServiceSDK.Builder()
 *     .baseUrl("https://your-auth-service.com")
 *     .tenantId("your-tenant-id")
 *     .build();
 * 
 * LoginResult result = auth.login("user@example.com", "password123");
 * UserProfile profile = auth.getProfile();
 */
public class AuthServiceSDK {
    private final String baseUrl;
    private final String apiKey;
    private final String tenantId;
    private final OkHttpClient httpClient;
    private final Gson gson;
    
    private String accessToken;
    private String refreshToken;
    
    private AuthServiceSDK(Builder builder) {
        this.baseUrl = builder.baseUrl;
        this.apiKey = builder.apiKey;
        this.tenantId = builder.tenantId;
        this.gson = new Gson();
        
        this.httpClient = new OkHttpClient.Builder()
            .connectTimeout(builder.connectTimeoutSeconds, TimeUnit.SECONDS)
            .readTimeout(builder.readTimeoutSeconds, TimeUnit.SECONDS)
            .writeTimeout(builder.writeTimeoutSeconds, TimeUnit.SECONDS)
            .build();
    }
    
    /**
     * Builder pattern for SDK initialization
     */
    public static class Builder {
        private String baseUrl = "http://localhost:3001";
        private String apiKey;
        private String tenantId;
        private long connectTimeoutSeconds = 10;
        private long readTimeoutSeconds = 30;
        private long writeTimeoutSeconds = 30;
        
        public Builder baseUrl(String baseUrl) {
            this.baseUrl = baseUrl;
            return this;
        }
        
        public Builder apiKey(String apiKey) {
            this.apiKey = apiKey;
            return this;
        }
        
        public Builder tenantId(String tenantId) {
            this.tenantId = tenantId;
            return this;
        }
        
        public Builder connectTimeout(long seconds) {
            this.connectTimeoutSeconds = seconds;
            return this;
        }
        
        public Builder readTimeout(long seconds) {
            this.readTimeoutSeconds = seconds;
            return this;
        }
        
        public Builder writeTimeout(long seconds) {
            this.writeTimeoutSeconds = seconds;
            return this;
        }
        
        public AuthServiceSDK build() {
            return new AuthServiceSDK(this);
        }
    }
    
    /**
     * Exception class for Auth Service errors
     */
    public static class AuthServiceException extends Exception {
        public AuthServiceException(String message) {
            super(message);
        }
        
        public AuthServiceException(String message, Throwable cause) {
            super(message, cause);
        }
    }
    
    /**
     * Authentication exception
     */
    public static class AuthenticationException extends AuthServiceException {
        public AuthenticationException(String message) {
            super(message);
        }
    }
    
    /**
     * User registration data
     */
    public static class RegisterRequest {
        public String email;
        public String password;
        public String name;
        public String tenantId;
        
        public RegisterRequest(String email, String password, String name, String tenantId) {
            this.email = email;
            this.password = password;
            this.name = name;
            this.tenantId = tenantId;
        }
    }
    
    /**
     * Login request data
     */
    public static class LoginRequest {
        public String email;
        public String password;
        public String tenantId;
        
        public LoginRequest(String email, String password, String tenantId) {
            this.email = email;
            this.password = password;
            this.tenantId = tenantId;
        }
    }
    
    /**
     * Login result
     */
    public static class LoginResult {
        public String accessToken;
        public String refreshToken;
        public UserProfile user;
    }
    
    /**
     * User profile data
     */
    public static class UserProfile {
        public String id;
        public String email;
        public String name;
        public String tenantId;
        public boolean isActive;
        public boolean emailVerified;
        public String role;
        public String createdAt;
        public String updatedAt;
    }
    
    /**
     * Token refresh request
     */
    public static class RefreshTokenRequest {
        public String refreshToken;
        
        public RefreshTokenRequest(String refreshToken) {
            this.refreshToken = refreshToken;
        }
    }
    
    /**
     * Password change request
     */
    public static class ChangePasswordRequest {
        public String oldPassword;
        public String newPassword;
        
        public ChangePasswordRequest(String oldPassword, String newPassword) {
            this.oldPassword = oldPassword;
            this.newPassword = newPassword;
        }
    }
    
    /**
     * Make HTTP request to the API
     */
    private JsonObject makeRequest(String method, String endpoint, Object requestBody, 
                                 boolean skipAuth, boolean skipRefresh) throws AuthServiceException {
        String url = baseUrl + endpoint;
        
        Request.Builder requestBuilder = new Request.Builder().url(url);
        
        // Add headers
        if (apiKey != null) {
            requestBuilder.addHeader("X-API-Key", apiKey);
        }
        
        if (accessToken != null && !skipAuth) {
            requestBuilder.addHeader("Authorization", "Bearer " + accessToken);
        }
        
        // Add request body if present
        if (requestBody != null) {
            String json = gson.toJson(requestBody);
            RequestBody body = RequestBody.create(json, MediaType.get("application/json"));
            
            if ("POST".equals(method)) {
                requestBuilder.post(body);
            } else if ("PATCH".equals(method)) {
                requestBuilder.patch(body);
            } else if ("PUT".equals(method)) {
                requestBuilder.put(body);
            }
        }
        
        Request request = requestBuilder.build();
        
        try {
            Response response = httpClient.newCall(request).execute();
            
            if (response.code() == 401 && !skipRefresh && refreshToken != null) {
                // Try to refresh token
                try {
                    refreshTokens();
                    // Retry original request
                    return makeRequest(method, endpoint, requestBody, skipAuth, true);
                } catch (AuthServiceException e) {
                    clearTokens();
                    throw new AuthenticationException("Authentication failed and token refresh failed");
                }
            }
            
            String responseBody = response.body().string();
            
            if (!response.isSuccessful()) {
                String message = "HTTP " + response.code();
                try {
                    JsonObject errorJson = JsonParser.parseString(responseBody).getAsJsonObject();
                    if (errorJson.has("message")) {
                        message = errorJson.get("message").getAsString();
                    }
                } catch (Exception e) {
                    // Use default message
                }
                
                if (response.code() == 401) {
                    throw new AuthenticationException(message);
                } else {
                    throw new AuthServiceException(message);
                }
            }
            
            return JsonParser.parseString(responseBody).getAsJsonObject();
            
        } catch (IOException e) {
            throw new AuthServiceException("Request failed", e);
        }
    }
    
    /**
     * Store authentication tokens
     */
    public void setTokens(String accessToken, String refreshToken) {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
    }
    
    /**
     * Clear stored tokens
     */
    public void clearTokens() {
        this.accessToken = null;
        this.refreshToken = null;
    }
    
    /**
     * Register a new user
     */
    public UserProfile register(String email, String password, String name) throws AuthServiceException {
        return register(email, password, name, this.tenantId);
    }
    
    public UserProfile register(String email, String password, String name, String tenantId) throws AuthServiceException {
        if (tenantId == null) {
            throw new IllegalArgumentException("tenantId is required");
        }
        
        RegisterRequest request = new RegisterRequest(email, password, name, tenantId);
        JsonObject response = makeRequest("POST", "/auth/register", request, true, false);
        
        return gson.fromJson(response.get("user"), UserProfile.class);
    }
    
    /**
     * Login user
     */
    public LoginResult login(String email, String password) throws AuthServiceException {
        return login(email, password, this.tenantId);
    }
    
    public LoginResult login(String email, String password, String tenantId) throws AuthServiceException {
        if (tenantId == null) {
            throw new IllegalArgumentException("tenantId is required");
        }
        
        LoginRequest request = new LoginRequest(email, password, tenantId);
        JsonObject response = makeRequest("POST", "/auth/login", request, true, false);
        
        LoginResult result = gson.fromJson(response, LoginResult.class);
        
        // Store tokens
        if (result.accessToken != null && result.refreshToken != null) {
            setTokens(result.accessToken, result.refreshToken);
        }
        
        return result;
    }
    
    /**
     * Logout user
     */
    public void logout() throws AuthServiceException {
        if (refreshToken != null) {
            try {
                RefreshTokenRequest request = new RefreshTokenRequest(refreshToken);
                makeRequest("POST", "/auth/logout", request, false, false);
            } catch (AuthServiceException e) {
                // Ignore logout errors
            }
        }
        
        clearTokens();
    }
    
    /**
     * Get user profile
     */
    public UserProfile getProfile() throws AuthServiceException {
        JsonObject response = makeRequest("GET", "/auth/profile", null, false, false);
        return gson.fromJson(response, UserProfile.class);
    }
    
    /**
     * Change password
     */
    public void changePassword(String oldPassword, String newPassword) throws AuthServiceException {
        ChangePasswordRequest request = new ChangePasswordRequest(oldPassword, newPassword);
        makeRequest("PATCH", "/auth/change-password", request, false, false);
    }
    
    /**
     * Refresh access token
     */
    public void refreshTokens() throws AuthServiceException {
        if (refreshToken == null) {
            throw new AuthServiceException("No refresh token available");
        }
        
        RefreshTokenRequest request = new RefreshTokenRequest(refreshToken);
        JsonObject response = makeRequest("POST", "/auth/refresh", request, true, true);
        
        String newAccessToken = response.get("accessToken").getAsString();
        String newRefreshToken = response.get("refreshToken").getAsString();
        
        setTokens(newAccessToken, newRefreshToken);
    }
    
    /**
     * Check if user is authenticated
     */
    public boolean isAuthenticated() {
        return accessToken != null;
    }
    
    /**
     * Get token information
     */
    public JsonObject getTokenInfo() {
        if (accessToken == null) {
            return null;
        }
        
        try {
            String[] parts = accessToken.split("\\.");
            if (parts.length != 3) {
                return null;
            }
            
            String payload = new String(Base64.getUrlDecoder().decode(parts[1]));
            return JsonParser.parseString(payload).getAsJsonObject();
        } catch (Exception e) {
            return null;
        }
    }
    
    /**
     * Check if token is expired
     */
    public boolean isTokenExpired() {
        JsonObject tokenInfo = getTokenInfo();
        if (tokenInfo == null || !tokenInfo.has("exp")) {
            return true;
        }
        
        long exp = tokenInfo.get("exp").getAsLong();
        return System.currentTimeMillis() / 1000 >= exp;
    }
}

/* Usage Example:

public class AuthExample {
    public static void main(String[] args) {
        AuthServiceSDK auth = new AuthServiceSDK.Builder()
            .baseUrl("http://localhost:3001")
            .tenantId("test-tenant")
            .connectTimeout(10)
            .readTimeout(30)
            .build();
        
        try {
            // Register
            AuthServiceSDK.UserProfile user = auth.register(
                "test@example.com",
                "Password123!",
                "Test User"
            );
            System.out.println("Registered user: " + user.email);
            
            // Login
            AuthServiceSDK.LoginResult result = auth.login(
                "test@example.com",
                "Password123!"
            );
            System.out.println("Logged in as: " + result.user.email);
            
            // Get profile
            AuthServiceSDK.UserProfile profile = auth.getProfile();
            System.out.println("Profile: " + profile.name);
            
            // Logout
            auth.logout();
            System.out.println("Logged out");
            
        } catch (AuthServiceSDK.AuthServiceException e) {
            System.err.println("Auth error: " + e.getMessage());
        }
    }
}

*/