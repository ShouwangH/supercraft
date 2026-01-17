# SuperCraft Demo: Printability Report + Suggested Fixes Nodes (Node Graph)

## TL;DR
Build a Next.js + three.js demo that adds **two deterministic post-processing nodes** to a ComfyUI-styled node graph:

1) **Printability Report** node: analyze a 3D mesh and produce a structured report + viewer overlays.  
2) **Suggested Fixes** node: propose deterministic fix recipes (with explicit risk warnings) and optionally generate a **new** repaired mesh node.

This does **not** claim “manufacturing ready.” It demonstrates: **we identified a real product gap, made it measurable, and reduced workflow friction without overpromising.**

---

## Problem Statement
SuperCraft can generate/export 3D, but generated meshes are often **not directly printable**. This is a real problem for some customers (prototype shops, hardware teams iterating enclosures/ergonomics), but not all. Even when customers don’t print, “printability blockers” are a strong proxy for “mesh quality and downstream usability.”

We want to:
- Make failures **visible and actionable**
- Provide **bounded, opt-in** improvements
- Produce artifacts that help handoff to engineers/model shops

---

## Design Principles
1) **Deterministic**: same input + same settings => same report/output. No stochastic steps.
2) **Diagnosis-first**: start with a report; repairs are optional.
3) **Never mutate the original**: repairs create new artifacts.
4) **Honest messaging**: separate “slicer blockers” vs “print quality risks.”
5) **ComfyUI-like UX**: nodes with inputs/outputs, run button, collapsible params, status badges.
6) **One-day feasible MVP**: keep the analysis small, fast, and credible.

---

## Scope

### In Scope (MVP)
- Real node graph canvas (React Flow)
- Mesh import (GLB/OBJ/STL) + built-in sample meshes
- three.js viewer with overlays
- Server-side analysis API (Next route handler)
- Report JSON + export bundle (JSON + screenshots)
- Fix recipes: floaters removal, cleanup, auto-orient suggestion, destructive watertight remesh *if feasible*

### Out of Scope
- “Guaranteed printable” claim
- Full wall thickness solver (can be added later if credible)
- Slicer integration
- Manufacturing (tolerances, shrinkage, multi-part assemblies, injection molding constraints)
- Full SuperCraft feature cloning (this is a surgical demo)

---

## Target Demo User Story
“As a designer exploring 3D outputs, I want to quickly see whether this mesh is likely to print (or at least slice), understand exactly why it fails, and optionally apply safe fixes—without silently changing my design.”

---

## Stack
- **Next.js (App Router)**
- **React Flow** for node graph
- **three.js** for mesh viewer + overlays
- Server-side route handlers:
  - `/api/printability/analyze`
  - `/api/printability/repair`
- Optional: WebWorker for client-side transforms (not required for MVP)

---

## High-Level Architecture
- UI: Node graph + inspector panels + viewer
- Artifacts are stored in-memory for demo (can be swapped to persistence later)
- Analysis is computed server-side for performance and determinism
- Viewer overlays are generated from analysis results

---

## Node Graph: Nodes & Edges

### Nodes
1) **Mesh Source**
   - Upload a mesh or choose a sample mesh
2) **Printability Report**
   - Analyze mesh, emit `report_json` + overlay data
3) **Suggested Fixes**
   - Read `mesh` + `report_json`, emit `fix_plan_json`; optionally run a fix to create `repaired_mesh`
4) **Mesh Viewer** (optional as standalone node; can also be a global viewer)
   - Subscribe to selected mesh + overlay selection

### Edges (typical)
`MeshSource.mesh -> PrintabilityReport.mesh -> SuggestedFixes.mesh`
`PrintabilityReport.report_json -> SuggestedFixes.report_json`
`SuggestedFixes.repaired_mesh -> PrintabilityReport.mesh` (loop for re-analysis, creates “after” report)

---

## UI/UX Spec

### Overall Layout
- Left: node graph canvas (React Flow)
- Right: inspector panel for selected node (params, outputs, logs)
- Bottom or side: three.js viewer (or viewer in center with graph left)

### Node Styling (ComfyUI-inspired)
- Dark panel, compact header
- Header includes:
  - Node title
  - Status pill: `PASS / WARN / FAIL`
  - Run button (▶)
- Left side: inputs with “ports”
- Right side: outputs with “ports” + export buttons
- Collapsible parameter sections

### Status Semantics
- **FAIL**: at least one **BLOCKER**
- **WARN**: no blockers, but one+ **RISKS**
- **PASS**: no blockers, low/no risks (rare for generated meshes; that’s fine)

### Report Presentation
- Issues list grouped by severity:
  - BLOCKER
  - RISK
  - INFO
- Each issue card includes:
  - Title + short summary
  - “Why it matters” one-liner
  - “Next steps” one-liner
  - `Highlight` toggle (drives viewer overlay mode)

### Viewer Overlay Modes
- Base shaded mesh
- Boundary edges overlay (open seams)
- Non-manifold edges overlay
- Floater components overlay
- Overhang risk heatmap

No fancy selection/picking required for MVP.

---

## Printability Report Node (Detailed)

