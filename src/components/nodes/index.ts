import {
  registerNode,
  meshSourceDefinition,
  modelViewerDefinition,
  printabilityReportDefinition,
  suggestedFixesDefinition,
} from '@/lib/nodes/registry'
import { MeshSourceNode } from './MeshSourceNode'
import { ModelViewerNode } from './ModelViewerNode'
import { PrintabilityReportNode } from './PrintabilityReportNode'
import { SuggestedFixesNode } from './SuggestedFixesNode'

// Register all node types
registerNode(meshSourceDefinition, MeshSourceNode)
registerNode(modelViewerDefinition, ModelViewerNode)
registerNode(printabilityReportDefinition, PrintabilityReportNode)
registerNode(suggestedFixesDefinition, SuggestedFixesNode)

export { MeshSourceNode, ModelViewerNode, PrintabilityReportNode, SuggestedFixesNode }
