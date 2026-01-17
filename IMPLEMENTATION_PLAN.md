# Implementation Plan: Printability Report + Suggested Fixes

## Stack Decisions
- **Framework**: Next.js 14+ (App Router) + TypeScript
- **Node Graph**: React Flow
- **3D Viewer**: three.js
- **State Management**: Zustand
- **Styling**: Tailwind CSS
- **Testing**: Vitest + React Testing Library
- **Mesh Processing**: three.js loaders + custom analysis utilities
- **Export**: Client-side canvas capture + JSZip

---

## PR Roadmap Overview

| Phase | Focus | PRs | ~LOC |
|-------|-------|-----|------|
| 0 | Foundation | 1-3 | 800 |
| 1 | Mesh Data Layer | 4-5 | 900 |
| 2 | Analysis Engine | 6-7 | 1200 |
| 3 | Report Node & Overlays | 8-9 | 900 |
| 4 | Fix System | 10-12 | 1200 |
| 5 | Export & Polish | 13 | 600 |
| 6 | Watertight Remesh (Stretch) | 14 | 600 |

**Total: 14 PRs, ~6200 LOC**

---

## Phase 0: Foundation

### PR 1: Project Scaffolding (~200 LOC)
**Goal**: Bootable Next.js app with tooling configured

**Implementation**:
- `npx create-next-app@latest` with App Router + TypeScript
- Tailwind CSS configuration
- Vitest setup with jsdom environment
- ESLint config
- Basic folder structure:
  ```
  src/
    app/
    components/
    lib/
    stores/
    types/
  ```

**Tests**:
- Vitest runs and passes (smoke test)
- Next.js dev server starts

**Invariants Tested**:
- Build succeeds with `next build`

---

### PR 2: React Flow Canvas + Node Registry (~300 LOC)
**Goal**: Draggable node graph with extensible node type system

**Implementation**:
- Install `reactflow`
- `NodeCanvas` component with React Flow provider
- Node type registry pattern:
  ```typescript
  // lib/nodes/registry.ts
  export const nodeTypes: Record<string, NodeType> = {}
  export function registerNode(type: string, component: React.FC) {...}
  ```
- Placeholder node types: `mesh-source`, `printability-report`, `suggested-fixes`
- Basic inspector panel (shows selected node ID)

**Tests**:
- `NodeCanvas` renders without crashing
- Adding a node updates the node list
- Connecting two nodes creates an edge
- Node selection updates inspector state

**Invariants Tested**:
- Node registry returns correct component for type
- Edge validation: only valid port connections allowed

---

### PR 3: Three.js Viewer Component (~300 LOC)
**Goal**: 3D viewer with orbit controls, ready for mesh rendering

**Implementation**:
- `MeshViewer` component with:
  - Scene, camera, renderer setup
  - OrbitControls
  - Ambient + directional lighting
  - Grid helper (toggleable)
  - Resize handling
- Placeholder cube mesh for testing
- Viewer state in Zustand store (camera position, grid visibility)

**Tests**:
- Viewer renders canvas element
- Resize updates renderer size
- Grid toggle works

**Invariants Tested**:
- Camera frustum contains origin after init
- Renderer pixel ratio matches device

---

## Phase 1: Mesh Data Layer

### PR 4: Mesh Store + Types + Mesh Source Node + Loaders (~600 LOC)
**Goal**: Complete mesh import pipeline from file to store

**Implementation**:
- Core types (`types/mesh.ts`):
  ```typescript
  interface MeshData {
    id: string
    name: string
    positions: Float32Array  // xyz triplets
    indices: Uint32Array     // triangle indices
    normals?: Float32Array
    triangleCount: number
    vertexCount: number
    boundingBox: BBox
  }

  interface BBox {
    min: [number, number, number]
    max: [number, number, number]
    dimensions: [number, number, number]
  }
  ```
- Zustand stores:
  - `useMeshStore`: meshes, activeMeshId, addMesh, removeMesh, setActiveMesh
  - `useUIStore`: selectedNodeId, inspectorTab
- three.js loaders integration:
  - `GLTFLoader` for GLB/GLTF
  - `OBJLoader` for OBJ
  - `STLLoader` for STL
- Mesh extraction utility: THREE.BufferGeometry → MeshData
- `MeshSourceNode` component:
  - File input (accept: .glb, .gltf, .obj, .stl)
  - Sample mesh dropdown (placeholder)
  - Output port: `mesh`
  - Status indicator (empty / loaded / error)

