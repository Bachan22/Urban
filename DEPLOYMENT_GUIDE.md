# UrbanIQ - Production Deployment & Performance Guide

## 🚀 Deployment Checklist

### Backend Deployment (FastAPI + PostgreSQL)

#### 1. Environment Configuration
```bash
# Create production .env
SECRET_KEY=$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')
REDIS_URL=redis://redis-server:6379
DATABASE_URL=postgresql://username:password@db-host:5432/urbaniq_db

# Store in secure location (AWS Secrets Manager, HashiCorp Vault, etc.)
```

#### 2. Database Setup
```bash
# Connect to production database
psql -h db-host -U username -d urbaniq_db

# Run migrations
alembic upgrade head

# Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_iot_devices_owner_id ON iot_devices(owner_id);
CREATE INDEX idx_iot_data_device_id ON iot_data_points(device_id);
CREATE INDEX idx_iot_data_timestamp ON iot_data_points(timestamp);
```

#### 3. Application Server (Gunicorn)
```bash
# Install production server
pip install gunicorn

# Run with multiple workers
gunicorn backend.app.main:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --access-logfile - \
  --error-logfile - \
  --log-level info
```

#### 4. Reverse Proxy (Nginx)
```nginx
upstream fastapi_app {
    server localhost:8000;
    server localhost:8001;
    server localhost:8002;
    server localhost:8003;
}

server {
    listen 80;
    server_name api.urbaniq.com;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.urbaniq.com;

    # SSL Certificates
    ssl_certificate /etc/ssl/certs/api.urbaniq.com.crt;
    ssl_certificate_key /etc/ssl/private/api.urbaniq.com.key;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;

    # Gzip Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
    gzip_min_length 1000;

    # Proxy Settings
    location / {
        proxy_pass http://fastapi_app;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket Support
    location /ws {
        proxy_pass http://fastapi_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

### Frontend Deployment (React + Vite)

#### 1. Build Optimization
```bash
cd frontend
npm run build

# Output in ./dist
# File sizes:
# - index.html: < 10KB
# - JavaScript: < 200KB (gzipped)
# - CSS: < 50KB (gzipped)
```

#### 2. CDN & Static Hosting
```bash
# Upload dist/ to S3
aws s3 sync dist/ s3://urbaniq-frontend/ --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id E123EXAMPLE \
  --paths "/*"
```

#### 3. Vercel/Netlify Deployment (Alternative)
```bash
# Using Vercel CLI
npm install -g vercel
vercel --prod

# Using Netlify CLI
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

#### 4. Web Server Config (Nginx for SPA)
```nginx
server {
    listen 443 ssl http2;
    server_name urbaniq.com;

    root /var/www/urbaniq/dist;
    index index.html;

    # SPA Routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Static Assets Caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security Headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Gzip Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;
}
```

## ⚡ Performance Optimization

### Backend Optimizations

#### 1. Database Query Optimization
```python
# Before: N+1 query problem
devices = db.query(IoTDeviceModel).all()
for device in devices:
    print(device.owner.email)  # Extra query per device!

# After: Use joinedload
from sqlalchemy.orm import joinedload
devices = db.query(IoTDeviceModel).options(joinedload(IoTDeviceModel.owner)).all()
```

#### 2. Pagination for Large Datasets
```python
@router.get("/devices")
async def list_devices(skip: int = 0, limit: int = 50):
    devices = db.query(IoTDeviceModel).offset(skip).limit(limit).all()
    return devices
```

#### 3. Redis Caching
```python
import redis
from functools import wraps

cache = redis.Redis(host='localhost', port=6379, db=0)

def cached(expire_time=300):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            key = f"{func.__name__}:{args}:{kwargs}"
            result = cache.get(key)
            if result:
                return json.loads(result)
            
            result = await func(*args, **kwargs)
            cache.setex(key, expire_time, json.dumps(result))
            return result
        return wrapper
    return decorator

@cached(expire_time=600)
async def get_device_stats(device_id: str):
    # Expensive query
    return db.query(...).all()
```