### Inputs
- `mesh` (required)
- `printer_profile` (required)
  - `FDM_0p4` (default)
  - `RESIN_standard` (optional)
- `orientation`:
  - `AUTO` (default; uses suggested orientation if provided)
  - manual rotations (optional)

### Parameters (MVP)
- `overhang_angle_deg` (default 45 for FDM)
- `floater_component_threshold` (tri count or volume proxy; default by profile)
- `max_triangles_for_analysis` (default 200k; decimate for analysis if larger)

### Outputs
- `report_json`
- `overlay_data`
- `analysis_summary`
- `export_bundle` (zip: report + viewer screenshots)

---

## Suggested Fixes Node (Detailed)

### Inputs
- `mesh` (required)
- `report_json` (required)

### Outputs
- `fix_plan_json`
- `repaired_mesh` (optional; created by running a fix)
- `repaired_report_json` (optional; can trigger re-run of analyze)

### Fix Plan UX
Rank fix recipes:
1) resolves blockers
2) lower risk first
3) minimal shape impact first

Each fix recipe card shows:
- Targets (issue IDs)
- Risk: LOW/MED/HIGH
- Shape impact: NONE/LOCAL/GLOBAL
- Deterministic: YES
- Expected effect (what it should improve)
- Warnings
- Button: “Run Fix → creates new mesh node”

---

## Analysis: Checks to Implement (MVP)

### Core Data Structures
Build an edge map keyed by undirected edge `(min(a,b), max(a,b))`:
- count of incident faces
- references for overlay construction

Build face adjacency for connected components:
- faces adjacent if they share an edge

### BLOCKERS (FAIL)
1) **Open Boundaries / Not Watertight**
- Boundary edges = edges with incident face count == 1
- Report count; overlay boundary edges as lines

2) **Non-Manifold Edges**
- Non-manifold edges = incident face count > 2
- Report count; overlay those edges as lines

3) **Disconnected Components / Floaters**
- Compute connected components of faces
- If >1 component:
  - Warn or fail depending on size/threshold:
    - If tiny components exist: treat as RISK (floaters) but can be BLOCKER if many or large
- Overlay floaters (by component mask)

### RISKS (WARN)
4) **Overhang Risk**
- For each face normal, compare to +Y up vector
- Flag faces where angle exceeds `overhang_angle_deg`
- Compute `% risky faces`
- Overlay heatmap via per-face mask

5) **Scale Sanity**
- Compute bbox
- If bbox max dimension < 5mm or > 2000mm: warn “scale likely wrong / units ambiguous”

### Optional (only if credible)
- “Tiny feature heuristic”: flag faces where any edge length < `min_feature_mm`
  - This is easy to do badly; only include if it aligns with obvious failure visuals.

### Explicitly Not Implemented (MVP)
- Robust self-intersection detection
- True wall thickness analysis

---

## Repair: Fix Recipes (MVP)

### 1) Remove Floaters (LOW)
- Identify small components (by triangle count threshold; optionally bbox volume proxy)
- Delete those components
- Output new mesh

Warnings:
- “Removes small disconnected fragments; verify no intentional details were removed.”

### 2) Mesh Cleanup (LOW)
- Remove degenerate faces (near-zero area)
- Merge duplicate vertices within epsilon
- Recompute normals
- Output new mesh

Warnings:
- “Cleanup should not change silhouette, but verify critical edges.”

### 3) Auto-Orient Suggestion (Advice Only)
- Evaluate a small set of orientations (e.g., yaw 0/90/180/270 × pitch 0/90)
- Choose lowest overhang risk percentage
- Output recommended orientation + explanation
- Does not alter mesh

Warnings:
- “Orientation reduces supports but doesn’t guarantee print success.”

### 4) Watertight Remesh (HIGH, optional if library is available)
- Voxel remesh / solidify strategy via library
- Output new mesh + delta stats (bbox change, triangle count change)

Warnings (must be explicit):
- “Destructive: may soften edges, close vents, change dimensions.”
- “Use for prototypes only; validate fits.”

If remesh is not feasible in a day, keep the recipe but mark:
- “Not implemented in demo” + provide external tool guidance (“recommended next steps in Blender/Netfabb”), while still outputting a fix plan.

---

## API Spec

### `POST /api/printability/analyze`
**Input**
- multipart mesh upload OR `{ meshBase64, format }`
- `{ printerProfile, settings }`

**Output**
- `report_json`
- `overlay_data` (edge lists, face masks)
- `analysis_summary` (status, counts, stats)

### `POST /api/printability/repair`
**Input**
- mesh + `recipe_id` + `params`

**Output**
- `repaired_mesh` (GLB preferred for viewer portability, or raw buffers)
- `delta_stats`
- optionally `repaired_report_json` (or client calls analyze again)

---

## Schemas