**Tests**:
- `addMesh` adds mesh to store
- `setActiveMesh` updates active ID
- Mesh data validates (positions length divisible by 3)
- File input accepts correct formats
- Loading GLB extracts positions/indices correctly
- Invalid file shows error state

**Invariants Tested**:
- Mesh indices never exceed vertex count
- BBox min ≤ max for all axes
- Extracted mesh has valid triangle count (indices.length / 3)
- Normals computed if missing

---

### PR 5: Procedural Sample Meshes (~300 LOC)
**Goal**: Three test meshes with known, exact printability issues

**Implementation**:
- `lib/samples/generateSamples.ts`:

  **Sample A: Open Shell** ("device-enclosure")
  - Box with one face removed (5 faces, 10 triangles)
  - Expected: BLOCKER (not watertight), exactly 4 boundary edges

  **Sample B: Floaters** ("messy-kitbash")
  - Main cube (12 tris) + 3 tiny disconnected cubes (12 tris each)
  - Expected: 4 components, 3 floaters below threshold

  **Sample C: Non-Manifold** ("bad-boolean")
  - Two cubes sharing an edge (T-junction geometry)
  - Expected: 2+ non-manifold edges

- Wire up to Mesh Source node dropdown
- Optional: load user's real GLB as 4th sample for smoke testing

**Tests**:
- Sample A has exactly 4 boundary edges
- Sample B has exactly 4 connected components
- Sample C has non-manifold edges (count verified)
- All samples have valid mesh data structure
- All samples are deterministic (same output every call)

**Invariants Tested**:
- Generated meshes are pure functions (no randomness)
- Triangle winding is consistent (CCW)

---

## Phase 2: Analysis Engine

### PR 6: Analysis Engine Core (~900 LOC)
**Goal**: All mesh analysis algorithms as pure, tested functions

**Implementation**:
- `lib/analysis/edgeMap.ts`:
  ```typescript
  interface EdgeMap {
    edges: Map<string, { faceIndices: number[], vertices: [number, number] }>
  }
  function buildEdgeMap(indices: Uint32Array): EdgeMap
  ```

- `lib/analysis/watertight.ts`:
  ```typescript
  interface WatertightResult {
    isWatertight: boolean
    boundaryEdges: number[]  // flat [a,b,a,b,...] for overlay
    boundaryEdgeCount: number
  }
  function checkWatertight(edgeMap: EdgeMap): WatertightResult
  ```

- `lib/analysis/nonManifold.ts`:
  ```typescript
  interface NonManifoldResult {
    hasNonManifold: boolean
    nonManifoldEdges: number[]
    nonManifoldEdgeCount: number
  }
  function checkNonManifold(edgeMap: EdgeMap): NonManifoldResult
  ```

- `lib/analysis/components.ts`:
  ```typescript
  interface ComponentsResult {
    componentCount: number
    componentIdPerFace: Uint32Array
    componentSizes: number[]
    mainComponentIndex: number
    floaterIndices: number[]
  }
  function findConnectedComponents(indices: Uint32Array, edgeMap: EdgeMap, threshold: number): ComponentsResult
  ```
  - Union-find algorithm on faces sharing edges

- `lib/analysis/overhang.ts`:
  ```typescript
  interface OverhangResult {
    overhangFaceMask: Uint8Array
    overhangFaceCount: number
    overhangPercentage: number
    maxOverhangAngle: number
  }
  function analyzeOverhang(positions, indices, normals, thresholdDeg, upVector): OverhangResult
  ```

- `lib/analysis/scale.ts`:
  ```typescript
  interface ScaleResult {
    isReasonable: boolean
    maxDimensionMm: number
    warning: string | null
  }
  function checkScale(bbox: BBox): ScaleResult
  ```

**Tests**:
- Edge map: closed cube has 12 edges, each with 2 faces
- Watertight: closed cube = 0 boundary, open box = 4 boundary, single tri = 3 boundary
- Non-manifold: T-junction sample has expected edge count
- Components: single mesh = 1, two cubes = 2, floater detection with threshold
- Overhang: horizontal face = 0°, vertical = 90°, 45° at threshold
- Scale: warn if < 5mm or > 2000mm

**Invariants Tested**:
- Edge map key is always `min,max` (undirected)
- Face count per edge ≥ 1
- Boundary edges array length is even
- Component IDs are contiguous 0..n-1
- Sum of component sizes = total face count
- Overhang percentage in [0, 100]
- Face mask length = face count

---

