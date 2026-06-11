# Security Hardening Documentation

## Overview

This document outlines the security measures implemented in the WhatsApp Toolkit to protect against common vulnerabilities and attacks.

---

## 🔒 Security Features Implemented

### 1. Environment Variable Management

**What:** All sensitive credentials moved from hardcoded values to environment variables.

**Protected Credentials:**
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key (public but protected by RLS)
- `GROQ_API_KEY` - Groq AI API key
- `SESSION_SECRET` - Session encryption secret

**Configuration:** `.env` file (excluded from git via `.gitignore`)

**Access:** Credentials loaded via `dotenv` package and served securely through `/api/config` endpoint.

---

### 2. HTTP Security Headers

**Implemented via Helmet.js and custom middleware:**

| Header | Purpose | Value |
|--------|---------|-------|
| `X-Content-Type-Options` | Prevent MIME sniffing | `nosniff` |
| `X-Frame-Options` | Prevent clickjacking | `DENY` |
| `X-XSS-Protection` | Enable browser XSS filter | `1; mode=block` |
| `Strict-Transport-Security` | Force HTTPS (production only) | `max-age=31536000; includeSubDomains` |

**Additional Helmet protections:**
- DNS prefetch control
- Hide X-Powered-By header
- IE No Open
- Referrer Policy

---

### 3. Rate Limiting

**Purpose:** Prevent brute force attacks, DoS, and API abuse.

#### General API Rate Limit
- **Scope:** All `/api/*` endpoints
- **Limit:** 100 requests per minute per IP
- **Configuration:** `RATE_LIMIT_MAX_REQUESTS` in `.env`

#### Authentication Rate Limit
- **Scope:** `/api/auth/*` endpoints
- **Limit:** 5 requests per minute per IP
- **Configuration:** `RATE_LIMIT_AUTH_MAX` in `.env`

**Implementation:**
```javascript
const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
    windowMs: 60000,
    max: 100,
    message: 'Too many requests from this IP, please try again later.'
});

app.use('/api/', apiLimiter);
```

---

### 4. Input Validation & Sanitization

**Package:** `express-validator`

#### Validation Rules Applied

**Phone Numbers:**
- Pattern: `/^[\d+\s-]+$/` (digits, +, spaces, dashes only)
- Function: `sanitizePhone()` - removes all non-numeric characters except +

**Strings:**
- Function: `sanitizeString()` - removes `<`, `>`, `javascript:`, event handlers
- Max length enforcement per endpoint
- XSS vector removal

**Numbers:**
- Function: `sanitizeNumber()` - converts to float, returns 0 if invalid
- Range validation (e.g., price must be positive)

#### Protected Endpoints

| Endpoint | Validations |
|----------|-------------|
| `PUT /api/deals/tracked/:id` | userId required, status enum, phone format |
| `POST /api/business-config` | userId required, text length limits |
| `POST /api/products` | userId required, name 1-200 chars, price positive |
| `PUT /api/products/:id` | userId required, name 1-200 chars, price positive |
| `POST /api/bulk/blacklist` | userId required, phone format, reason length |
| `POST /api/whatsapp/send-message` | userId required, phone format, message 4096 max |

**Example Implementation:**
```javascript
app.post('/api/products',
    [
        body('userId').notEmpty().withMessage('userId is required'),
        body('item_name').notEmpty().trim().isLength({ min: 1, max: 200 }),
        body('price_pkr').notEmpty().isFloat({ min: 0 })
    ],
    validateRequest,
    async (req, res) => {
        let { item_name, price_pkr, userId } = req.body;
        
        // Sanitize
        item_name = sanitizeString(item_name);
        price_pkr = sanitizeNumber(price_pkr);
        
        // Process...
    }
);
```

---

## 🛡️ Attack Prevention

### SQL Injection
**Protection:** Supabase uses parameterized queries automatically. All database operations use the Supabase client library which prevents SQL injection.

### XSS (Cross-Site Scripting)
**Protection:**
1. Input sanitization removes dangerous characters
2. Security headers enable browser XSS filters
3. `escapeHtml()` function used in frontend for user-generated content

### CSRF (Cross-Site Request Forgery)
**Protection:**
1. Socket.IO authentication via userId
2. All API requests require userId validation
3. Custom security headers

