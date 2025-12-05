# ADR-003: OAuth2 Authentication Flow

## Status
Accepted

## Context
We need a secure authentication mechanism that supports both web and mobile clients.

## Decision
Implement OAuth2 with JWT tokens using the authorization code flow.

```mermaid
sequenceDiagram
    participant User
    participant Client
    participant AuthServer
    participant ResourceServer
    
    User->>Client: 1. Click Login
    Client->>AuthServer: 2. Request Authorization
    AuthServer->>User: 3. Show Login Page
    User->>AuthServer: 4. Enter Credentials
    AuthServer->>Client: 5. Authorization Code
    Client->>AuthServer: 6. Exchange Code for Token
    AuthServer->>Client: 7. Access Token + Refresh Token
    Client->>ResourceServer: 8. Request with Access Token
    ResourceServer->>Client: 9. Protected Resource
```

## Consequences

### Positive
- Industry standard approach
- Supports multiple client types
- Secure token-based authentication
- Refresh token support for long sessions

### Negative
- More complex than basic auth
- Requires token storage management
- Need to handle token refresh logic

## Security Considerations
- Tokens stored in httpOnly cookies
- Refresh tokens rotated on use
- Short-lived access tokens (15 minutes)