### PR 7: Analysis API Route + Report Schema (~300 LOC)
**Goal**: Server endpoint that orchestrates analysis and returns structured report

**Implementation**:
- `app/api/printability/analyze/route.ts`:
  - Accept: JSON with base64 mesh + format + settings
  - Decode and parse mesh to MeshData
  - Run all checks: watertight, nonManifold, components, overhang, scale
  - Aggregate into report

- `lib/analysis/report.ts`:
  ```typescript
  interface PrintabilityReport {
    schema_version: "1.0"
    created_at: string
    mesh_stats: MeshStats
    printer_profile: PrinterProfile
    status: "PASS" | "WARN" | "FAIL"
    issues: Issue[]
  }
  function generateReport(mesh: MeshData, results: AnalysisResults, profile: PrinterProfile): PrintabilityReport
  ```

- Issue mapping:
  - BLOCKER: boundary edges > 0, non-manifold > 0
  - RISK: overhang % > 20, floaters exist, scale warning
  - Status: FAIL if any BLOCKER, WARN if any RISK, else PASS

- Report types (`types/report.ts`)

**Tests**:
- API returns 400 for invalid mesh data
- API returns valid report JSON matching schema
- Sample A → status FAIL with boundary edge issue
- Sample B → has floater issue (RISK or BLOCKER based on count)
- Sample C → status FAIL with non-manifold issue

**Invariants Tested**:
- Report always has schema_version
- Issues array is sorted by severity (BLOCKER first)
- Status is consistent with issue severities

---

## Phase 3: Report Node & Overlays

### PR 8: Printability Report Node UI (~300 LOC)
**Goal**: Node that displays analysis results with issue cards

**Implementation**:
- `PrintabilityReportNode` component:
  - Input port: `mesh`
  - Output ports: `report_json`, `overlay_data`
  - Run button triggers analysis API call
  - Status badge: PASS (green) / WARN (yellow) / FAIL (red)

- Inspector panel integration:
  - Issue list grouped by severity
  - Each issue card: title, summary, "Highlight" toggle
  - Mesh stats summary

- `useAnalysisStore`:
  - `reports: Record<nodeId, PrintabilityReport>`
  - `overlays: Record<nodeId, OverlayData>`
  - `activeOverlayKey: string | null`

**Tests**:
- Node shows loading state during analysis
- Status badge reflects report status
- Issue cards render with correct severity styling
- Highlight toggle updates activeOverlayKey

**Invariants Tested**:
- One analysis runs at a time per node
- Report ID matches node ID

---

### PR 9: Viewer Overlays (All Types) (~600 LOC)
**Goal**: All overlay rendering modes for the viewer

**Implementation**:
- `lib/viewer/overlays/edgeOverlay.ts`:
  ```typescript
  function createEdgeOverlay(
    positions: Float32Array,
    edgePairs: number[],
    color: THREE.Color
  ): THREE.LineSegments
  ```
  - Boundary edges: red
  - Non-manifold edges: magenta

- `lib/viewer/overlays/componentOverlay.ts`:
  - Color main component gray, floaters red
  - Uses vertex colors on mesh clone

- `lib/viewer/overlays/overhangOverlay.ts`:
  - Heatmap based on face angle
  - Green (safe) → yellow → red (severe overhang)
  - Uses vertex colors

- `MeshViewer` updates:
  - Subscribe to `activeOverlayKey`
  - Render overlays on top of mesh
  - Overlay toggle logic by issue key

**Tests**:
- Edge overlay has correct number of line segments
- Overlay visibility toggles with activeOverlayKey
- Floater overlay colors correct faces
- Overhang heatmap gradient is correct
- Overlay cleanup on mode switch

**Invariants Tested**:
- Line segment count = edgePairs.length / 2
- Overlay disposes properly on unmount
- All faces have a color assigned
- Heatmap values in [0, 1] range

---

## Phase 4: Fix System

### PR 10: Fix Plan Generator + Suggested Fixes Node (~300 LOC)
**Goal**: Generate fix recommendations from report and display in node

**Implementation**:
- `lib/fixes/planGenerator.ts`:
  ```typescript
  interface FixRecipe {
    id: string
    title: string
    targets: string[]  // issue IDs
    risk: "LOW" | "MED" | "HIGH"
    shape_impact: "NONE" | "LOCAL" | "GLOBAL"
    deterministic: true
    steps: FixStep[]
    warnings: string[]
  }

  function generateFixPlan(report: PrintabilityReport): FixPlan
  ```