#### 4. Connection Pooling
```python
# Already configured in connection.py
from sqlalchemy import create_engine

engine = create_engine(
    DATABASE_URL,
    pool_size=20,           # Max connections to keep in pool
    max_overflow=10,        # Additional connections above pool_size
    pool_pre_ping=True,     # Verify connection before use
    pool_recycle=3600,      # Recycle connections after 1 hour
)
```

### Frontend Optimizations

#### 1. Code Splitting
```tsx
import { lazy, Suspense } from 'react';
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));

<Suspense fallback={<Loading />}>
  <AdminDashboard />
</Suspense>
```

#### 2. Memoization
```tsx
import { memo } from 'react';

const DeviceCard = memo(({ device }) => {
  return <div>{device.name}</div>;
}, (prev, next) => prev.device.id === next.device.id);
```

#### 3. Image Optimization
```bash
# Use modern formats and compress
npx imagemin src/assets/*.png --out-dir=src/assets/optimized --plugin=pngquant
```

#### 4. Bundle Analysis
```bash
npm install -D rollup-plugin-visualizer
# Check bundle size: npm run build, then check dist/stats.html
```

## 🔒 Security Hardening

### API Security
```python
from fastapi.middleware import trustedhost
from slowapi import Limiter
from slowapi.util import get_remote_address

# Trust proxy headers
app.add_middleware(trustedhost.TrustedHostMiddleware, allowed_hosts=["urbaniq.com"])

# Rate limiting
limiter = Limiter(key_func=get_remote_address)

@limiter.limit("5/minute")
async def login(credentials):
    ...
```

### Database Security
```bash
# Use strong passwords
# Grant minimal privileges
GRANT CONNECT ON DATABASE urbaniq_db TO api_user;
GRANT USAGE ON SCHEMA public TO api_user;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO api_user;

# Use SSL for connections
postgresql://user:pass@host:5432/db?sslmode=require
```

### Monitoring & Logging
```python
import logging
from pythonjsonlogger import jsonlogger

logger = logging.getLogger(__name__)
handler = logging.StreamHandler()
formatter = jsonlogger.JsonFormatter()
handler.setFormatter(formatter)
logger.addHandler(handler)
```

## 📊 Monitoring & Observability

### Metrics to Track
- API response times
- Database query performance
- Cache hit rates
- Error rates
- User growth
- Device status distribution

### Tools
- **Prometheus** - Metrics collection
- **Grafana** - Dashboards
- **ELK Stack** - Logging
- **Sentry** - Error tracking
- **New Relic** - APM

## 🚨 Incident Response

### Database Down
1. Switch to read replica
2. Alert team
3. Restore from backup
4. Reindex tables

### High Latency
1. Check CPU/Memory usage
2. Analyze slow queries
3. Increase connection pool
4. Scale horizontally

### Security Breach
1. Rotate all keys
2. Force password resets
3. Audit access logs
4. Deploy hotfix

## ✅ Pre-Launch Checklist

- [ ] SSL certificates configured
- [ ] Database backups automated (daily)
- [ ] Monitoring and alerts set up
- [ ] Rate limiting implemented
- [ ] API documentation updated
- [ ] Security audit completed
- [ ] Performance tests passed (< 200ms response time)
- [ ] Load testing passed (1000+ concurrent users)
- [ ] Disaster recovery plan documented
- [ ] Team trained on deployment

## 📈 Scaling Strategy

### Phase 1: Single Server (< 10K users)
- All services on one instance
- PostgreSQL with basic backups

### Phase 2: Separated Services (10K - 100K users)
- API servers behind load balancer
- Dedicated database server
- Redis for caching

### Phase 3: Microservices (> 100K users)
- IoT service separate
- Analytics service separate
- Notification service separate
- Message queue (RabbitMQ/Kafka)

---

**For production deployment, consult with DevOps/Infrastructure team**
