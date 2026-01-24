/**
 * Fix Plan Types
 *
 * Schema for mesh repair fix plans and recipes.
 */

export const FIX_PLAN_SCHEMA_VERSION = '1.0'

/**
 * Risk level for a fix recipe
 */
export type FixRisk = 'LOW' | 'MEDIUM' | 'HIGH'

/**
 * Shape impact level for a fix recipe
 */
export type ShapeImpact = 'NONE' | 'LOCAL' | 'GLOBAL'

/**
 * Fix operation types
 */
export type FixOperationType =
  | 'remove_floaters'
  | 'mesh_cleanup'
  | 'auto_orient'
  | 'watertight_remesh'
  | 'csg_union'

/**
 * A single step in a fix operation
 */
export interface FixStep {
  /** Operation to perform */
  op: string
  /** Operation parameters */
  params?: Record<string, unknown>
}

/**
 * A fix recipe that can be applied to a mesh
 */
export interface FixRecipe {
  /** Unique recipe ID */
  id: string
  /** Recipe type */
  type: FixOperationType
  /** Human-readable title */
  title: string
  /** Description of what this fix does */
  description: string
  /** Issue IDs this fix targets */
  targetIssues: string[]
  /** Risk level */
  risk: FixRisk
  /** Shape impact level */
  shapeImpact: ShapeImpact
  /** Whether this fix is deterministic */
  deterministic: boolean
  /** Whether this fix is implemented (vs advisory only) */
  implemented: boolean
  /** Steps to perform */
  steps: FixStep[]
  /** Warning messages */
  warnings: string[]
  /** Expected improvement description */
  expectedEffect: string
}

/**
 * Complete fix plan for a mesh
 */
export interface FixPlan {
  /** Schema version */
  schemaVersion: string
  /** When the plan was created */
  createdAt: string
  /** Mesh ID this plan is for */
  meshId: string
  /** Report ID this plan is based on */
  reportId: string
  /** Recommended fix recipes, ordered by priority */
  recommended: FixRecipe[]
  /** Advisory-only suggestions (not implemented) */
  advisory: FixRecipe[]
}

/**
 * Result of applying a fix
 */
export interface FixResult {
  /** Whether the fix succeeded */
  success: boolean
  /** New mesh ID if mesh was modified */
  newMeshId?: string
  /** Error message if fix failed */
  error?: string
  /** Statistics about changes made */
  stats?: {
    /** Triangles removed */
    trianglesRemoved?: number
    /** Triangles added */
    trianglesAdded?: number
    /** Vertices removed */
    verticesRemoved?: number
    /** Vertices added */
    verticesAdded?: number
    /** Components removed */
    componentsRemoved?: number
    /** Components merged via CSG union */
    componentsUnioned?: number
    /** Triangles before operation */
    trianglesBefore?: number
    /** Triangles after operation */
    trianglesAfter?: number
    /** Number of holes filled (for watertight remesh) */
    holesFilled?: number
    /** Number of holes skipped due to size (for watertight remesh) */
    holesSkipped?: number
    /** Boundary edges before repair */
    boundaryEdgesBefore?: number
    /** Boundary edges after repair */
    boundaryEdgesAfter?: number
  }
}

/**
 * Request to apply a fix
 */
export interface RepairRequest {
  /** Mesh data */
  mesh: {
    positions: number[]
    indices: number[]
    normals?: number[]
  }
  /** Recipe ID to apply */
  recipeId: string
  /** Recipe type */
  recipeType: FixOperationType
  /** Recipe parameters */
  params?: Record<string, unknown>
}

/**
 * Response from repair API
 */
export interface RepairResponse {
  /** Whether the repair succeeded */
  success: boolean
  /** Repaired mesh data */
  mesh?: {
    positions: number[]
    indices: number[]
    normals?: number[]
  }
  /** Fix result statistics */
  result?: FixResult
  /** Error message if repair failed */
  error?: string
}
