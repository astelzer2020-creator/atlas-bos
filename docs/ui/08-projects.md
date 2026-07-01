---
title: Projects Module — UI Specification
document_id: ATLAS-UI-08
version: 1.0.0
status: draft
phase: 4
last_updated: 2026-06-30
module: projects
related_documents:
  - ATLAS-DB-09
  - ATLAS-ARCH-08
  - ATLAS-UI-00
tags:
  - ui
  - projects
  - tasks
  - kanban
  - gantt
  - wireframes
---

# Projects Module — UI Specification

## Purpose

Complete UI specification for the **Project Management** module: portfolio views, project workspaces, task execution surfaces (board, list, Gantt), sprint planning, time tracking, milestones, templates, and all associated modals. Aligns with `projects` schema (DB-09) and RBAC model (ARCH-08).

## Screen ID Convention

```
UI-PROJ-{NNN}       Screen / full-page view
UI-PROJ-MOD-{NNN}   Modal / drawer overlay
```

## Module Navigation

| Route | Screen ID | Label |
|-------|-----------|-------|
| `/projects` | UI-PROJ-001 | Projects |
| `/projects/new` | UI-PROJ-015 | New Project |
| `/projects/:projectId` | UI-PROJ-002 | Project Overview |
| `/projects/:projectId/tasks` | UI-PROJ-003 | Tasks |
| `/projects/:projectId/board` | UI-PROJ-007 | Board |
| `/projects/:projectId/list` | UI-PROJ-008 | List |
| `/projects/:projectId/gantt` | UI-PROJ-010 | Timeline (Gantt) |
| `/projects/:projectId/sprints` | UI-PROJ-011 | Sprints |
| `/projects/:projectId/time` | UI-PROJ-012 | Time |
| `/projects/:projectId/milestones` | UI-PROJ-013 | Milestones |
| `/projects/:projectId/files` | UI-PROJ-005 | Files |
| `/projects/:projectId/settings` | UI-PROJ-006 | Settings |
| `/projects/templates` | UI-PROJ-014 | Templates |

### App Shell Integration

- **Primary nav:** Projects icon in left sidebar (position 6 after CRM, Finance).
- **Breadcrumbs:** `Projects` → `{Project name}` → `{Tab}`.
- **AI panel:** Persistent right sidebar (UI-AI-002); context auto-includes current project/task when on project routes.
- **Quick actions (global):** `+ Task` (if single active project in session), `Log time` (opens UI-PROJ-MOD-004).

---

## Permissions Matrix

| Permission | UI Effect |
|------------|-----------|
| `projects:projects:read` | View project list and non-private projects where member or org visibility |
| `projects:projects:write` | Create/edit projects, wizard, settings (non-destructive) |
| `projects:projects:delete` | Archive project (UI-PROJ-MOD-005) |
| `projects:projects:manage` | Full settings, member roles, visibility, budget |
| `projects:tasks:read` | View tasks, board, list, Gantt, drawer (read-only) |
| `projects:tasks:write` | Create/edit tasks, drag on board, dependencies |
| `projects:tasks:assign` | Assign members, change assignee |
| `projects:tasks:delete` | Delete/archive tasks |
| `projects:time:read` | View time entries and reports |
| `projects:time:write` | Log and edit own time |
| `projects:time:approve` | Approve/reject submitted time |
| `projects:sprints:manage` | Create sprints, move tasks between sprints |
| `projects:templates:read` | View templates gallery |
| `projects:templates:write` | Create/edit templates |
| Resource grant `projects:{id}:manage` | Override project-scoped restrictions for that project |

**Project member roles** (in addition to org RBAC): `owner`, `manager`, `member`, `viewer`, `client` — see per-screen notes.

**Default deny:** Buttons hidden (not disabled-with-tooltip) when permission missing unless `viewer` role shows read-only affordances with lock icon.

---

## Responsive Breakpoints

| Token | Range | Layout |
|-------|-------|--------|
| `xs` | 0–479px | Single column; bottom tab bar for project sub-nav |
| `sm` | 480–767px | Single column; collapsible filters |
| `md` | 768–1023px | Two-column where applicable; drawer overlays |
| `lg` | 1024–1439px | Full desktop layout; optional AI panel |
| `xl` | 1440px+ | Max content width 1440px; Gantt uses full width |

