import type { ComponentType } from 'react'
import type { NodeProps } from 'reactflow'
import { NODE_TYPES, type NodeTypeDefinition } from '@/types/nodes'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NodeComponent = ComponentType<NodeProps<any>>

const nodeComponents: Map<string, NodeComponent> = new Map()
const nodeDefinitions: Map<string, NodeTypeDefinition> = new Map()

export function registerNode(
  definition: NodeTypeDefinition,
  component: NodeComponent
): void {
  nodeDefinitions.set(definition.type, definition)
  nodeComponents.set(definition.type, component)
}

export function getNodeComponent(type: string): NodeComponent | undefined {
  return nodeComponents.get(type)
}

export function getNodeDefinition(type: string): NodeTypeDefinition | undefined {
  return nodeDefinitions.get(type)
}

export function getAllNodeTypes(): NodeTypeDefinition[] {
  return Array.from(nodeDefinitions.values())
}

export function getRegisteredNodeTypes(): Record<string, NodeComponent> {
  const types: Record<string, NodeComponent> = {}
  nodeComponents.forEach((component, type) => {
    types[type] = component
  })
  return types
}

export function isValidConnection(
  sourceType: string,
  sourceHandle: string,
  targetType: string,
  targetHandle: string
): boolean {
  const sourceDef = getNodeDefinition(sourceType)
  const targetDef = getNodeDefinition(targetType)

  if (!sourceDef || !targetDef) return false

  const sourcePort = sourceDef.outputs.find((p) => p.id === sourceHandle)
  const targetPort = targetDef.inputs.find((p) => p.id === targetHandle)

  if (!sourcePort || !targetPort) return false

  // Ports must have matching types
  return sourcePort.type === targetPort.type
}

// Node type definitions
export const meshSourceDefinition: NodeTypeDefinition = {
  type: NODE_TYPES.MESH_SOURCE,
  label: 'Mesh Source',
  inputs: [],
  outputs: [{ id: 'mesh', label: 'Mesh', type: 'mesh' }],
}

export const printabilityReportDefinition: NodeTypeDefinition = {
  type: NODE_TYPES.PRINTABILITY_REPORT,
  label: 'Printability Report',
  inputs: [{ id: 'mesh', label: 'Mesh', type: 'mesh' }],
  outputs: [
    { id: 'report', label: 'Report', type: 'report' },
  ],
}

export const suggestedFixesDefinition: NodeTypeDefinition = {
  type: NODE_TYPES.SUGGESTED_FIXES,
  label: 'Suggested Fixes',
  inputs: [
    { id: 'mesh', label: 'Mesh', type: 'mesh' },
    { id: 'report', label: 'Report', type: 'report' },
  ],
  outputs: [
    { id: 'repaired_mesh', label: 'Repaired Mesh', type: 'mesh' },
  ],
}
