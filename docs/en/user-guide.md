# User Guide

This guide explains the user-facing features and how Briclaude works.

## Table of Contents

1. [Overview](#overview)
2. [File System and User Environment](#file-system-and-user-environment)
3. [Authentication and Tokens](#authentication-and-tokens)
4. [Permissions and Operations](#permissions-and-operations)
5. [Skills System](#skills-system)
6. [Sessions and Workspace Integration](#sessions-and-workspace-integration)
7. [Security](#security)

## Overview

Briclaude is a Claude Code-like AI chat application running on Databricks Apps. Users can ask Claude to create code and perform Databricks workspace operations using natural language.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Databricks Apps                          │
│  ┌─────────────┐         ┌─────────────────────────────┐   │
│  │ Auth Proxy  │ headers │ Briclaude API               │   │
│  │             │────────▶│ ├─ /api/* (API)             │   │
│  │             │         │ └─ /*     (Frontend)        │   │
│  └─────────────┘         └─────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## File System and User Environment

### User Environment Isolation

In Briclaude, each user is assigned a dedicated file system area. This ensures data isolation between users.

```
${USER_BASE_DIR}/
├── user1/                          # User 1's home directory
│   ├── .claude/
│   │   ├── settings.local.json     # Claude settings
│   │   └── skills/                 # User's skills
│   │       ├── my-skill/
│   │       │   └── SKILL.md
│   │       └── another-skill/
│   │           └── SKILL.md
│   ├── session_xxx.../             # Session working directory
│   └── session_yyy.../
└── user2/                          # User 2's home directory
    └── ...
```

### Directory Roles

| Directory | Description |
|-----------|-------------|
| `${USER_BASE_DIR}/${userId}` | User's home directory. All user data is stored here |
| `${userHome}/.claude/` | Claude-related configuration files |
| `${userHome}/.claude/skills/` | Skills created or imported by the user |
| `${userHome}/${sessionId}/` | Working directory for each session |

### Skills and File System

Skills are stored on the file system, which provides the following characteristics:

- **Persistence**: Skills are retained after session ends
- **User-specific**: Each user has their own set of skills
- **Portability**: Skills can be imported from Git repositories

## Authentication and Tokens

### Authentication Flow

In Databricks Apps, the authentication proxy handles user authentication and forwards the following headers to the application:

| Header | Description |
|--------|-------------|
| `x-forwarded-user` | User ID (from IdP) |
| `x-forwarded-preferred-username` | Display name |
| `x-forwarded-email` | Email address |
| `x-forwarded-access-token` | OBO (On-Behalf-Of) token |

### Token Types and Usage

Briclaude uses multiple token types:

#### 1. OBO (On-Behalf-Of) Token

- **How to obtain**: Automatically provided by Databricks Apps authentication proxy
- **Use case**: Call Databricks API on behalf of the user
- **Validity**: Short-lived token provided per request
- **Limitation**: Only available when accessing through Databricks Apps

#### 2. PAT (Personal Access Token)

- **How to obtain**: User generates in Databricks UI and registers in the app
- **Use case**: Claude executes Databricks CLI commands on behalf of the user
- **Validity**: User configurable (recommended: within 90 days)
- **Storage**: Encrypted with AES-256-GCM and stored in database

#### 3. Service Principal Token

- **How to obtain**: Application obtains via OAuth Client Credentials
- **Use case**: Fallback when PAT is not registered
- **Limitation**: Operations limited to Service Principal's permission scope

### Why PAT is Required

When Claude Code executes the `databricks` CLI within a session, PAT is required for the following reasons:

1. **CLI Authentication**: The `databricks` CLI uses credentials from the file system
2. **User Permission Execution**: OBO tokens are only available via HTTP headers and cannot be used with CLI
3. **Workspace Operations**: File upload/download requires user permissions

```
┌────────────────────────────────────────────────────────────────┐
│  Authentication within Claude Code Session                     │
│                                                                │
│  ┌─────────────┐    ┌─────────────────┐    ┌──────────────┐  │
│  │ Claude Code │───▶│ databricks CLI  │───▶│ Databricks   │  │
│  │             │    │ (using PAT)     │    │ Workspace    │  │
│  └─────────────┘    └─────────────────┘    └──────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

### How to Register PAT

1. Generate PAT from Databricks UI: Settings > Developer > Access tokens
2. Register the token in Briclaude's settings screen
3. The token is encrypted and stored securely

**Note**: PAT must start with `dapi`.

## Permissions and Operations

Each operation uses the following permissions/tokens:

| Operation | Token Used | Description |
|-----------|------------|-------------|
| **App Access** | OBO Token | Handled by Databricks Apps auth proxy |
| **Session Creation** | App Auth | Internal app processing, only user auth required |
| **Skill List/Create/Delete** | App Auth | File system operations, only user auth |
| **Skill Git Import** | App Auth | Clone public repositories |
| **Claude Chat** | App Auth + Anthropic API | Claude API calls |
| **Workspace File Fetch** | PAT or OBO | `databricks workspace export-dir` command |
| **Workspace File Sync** | PAT | `databricks sync` command (executed by Claude) |
| **SQL Warehouse Query** | PAT or SP | Databricks SQL execution |

### Authentication Priority

When calling Databricks API, authentication methods are selected in the following order:

```
1. User-registered PAT (if available)
   ↓ (if not available)
2. Service Principal Token (OAuth M2M)
```

## Skills System

### What are Skills?

Skills are custom instruction sets that extend Claude's capabilities. They are written in SKILL.md files and referenced by Claude when executing tasks.

### Skill Structure

```yaml
---
name: my-custom-skill
description: Description of this skill
metadata:
  version: 1.0.0
  author: your-name
  source: https://github.com/org/repo  # For Git imports
---

# Skill Content

Write instructions for Claude in Markdown format here.
```

### Skill Storage Location

Skills are stored in the user's file system area:

```
${userHome}/.claude/skills/
├── skill-name-1/
│   └── SKILL.md
└── skill-name-2/
    └── SKILL.md
```

### Skill Management

| Operation | Description |
|-----------|-------------|
| List | View registered skills |
| Create | Create new skill |
| Edit | Update existing skill content |
| Delete | Remove unwanted skills |
| Git Import | Import skills from public repositories |

### Import from Git

Skills can be imported from public Git repositories:

- **Supported formats**: HTTPS URL or SSH URL
- **Branch specification**: Can import from specific branch
- **Path specification**: Can specify specific directory within repository

## Sessions and Workspace Integration

### How Sessions Work

Each chat session is assigned a dedicated working directory:

```
${userHome}/${sessionId}/
├── .claude/
│   └── settings.local.json  # SessionStart hook settings
├── imported_file1.py        # Files imported from Workspace
└── imported_file2.sql
```

### SessionStart Hooks

Commands that automatically execute at session start can be configured. When specifying Databricks Workspace as a source, the following command is automatically set:

```bash
databricks workspace export-dir "/Workspace/path/to/source" . --overwrite
```

This downloads Workspace files locally when the session starts.

### Workspace Operations Policy

In Briclaude, we adopt the policy of **having Claude Code perform** Workspace and app operations:

```
┌────────────────────────────────────────────────────────────────┐
│  Workspace Operation Flow                                      │
│                                                                │
│  User: "Fix this code and save it to Workspace"               │
│      ↓                                                         │
│  Claude: Edits the file                                        │
│      ↓                                                         │
│  Claude: Syncs to Workspace with databricks sync               │
│      ↓                                                         │
│  Claude: Reports "Done"                                        │
└────────────────────────────────────────────────────────────────┘
```

#### Benefits of This Approach

1. **Flexibility**: Claude selects optimal commands based on the situation
2. **Transparency**: Commands executed are shown to the user
3. **Error Handling**: Claude interprets and handles errors
4. **Learning**: Users can learn CLI usage

#### Main Databricks CLI Commands

Main CLI commands used by Claude within sessions:

| Command | Usage |
|---------|-------|
| `databricks workspace export-dir` | Download files from Workspace |
| `databricks workspace import-dir` | Upload files to Workspace |
| `databricks sync` | Sync local and Workspace |
| `databricks fs` | Unity Catalog Volumes operations |
| `databricks clusters` | Cluster management |
| `databricks jobs` | Job management |

## Security

### Data Isolation

#### Row-Level Security (RLS)

The database uses PostgreSQL RLS to restrict users to accessing only their own data:

- **Sessions**: Can only view own sessions
- **Tokens**: Can only manage own tokens
- **Settings**: Can only modify own settings

#### File System Isolation

- Each user's files are isolated under `${USER_BASE_DIR}/${userId}`
- Validation implemented to prevent path traversal attacks
- Session deletion only removes the corresponding directory

### Token Protection

#### Encryption

Sensitive tokens like PAT are encrypted with AES-256-GCM:

- **Algorithm**: AES-256-GCM (authenticated encryption)
- **Key length**: 256 bits (64 hexadecimal characters)
- **IV**: Randomly generated for each encryption

#### Display Masking

When displaying tokens in the UI, they are partially masked:

```
dapi****xyz  (only first 4 + last 3 characters shown)
```

### Input Validation

#### Skill Names

- Allowed characters: `a-z`, `A-Z`, `0-9`, `-`, `_`
- Path separators (`/`, `\`) are prohibited
- `.` and `..` are prohibited

#### Git URLs

- Only URLs starting with `https://` or `git@` are allowed
- Branch name validation

### Session Security

- Session IDs are in TypeID format (UUIDv7-based)
- Independent working directory per session
- Cannot access other users' sessions

## Related Resources

- [Local Development Guide](./development.md) - Development environment setup
- [Deployment Guide](./deployment.md) - Deploying to Databricks Apps
