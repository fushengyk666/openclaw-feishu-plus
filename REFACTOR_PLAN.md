# REFACTOR_PLAN.md

## Goal

Refactor `openclaw-feishu-plus` into a focused enhancement layer for the official OpenClaw Feishu extension.

Principles:
- Keep the official Feishu plugin as the foundation.
- Do not fork or modify the official plugin directly.
- Implement only additive capabilities, especially where official coverage is missing or insufficient.
- Prioritize **Calendar** and **Cloud Docs enhancements**.
- Package after each iteration.

---

## Current Assessment

### Official OpenClaw Feishu plugin already covers
- `feishu_doc`
- `feishu_drive`
- `feishu_wiki`
- `feishu_perm`
- `feishu_bitable_*`

The official plugin already has strong docx/drive/wiki/perm/bitable foundations, so `feishu-plus` should **not** reimplement all of them.

### `feishu-plus` should focus on
1. **Calendar** as a first-class enhancement module
2. **Docs-related advanced capabilities** not cleanly covered by official tools
3. **Bitable advanced/batch operations**
4. **Diagnostics and compatibility helpers**

---

## Scope Strategy

### Layer 1: Official plugin (keep as-is)
Use official tools for:
- basic docx operations
- drive file operations
- wiki navigation
- basic permission management
- basic bitable CRUD

### Layer 2: feishu-plus (enhancement layer)
Build and maintain by **domain** instead of flat capability buckets:
- `calendar/`
- `docs/`
- `bitable/`

Permission capabilities should live under their resource domains instead of remaining a long-term top-level product module.

---

## Refactor Phases

## Phase 1 — Core cleanup
Target: stabilize plugin architecture.

Tasks:
- Introduce shared core utilities
- Normalize client creation and account routing
- Normalize result formatting
- Normalize error mapping
- Clarify tool/module boundaries

Planned structure:

```text
src/
  core/
    client.js
    errors.js
    result.js
  domains/
    calendar/
    docs/
    bitable/
  tools/
```

---

## Phase 2 — Calendar first
Target: make calendar the strongest part of the plugin.

Planned capabilities:
- list calendars
- get calendar
- create calendar (if needed by API scope)
- list events
- get event
- create event
- update event
- delete event
- list ACLs
- create ACL
- delete ACL
- later: attendees / reminders / recurrence / pagination / filtering / timezone helpers

Reason:
- official plugin does not currently cover calendar tools
- clear product value
- low overlap risk

---

## Phase 3 — Cloud Docs enhancement layer
Target: enhance, not replace, official docs tools.

Planned directions:
- advanced doc block helpers
- batch/structured patch helpers
- permission diagnostics
- cross-resource helpers (doc/drive/wiki)
- selective advanced bitable actions

Not planned:
- full duplicate reimplementation of official doc/drive/wiki tools

---

## Phase 4 — Diagnostics and polish
Target: reduce support/debug cost.

Planned capabilities:
- scope diagnostics
- token/config diagnostics
- object/token type validation helpers
- better error messages for common Feishu API failures
- README and capability matrix

---

## Packaging Strategy

Each iteration should produce:
1. code changes
2. version bump
3. package build artifact / publish-ready state
4. concise changelog summary

Publish target:
- GitHub Packages (`npm.pkg.github.com`)

---

## Immediate Next Tasks

1. Refactor repository structure without breaking current behavior
2. Extract shared core helpers
3. Reorganize calendar into modular structure
4. Preserve existing external tool names where reasonable
5. Prepare first packaged iteration

---

## Notes

Working rule going forward:
- For Feishu-related design or capability questions, check official Feishu Open Platform docs first, then verify against official OpenClaw Feishu extension code.
