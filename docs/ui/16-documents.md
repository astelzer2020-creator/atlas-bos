---
title: Documents & Storage UI Specification
document_id: ATLAS-UI-16
version: 1.0.0
status: approved
phase: 4
last_updated: 2026-06-30
module: documents
related_documents:
  - ATLAS-DB-18
  - ATLAS-ARCH-09
  - ATLAS-UI-19
  - ATLAS-UI-18
  - ATLAS-UI-20
tags:
  - documents
  - storage
  - files
  - sharing
  - versions
---

# Documents & Storage UI Specification

## Document Control

| Field | Value |
|-------|-------|
| **Module** | Documents & Storage |
| **Screen count** | 5 screens, 6 modals, 2 panels |
| **Primary personas** | P3 (Employee), P1 (Owner), P4 (Accountant) |
| **Route prefix** | `/documents`, entity-attached file panels |
| **Storage backend** | S3-compatible object storage |

---

## 1. Purpose & Scope

Define file management UI: browser (tree + grid), preview, upload, sharing, version history, trash/recovery, and storage quota indicators. Applies to standalone Documents module and embedded file panels across CRM, Finance, Projects, etc.

### In Scope

- Folder hierarchy navigation
- Multi-file upload with drag-drop
- Permission-aware sharing
- Version history and restore
- Trash with 30-day retention
- Quota visualization

### Out of Scope

- Real-time collaborative editing (Docs editor — separate module)
- E-discovery legal hold UI (enterprise v1.1)
- Client-side encryption

---

## 2. Navigation & Information Architecture

```
Documents (/documents)
├── Root (/documents)
├── Folder (/documents/folders/:folderId)
├── File Preview (/documents/files/:fileId)
├── Trash (/documents/trash)
└── Shared with me (/documents/shared)

Entity Attachments (embedded)
├── CRM Contact files panel
├── Project files panel
├── Invoice attachments
└── ... (polymorphic via file_attachments)
```

---

## 3. Screen Inventory

| ID | Screen | Route | Permission gate |
|----|--------|-------|-----------------|
| DC-S01 | File Browser | `/documents`, `/documents/folders/:id` | `storage:files:read` |
| DC-S02 | File Preview | `/documents/files/:fileId` | `storage:files:read` |
| DC-S03 | Upload Flow | Overlay on DC-S01 | `storage:files:write` |
| DC-S04 | Version History | Panel on DC-S02 | `storage:files:read` |
| DC-S05 | Trash / Recovery | `/documents/trash` | `storage:files:read` |

### Modals

| ID | Surface | Trigger |
|----|---------|---------|
| DC-M01 | Share | Share action |
| DC-M02 | Move | Move action |
| DC-M03 | Rename | Rename action (file or folder) |
| DC-M04 | Delete | Delete action |
| DC-M05 | Restore Version | Version history restore |
| DC-M06 | Create Folder | New folder action |

### Panels

| ID | Surface | Context |
|----|---------|---------|
| DC-P01 | Storage Quota Indicator | Shell sidebar + DC-S01 header |
| DC-P02 | Upload Progress Panel | Bottom dock during uploads |

---

## 4. Global Patterns

### 4.1 Storage Quota Indicator (DC-P01)

```
┌─────────────────────────────────────┐
│ Storage                              │
│ ████████░░░░░░░░  32.4 / 50 GB (65%)│
│ [Manage storage]                     │
└─────────────────────────────────────┘
```

| Threshold | Visual | Action |
|-----------|--------|--------|
| < 80% | Default blue progress | — |
| 80–95% | Amber progress + warning icon | Tooltip: "Consider upgrading" |
| ≥ 95% | Red progress | Banner on DC-S01; block upload at 100% |
| 100% | Full red | Upload disabled; upgrade CTA → BL-S01 |

Placement: Documents sidebar footer; Settings → Storage; shell compact meter for admins.

### 4.2 File Type Icons

| Category | Extensions | Icon treatment |
|----------|------------|----------------|
| Image | png, jpg, gif, webp, svg | Thumbnail if generated |
| Document | pdf, docx, xlsx, pptx | Branded file icon |
| Video | mp4, mov, webm | Thumbnail + play overlay |
| Audio | mp3, wav | Waveform placeholder |
| Archive | zip, tar | Archive icon |
| Code | js, ts, py, etc. | Monospace badge |
| Unknown | * | Generic document icon |

### 4.3 View Modes

| Mode | Default | Grid columns |
|------|---------|--------------|
| Grid | Desktop | 4–6 responsive |
| List | Mobile | Single column table |
| Tree + Grid | Desktop wide | Left tree 240px, right grid |

Persist view preference per user in `user_preferences`.

---

## 5. Screen Specifications

### DC-S01 — File Browser

**Routes:** `/documents`, `/documents/folders/:folderId`

#### Layout (Desktop)

