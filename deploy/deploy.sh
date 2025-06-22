#!/bin/bash

# Production Deployment Script for Auth Service
# Usage: ./deploy.sh [environment] [action]
# Example: ./deploy.sh production deploy

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENVIRONMENT="${1:-production}"
ACTION="${2:-deploy}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    
    # Check if Docker Compose is available
    if ! command -v docker-compose >/dev/null 2>&1; then
        log_error "Docker Compose is not installed. Please install it and try again."
        exit 1
    fi
    
    # Check if environment file exists
    if [[ ! -f "$PROJECT_ROOT/.env.$ENVIRONMENT" ]]; then
        log_error "Environment file .env.$ENVIRONMENT not found."
        log_info "Please copy .env.production.example to .env.$ENVIRONMENT and configure it."
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Backup database
backup_database() {
    log_info "Creating database backup..."
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_dir="$PROJECT_ROOT/backups"
    local backup_file="$backup_dir/auth_service_backup_$timestamp.sql"
    
    mkdir -p "$backup_dir"
    
    # Create backup using docker-compose
    if docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" exec -T postgres pg_dump -U auth_user auth_service > "$backup_file" 2>/dev/null; then
        log_success "Database backup created: $backup_file"
    else
        log_warning "Database backup failed or no existing database found"
    fi
}

# Build and deploy
deploy() {
    log_info "Starting deployment to $ENVIRONMENT environment..."
    
    cd "$PROJECT_ROOT"
    
    # Load environment variables
    export $(grep -v '^#' ".env.$ENVIRONMENT" | xargs)
    
    # Build and start services
    log_info "Building and starting services..."
    docker-compose -f docker-compose.prod.yml --env-file ".env.$ENVIRONMENT" up -d --build
    
    # Wait for services to be healthy
    log_info "Waiting for services to be healthy..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if docker-compose -f docker-compose.prod.yml ps | grep -q "healthy"; then
            log_success "Services are healthy"
            break
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            log_error "Services failed to become healthy within timeout"
            exit 1
        fi
        
        log_info "Attempt $attempt/$max_attempts - waiting for services..."
        sleep 10
        ((attempt++))
    done
    
    # Run database migrations
    log_info "Running database migrations..."
    docker-compose -f docker-compose.prod.yml exec -T auth-service npx prisma migrate deploy
    
    # Verify deployment
    verify_deployment
    
    log_success "Deployment completed successfully!"
}

# Verify deployment
verify_deployment() {
    log_info "Verifying deployment..."
    
    # Check service health
    local health_url="http://localhost:3001/monitoring/health"
    
    if curl -f -s "$health_url" >/dev/null; then
        log_success "Health check passed"
    else
        log_error "Health check failed"
        exit 1
    fi
    
    # Check database connection
    if docker-compose -f docker-compose.prod.yml exec -T auth-service node -e "
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        prisma.user.count().then(() => {
            console.log('Database connection successful');
            process.exit(0);
        }).catch((e) => {
            console.error('Database connection failed:', e.message);
            process.exit(1);
        });
    "; then
        log_success "Database connection verified"
    else
        log_error "Database connection failed"
        exit 1
    fi
    
    # Check Redis connection
    if docker-compose -f docker-compose.prod.yml exec -T redis redis-cli ping | grep -q PONG; then
        log_success "Redis connection verified"
    else
        log_error "Redis connection failed"
        exit 1
    fi
}

# Stop services
stop() {
    log_info "Stopping services..."
    cd "$PROJECT_ROOT"
    docker-compose -f docker-compose.prod.yml down
    log_success "Services stopped"
}

# Restart services
restart() {
    log_info "Restarting services..."
    cd "$PROJECT_ROOT"
    docker-compose -f docker-compose.prod.yml restart
    verify_deployment
    log_success "Services restarted"
}

# Show logs
logs() {
    log_info "Showing logs..."
    cd "$PROJECT_ROOT"
    docker-compose -f docker-compose.prod.yml logs -f
}

# Show status
status() {
    log_info "Service status:"
    cd "$PROJECT_ROOT"
    docker-compose -f docker-compose.prod.yml ps
    
    echo ""
    log_info "Service health:"
    curl -s http://localhost:3001/monitoring/health | jq '.' || echo "Health endpoint not available"
}

# Cleanup old images and volumes
cleanup() {
    log_info "Cleaning up old Docker images and volumes..."
    
    # Remove old images
    docker image prune -f
    
    # Remove unused volumes (be careful with this in production)
    read -p "Do you want to remove unused volumes? This will delete data not used by current containers. (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker volume prune -f
        log_success "Volumes cleaned up"
    else
        log_info "Volume cleanup skipped"
    fi
    
    log_success "Cleanup completed"
}

# Update application
update() {
    log_info "Updating application..."
    
    # Backup before update
    backup_database
    
    # Pull latest changes (if using git)
    if [ -d "$PROJECT_ROOT/.git" ]; then
        log_info "Pulling latest changes..."
        cd "$PROJECT_ROOT"
        git pull origin main
    fi
    
    # Deploy with new code
    deploy
    
    log_success "Update completed"
}

# Scale services
scale() {
    local service="${3:-auth-service}"
    local replicas="${4:-2}"
    
    log_info "Scaling $service to $replicas replicas..."
    cd "$PROJECT_ROOT"
    docker-compose -f docker-compose.prod.yml up -d --scale "$service=$replicas"
    log_success "Service scaled to $replicas replicas"
}

# Main script logic
main() {
    case "$ACTION" in
        "deploy")
            check_prerequisites
            backup_database
            deploy
            ;;
        "stop")
            stop
            ;;
        "restart")
            restart
            ;;
        "logs")
            logs
            ;;
        "status")
            status
            ;;
        "cleanup")
            cleanup
            ;;
        "update")
            check_prerequisites
            update
            ;;
        "scale")
            scale "$@"
            ;;
        "backup")
            backup_database
            ;;
        *)
            echo "Usage: $0 [environment] [action]"
            echo ""
            echo "Environments: production, staging"
            echo ""
            echo "Actions:"
            echo "  deploy   - Deploy the application"
            echo "  stop     - Stop all services"
            echo "  restart  - Restart all services"
            echo "  logs     - Show service logs"
            echo "  status   - Show service status"
            echo "  cleanup  - Clean up old Docker resources"
            echo "  update   - Update and redeploy application"
            echo "  scale    - Scale services (usage: scale [service] [replicas])"
            echo "  backup   - Create database backup"
            echo ""
            echo "Examples:"
            echo "  $0 production deploy"
            echo "  $0 production status"
            echo "  $0 production scale auth-service 3"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"