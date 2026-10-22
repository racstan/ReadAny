---
draft: false
title: WebDAV Sync
description: Sync reading progress and annotations across devices.
---

## Overview

ReadAny supports syncing your reading progress and annotations across multiple devices via WebDAV. This works with any WebDAV-compatible cloud storage service.

## Compatible Services

- **Nextcloud** — Self-hosted cloud storage
- **ownCloud** — Open-source file sync and share
- **Box** — Cloud storage with WebDAV support
- **Any standard WebDAV server** — Including self-hosted solutions

## Setup

1. Go to **Settings → Sync**
2. Enter your WebDAV server URL (e.g., `https://your-server.com/dav/`)
3. Enter your username and password (or app-specific password)
4. Click **Test Connection** to verify
5. Enable sync

## What Gets Synced

- Reading progress (current position for each book)
- Annotations (highlights and notes)
- Book metadata

Books files themselves are **not** synced — you need to have the book file on each device.

## Conflict Resolution

When the same book is read on multiple devices, ReadAny uses the most recent change. If annotations conflict, both versions are preserved.
