import {
  registerNode,
  meshSourceDefinition,
  printabilityReportDefinition,
  suggestedFixesDefinition,
} from '@/lib/nodes/registry'
import { MeshSourceNode } from './MeshSourceNode'
import { PrintabilityReportNode } from './PrintabilityReportNode'
import { SuggestedFixesNode } from './SuggestedFixesNode'

// Register all node types
registerNode(meshSourceDefinition, MeshSourceNode)
registerNode(printabilityReportDefinition, PrintabilityReportNode)
registerNode(suggestedFixesDefinition, SuggestedFixesNode)

export { MeshSourceNode, PrintabilityReportNode, SuggestedFixesNode }
