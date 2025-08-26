# Push Module Security Guide

## Table of Contents

- [Overview](#overview)
- [Security Architecture](#security-architecture)
- [Data Protection](#data-protection)
- [Authentication & Authorization](#authentication--authorization)
- [Input Validation](#input-validation)
- [Sanitization](#sanitization)
- [Security Features](#security-features)
- [Best Practices](#best-practices)
- [Incident Response](#incident-response)

## Overview

The Push module implements defense-in-depth security with multiple layers of protection:

1. **Authentication Layer**: User identity verification
2. **Authorization Layer**: Access control and permissions
3. **Validation Layer**: Input validation and sanitization
4. **Security Layer**: Threat detection and prevention
5. **Audit Layer**: Comprehensive logging and monitoring

## Security Architecture

### Security Components

```
┌─────────────────────────────────────────────┐
│                User Request                  │
└────────────────────┬────────────────────────┘
                     │
        ┌────────────▼────────────┐
        │    Authentication      │
        │  (Supabase Auth/JWT)   │
        └────────────┬────────────┘
                     │
        ┌────────────▼────────────┐
        │    Authorization       │
        │    (RLS Policies)      │
        └────────────┬────────────┘
                     │
        ┌────────────▼────────────┐
        │   Input Validation     │
        │ (Security Validator)   │
        └────────────┬────────────┘
                     │
        ┌────────────▼────────────┐
        │    Sanitization        │
        │  (Remove Sensitive)    │
        └────────────┬────────────┘
                     │
        ┌────────────▼────────────┐
        │   Rate Limiting        │
        │   (Quota Control)      │
        └────────────┬────────────┘
                     │
        ┌────────────▼────────────┐
        │   Secure Storage       │
        │  (Encrypted Upload)    │
        └────────────┬────────────┘
                     │
        ┌────────────▼────────────┐
        │    Audit Logging       │
        │  (Security Events)     │
        └─────────────────────────┘
```

## Data Protection

### Encryption at Rest

All sensitive data is encrypted at rest:

```typescript
// Secure storage configuration
const secureStorage = new SecureStorageService({
  encryptionKey: process.env.PUSH_SECURE_STORAGE_KEY,
  algorithm: 'aes-256-gcm',
  keyDerivation: 'pbkdf2',
  iterations: 100000,
});

// Encrypt sensitive data
const encrypted = await secureStorage.encrypt(sensitiveData);
```

### Encryption in Transit

All data transmissions use TLS 1.3:

```typescript
// Enforce HTTPS
const httpsAgent = new https.Agent({
  minVersion: 'TLSv1.3',
  rejectUnauthorized: true,
});

// Supabase client with TLS
const supabase = createClient(url, key, {
  global: {
    fetch: (url, options) =>
      fetch(url, {
        ...options,
        agent: httpsAgent,
      }),
  },
});
```

### Secure Key Management

```typescript
// Key rotation strategy
class KeyRotationService {
  async rotateKeys(): Promise<void> {
    // Generate new key
    const newKey = crypto.randomBytes(32);

    // Re-encrypt existing data
    const data = await this.getAllEncryptedData();
    for (const item of data) {
      const decrypted = await this.decrypt(item, this.currentKey);
      const reencrypted = await this.encrypt(decrypted, newKey);
      await this.update(item.id, reencrypted);
    }

    // Update key reference
    await this.updateKeyReference(newKey);
    this.currentKey = newKey;
  }
}
```

## Authentication & Authorization

### Authentication Flow

```typescript
// JWT verification
export class AuthGuard {
  async validateToken(token: string): Promise<UserSession> {
    try {
      // Verify JWT signature
      const decoded = jwt.verify(token, this.jwtSecret, {
        algorithms: ['HS256'],
        issuer: 'supabase',
        audience: 'authenticated',
      });

      // Check token expiration
      if (decoded.exp < Date.now() / 1000) {
        throw new UnauthorizedError('Token expired');
      }

      // Validate user session
      const session = await this.validateSession(decoded.sub);

      return session;
    } catch (error) {
      throw new UnauthorizedError('Invalid token');
    }
  }
}
```

### Role-Based Access Control (RBAC)

```typescript
// Permission definitions
enum Permission {
  UPLOAD_PACKAGE = 'upload:package',
  DELETE_PACKAGE = 'delete:package',
  UPDATE_PACKAGE = 'update:package',
  VIEW_ANALYTICS = 'view:analytics',
  MANAGE_TEAM = 'manage:team',
}

// Role definitions
const roles = {
  free: [Permission.UPLOAD_PACKAGE, Permission.DELETE_PACKAGE],
  pro: [...roles.free, Permission.VIEW_ANALYTICS],
  team: [...roles.pro, Permission.MANAGE_TEAM],
};

// Authorization check
export class AuthorizationService {
  hasPermission(user: User, permission: Permission): boolean {
    const userRole = roles[user.tier];
    return userRole.includes(permission);
  }
}
```

### Row Level Security (RLS)

```sql
-- Enforce data isolation
CREATE POLICY "Users can only access their own data"
  ON taptik_packages
  USING (
    auth.uid() = user_id
    OR (is_public = true AND permission_check('view:public'))
  );

-- Team access control
CREATE POLICY "Team members can access team packages"
  ON taptik_packages
  USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid()
    )
  );
```

## Input Validation

### Comprehensive Validation Rules

```typescript
export class SecurityValidatorService {
  // SQL Injection Prevention
  private readonly sqlPatterns = [/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE)\b)/gi, /('|(--|\/\*|\*\/|;))/g, /(EXEC(\s|\()|EXECUTE(\s|\())/gi];

  // XSS Prevention
  private readonly xssPatterns = [/<script[^>]*>.*?<\/script>/gi, /javascript:/gi, /on\w+\s*=/gi, /<iframe/gi];

  // Command Injection Prevention
  private readonly cmdPatterns = [/(\||;|&|\$\(|\`)/g, /(rm\s+-rf|chmod|chown|sudo)/gi, /(\/etc\/passwd|\/etc\/shadow)/gi];

  // Path Traversal Prevention
  private readonly pathPatterns = [/\.\.\//g, /\.\.\\/, /%2e%2e/gi, /\x00/g];

  validateInput(input: unknown, fieldName: string): SecurityValidationResult {
    const issues: SecurityIssue[] = [];
    const inputStr = String(input);

    // Check all patterns
    for (const [name, patterns] of Object.entries(this.getAllPatterns())) {
      for (const pattern of patterns) {
        if (pattern.test(inputStr)) {
          issues.push({
            type: 'INJECTION_ATTEMPT',
            field: fieldName,
            message: `${name} injection detected`,
            severity: 'critical',
          });
        }
      }
    }

    return this.createResult(issues);
  }
}
```

### File Validation

```typescript
export class FileValidationService {
  // Dangerous file signatures
  private readonly dangerousSignatures = [
    { bytes: [0x4d, 0x5a], type: 'PE executable' },
    { bytes: [0x7f, 0x45, 0x4c, 0x46], type: 'ELF executable' },
    { bytes: [0xca, 0xfe, 0xba, 0xbe], type: 'Java class' },
    { bytes: [0xcf, 0xfa, 0xed, 0xfe], type: 'Mach-O binary' },
  ];

  async validateFile(buffer: Buffer): Promise<ValidationResult> {
    const issues: SecurityIssue[] = [];

    // Check file signature
    for (const sig of this.dangerousSignatures) {
      if (this.matchesSignature(buffer, sig.bytes)) {
        issues.push({
          type: 'EXECUTABLE_CONTENT',
          message: `Detected ${sig.type}`,
          severity: 'critical',
        });
      }
    }

    // Check entropy (detect encryption/obfuscation)
    const entropy = this.calculateEntropy(buffer);
    if (entropy > 7.5) {
      issues.push({
        type: 'HIGH_ENTROPY',
        message: 'Possible encrypted/obfuscated content',
        severity: 'high',
      });
    }

    // Check for embedded scripts
    const content = buffer.toString('utf8', 0, Math.min(buffer.length, 10000));
    if (this.containsScript(content)) {
      issues.push({
        type: 'EMBEDDED_SCRIPT',
        message: 'Contains executable script',
        severity: 'high',
      });
    }

    return { isValid: issues.length === 0, issues };
  }
}
```

## Sanitization

### Sensitive Data Patterns

```typescript
export class SanitizationService {
  private readonly sensitivePatterns = {
    // API Keys
    awsKey: /AKIA[0-9A-Z]{16}/gi,
    awsSecret: /aws[_\-]?secret[_\-]?access[_\-]?key\s*[:=]\s*['""]?[A-Za-z0-9/+=]{40}/gi,
    githubToken: /ghp_[a-zA-Z0-9]{36}/gi,
    googleApi: /AIza[0-9A-Za-z\-_]{35}/gi,
    stripeKey: /sk_(live|test)_[0-9a-zA-Z]{24}/gi,

    // Passwords
    password: /(password|passwd|pwd)\s*[:=]\s*['""]?[^\s'"",]+/gi,

    // Tokens
    bearerToken: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
    jwtToken: /eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_.+/=]*/g,

    // Private Keys
    privateKey: /-----BEGIN\s+(RSA|DSA|EC|OPENSSH|PRIVATE)\s+PRIVATE\s+KEY-----/gi,

    // Database URLs
    databaseUrl: /(mongodb|postgres|mysql|redis):\/\/[^@]+@[^\s]+/gi,

    // Email addresses (optional)
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,

    // Credit Cards
    creditCard: /\b(?:\d{4}[\s\-]?){3}\d{4}\b/g,

    // SSN
    ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  };

  async sanitizePackage(buffer: Buffer, fileName: string, platform: PlatformConfig): Promise<SanitizationResult> {
    let content = buffer.toString('utf8');
    const report: SanitizationReport = {
      removed: [],
      masked: [],
      removedCount: 0,
      maskedCount: 0,
      detectedPatterns: [],
      classifications: [],
      autoTags: [],
    };

    // Apply sanitization
    for (const [name, pattern] of Object.entries(this.sensitivePatterns)) {
      const matches = content.match(pattern);
      if (matches) {
        report.detectedPatterns.push(name);

        if (this.shouldRemove(name)) {
          content = content.replace(pattern, '');
          report.removed.push(name);
          report.removedCount += matches.length;
        } else {
          content = content.replace(pattern, (match) => this.mask(match));
          report.masked.push(name);
          report.maskedCount += matches.length;
        }
      }
    }

    // Classification
    report.classifications = this.classifyContent(report);
    report.autoTags = this.generateAutoTags(content, platform);

    return {
      sanitized: Buffer.from(content),
      report,
    };
  }

  private mask(value: string): string {
    const visibleChars = 4;
    if (value.length <= visibleChars * 2) {
      return '*'.repeat(value.length);
    }
    return value.substring(0, visibleChars) + '*'.repeat(value.length - visibleChars * 2) + value.substring(value.length - visibleChars);
  }
}
```

## Security Features

### Malware Detection

```typescript
export class MalwareDetectionService {
  private readonly clamav = new ClamAV({
    host: process.env.CLAMAV_HOST,
    port: process.env.CLAMAV_PORT,
  });

  async scanFile(buffer: Buffer): Promise<ScanResult> {
    try {
      // ClamAV scan
      const result = await this.clamav.scan(buffer);

      if (result.isInfected) {
        throw new SecurityError('MALWARE_DETECTED', `Detected: ${result.viruses.join(', ')}`);
      }

      // Additional heuristic checks
      const heuristicResult = await this.heuristicScan(buffer);

      return {
        clean: !result.isInfected && heuristicResult.clean,
        threats: [...result.viruses, ...heuristicResult.threats],
      };
    } catch (error) {
      // Fail secure - reject on scan failure
      throw new SecurityError('SCAN_FAILED', 'Security scan failed');
    }
  }

  private async heuristicScan(buffer: Buffer): Promise<HeuristicResult> {
    const threats: string[] = [];

    // Check for suspicious patterns
    const patterns = [
      { regex: /eval\s*\(/, name: 'Eval usage' },
      { regex: /Function\s*\(/, name: 'Dynamic function' },
      { regex: /require\s*\(['"]child_process['"]/, name: 'Child process' },
      { regex: /\.exec\s*\(/, name: 'Command execution' },
    ];

    const content = buffer.toString('utf8', 0, Math.min(buffer.length, 100000));

    for (const pattern of patterns) {
      if (pattern.regex.test(content)) {
        threats.push(pattern.name);
      }
    }

    return {
      clean: threats.length === 0,
      threats,
    };
  }
}
```

### Rate Limiting

```typescript
export class EnhancedRateLimiterService {
  // Sliding window rate limiting
  async checkRateLimit(userId: string, action: string, limits: RateLimitConfig): Promise<RateLimitResult> {
    const key = `rate:${action}:${userId}`;
    const now = Date.now();
    const window = limits.windowMs;

    // Get recent requests
    const requests = await this.redis.zrangebyscore(key, now - window, now);

    // Check if limit exceeded
    if (requests.length >= limits.max) {
      const oldestRequest = parseInt(requests[0]);
      const resetTime = new Date(oldestRequest + window);

      throw new RateLimitError({
        limit: limits.max,
        remaining: 0,
        resetAt: resetTime,
        retryAfter: Math.ceil((resetTime.getTime() - now) / 1000),
      });
    }

    // Add current request
    await this.redis.zadd(key, now, `${now}:${crypto.randomBytes(4).toString('hex')}`);
    await this.redis.expire(key, Math.ceil(window / 1000));

    return {
      limit: limits.max,
      remaining: limits.max - requests.length - 1,
      resetAt: new Date(now + window),
    };
  }

  // Distributed rate limiting
  async checkDistributedLimit(userId: string, action: string): Promise<boolean> {
    const script = `
      local key = KEYS[1]
      local limit = tonumber(ARGV[1])
      local window = tonumber(ARGV[2])
      local now = tonumber(ARGV[3])
      
      redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
      local count = redis.call('ZCARD', key)
      
      if count < limit then
        redis.call('ZADD', key, now, now)
        redis.call('EXPIRE', key, window)
        return 1
      else
        return 0
      end
    `;

    const result = await this.redis.eval(
      script,
      1,
      `rate:${action}:${userId}`,
      100, // limit
      86400000, // 24 hours in ms
      Date.now(),
    );

    return result === 1;
  }
}
```

### Audit Logging

```typescript
export class SecurityAuditService {
  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    const auditEntry: AuditLog = {
      id: uuidv4(),
      timestamp: new Date(),
      userId: event.userId,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      result: event.result,
      riskScore: this.calculateRiskScore(event),
      metadata: {
        ...event.metadata,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        sessionId: event.sessionId,
        threatIndicators: event.threatIndicators,
      },
    };

    // Store in database
    await this.storeAuditLog(auditEntry);

    // Alert on high-risk events
    if (auditEntry.riskScore > 0.7) {
      await this.alertSecurityTeam(auditEntry);
    }

    // Stream to SIEM
    await this.streamToSIEM(auditEntry);
  }

  private calculateRiskScore(event: SecurityEvent): number {
    let score = 0;

    // Failed authentication attempts
    if (event.action === 'AUTH_FAILED') score += 0.3;

    // Suspicious patterns
    if (event.threatIndicators?.includes('SQL_INJECTION')) score += 0.8;
    if (event.threatIndicators?.includes('XSS_ATTEMPT')) score += 0.7;

    // Unusual activity
    if (event.metadata?.unusualTime) score += 0.2;
    if (event.metadata?.unusualLocation) score += 0.3;

    return Math.min(score, 1.0);
  }
}
```

## Best Practices

### Secure Coding Guidelines

```typescript
// ✅ Good: Parameterized queries
const result = await db.query('SELECT * FROM packages WHERE user_id = $1 AND name = $2', [userId, packageName]);

// ❌ Bad: String concatenation
const result = await db.query(`SELECT * FROM packages WHERE user_id = '${userId}'`);

// ✅ Good: Input validation
function validatePackageName(name: string): void {
  if (!/^[a-zA-Z0-9\-_.]+$/.test(name)) {
    throw new ValidationError('Invalid package name');
  }
}

// ❌ Bad: No validation
function processPackage(name: string): void {
  // Direct use without validation
  fs.writeFileSync(name, data);
}

// ✅ Good: Secure random
const token = crypto.randomBytes(32).toString('hex');

// ❌ Bad: Predictable values
const token = Math.random().toString(36);

// ✅ Good: Constant-time comparison
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// ❌ Bad: Timing attack vulnerable
function insecureCompare(a: string, b: string): boolean {
  return a === b;
}
```

### Security Headers

```typescript
// Configure security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://*.supabase.co'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'none'"],
        frameSrc: ["'none'"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }),
);

// Additional security headers
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
```

### CORS Configuration

```typescript
const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = ['https://app.taptik.com', 'https://taptik.com'];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  maxAge: 86400, // 24 hours
};

app.use(cors(corsOptions));
```

## Incident Response

### Security Incident Workflow

```typescript
export class IncidentResponseService {
  async handleSecurityIncident(incident: SecurityIncident): Promise<void> {
    // 1. Immediate containment
    await this.containThreat(incident);

    // 2. Evidence collection
    const evidence = await this.collectEvidence(incident);

    // 3. Impact assessment
    const impact = await this.assessImpact(incident);

    // 4. Notification
    if (impact.severity >= 'high') {
      await this.notifyStakeholders(incident, impact);
    }

    // 5. Recovery
    await this.initiateRecovery(incident);

    // 6. Post-incident analysis
    await this.conductPostMortem(incident, evidence);
  }

  private async containThreat(incident: SecurityIncident): Promise<void> {
    switch (incident.type) {
      case 'ACCOUNT_COMPROMISE':
        await this.disableAccount(incident.userId);
        await this.invalidateSessions(incident.userId);
        break;

      case 'DATA_BREACH':
        await this.isolateAffectedData(incident.resourceId);
        await this.revokeAccess(incident.resourceId);
        break;

      case 'MALWARE_UPLOAD':
        await this.quarantineFile(incident.resourceId);
        await this.scanRelatedFiles(incident.userId);
        break;
    }
  }

  private async collectEvidence(incident: SecurityIncident): Promise<Evidence> {
    return {
      logs: await this.collectLogs(incident.timeframe),
      snapshots: await this.captureSystemState(),
      artifacts: await this.preserveArtifacts(incident),
      timeline: await this.reconstructTimeline(incident),
    };
  }
}
```

### Security Monitoring

```typescript
export class SecurityMonitoringService {
  private readonly anomalyDetector = new AnomalyDetector();

  async monitorSecurityEvents(): Promise<void> {
    // Real-time event monitoring
    this.eventStream.on('security-event', async (event) => {
      // Detect anomalies
      const anomaly = await this.anomalyDetector.analyze(event);

      if (anomaly.score > 0.8) {
        await this.handleAnomaly(anomaly);
      }

      // Pattern matching
      const patterns = await this.detectPatterns(event);

      if (patterns.includes('BRUTE_FORCE')) {
        await this.blockBruteForce(event.userId);
      }

      if (patterns.includes('CREDENTIAL_STUFFING')) {
        await this.enforceStrongerAuth(event.userId);
      }
    });
  }

  private async detectPatterns(event: SecurityEvent): Promise<string[]> {
    const patterns: string[] = [];

    // Brute force detection
    const recentFailures = await this.getRecentAuthFailures(event.userId);
    if (recentFailures > 5) {
      patterns.push('BRUTE_FORCE');
    }

    // Credential stuffing detection
    const loginVelocity = await this.getLoginVelocity(event.ipAddress);
    if (loginVelocity > 10) {
      patterns.push('CREDENTIAL_STUFFING');
    }

    // Account takeover detection
    const riskSignals = await this.getRiskSignals(event);
    if (riskSignals.score > 0.7) {
      patterns.push('ACCOUNT_TAKEOVER');
    }

    return patterns;
  }
}
```

## Security Testing

### Penetration Testing

```typescript
describe('Security Penetration Tests', () => {
  it('should prevent SQL injection', async () => {
    const maliciousInputs = ["'; DROP TABLE users; --", "1' OR '1'='1", "admin' --", "' UNION SELECT * FROM passwords --"];

    for (const input of maliciousInputs) {
      const result = await api.searchPackages(input);

      expect(result.status).toBe(400);
      expect(result.error).toContain('Invalid input');

      // Verify database integrity
      const tables = await db.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
      expect(tables.rows).toContainEqual({ tablename: 'users' });
    }
  });

  it('should prevent XSS attacks', async () => {
    const xssPayloads = ['<script>alert("XSS")</script>', '<img src=x onerror=alert(1)>', 'javascript:alert(1)', '<svg onload=alert(1)>'];

    for (const payload of xssPayloads) {
      const result = await api.createPackage({
        name: payload,
        description: payload,
      });

      // Check response doesn't reflect payload
      expect(result.body).not.toContain(payload);

      // Check stored data is sanitized
      const stored = await db.getPackage(result.id);
      expect(stored.name).not.toContain('<script>');
      expect(stored.description).not.toContain('javascript:');
    }
  });

  it('should enforce rate limits', async () => {
    const requests = [];

    // Make 101 requests (limit is 100)
    for (let i = 0; i < 101; i++) {
      requests.push(api.uploadPackage(testPackage));
    }

    const results = await Promise.allSettled(requests);
    const successful = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter((r) => r.status === 'rejected');

    expect(successful.length).toBe(100);
    expect(failed.length).toBe(1);
    expect(failed[0].reason).toContain('Rate limit exceeded');
  });
});
```

## Security Checklist

### Development

- [ ] Input validation on all user inputs
- [ ] Output encoding for all dynamic content
- [ ] Parameterized queries for all database operations
- [ ] Secure session management
- [ ] Strong authentication mechanisms
- [ ] Proper error handling without information leakage
- [ ] Security headers configured
- [ ] CORS properly configured
- [ ] Dependencies regularly updated
- [ ] Security linting enabled

### Deployment

- [ ] HTTPS enforced everywhere
- [ ] Secrets stored securely (not in code)
- [ ] Database access restricted
- [ ] Storage bucket policies configured
- [ ] Rate limiting enabled
- [ ] Monitoring and alerting configured
- [ ] Backup and recovery tested
- [ ] Incident response plan documented
- [ ] Security scanning in CI/CD
- [ ] Penetration testing completed

### Operations

- [ ] Regular security audits
- [ ] Log monitoring active
- [ ] Anomaly detection configured
- [ ] Vulnerability scanning scheduled
- [ ] Security patches applied promptly
- [ ] Access reviews conducted
- [ ] Security training completed
- [ ] Compliance requirements met
- [ ] Insurance coverage adequate
- [ ] Legal requirements satisfied

## Compliance

### GDPR Compliance

```typescript
export class GDPRComplianceService {
  // Right to be forgotten
  async deleteUserData(userId: string): Promise<void> {
    // Delete packages
    await db.query('DELETE FROM taptik_packages WHERE user_id = $1', [userId]);

    // Delete analytics
    await db.query('DELETE FROM package_downloads WHERE user_id = $1', [userId]);

    // Delete audit logs (keep anonymized)
    await db.query("UPDATE audit_logs SET user_id = NULL, metadata = metadata - 'email' - 'name' WHERE user_id = $1", [userId]);

    // Delete from storage
    await storage.deleteUserFiles(userId);
  }

  // Data portability
  async exportUserData(userId: string): Promise<UserDataExport> {
    const packages = await db.query('SELECT * FROM taptik_packages WHERE user_id = $1', [userId]);
    const downloads = await db.query('SELECT * FROM package_downloads WHERE user_id = $1', [userId]);
    const audit = await db.query('SELECT * FROM audit_logs WHERE user_id = $1', [userId]);

    return {
      packages: packages.rows,
      downloads: downloads.rows,
      auditLogs: audit.rows,
      exportDate: new Date(),
      format: 'json',
    };
  }
}
```

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE/SANS Top 25](https://cwe.mitre.org/top25/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [Security Best Practices](./DEVELOPER.md#security-considerations)