```
┌──────────────────────────────────────────────────────────────────┐
│ Documents    [Upload ▼] [New folder] [🔍 Search]    [Grid|List]  │
├────────────┬─────────────────────────────────────────────────────┤
│ Folder Tree│ Breadcrumb: Documents / Projects / Q2 Reports     │
│ ─────────  ├─────────────────────────────────────────────────────┤
│ ▼ Documents│ ☐ Name          Modified    Size      Shared  ⋮     │
│   ▼ Projects│ ─────────────────────────────────────────────────  │
│     Q2     │ ☐ 📄 Report.pdf  Jun 28     2.4 MB   3 people      │
│   Finance  │ ☐ 📁 Archive     Jun 1      —        Private       │
│ Shared     │ ...                                               │
│ Trash      │                                                    │
├────────────┴─────────────────────────────────────────────────────┤
│ Storage: ████████░░ 32.4/50 GB                                   │
└──────────────────────────────────────────────────────────────────┘
```

#### Toolbar Actions

| Action | Shortcut | Permission |
|--------|----------|------------|
| Upload files | `U` | `storage:files:write` |
| Upload folder | — | `storage:files:write` |
| New folder | `N` | `storage:folders:write` |
| Download | `D` | `storage:files:read` |
| Share | `S` | `storage:files:share` |
| Move | `M` | `storage:files:write` |
| Delete | `Del` | `storage:files:delete` |

#### Selection Model

- Single click: select; double click: open folder or preview file
- `Ctrl/Cmd+click`: multi-select
- `Shift+click`: range select
- Bulk action bar appears when ≥1 selected

#### Search

- Scoped to current folder + subfolders (toggle: "Search everywhere")
- Filters: type, date modified, owner, shared status
- Results open in list view with path column

#### Drag & Drop

| Target | Behavior |
|--------|----------|
| Folder in tree | Move files (confirm if changing permissions) |
| Browser background | Upload to current folder |
| External → browser | Upload (DC-S03) |

#### Context Menu (Right-click)

Open, Download, Share, Rename, Move, Copy link, Delete, Properties.

---

### DC-S02 — File Preview

**Route:** `/documents/files/:fileId`

#### Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ ← Back    Report.pdf                    [Share] [Download] [⋮]  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│                    [Preview Renderer]                            │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│ Details │ Versions │ Activity                                      │
│ Size: 2.4 MB  Modified: Jun 28  Owner: Jane  Version: 3         │
└──────────────────────────────────────────────────────────────────┘
```

#### Preview Renderers

| Type | Renderer |
|------|----------|
| PDF | PDF.js viewer; page nav, zoom |
| Image | Pinch zoom, pan |
| Video/Audio | HTML5 player |
| Office | Office Online / LibreOffice WASM preview |
| Text/Code | Syntax-highlighted editor (read-only) |
| Unsupported | Icon + download CTA |

#### Preview States

| Status | UI |
|--------|-----|
| `scanning` | "Scanning for viruses..." spinner |
| `quarantined` | Red banner; admin-only access |
| `processing` | Preview generating skeleton |
| `ready` | Full preview |
| `error` | ES-DC-003 |

#### Tabs

| Tab | Content |
|-----|---------|
| Details | Metadata, checksum, linked entities |
| Versions | DC-S04 panel |
| Activity | Upload, share, download audit log |

---

### DC-S03 — Upload Flow

**Type:** Overlay panel + drag-drop zone (not separate route).

#### Upload Panel (DC-P02)

```
┌─────────────────────────────────────────────────────────────┐
│ Uploading 3 files to "Q2 Reports"                    [Minimize]│
├─────────────────────────────────────────────────────────────┤
│ report.pdf     ████████████░░░░  78%    2.4 MB   [Cancel]   │
│ data.xlsx      ██████████████████  Done ✓         [×]       │
│ image.png      Waiting...                                   │
├─────────────────────────────────────────────────────────────┤
│ 2 of 3 complete                          [Cancel all]       │
└─────────────────────────────────────────────────────────────┘
```

#### Drop Zone Overlay

- Full-browser overlay on drag enter
- Dashed border, "Drop files to upload to {folder}"
- Multi-file, folder upload via `webkitdirectory`

#### Upload Rules

| Rule | UI feedback |
|------|-------------|
| Max file size | 5 GB per file; error per file |
| Blocked extensions | `.exe`, `.bat`, etc. — inline error |
| Quota exceeded | Block queue; show upgrade CTA |
| Duplicate hash | Prompt: "File exists — replace or keep both" |

#### Post-Upload

- Toast: "3 files uploaded"
- Optional: "Share now" quick action
- Refresh file list; scroll to new files (highlight 3s)

---

### DC-S04 — Version History

**Type:** Panel (tab on DC-S02 or side drawer).

#### Version List

| Column | Notes |
|--------|-------|
| Version | v3, v2, v1 |
| Modified | Timestamp + user |
| Size | Bytes |
| Comment | Optional version note |
| Actions | Preview, Download, Restore |

- Current version badge
- Restore opens DC-M05
- Max 100 versions displayed; paginate older

---

### DC-S05 — Trash / Recovery

**Route:** `/documents/trash`

#### Table

| Column | Notes |
|--------|-------|
| Name | Original path shown in subtitle |
| Deleted | Timestamp |
| Deleted by | User |
| Expires | Auto-purge date (30 days) |
| Actions | Restore, Delete permanently |

#### Bulk Actions

- Restore selected
- Empty trash (admin only) — confirmation modal

#### Empty State

ES-DC-004: "Trash is empty"

---

## 6. Modal Specifications

### DC-M01 — Share

| Element | Spec |
|---------|------|
| Size | `lg` (720px) |
| Title | "Share {filename}" |
| Access level | Private / Organization / Specific people / Link |
| People picker | Autocomplete org members + teams |
| Permission level | View, Comment (docs only), Edit |
| Link sharing | Toggle + copy link; optional password (enterprise) |
| Expiry | Optional date picker for link |
| Footer | Effective permissions summary |
| Actions | Cancel, Save |

Inherited permissions from parent folder shown as read-only section.

---

### DC-M02 — Move

| Element | Spec |
|---------|------|
| Size | `md` |
| Body | Folder tree picker (single select) |
| Warning | If destination has name conflict |
| Actions | Cancel, Move here |

---

### DC-M03 — Rename

| Element | Spec |
|---------|------|
| Size | `sm` |
| Input | Current name pre-filled, extension locked for files |
| Validation | No `/\:*?"<>|` chars; max 255 |
| Actions | Cancel, Rename |

