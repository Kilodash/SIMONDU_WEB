---
id: perdamaian-module
title: "Perdamaian (peace settlement) workflow module"
category: decision
status: active
created: "2026-07-04T19:08:11"
updated: "2026-07-04T19:08:52"
---

## compiled_truth

## What was decided

Added a **Perdamaian** (peace settlement) workflow module as a case outcome path. This allows cases to be resolved through mutual agreement between the complainant and the reported officer, following formal police procedure.

## How it works

The Perdamaian flow is triggered from the Case Detail Sheet via a dialog with three categories of requirements:

### 1. Syarat Material (Material Requirements)
- No public unrest or rejection from the community
- No social conflict impact
- Statement of non-objection from all involved parties
- Meets Prinsip Pembatas criteria

### 2. Prinsip Pembatas (Limiting Principles)
- Offender's fault level is not severe (considers intent and purpose / Mensrea)
- Offender is not a repeat violator of discipline/ethics code; commander deems peace settlement appropriate

### 3. Syarat Formil (Formal Requirements)
- Peace request letter from both parties
- Peace statement letter from both parties
- Complaint withdrawal letter on stamped paper by complainant
- Supplementary examination report for both parties

## Implementation

- All 10 checkboxes must be checked before submission (all-or-nothing gate)
- UI enforces via \llPerdamaianChecked\ boolean derived from \perdamaianChecks\ state object
- Document upload support for peace settlement documents (uploads via same document pipeline)
- On submission: updates case outcome to \perdamaian\ settlement, triggers background sync to Gajamada

## Rationale

- Perdamaian is a recognized settlement path in Indonesian police internal affairs procedure
- The checklist enforces procedural compliance ? prevents premature/official peace settlements
- Separating it from the main checklist engine keeps the SOP checklist focused on investigation documents

## Related

- [[sop-checklist-engine]]
- [[gajamada-source-of-truth]]


## timeline

- time: 2026-07-04T19:08:11
  kind: decision
  summary: "Created this page: Perdamaian (peace settlement) workflow module"
  source: git log
  affects: [perdamaian-module]

- time: 2026-07-04T19:08:52
  kind: decision
  summary: Initial capture from git log and code analysis
  source: "git log + code analysis"
  affects: [perdamaian-module]