- Recipe mapping:
  - Floater issues → "Remove Floaters" (LOW)
  - Any issues → "Mesh Cleanup" (LOW)
  - Overhang issues → "Auto-Orient" (NONE, advice only)
  - Boundary/non-manifold → "Watertight Remesh" (HIGH)

- `SuggestedFixesNode` component:
  - Input ports: `mesh`, `report_json`
  - Output ports: `fix_plan_json`, `repaired_mesh`
  - Fix recipe cards with Run buttons

**Tests**:
- Floater report generates floater fix
- Non-manifold report generates remesh suggestion
- Recipes sorted by risk (LOW first)

**Invariants Tested**:
- All recipes have at least one target issue
- Recipe IDs are unique

---

### PR 11: Fix Implementations (Floaters, Cleanup, Auto-Orient) (~600 LOC)
**Goal**: All fix recipe implementations as pure functions

**Implementation**:
- `lib/fixes/removeFloaters.ts`:
  ```typescript
  function removeFloaters(
    mesh: MeshData,
    components: ComponentsResult,
    threshold: number
  ): MeshData
  ```
  - Keep only faces in main component (or above threshold)
  - Reindex vertices (remove orphans)

- `lib/fixes/meshCleanup.ts`:
  ```typescript
  function cleanupMesh(mesh: MeshData): MeshData
  ```
  - Remove degenerate faces (area < epsilon)
  - Merge duplicate vertices (distance < epsilon)
  - Recompute normals

- `lib/fixes/autoOrient.ts`:
  ```typescript
  interface OrientationCandidate {
    rotation: [number, number, number]  // euler XYZ
    overhangPercentage: number
  }

  function findBestOrientation(
    mesh: MeshData,
    overhangThreshold: number
  ): { best: OrientationCandidate, candidates: OrientationCandidate[], explanation: string }
  ```
  - Test 12 orientations (yaw × pitch combinations)
  - Returns suggestion only (no mesh modification)

**Tests**:
- Floater removal reduces component count to 1
- Floater removal preserves main component triangles
- Cleanup merges vertices within epsilon
- Cleanup removes zero-area triangles
- Auto-orient: flat plate → 0° pitch is best
- Auto-orient: returns lowest overhang %

**Invariants Tested**:
- Output mesh has valid structure
- No orphan vertices in output
- Vertex count ≤ input vertex count
- Best orientation has lowest overhang %
- All rotations are valid euler angles

---

### PR 12: Repair API Route + Re-analysis Flow (~300 LOC)
**Goal**: Server endpoint for mesh repair with delta reporting

**Implementation**:
- `app/api/printability/repair/route.ts`:
  - Accept: mesh + recipe_id + params
  - Execute fix operation
  - Return repaired mesh (as GLB base64)
  - Include delta stats (tri count diff, vertex count diff)

- `lib/export/meshToGLB.ts`:
  - Convert MeshData to GLB binary

- Re-analysis flow:
  - After repair, UI can connect repaired_mesh to new Report node
  - Shows before/after comparison

**Tests**:
- API accepts valid repair request
- Returns valid GLB
- Delta stats are accurate (tri count diff)
- Invalid recipe returns 400

**Invariants Tested**:
- Repaired mesh is valid MeshData
- Delta stats signs are correct (negative = reduction)

---

## Phase 5: Export & Polish

### PR 13: Export Bundle + UI Polish (~600 LOC)
**Goal**: Export functionality and visual polish

**Implementation**:
- `lib/export/bundleExport.ts`:
  ```typescript
  async function exportBundle(
    report: PrintabilityReport,
    viewer: MeshViewer,
    overlayKeys: string[]
  ): Promise<Blob>
  ```

- Screenshot capture:
  - Base shaded view
  - Each active overlay
  - Uses `renderer.domElement.toDataURL('image/png')`

- Bundle structure:
  ```
  export-{timestamp}/
    report.json
    screenshots/
      base.png
      overlay-boundary.png
      overlay-overhang.png
  ```

- UI: Export button on Report node

- Node styling polish:
  - Dark panels with subtle borders
  - Compact headers with status pills
  - Port styling (circles with type colors)
  - Hover states

- Warning dialogs:
  - Confirmation for HIGH risk fixes
  - Checkbox: "I understand this is destructive"

- Polish:
  - Loading spinners
  - Error states with retry

**Tests**:
- Bundle contains report.json
- Screenshots are valid PNGs
- Zip structure is correct
- Destructive fix shows warning dialog
- Cancel aborts fix

