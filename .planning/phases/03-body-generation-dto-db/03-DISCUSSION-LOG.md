# Phase 3: Body Generation (DTO + DB) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-05
**Phase:** 03-body-generation-dto-db
**Areas discussed:** DTO Body Generation UX

---

## DTO Body Generation UX

### 1. Trigger mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Generate button in body editor | Button appears in body editor toolbar when DTO detected. Body mode auto-switches to raw-JSON. | ✓ |
| Auto-fill on endpoint open | Body auto-generated when user clicks detected endpoint in sidebar. | |
| Context menu action | Right-click endpoint → "Generate Body from DTO". | |

**User's choice:** Generate button in body editor (Recommended)
**Notes:** Replicates Postman's "Generate from example" pattern.

### 2. Overwrite vs preview

| Option | Description | Selected |
|--------|-------------|----------|
| Replace current body | Generated JSON overwrites body editor. Dirty indicator on, Ctrl+Z to undo. | ✓ |
| Open in new request tab | Generated body goes to new tab, original untouched. | |
| Show preview diff first | Side-by-side diff with Apply/Discard buttons. | |

**User's choice:** Replace current body (Recommended)

### 3. Multiple DTOs (polymorphism)

| Option | Description | Selected |
|--------|-------------|----------|
| Dropdown to pick concrete type | Tiny dropdown next to Generate with subtype names. Defaults to first. | ✓ |
| Generate for declared type only | Only the @RequestBody declared type; warning if abstract. | |
| Generate union/wrapper | Wrapper JSON with @type discriminator and all subtypes. | |

**User's choice:** Dropdown to pick concrete type (Recommended)

### 4. Java records and Lombok constructor types

| Option | Description | Selected |
|--------|-------------|----------|
| Trace constructor params | Walk all-args constructor/@AllArgsConstructor, map param names to JSON fields. | ✓ |
| Show a visual marker | Record badge/icon on constructor-mapped fields. | |
| Include both approaches | Constructor tracing + subtle readonly indicator. | |

**User's choice:** Trace constructor params (Recommended)

### 5. Placeholder values

| Option | Description | Selected |
|--------|-------------|----------|
| Type-indicative values | String→`"<string>"`, number→`"<number>"`, boolean→`"<boolean>"`. Angle brackets = obvious placeholder. | ✓ |

**User's choice:** Type-indicative values (Recommended)

### 6. Enum fields

| Option | Description | Selected |
|--------|-------------|----------|
| First value + JSON comment | First enum constant as value, comment lists all valid values. | ✓ |
| Pick first enum value only | Simple first value, no hint. | |
| Type-annotated placeholder | `"<enum: Status>"` — user replaces with actual value. | |

**User's choice:** Show all values as a JSON comment (Recommended)

### 7. Optional<T> fields

| Option | Description | Selected |
|--------|-------------|----------|
| Include with type placeholder | Optional fields appear with type placeholder. Not omitted, not null. | ✓ |
| Set to null | Optional fields default to null. | |
| Omit Optional fields | Only required fields appear. | |

**User's choice:** Include with type placeholder (Recommended)

### 8. Collections (List/Set/Map)

| Option | Description | Selected |
|--------|-------------|----------|
| One sample element | Single example item showing type + array structure. | ✓ |
| Empty collection | `[]` — clean but hides item type. | |
| Two sample elements | Two items, clearer but more clutter. | |

**User's choice:** One sample element (Recommended)

---

## the agent's Discretion

The following gray areas were identified but not discussed — deferred to the planner/researcher:

- DB connection management UX (where connections are managed, how linked to requests)
- Column→field mapping editor design (table layout, auto-map behavior, coverage badge visualization)
- DB connection lifecycle (open/close strategy, pool persistence)
- Helper-offline degraded mode for body generation UI
- Row picker UX (id/WHERE/first-N presentation)
- Per-driver JDBC type normalization scope