### Report JSON (`report_json`)
```json
{
  "schema_version": "1.0",
  "created_at": "ISO-8601",
  "tool_versions": { "app": "0.1.0", "mesh_lib": "..." },
  "printer_profile": { "name": "FDM_0p4", "overhang_angle_deg": 45 },
  "mesh_stats": {
    "triangles": 12345,
    "vertices": 6789,
    "components": 2,
    "bbox_mm": [120.1, 60.2, 35.0],
    "analysis_decimated": false
  },
  "status": "FAIL",
  "issues": [
    {
      "id": "BND_OPEN_001",
      "severity": "BLOCKER",
      "title": "Mesh is not watertight",
      "summary": "Found 842 boundary edges (open seams).",
      "evidence": { "boundary_edges": 842 },
      "overlay_key": "issue:BND_OPEN_001",
      "why_it_matters": "Open meshes often slice incorrectly or not at all.",
      "next_steps": "Try 'Fill small holes' or 'Watertight remesh' fix."
    }
  ]
}

Overlay Data (overlay_data)

Keep it simple and compact:

boundaryEdges: number[] flattened vertex index pairs [a,b,a,b,...]

nonManifoldEdges: number[] flattened pairs

overhangFaceMask: number[] | Uint8Array length = faceCount

componentIdPerFace: number[] length = faceCount

Fix Plan JSON (fix_plan_json)
{
  "schema_version": "1.0",
  "recommended": [
    {
      "id": "FIX_FLOATERS_001",
      "title": "Remove floating fragments",
      "targets": ["CMP_FLOATERS_001"],
      "risk": "LOW",
      "shape_impact": "LOCAL",
      "deterministic": true,
      "steps": [{ "op": "remove_components_below_tri_count", "tri_count": 200 }],
      "warnings": [
        "Removes small disconnected parts; verify no intentional details were removed."
      ]
    }
  ]
}

Sample Mesh Set (Required for Demo)

Include 3 sample meshes with obvious, distinct failures.

Sample A: Open Shell (“device enclosure”)

Box-like enclosure with a missing face / open seam
Expected:

BLOCKER: not watertight

WARN: overhang risk (depending on orientation)

Sample B: Floaters (“messy kitbash”)

Main body + several tiny disconnected cubes
Expected:

WARN/FAIL: multiple components

Fix: floaters removal shows clear improvement

Sample C: Non-manifold (“bad boolean”)

Two shapes sharing faces/edges in a way that creates non-manifold edges
Expected:

BLOCKER: non-manifold edges

Implementation note:

Generate these procedurally in code if sourcing assets is slow.

Phased Build Plan
Phase 0 — Skeleton (0.5 day)

Next.js app router setup

React Flow canvas with draggable nodes

Node registry + inspector panel

three.js viewer renders a simple mesh

Acceptance:

You can add nodes and connect them; selecting a node updates inspector.

Phase 1 — Mesh Import + Viewer (0.5 day)

MeshSource node:

upload GLB/OBJ/STL

load sample meshes

Viewer:

orbit controls

shaded mesh

Acceptance:

Mesh loads reliably; triangle/vertex counts show.

Phase 2 — Analyze API + Report Node (1 day)

Implement edge map + watertight + non-manifold + components + overhang

Return report + overlay data

UI renders issue list with highlight toggles

Viewer shows overlays

Acceptance:

Sample meshes produce expected FAIL/WARN with working overlays.

Phase 3 — Suggested Fixes Node (0.5–1 day)

Generate fix plan based on report

Implement floaters removal + cleanup

Re-run analysis on repaired mesh; show before/after counts

Acceptance:

One-click fix produces a new mesh node and improves report metrics.

Phase 4 — Export + Polish (0.5 day)

Export bundle:

report JSON

1–3 viewer screenshots (base + key overlays)

Improve node UI styling (ComfyUI vibe)

Add warning copy and “destructive” gating checkbox

Acceptance:

Demo script can be recorded in < 2 minutes.

Phase 5 — Optional: Watertight Remesh (time permitting)

Implement destructive remesh if a library is available and stable

Otherwise keep as “recommended external step”

Acceptance:

If implemented, it clearly improves boundary edge blockers on Sample A with explicit warnings.

Acceptance Criteria (Hard)

Deterministic outputs for same inputs/settings

Report clearly distinguishes BLOCKERS vs RISKS

Overlays work and are easy to toggle

Fixes create new artifacts and never overwrite original

Export bundle exists and is readable by a human

Demo Script (90 seconds)

Load Sample A → Printability Report shows FAIL “not watertight”

Toggle “Highlight” → boundary edges appear in viewer

Suggested Fixes proposes low-risk cleanup + high-risk remesh (with warnings)

Run floaters removal on Sample B → report improves; show before/after counts

Export report bundle

Risks & Mitigations

Remesh is hard: treat as optional; don’t fake it.

Large meshes: decimate for analysis only; record that in report.

Bad heuristics: avoid wall thickness and tiny-feature scoring unless you can validate visually.

Overclaiming: keep messaging tight: “diagnose + suggest + bounded fixes.”

Implementation Notes / Dev Checklist

Use canonical mesh buffers internally (positions/indices)

Compute face normals if missing

Build edge map once per mesh; reuse across checks

Overlay rendering:

edges: LineSegments

face masks: vertex colors or per-face attribute in shader

Version the schemas (schema_version) and embed tool versions in report

Store artifacts in-memory keyed by id for MVP