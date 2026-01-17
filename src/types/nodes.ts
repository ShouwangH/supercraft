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
}

export interface PrintabilityReportNodeData extends BaseNodeData {
  reportId: string | null
}

export interface SuggestedFixesNodeData extends BaseNodeData {
  fixPlanId: string | null
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