---

## UI-PROJ-001 — Project List

**Route:** `/projects`  
**Permissions:** `projects:projects:read`

### Wireframe — Desktop (Grid View)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [≡] Atlas    Projects                                    [🔍] [Filter▾] [+ New]│
├──────────────────────────────────────────────────────────────────────────────┤
│ Projects                                                                     │
│ ┌─────────┐ ┌─────────┐  Status: [All▾] Priority: [All▾] Owner: [Me▾]       │
│ │ Grid ◉  │ │ List ○  │  Workspace: [All▾]                    Sort: [Updated▾]│
│ └─────────┘ └─────────┘                                                      │
├──────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐              │
│ │ PRJ-1042         │ │ PRJ-1038         │ │ PRJ-1031         │              │
│ │ Website Redesign │ │ Q3 Onboarding    │ │ API Migration    │              │
│ │ ● Active  High   │ │ ● Planning Med   │ │ ● On Hold  Crit  │              │
│ │ ████████░░ 78%   │ │ ███░░░░░░░ 32%   │ │ ██░░░░░░░░ 18%   │              │
│ │ 👤👤👤 +2  Due 8/1│ │ 👤👤 Due 9/15    │ │ 👤👤👤👤 Due —   │              │
│ └──────────────────┘ └──────────────────┘ └──────────────────┘              │
│ ┌──────────────────┐ ┌──────────────────┐                                    │
│ │ ...              │ │ ...              │                                    │
│ └──────────────────┘ └──────────────────┘                                    │
├──────────────────────────────────────────────────────────────────────────────┤
│ Showing 24 of 156 projects                              [◀ 1 2 3 ... 7 ▶]   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Wireframe — List View

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Code      │ Name              │ Status   │ Priority │ Progress │ Owner │ Due  │
├───────────┼───────────────────┼──────────┼──────────┼──────────┼───────┼──────┤
│ PRJ-1042  │ Website Redesign  │ Active   │ High     │ 78%      │ Alice │ 8/1  │
│ PRJ-1038  │ Q3 Onboarding     │ Planning │ Medium   │ 32%      │ Bob   │ 9/15 │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Components

| Component | Behavior |
|-----------|----------|
| View toggle | Persists per user (`localStorage` + user preference API) |
| Project card | Click → UI-PROJ-002; context menu: Open, Pin, Archive (if permitted) |
| `+ New` | Navigates to UI-PROJ-015 |
| Filters | Status, priority, owner, workspace, date range, tag |
| Search | Full-text on name, code, description (OpenSearch) |

### States

| State | Treatment |
|-------|-----------|
| Empty | Illustration + "No projects yet" + CTA `Create project` |
| Loading | Skeleton cards (6) |
| Error | Inline banner + Retry |
| No permission | Redirect to `/home` with toast |

### Responsive

| Breakpoint | Behavior |
|------------|----------|
| xs–sm | Grid only (1 column); list view hidden; filters in bottom sheet |
| md | Grid 2 columns |
| lg+ | Grid 3–4 columns; list view available |

---

## UI-PROJ-002 — Project Detail (Overview Tab)

**Route:** `/projects/:projectId`  
**Permissions:** `projects:projects:read` + project membership or org visibility

### Sub-Navigation Tabs

`Overview` | `Tasks` | `Board` | `List` | `Timeline` | `Sprints` | `Time` | `Milestones` | `Files` | `Settings`

