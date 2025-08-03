# Supabase Client Design Specification

## Overview

Direct integration of Supabase client into Taptik CLI for authentication and cloud storage
capabilities.

## Architecture Design

### 1. Client Structure

- **Pattern**: Direct client instantiation with singleton export
- **Location**: `src/supabase/supabase-client.ts`
- **Configuration**: Environment-based configuration with validation
- **Export**: Named export for direct import in commands

### 2. Key Components

#### Supabase Client Module

- Creates and exports configured Supabase client instance
- Handles environment variable validation
- Provides typed client for TypeScript support
- Single source of truth for Supabase connection

#### Configuration

- Environment variables loaded via dotenv
- SUPABASE_URL and SUPABASE_ANON_KEY validation
- Runtime configuration validation on startup
- Error handling for missing configuration

### 3. Integration Points

- **Commands**: Direct import of supabase client
  (`import { supabase } from '@/supabase/supabase-client'`)
- **Authentication**: Direct client method calls (`supabase.auth.signIn()`)
- **Storage**: Direct storage access (`supabase.storage.from()`)
- **Database**: Direct database queries (`supabase.from()`)
- **Testing**: Mock the entire client module

## Technical Decisions

1. **Client Library**: `@supabase/supabase-js` v2
2. **Configuration**: Environment variables with validation
3. **Error Handling**: Structured error responses with proper CLI exit codes
4. **Testing**: Full mock support with Vitest

## Security Considerations

- Anon key stored in environment variables
- No hardcoded credentials
- Secure token storage for authenticated sessions
