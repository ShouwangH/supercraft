import type { Node, Edge } from 'reactflow'

export type NodeStatus = 'idle' | 'running' | 'pass' | 'warn' | 'fail' | 'error'

export type PortType = 'mesh' | 'report' | 'fix_plan'

export interface PortDefinition {
  id: string
  label: string
  type: PortType
}

export interface NodeTypeDefinition {
  type: string
  label: string
  inputs: PortDefinition[]
  outputs: PortDefinition[]
}

export interface BaseNodeData {
  label: string
  status: NodeStatus
}

export interface MeshSourceNodeData extends BaseNodeData {
  meshId: string | null
  meshName: string | null
  error: string | null
}

export interface PrintabilityReportNodeData extends BaseNodeData {
  /** Mesh ID from connected MeshSource node */
  meshId: string | null
  /** Report ID (same as meshId when report exists) */
  reportId: string | null
  /** Whether analysis is in progress */
  analyzing: boolean
  /** Error message if analysis failed */
  error: string | null
}

export interface SuggestedFixesNodeData extends BaseNodeData {
  /** Mesh ID from connected MeshSource node */
  meshId: string | null
  /** Fix plan ID (same as meshId when plan exists) */
  fixPlanId: string | null
  /** Whether fix plan generation is in progress */
  generating: boolean
  /** Whether a fix is being applied */
  applyingFix: string | null
  /** Error message */
  error: string | null
}

export type AppNodeData = MeshSourceNodeData | PrintabilityReportNodeData | SuggestedFixesNodeData

export type AppNode = Node<AppNodeData>
export type AppEdge = Edge

export const NODE_TYPES = {
  MESH_SOURCE: 'mesh-source',
  PRINTABILITY_REPORT: 'printability-report',
  SUGGESTED_FIXES: 'suggested-fixes',
} as const

export type NodeType = typeof NODE_TYPES[keyof typeof NODE_TYPES]