### Wireframe — Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ← Projects / Website Redesign (PRJ-1042)          [Log time] [⋮ Archive]     │
├──────────────────────────────────────────────────────────────────────────────┤
│ [Overview] Tasks Board List Timeline Sprints Time Milestones Files Settings  │
├──────────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────┐ ┌──────────────────────────────────────────┐ │
│ │ Status: ● Active            │ │ Team                          [+ Assign] │ │
│ │ Priority: High              │ │ 👤 Alice (Owner)  👤 Bob (Manager)       │ │
│ │ Start: Jun 1  Due: Aug 1    │ │ 👤 Carol (Member) 👤 + Invite            │ │
│ │ Budget: 400h / 320h used    │ └──────────────────────────────────────────┘ │
│ │ Progress: ████████░░ 78%    │ ┌──────────────────────────────────────────┐ │
│ └─────────────────────────────┘ │ Recent Activity                          │ │
│ ┌─────────────────────────────┐ │ • Bob completed "Homepage mockups"       │ │
│ │ Milestones (next 3)    [All]│ │ • Alice commented on PRJ-1042-T-88         │ │
│ │ ○ Beta launch — Jul 15      │ └──────────────────────────────────────────┘ │
│ │ ○ UAT complete — Jul 22     │ ┌──────────────────────────────────────────┐ │
│ └─────────────────────────────┘ │ Linked: [CRM Deal #4421] [Order #881]    │ │
│                                 └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Actions

| Button | Permission | Result |
|--------|------------|--------|
| `+ Assign` | `projects:projects:manage` | UI-PROJ-MOD-002 |
| `Log time` | `projects:time:write` | UI-PROJ-MOD-004 |
| `⋮ Archive` | `projects:projects:delete` | UI-PROJ-MOD-005 |

### Responsive

| Breakpoint | Behavior |
|------------|----------|
| xs–sm | Tabs → horizontal scroll or "More" dropdown; widgets stack vertically |
| md+ | Two-column overview layout |

---

## UI-PROJ-003 — Project Detail (Tasks Tab)

**Route:** `/projects/:projectId/tasks`  
**Permissions:** `projects:tasks:read`

Aggregated task tree view (hierarchical). Links to board/list/Gantt via sub-views.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [+ Create task]     Filter: [Status▾] [Assignee▾] [Sprint▾]    [Board][List] │
├──────────────────────────────────────────────────────────────────────────────┤
│ ▼ Epic: Homepage Redesign                                                    │
│   ├─ ● In Progress  T-88  Hero section           Alice    Due Jul 5         │
│   ├─ ○ To Do        T-89  Footer redesign        —        Due Jul 8         │
│   └─ ✓ Done         T-90  Wireframes             Bob      Completed         │
│ ▼ Epic: Backend API                                                          │
│   └─ ...                                                                     │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## UI-PROJ-004 — Project Detail (Timeline Tab)

**Route:** `/projects/:projectId/timeline` (alias for activity + milestone timeline, distinct from Gantt)

Chronological feed: status changes, milestone completions, sprint boundaries, dependency resolutions.

---

## UI-PROJ-005 — Project Detail (Files Tab)

**Route:** `/projects/:projectId/files`  
**Permissions:** `projects:projects:read`; upload requires `documents:files:write`

Integrates Documents module. Folder tree, drag-drop upload, link existing document.

---

## UI-PROJ-006 — Project Detail (Settings Tab)

**Route:** `/projects/:projectId/settings`  
**Permissions:** `projects:projects:manage`

Sections: General, Members & Roles, Workflows, Integrations, Danger Zone (archive/delete).

| Field | Validation |
|-------|------------|
| Code | Unique per org; uppercase alphanumeric + hyphen |
| Visibility | `private` \| `team` \| `organization` |
| Budget hours/amount | Numeric; currency from org default |

---

## UI-PROJ-007 — Task Board (Kanban)

**Route:** `/projects/:projectId/board`  
**Permissions:** `projects:tasks:read`; drag requires `projects:tasks:write`

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Board: [Default workflow▾]  Group: [Status▾]  [+ Add column] (admin only)   │
├──────────────┬──────────────┬──────────────┬──────────────┬──────────────────┤
│ To Do (12)   │ In Progress  │ In Review    │ Done (45)    │ +                │
│              │ (5)          │ (3)          │              │                  │
│ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐ │ ┌──────────┐ │                  │
│ │ T-88     │ │ │ T-91     │ │ │ T-85     │ │ │ T-80     │ │                  │
│ │ Hero     │ │ │ API auth │ │ │ QA pass  │ │ │ Setup    │ │                  │
│ │ 🔴 Jul 5 │ │ │ 🟡 Jul 9 │ │ │ 👤 Carol │ │ │ ✓        │ │                  │
│ │ 👤 Alice │ │ │ 👤 Bob   │ │ └──────────┘ │ └──────────┘ │                  │
│ └──────────┘ │ └──────────┘ │              │              │                  │
│ [+ Task]     │              │              │              │                  │
└──────────────┴──────────────┴──────────────┴──────────────┴──────────────────┘
```

### Interactions

| Action | Behavior |
|--------|----------|
| Card click | Opens UI-PROJ-009 drawer |
| Drag card | Optimistic move; PATCH status/column; toast on conflict (version mismatch) |
| `+ Task` | UI-PROJ-MOD-001 with preset column status |
| Swimlanes | Optional group by assignee, priority, epic (lg+ only) |

### Responsive

| Breakpoint | Behavior |
|------------|----------|
| xs–sm | Single column swipe carousel between statuses; no drag between columns (use status picker in drawer) |
| md | Horizontal scroll columns |
| lg+ | Full kanban with drag-drop |

---

## UI-PROJ-008 — Task List

**Route:** `/projects/:projectId/list`  
**Permissions:** `projects:tasks:read`

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [☐ Select all]  Bulk: [Status▾] [Assign▾] [Delete]        [+ Create task]  │
├────┬────────┬─────────────────────┬──────────┬─────────┬──────┬──────────────┤
│ ☐  │ T-88   │ Hero section        │ Progress │ Alice   │ Jul 5│ High         │
│ ☐  │ T-89   │ Footer redesign     │ To Do    │ —       │ Jul 8│ Medium       │
└────┴────────┴─────────────────────┴──────────┴─────────┴──────┴──────────────┘
```

- Inline edit for title, status, assignee (permission-gated).
- Column chooser persisted per user.
- Export CSV: `projects:tasks:read`.

---

## UI-PROJ-009 — Task Detail Drawer

**Trigger:** Click task card/row anywhere in project  
**Permissions:** `projects:tasks:read`

### Wireframe

```
                                    ┌─────────────────────────────────────┐
                                    │ T-88 — Hero section            [×]  │
                                    ├─────────────────────────────────────┤
                                    │ Status: [In Progress▾]  Priority: H │
                                    │ Assignee: [Alice▾]      Due: Jul 5  │
                                    │ Sprint: [Sprint 14▾]    Epic: [▾]   │
                                    ├─────────────────────────────────────┤
                                    │ Description                         │
                                    │ ┌─────────────────────────────────┐ │
                                    │ │ Rich text editor                │ │
                                    │ └─────────────────────────────────┘ │
                                    ├─────────────────────────────────────┤
                                    │ Dependencies  [+ Add]               │
                                    │ ← Blocked by T-85 (Done)            │
                                    │ → Blocks T-92                       │
                                    ├─────────────────────────────────────┤
                                    │ Subtasks (2/5)                      │
                                    │ Comments │ Activity │ Time (4.5h)  │
                                    └─────────────────────────────────────┘
```

### Drawer Behavior

| Breakpoint | Width | Mode |
|------------|-------|------|
| xl | 480px | Right overlay; main content dims |
| md–lg | 400px | Right overlay |
| xs–sm | 100vw | Full-screen sheet with back affordance |

`Set dependency` → UI-PROJ-MOD-003.

---

## UI-PROJ-010 — Gantt Chart

**Route:** `/projects/:projectId/gantt`  
**Permissions:** `projects:tasks:read`; drag bars requires `projects:tasks:write`

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Zoom: [Day][Week◉][Month]  Show: [☑ Dependencies][☑ Milestones][☑ Today]    │
├────────────────────┬─────────────────────────────────────────────────────────┤
│ Task               │ Jun          Jul          Aug                           │
├────────────────────┼─────────────────────────────────────────────────────────┤
│ ▼ Epic: Homepage   │                                                         │
│   T-88 Hero        │     ████████                                            │
│   T-89 Footer      │              ██████                                     │
│ ◆ Beta launch      │                    ♦                                    │
└────────────────────┴─────────────────────────────────────────────────────────┘
```

- Dependency lines with cycle prevention (BR-PM-03).
- Critical path highlight (calculated server-side).
- xs–sm: Gantt hidden; show "Open on desktop" + link to task list with date columns.

---

## UI-PROJ-011 — Sprint Planning

**Route:** `/projects/:projectId/sprints`  
**Permissions:** `projects:sprints:manage` (write); read with `projects:tasks:read`

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Sprint: [Sprint 14 ▾]  Jul 1 – Jul 14   [Start sprint] [Complete sprint]   │
├──────────────────────────────┬───────────────────────────────────────────────┤
│ Backlog (23)                 │ Sprint 14 (8) — 34 / 40 pts                   │
│ ┌──────────────────────────┐ │ ┌───────────────────────────────────────────┐ │
│ │ T-95  5pts  [Add →]      │ │ │ T-88  8pts  Alice                         │ │
│ │ T-96  3pts  [Add →]      │ │ │ T-91  5pts  Bob                           │ │
│ └──────────────────────────┘ │ └───────────────────────────────────────────┘ │
│ Velocity chart (last 6)      │ Burndown chart                                │
└──────────────────────────────┴───────────────────────────────────────────────┘
```

---

## UI-PROJ-012 — Time Tracking

**Route:** `/projects/:projectId/time`  
**Permissions:** `projects:time:read`

### Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [Log time]  View: [Timesheet◉][By task][By member]   Week: [◀ Jun 24–30 ▶]  │
├──────────────────────────────────────────────────────────────────────────────┤
│ Member   │ Mon │ Tue │ Wed │ Thu │ Fri │ Total │ Billable │ Status          │
│ Alice    │ 6h  │ 8h  │ 4h  │ —   │ 2h  │ 20h   │ 18h      │ Submitted       │
│ Bob      │ 4h  │ 4h  │ 4h  │ 4h  │ 4h  │ 20h   │ 20h      │ Approved        │
├──────────────────────────────────────────────────────────────────────────────┤
│ Project total: 320h / 400h budget                                            │
└──────────────────────────────────────────────────────────────────────────────┘
```

Approve/reject: `projects:time:approve`.

---

## UI-PROJ-013 — Milestones

**Route:** `/projects/:projectId/milestones`  
**Permissions:** `projects:tasks:read`; write requires `projects:tasks:write`

Timeline list + calendar mini-view. Link tasks to milestones. Status: `pending`, `at_risk`, `completed`, `missed`.

---

## UI-PROJ-014 — Templates

**Route:** `/projects/templates`  
**Permissions:** `projects:templates:read`

Gallery of org and platform templates. Preview structure (epics, default tasks, durations). `Use template` → UI-PROJ-015 pre-filled.

---

## UI-PROJ-015 — Create Project Wizard

**Route:** `/projects/new`  
**Permissions:** `projects:projects:write`

### Steps

| Step | Title | Fields |
|------|-------|--------|
| 1 | Basics | Name*, Code (auto-suggest), Description, Workspace |
| 2 | Plan | Template (optional), Start/End dates, Priority, Visibility |
| 3 | Team | Member picker, roles, allocation % |
| 4 | Budget | Hours, amount, currency (optional) |
| 5 | Review | Summary + `Create project` |

### Wireframe — Step 1

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Create project                                    Step 1 of 5  ●○○○○         │
├──────────────────────────────────────────────────────────────────────────────┤
│ Project name *                                                               │
│ [________________________________________________]                           │
│ Project code *              Workspace                                          │
│ [PRJ-________]              [Default workspace ▾]                            │
│ Description                                                                  │
│ [                                                                            ]│
├──────────────────────────────────────────────────────────────────────────────┤
│                                    [Cancel]              [Next →]            │
└──────────────────────────────────────────────────────────────────────────────┘
```

- Cancel → confirm dialog if any field touched.
- Success → redirect to UI-PROJ-002 with toast.

### Responsive

Full-screen stepper on xs–sm; modal-style centered card on md+ (max-width 640px).

---

## Modals

### UI-PROJ-MOD-001 — Create Task

**Trigger:** `+ Create task`, `+ Task` on board, keyboard `T` (when project context active)  
**Permissions:** `projects:tasks:write`

```
┌─────────────────────────────────────────┐
│ Create task                        [×]  │
├─────────────────────────────────────────┤
│ Title *                                 │
│ [_________________________________]     │
│ Project: Website Redesign (locked)      │
│ Status: [To Do ▾]   Priority: [Med ▾]   │
│ Assignee: [Unassigned ▾]  Due: [date]   │
│ Parent task: [None ▾]   Sprint: [▾]     │
│ Description (optional)                  │
│ [ ] Create another                      │
├─────────────────────────────────────────┤
│ [Cancel]              [Create task]     │
└─────────────────────────────────────────┘
```

Validation: title 1–500 chars; due date ≥ project start if set.

---

### UI-PROJ-MOD-002 — Assign Members

**Trigger:** Overview team `+ Assign`, Settings → Members  
**Permissions:** `projects:projects:manage`

- User search (org members + invite by email if `admin:members:invite`).
- Role per member: owner, manager, member, viewer, client.
- Allocation % and hourly rate (optional, finance integration).
- Cannot remove sole owner without transfer.

---

### UI-PROJ-MOD-003 — Set Dependency

**Trigger:** Task drawer → Dependencies → `+ Add`  
**Permissions:** `projects:tasks:write`

```
┌─────────────────────────────────────────┐
│ Add dependency                     [×]  │
├─────────────────────────────────────────┤
│ This task: T-88 Hero section            │
│ Type: [Finish-to-Start ▾]               │
│ Predecessor: [Search tasks... ▾]        │
│ Lag: [0] days                           │
│ ⚠ Cycle check runs on save              │
├─────────────────────────────────────────┤
│ [Cancel]              [Add dependency]  │
└─────────────────────────────────────────┘
```

Error: circular dependency → inline message, save disabled.

---

### UI-PROJ-MOD-004 — Log Time

**Trigger:** `Log time` buttons, task drawer Time tab  
**Permissions:** `projects:time:write`

Fields: Project*, Task (optional), Date*, Hours*, Billable toggle, Notes, Tags. Timer mode: Start/Stop (lg+ desktop).

---

### UI-PROJ-MOD-005 — Archive Project

**Trigger:** Project overview `⋮` → Archive, Settings → Danger Zone  
**Permissions:** `projects:projects:delete`

- Confirmation: type project code to confirm.
- Checkbox: "Notify all members."
- Archived projects hidden from default list; filter `Status: Archived` to view.
- Restore: `projects:projects:manage` within 90 days.

---

## Cross-Cutting Requirements

### Accessibility (WCAG 2.2 AA)

- All task status changes available via keyboard (not drag-only).
- Board columns: `aria-dropeffect` + live region announcements on move.
- Gantt: tabular alternative view linked prominently.
- Color-blind safe status chips (icon + label).

### Localization

- Dates/times: user locale; week start from org setting.
- Duration: `4.5h` vs `4h 30m` per locale preference.

### Performance

- Virtualized lists > 100 tasks.
- Board columns lazy-load cards (50 per column initial).
- Gantt fetches visible date range ± 2 weeks.

### Real-Time

- SSE channel `project:{id}` for task moves, comments (presence indicators on md+).

---

## Screen Index

| ID | Name |
|----|------|
| UI-PROJ-001 | Project List |
| UI-PROJ-002 | Project Detail — Overview |
| UI-PROJ-003 | Project Detail — Tasks |
| UI-PROJ-004 | Project Detail — Timeline |
| UI-PROJ-005 | Project Detail — Files |
| UI-PROJ-006 | Project Detail — Settings |
| UI-PROJ-007 | Task Board (Kanban) |
| UI-PROJ-008 | Task List |
| UI-PROJ-009 | Task Detail Drawer |
| UI-PROJ-010 | Gantt Chart |
| UI-PROJ-011 | Sprint Planning |
| UI-PROJ-012 | Time Tracking |
| UI-PROJ-013 | Milestones |
| UI-PROJ-014 | Templates |
| UI-PROJ-015 | Create Project Wizard |
| UI-PROJ-MOD-001 | Create Task |
| UI-PROJ-MOD-002 | Assign Members |
| UI-PROJ-MOD-003 | Set Dependency |
| UI-PROJ-MOD-004 | Log Time |
| UI-PROJ-MOD-005 | Archive Project |