**Invariants Tested**:
- Report JSON in bundle matches displayed report
- HIGH risk fixes always show warning
- LOW risk fixes don't show warning

---

## Phase 6: Watertight Remesh (Stretch)

### PR 14: Watertight Remesh (Manifold Integration) (~600 LOC)
**Goal**: Destructive repair for non-watertight meshes

**Implementation**:
- Install `manifold-3d` (WASM build)
- `lib/fixes/manifold.ts`:
  - Initialize WASM module
  - Convert MeshData ↔ Manifold mesh
  - Expose basic operations

- `lib/fixes/watertightRemesh.ts`:
  ```typescript
  function watertightRemesh(
    mesh: MeshData,
    resolution: number
  ): MeshData
  ```
  - Voxelize → extract surface
  - Or use Manifold's hull/repair operations

- Recipe integration:
  - HIGH risk with explicit warnings
  - Shows dimension delta warning if > 1%

**Tests**:
- WASM loads successfully
- Cube converts to Manifold and back (round-trip)
- Open box becomes watertight after remesh
- Remeshed mesh has 0 boundary edges
- Dimensions within tolerance

**Invariants Tested**:
- Round-trip preserves triangle count for valid mesh
- Invalid mesh throws (doesn't crash)
- Output is always watertight
- BBox change is reported accurately

---

## Test Strategy Summary

### Unit Tests (Vitest)
- All analysis functions with known inputs (procedural samples)
- Mesh data validation
- Report generation logic
- Fix operations with before/after assertions

### Integration Tests (Vitest + React Testing Library)
- API routes with mock meshes
- Node components with store interactions
- Viewer overlay rendering

### Key Invariants to Test Throughout
1. **Determinism**: Same input → same output (critical for report/fixes)
2. **Mesh validity**: Indices in bounds, no NaN positions, valid normals
3. **Report consistency**: Status matches issue severities
4. **Immutability**: Original mesh never modified by fixes
5. **Type safety**: All schemas validated at boundaries

### Sample GLB for Smoke Testing
- User-provided GLB can be added as 4th sample for real-world validation
- Not used for invariant tests (unpredictable geometry)
- Useful for visual QA and demo

---

## File Structure (Final)

```
src/
├── app/
│   ├── page.tsx                    # Main app
│   ├── layout.tsx
│   └── api/
│       └── printability/
│           ├── analyze/route.ts
│           └── repair/route.ts
├── components/
│   ├── canvas/
│   │   ├── NodeCanvas.tsx
│   │   └── nodes/
│   │       ├── MeshSourceNode.tsx
│   │       ├── PrintabilityReportNode.tsx
│   │       └── SuggestedFixesNode.tsx
│   ├── viewer/
│   │   ├── MeshViewer.tsx
│   │   └── overlays/
│   └── ui/
│       ├── Inspector.tsx
│       ├── IssueCard.tsx
│       └── FixRecipeCard.tsx
├── lib/
│   ├── analysis/
│   │   ├── edgeMap.ts
│   │   ├── watertight.ts
│   │   ├── nonManifold.ts
│   │   ├── components.ts
│   │   ├── overhang.ts
│   │   ├── scale.ts
│   │   └── report.ts
│   ├── fixes/
│   │   ├── planGenerator.ts
│   │   ├── removeFloaters.ts
│   │   ├── meshCleanup.ts
│   │   ├── autoOrient.ts
│   │   └── watertightRemesh.ts
│   ├── samples/
│   │   └── generateSamples.ts
│   ├── loaders/
│   │   └── meshLoader.ts
│   ├── export/
│   │   ├── bundleExport.ts
│   │   └── meshToGLB.ts
│   └── viewer/
│       └── overlays/
├── stores/
│   ├── meshStore.ts
│   ├── analysisStore.ts
│   └── uiStore.ts
├── types/
│   ├── mesh.ts
│   ├── report.ts
│   └── fixes.ts
└── __tests__/
    ├── analysis/
    ├── fixes/
    └── integration/
```

---

## Dependencies

```json
{
  "dependencies": {
    "next": "^14.x",
    "react": "^18.x",
    "reactflow": "^11.x",
    "three": "^0.160.x",
    "zustand": "^4.x",
    "jszip": "^3.x",
    "manifold-3d": "^2.x"  // Phase 6 only
  },
  "devDependencies": {
    "typescript": "^5.x",
    "vitest": "^1.x",
    "@testing-library/react": "^14.x",
    "@types/three": "^0.160.x",
    "jsdom": "^24.x"
  }
}
```
