# Deploy Module Usage Examples

## Common Deployment Scenarios

This guide provides practical examples for various deployment scenarios using the Taptik Deploy module.

## Table of Contents

- [Basic Deployments](#basic-deployments)
- [Advanced Deployments](#advanced-deployments)
- [Conflict Resolution](#conflict-resolution)
- [Component Management](#component-management)
- [Validation and Testing](#validation-and-testing)
- [Backup and Recovery](#backup-and-recovery)
- [Troubleshooting Workflows](#troubleshooting-workflows)
- [Automation Scripts](#automation-scripts)

## Basic Deployments

### 1. First-Time Deployment

Deploy your first configuration to Claude Code:

```bash
# Login to Supabase first
taptik login

# List available configurations
taptik list

# Deploy the latest configuration
taptik deploy

# Output:
# 🚀 Starting deployment to claudeCode...
# 📥 Importing context from Supabase...
# ✅ Context imported successfully: My Development Setup
# 🚀 Deploying to Claude Code...
# ✅ Deployment successful!
# 📦 Components deployed: settings, agents, commands, project
```

### 2. Deploy Specific Configuration

Deploy a configuration by its ID:

```bash
# Find configuration ID
taptik list --detailed

# Deploy specific configuration
taptik deploy --context-id dev-setup-2024

# With verbose output
taptik deploy --context-id dev-setup-2024 --verbose
```

### 3. Quick Deploy with Defaults

Deploy with automatic conflict resolution:

```bash
# Always overwrite existing files
taptik deploy --force --conflict-strategy overwrite

# Skip all conflicts
taptik deploy --force --conflict-strategy skip

# Create backups automatically
taptik deploy --force --conflict-strategy backup
```

## Advanced Deployments

### 1. Staged Deployment

Deploy components in stages:

```bash
# Stage 1: Deploy only settings
taptik deploy --components settings --dry-run
taptik deploy --components settings

# Stage 2: Deploy agents
taptik deploy --components agents --dry-run
taptik deploy --components agents

# Stage 3: Deploy commands and project files
taptik deploy --components commands project
```

### 2. Partial Update

Update only specific components:

```bash
# Update only Claude Code settings
taptik deploy --components settings --conflict-strategy merge

# Update agents without touching other components
taptik deploy --components agents --skip-components settings commands project

# Update everything except commands
taptik deploy --skip-components commands
```

### 3. Safe Production Deployment

Deploy with maximum safety checks:

```bash
# Step 1: Validate configuration
taptik deploy --validate-only

# Step 2: Dry run to preview changes
taptik deploy --dry-run | tee deployment-plan.txt

# Step 3: Create manual backup
taptik backup create --name pre-deployment

# Step 4: Deploy with backup strategy
taptik deploy --conflict-strategy backup --timeout 60000

# Step 5: Verify deployment
taptik verify --post-deployment
```

## Conflict Resolution

### 1. Interactive Conflict Resolution

Handle conflicts interactively:

```bash
# Prompt for each conflict (default)
taptik deploy --conflict-strategy prompt

# Example interaction:
# Conflict: ~/.claude/settings.json already exists
# Options:
#   [o] Overwrite
#   [s] Skip
#   [m] Merge
#   [b] Backup and overwrite
#   [d] Show diff
# Choose action: d
# [Shows diff]
# Choose action: m
```

### 2. Automatic Merge Strategy

Intelligently merge configurations:

```bash
# Merge settings while preserving local changes
taptik deploy --conflict-strategy merge

# Merge with preference for remote
taptik deploy --conflict-strategy merge --merge-preference remote

# Merge with preference for local
taptik deploy --conflict-strategy merge --merge-preference local
```

### 3. Backup Before Overwrite

Create automatic backups:

```bash
# Backup existing files before overwriting
taptik deploy --conflict-strategy backup

# Backup location: ~/.taptik/backups/backup_20240315_143022.json
# Manifest: ~/.taptik/backups/manifest_20240315_143022.json
```

## Component Management

### 1. Settings Management

Deploy only settings:

```bash
# Deploy global settings
taptik deploy --components settings

# Settings deployed to:
# - ~/.claude/settings.json (global)
# - .claude/settings.json (project)
```

### 2. Agent Deployment

Manage custom agents:

```bash
# Deploy all agents
taptik deploy --components agents

# List deployed agents
ls -la ~/.claude/agents/

# Verify agent deployment
taptik verify --components agents
```

### 3. Command Management

Deploy custom commands:

```bash
# Deploy commands with execution permission check
taptik deploy --components commands --verify-permissions

# Make commands executable
chmod +x ~/.claude/commands/*.sh

# Test command execution
~/.claude/commands/my-command.sh --test
```

### 4. Project Files

Deploy project-specific files:

```bash
# Deploy CLAUDE.md and project settings
taptik deploy --components project

# Files deployed:
# - ./CLAUDE.md
# - ./.claude/settings.json
# - ./.claude/hooks/
```

## Validation and Testing

### 1. Pre-Deployment Validation

Validate before deploying:

```bash
# Full validation
taptik deploy --validate-only

# Validate specific components
taptik deploy --validate-only --components settings agents

# Verbose validation output
taptik deploy --validate-only --verbose

# Output:
# 🔍 Running validation only...
# ✅ Settings: Valid
# ✅ Agents: Valid (3 agents)
# ✅ Commands: Valid (5 commands)
# ⚠️  Project: Warning - CLAUDE.md will be overwritten
```

### 2. Dry Run Testing

Preview deployment without changes:

```bash
# Basic dry run
taptik deploy --dry-run

# Dry run with detailed output
taptik deploy --dry-run --verbose

# Save dry run report
taptik deploy --dry-run > deployment-preview.txt

# Output:
# 🧪 Running in dry-run mode...
# Would deploy:
#   - Settings: ~/.claude/settings.json (2.3 KB)
#   - Agents: 3 files to ~/.claude/agents/
#   - Commands: 5 files to ~/.claude/commands/
#   - Project: CLAUDE.md (1.5 KB)
# No files will be modified.
```

### 3. Security Validation

Check for security issues:

```bash
# Security scan only
taptik deploy --security-scan

# Strict security validation
export TAPTIK_SECURITY_LEVEL=strict
taptik deploy --validate-only

# Output:
# 🔒 Security Scan Results:
# ✅ No malicious patterns detected
# ✅ No path traversal attempts
# ✅ No sensitive data exposed
# ⚠️  Warning: Command 'cleanup.sh' requests sudo
```

## Backup and Recovery

### 1. Manual Backup

Create backups before deployment:

```bash
# Create named backup
taptik backup create --name "before-update-2024"

# Create timestamped backup
taptik backup create

# List available backups
taptik backup list

# Output:
# Available backups:
# 1. before-update-2024 (2024-03-15 14:30:22) - 15.2 KB
# 2. backup_20240315_143022 (2024-03-15 14:30:22) - 15.2 KB
# 3. backup_20240314_093015 (2024-03-14 09:30:15) - 14.8 KB
```

### 2. Rollback Procedures

Rollback failed deployments:

```bash
# Rollback to latest backup
taptik rollback --latest

# Rollback to specific backup
taptik rollback --backup-id backup_20240315_143022

# Rollback specific component
taptik rollback --component settings --backup-id backup_20240315_143022

# Dry run rollback
taptik rollback --latest --dry-run
```

### 3. Recovery from Failures

Recover from deployment failures:

```bash
# Automatic recovery (if deployment failed)
taptik recover --auto

# Manual recovery with specific backup
taptik recover --backup-id backup_20240315_143022

# Force recovery (ignore locks)
taptik recover --force --backup-id backup_20240315_143022

# Verify recovery
taptik verify --post-recovery
```

## Troubleshooting Workflows

### 1. Debug Failed Deployment

```bash
# Enable debug mode
export DEBUG=taptik:*
export NODE_ENV=development

# Run with verbose output
taptik deploy --verbose --debug

# Check logs
tail -f ~/.taptik/logs/deploy-*.log

# View specific error
grep ERROR ~/.taptik/logs/deploy-*.log
```

### 2. Fix Permission Issues

```bash
# Check current permissions
ls -la ~/.claude/

# Fix permission issues
chmod 755 ~/.claude
chmod 644 ~/.claude/settings.json
find ~/.claude/commands -type f -exec chmod 755 {} \;

# Retry deployment
taptik deploy --force
```

### 3. Resolve Lock Issues

```bash
# Check for locks
ls -la ~/.claude/.locks/

# Wait for lock release
taptik deploy --wait-for-lock --timeout 30000

# Force unlock (use with caution)
rm -f ~/.claude/.locks/*.lock
taptik deploy --force-unlock

# Clean up stale locks
taptik locks cleanup --stale
```

### 4. Network Issues

```bash
# Retry with extended timeout
taptik deploy --timeout 120000 --retry 5

# Use exponential backoff
taptik deploy --retry-strategy exponential

# Check network connectivity
taptik debug network --test

# Use offline mode with local config
taptik deploy --offline --local-config ./backup-config.json
```

## Automation Scripts

### 1. Automated Daily Deployment

```bash
#!/bin/bash
# daily-deploy.sh

# Set up environment
export TAPTIK_ENV=production
export TAPTIK_SECURITY_LEVEL=strict

# Create backup
echo "Creating backup..."
taptik backup create --name "daily-$(date +%Y%m%d)"

# Validate configuration
echo "Validating configuration..."
if ! taptik deploy --validate-only; then
    echo "Validation failed!"
    exit 1
fi

# Deploy with automatic conflict resolution
echo "Deploying..."
taptik deploy \
    --conflict-strategy backup \
    --timeout 60000 \
    --force

# Verify deployment
echo "Verifying..."
taptik verify --post-deployment

# Clean old backups
echo "Cleaning old backups..."
taptik backup cleanup --older-than 30d

echo "Deployment complete!"
```

### 2. CI/CD Integration

```yaml
# .github/workflows/deploy.yml
name: Deploy Taptik Configuration

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install Taptik CLI
        run: npm install -g @taptik/cli
        
      - name: Authenticate
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
        run: taptik auth login --token ${{ secrets.TAPTIK_TOKEN }}
        
      - name: Validate Configuration
        run: taptik deploy --validate-only
        
      - name: Deploy
        run: |
          taptik deploy \
            --context-id ${{ vars.CONFIG_ID }} \
            --conflict-strategy overwrite \
            --force
```

### 3. Batch Deployment Script

```bash
#!/bin/bash
# batch-deploy.sh

# Deploy to multiple environments
ENVIRONMENTS=("dev" "staging" "prod")
CONFIG_IDS=("dev-config" "staging-config" "prod-config")

for i in "${!ENVIRONMENTS[@]}"; do
    ENV="${ENVIRONMENTS[$i]}"
    CONFIG="${CONFIG_IDS[$i]}"
    
    echo "Deploying to $ENV environment..."
    
    # Set environment
    export TAPTIK_ENV="$ENV"
    
    # Validate
    if taptik deploy --context-id "$CONFIG" --validate-only; then
        # Deploy
        taptik deploy \
            --context-id "$CONFIG" \
            --conflict-strategy backup \
            --force
        
        echo "✅ $ENV deployment successful"
    else
        echo "❌ $ENV validation failed, skipping"
    fi
done
```

### 4. Rollback Script

```bash
#!/bin/bash
# emergency-rollback.sh

echo "🚨 Emergency Rollback Initiated"

# Kill any running deployments
pkill -f "taptik deploy" || true

# Release all locks
taptik locks release --all --force

# Find latest backup
LATEST_BACKUP=$(taptik backup list --format json | jq -r '.[0].id')

if [ -z "$LATEST_BACKUP" ]; then
    echo "❌ No backup found!"
    exit 1
fi

echo "Rolling back to: $LATEST_BACKUP"

# Perform rollback
taptik rollback --backup-id "$LATEST_BACKUP" --force

# Verify
if taptik verify --post-recovery; then
    echo "✅ Rollback successful"
else
    echo "❌ Rollback verification failed"
    exit 1
fi
```

## Performance Optimization

### 1. Large Configuration Deployment

```bash
# Enable streaming for large configs
taptik deploy --stream --chunk-size 1048576

# Use parallel deployment
taptik deploy --parallel --max-workers 4

# Enable caching
taptik deploy --cache --cache-ttl 3600
```

### 2. Slow Network Optimization

```bash
# Compress transfer
taptik deploy --compress

# Use incremental updates
taptik deploy --incremental

# Enable resume on failure
taptik deploy --resume-on-failure
```

## Monitoring and Reporting

### 1. Real-time Monitoring

```bash
# Monitor deployment progress
taptik deploy --progress

# Watch deployment logs
tail -f ~/.taptik/logs/deploy-*.log | grep -E "(START|COMPLETE|ERROR)"

# Monitor system resources
taptik deploy --monitor-resources
```

### 2. Generate Reports

```bash
# Generate deployment report
taptik report generate --type deployment --output report.html

# Generate security audit
taptik audit report --last 7d --output audit-report.pdf

# Generate performance metrics
taptik metrics export --format csv --output metrics.csv
```

## Best Practices Summary

1. **Always validate** before deploying
2. **Use dry-run** for production deployments
3. **Create backups** before major changes
4. **Monitor logs** during deployment
5. **Use appropriate conflict strategy**
6. **Verify deployment** after completion
7. **Clean up old backups** regularly
8. **Review security warnings**
9. **Document deployment decisions**
10. **Test rollback procedures**