### Clickjacking
**Protection:** `X-Frame-Options: DENY` header prevents site from being embedded in iframes

### DoS/DDoS
**Protection:**
1. Rate limiting on all API endpoints
2. Stricter limits on authentication endpoints
3. Request size limits via body-parser

### Authentication Brute Force
**Protection:**
1. Auth-specific rate limiter (5 req/min)
2. Failed attempt logging
3. Progressive delays possible (not yet implemented)

---

## 🔐 Configuration Guide

### Production Deployment Checklist

- [ ] Set `NODE_ENV=production` in `.env`
- [ ] Generate random `SESSION_SECRET`: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- [ ] Update `SUPABASE_URL` and `SUPABASE_ANON_KEY` with production values
- [ ] Set `GROQ_API_KEY` for AI features
- [ ] Enable HTTPS on your hosting platform
- [ ] Verify `.env` is NOT committed to git
- [ ] Enable Supabase Row Level Security (RLS) on all tables
- [ ] Configure firewall rules on your server
- [ ] Set up SSL/TLS certificates
- [ ] Enable logging and monitoring
- [ ] Review rate limit values for your traffic

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
# Edit .env with your actual credentials
```

**Required Variables:**
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase public anonymous key
- `GROQ_API_KEY` - Groq AI API key (if using AI agent)
- `SESSION_SECRET` - Random string for session encryption

**Optional Security Variables:**
- `RATE_LIMIT_WINDOW_MS` - Rate limit time window (default: 60000ms)
- `RATE_LIMIT_MAX_REQUESTS` - Max requests per window (default: 100)
- `RATE_LIMIT_AUTH_MAX` - Max auth requests per window (default: 5)

---

## 📊 Security Testing

### Manual Testing

**1. Test Rate Limiting:**
```bash
# Should succeed
for i in {1..50}; do curl http://localhost:3000/api/whatsapp/status?userId=test; done

# Should fail with 429
for i in {1..150}; do curl http://localhost:3000/api/whatsapp/status?userId=test; done
```

**2. Test Input Validation:**
```bash
# Should fail validation
curl -X POST http://localhost:3000/api/products \
  -H "Content-Type: application/json" \
  -d '{"item_name":"<script>alert(1)</script>","price_pkr":-100}'
```

**3. Test Security Headers:**
```bash
curl -I http://localhost:3000/api/config
# Should see X-Content-Type-Options, X-Frame-Options, etc.
```

### Automated Security Scanning

**Recommended Tools:**
- `npm audit` - Check for vulnerable dependencies
- `snyk test` - Advanced vulnerability scanning
- OWASP ZAP - Web application security scanner
- Burp Suite - Penetration testing

**Run vulnerability check:**
```bash
npm audit
npm audit fix  # Apply automatic fixes
```

---

## 🚨 Incident Response

### If Credentials Are Compromised

1. **Immediate Actions:**
   - Regenerate all API keys (Supabase, Groq)
   - Update `.env` with new credentials
   - Restart the server
   - Review access logs for suspicious activity

2. **Supabase Security:**
   - Go to Supabase Dashboard → Settings → API
   - Reset project API keys
   - Review Row Level Security policies
   - Check audit logs

3. **Session Secret Compromise:**
   - Generate new `SESSION_SECRET`
   - All users will need to re-authenticate
   - Monitor for suspicious sessions

### Reporting Security Issues

**DO NOT** open public GitHub issues for security vulnerabilities.

**Instead:**
- Contact the development team privately
- Provide detailed description of the vulnerability
- Include steps to reproduce
- Allow reasonable time for fix before disclosure

---

## 📚 Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Helmet.js Documentation](https://helmetjs.github.io/)
- [Supabase Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

---

## 🔄 Security Maintenance

### Regular Tasks

**Weekly:**
- Review application logs for suspicious activity
- Check rate limit violations

**Monthly:**
- Run `npm audit` and update dependencies
- Review user permissions and access
- Test backup and recovery procedures

**Quarterly:**
- Full security audit
- Penetration testing
- Review and update security policies
- Training for development team

### Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-06-10 | Initial security hardening implementation |

---

*Last Updated: 2026-06-10*