---

### DC-M04 — Delete

| Element | Spec |
|---------|------|
| Size | `sm` |
| Body | "Move to trash? Restorable for 30 days." |
| Folder delete | "Delete folder and all contents (N items)" |
| Actions | Cancel, Move to trash (destructive) |

---

### DC-M05 — Restore Version

| Element | Spec |
|---------|------|
| Size | `md` |
| Body | "Restore version 2? Current version 3 will be preserved in history." |
| Actions | Cancel, Restore |

---

### DC-M06 — Create Folder

| Element | Spec |
|---------|------|
| Size | `sm` |
| Input | Folder name |
| Location | Shows parent path (breadcrumb) |
| Actions | Cancel, Create |

---

## 7. Embedded File Panels (Cross-Module)

Used on CRM contacts, deals, projects, invoices, etc.

```
┌─────────────────────────────────────────┐
│ Files (4)                    [Upload]   │
├─────────────────────────────────────────┤
│ 📄 Contract.pdf    Jun 28    [⋮]       │
│ 📄 SOW.docx        Jun 15    [⋮]       │
│ [View all in Documents →]             │
└─────────────────────────────────────────┘
```

| Behavior | Spec |
|----------|------|
| Upload | Attaches via `file_attachments` polymorphic link |
| Permissions | Inherit entity ReBAC + explicit file grants |
| Max displayed | 5 files; "View all" → filtered DC-S01 |
| Empty | ES-DC-001 with upload CTA |

---

## 8. Permissions & Visibility

| Action | Permission | UI rule |
|--------|------------|---------|
| View files | `storage:files:read` | Hide Documents nav |
| Upload | `storage:files:write` | Hide upload buttons |
| Share | `storage:files:share` | Hide share action |
| Delete | `storage:files:delete` | Hide delete; trash read-only |
| Manage quotas | `admin:storage:manage` | Quota admin settings |

---

## 9. Responsive Behavior

| Breakpoint | Adaptation |
|------------|------------|
| Mobile | Tree → drawer; list view default; FAB upload |
| Tablet | Collapsible tree; 3-column grid |
| Desktop | Full tree + grid |

Touch: 44×44px action targets; long-press context menu.

---

## 10. Accessibility

| Requirement | Implementation |
|-------------|----------------|
| File list | `role="grid"` or table semantics |
| Keyboard | Arrow keys navigate; Enter opens |
| Upload drop zone | `aria-dropzone` |
| Progress | `aria-valuenow` on upload bars |
| Preview | Focus trap in fullscreen preview mode |

---

## 11. Telemetry Events

| Event | Properties |
|-------|------------|
| `documents.browser.viewed` | `folder_id`, `view_mode` |
| `documents.file.uploaded` | `file_type`, `size_bytes`, `duration_ms` |
| `documents.file.previewed` | `file_id`, `file_type` |
| `documents.file.shared` | `file_id`, `share_type` |
| `documents.file.deleted` | `file_id`, `permanent` |
| `documents.quota.warning` | `percent_used` |

---

## 12. Open Questions

| ID | Question | Owner |
|----|----------|-------|
| OQ-UI-16-01 | Office preview: Office Online vs WASM? | Engineering |
| OQ-UI-16-02 | Folder-level default permissions UI? | Product |
| OQ-UI-16-03 | Client-side upload resume for >1GB files? | v1.1 |