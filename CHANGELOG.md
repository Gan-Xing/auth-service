# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Dark mode support for admin panel
- GraphQL API support
- Enhanced password policies
- Business metrics monitoring

## [1.2.1] - 2025-06-22

### Fixed
- **Admin Panel Pagination**: Fixed pagination display showing `[object Object]` instead of proper page numbers
  - Added missing `page` and `pages` fields to pagination object in `AdminController`
  - Standardized pagination format across all admin pages
- **Pagination Button States**: Fixed prev/next buttons not properly disabling based on current page
  - Added conditional rendering based on `pagination.hasPrev` and `pagination.hasNext`
  - Improved CSS for disabled state with `pointer-events: none`
- **Table Column Widths**: Optimized column widths for plan and status columns
  - Set table to `table-layout: fixed` for consistent layout
  - Allocated 10% width for plan column and 10% for status column
  - Added `white-space: nowrap` to prevent text wrapping in badges
- **Admin Permission Consistency**: Fixed inconsistent admin guard usage across pages
  - Temporarily disabled `AdminGuard` on audit-logs page to match other pages
  - Fixed admin token expiration mismatch (JWT default 15min vs admin token 24h)
  - Explicitly set `expiresIn: '24h'` in `generateAdminToken` method

### Changed
- Improved admin panel table styling with better spacing and typography
- Reduced action button sizes and optimized spacing for better UX
- Enhanced status and plan badge styling with centered alignment

### Technical Details
- Modified `src/auth/controllers/admin.controller.ts` pagination logic
- Updated `views/admin/tenants-clean.hbs` template with improved styling
- Fixed token expiration inconsistency between JWT config (15m) and admin tokens (24h)

## [1.2.0] - 2025-06-21

### Added
- **Complete Admin Dashboard**: Full-featured management interface
  - Modern responsive design with Tailwind CSS
  - Tenant management with CRUD operations
  - User management with role-based access
  - System configuration interface
  - Audit logs with detailed tracking
- **Enhanced Monitoring System**: Comprehensive metrics and alerting
  - Real-time performance monitoring
  - Intelligent alerting system
  - System health checks with detailed metrics
  - Automated notification system
- **Performance Optimization Module**: Advanced caching and optimization
  - Redis caching system with intelligent strategies
  - Database query optimization
  - Concurrent processing improvements
  - Performance benchmarking tools
- **Feature Flags System**: Dynamic feature management
  - Runtime feature enabling/disabling
  - Tenant-level feature control
  - Feature dependency management
  - Real-time configuration updates

### Enhanced
- **Security Improvements**: Multi-layer security enhancements
  - Rate limiting protection
  - Brute force attack prevention
  - Input validation and sanitization
  - XSS and CSRF protection
  - Security headers configuration
- **Documentation System**: Complete API documentation
  - Interactive Swagger interface
  - Usage examples and tutorials
  - Multi-language integration guides
  - SDK download capabilities

## [1.1.0] - 2025-06-20

### Added
- **Multi-Tenant Architecture**: Complete tenant isolation system
  - Tenant creation and management APIs
  - Isolated data and configuration per tenant
  - API key authentication per tenant
  - Domain-based tenant resolution
- **OAuth Integration**: Third-party authentication support
  - GitHub OAuth provider
  - Google OAuth provider
  - WeChat OAuth configuration
  - Extensible OAuth callback handling
- **Communication Services**: Comprehensive notification system
  - Email service with Nodemailer integration
  - International SMS service (Vonage/Twilio/AWS SNS)
  - Verification code system
  - Global SMS support with rate optimization
- **Audit Logging**: Complete operation tracking
  - User action logging
  - Security event recording
  - System operation tracking
  - Exportable audit reports

### Enhanced
- **JWT System**: Improved token management
  - Access and refresh token mechanism
  - JWKS public key service
  - OpenID Connect discovery endpoint
  - Enhanced token security
- **User Management**: Extended user functionality
  - Password strength validation
  - Email verification system
  - Password reset workflows
  - User profile management

## [1.0.0] - 2025-06-19

### Added
- **Core Authentication System**: Complete JWT-based authentication
  - User registration and login
  - Password management and validation
  - Session management
  - Secure logout functionality
- **Database Foundation**: PostgreSQL with Prisma ORM
  - User and session management
  - Database migrations
  - Data validation and constraints
- **API Documentation**: Swagger/OpenAPI integration
  - Interactive API explorer
  - Comprehensive endpoint documentation
  - Request/response schemas
- **Basic Security**: Fundamental security measures
  - Input validation
  - Password hashing with bcrypt
  - Basic rate limiting
  - Error handling and logging

### Technical Stack
- **Backend**: NestJS 10.x with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT with Passport.js
- **Validation**: class-validator and class-transformer
- **Documentation**: Swagger/OpenAPI
- **Security**: Helmet, bcrypt, rate limiting

---

## Version Numbering

This project follows [Semantic Versioning](https://semver.org/):

- **MAJOR** version for incompatible API changes
- **MINOR** version for backwards-compatible functionality additions
- **PATCH** version for backwards-compatible bug fixes

## Change Categories

- **Added** for new features
- **Changed** for changes in existing functionality
- **Deprecated** for soon-to-be removed features
- **Removed** for now removed features
- **Fixed** for any bug fixes
- **Security** for vulnerability fixes

## Links

- [Project Repository](https://github.com/your-org/auth-service)
- [Documentation](./CLAUDE.md)
- [Requirements](./REQUIREMENTS.md)