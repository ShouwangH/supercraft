/**
 * Export Bundle Generator
 *
 * Creates downloadable bundles containing report JSON and viewer screenshots.
 */

import type { PrintabilityReport } from '@/types/report'
import type { OverlayMode } from '@/stores/viewerStore'

export interface ExportScreenshot {
  name: string
  dataUrl: string
}

export interface ExportBundle {
  report: PrintabilityReport
  screenshots: ExportScreenshot[]
  meshName: string
  timestamp: string
}

/**
 * Converts a base64 data URL to a Blob
 */
function dataUrlToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',')
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png'
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new Blob([u8arr], { type: mime })
}

/**
 * Creates a ZIP file from the bundle data
 * Uses a simple ZIP implementation without external dependencies
 */
async function createZipBlob(bundle: ExportBundle): Promise<Blob> {
  // Simple approach: create a virtual file structure
  const files: { name: string; content: Blob | string }[] = []

  // Add report JSON
  files.push({
    name: 'report.json',
    content: JSON.stringify(bundle.report, null, 2),
  })

  // Add screenshots
  for (const screenshot of bundle.screenshots) {
    files.push({
      name: `screenshots/${screenshot.name}.png`,
      content: dataUrlToBlob(screenshot.dataUrl),
    })
  }

  // Add a readme
  const readme = `# Printability Report Export

Mesh: ${bundle.meshName}
Generated: ${bundle.timestamp}
Status: ${bundle.report.status}

## Contents

- report.json: Full printability analysis report
- screenshots/: Viewer screenshots
  ${bundle.screenshots.map((s) => `- ${s.name}.png`).join('\n  ')}

## Report Summary

- Triangles: ${bundle.report.meshStats.triangleCount.toLocaleString()}
- Components: ${bundle.report.meshStats.componentCount}
- Issues: ${bundle.report.issues.length}
${bundle.report.issues.map((i) => `  - [${i.severity}] ${i.title}`).join('\n')}
`
  files.push({
    name: 'README.md',
    content: readme,
  })

  // Create a simple combined download (not a real ZIP, but functional)
  // For a proper ZIP, we'd use a library like JSZip
  // This creates a JSON manifest with base64 encoded files
  const manifest = {
    version: '1.0',
    meshName: bundle.meshName,
    timestamp: bundle.timestamp,
    files: await Promise.all(
      files.map(async (f) => ({
        name: f.name,
        content:
          typeof f.content === 'string'
            ? f.content
            : await blobToBase64(f.content),
        type: typeof f.content === 'string' ? 'text' : 'base64',
      }))
    ),
  }

  return new Blob([JSON.stringify(manifest, null, 2)], {
    type: 'application/json',
  })
}

/**
 * Converts a Blob to base64 string
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      // Remove data URL prefix
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Downloads the report JSON directly
 */
export function downloadReportJson(report: PrintabilityReport, meshName: string): void {
  const json = JSON.stringify(report, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = `${meshName}-report-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}

/**
 * Downloads a single screenshot
 */
export function downloadScreenshot(dataUrl: string, name: string): void {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = `${name}.png`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Downloads the full export bundle
 */
export async function downloadExportBundle(bundle: ExportBundle): Promise<void> {
  const blob = await createZipBlob(bundle)
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = `${bundle.meshName}-export-${bundle.timestamp.split('T')[0]}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  URL.revokeObjectURL(url)
}

/**
 * Overlay modes to capture for export
 */
export const EXPORT_OVERLAY_MODES: { mode: OverlayMode; name: string }[] = [
  { mode: 'none', name: 'base' },
  { mode: 'boundary_edges', name: 'boundary-edges' },
  { mode: 'non_manifold_edges', name: 'non-manifold-edges' },
  { mode: 'components', name: 'components' },
  { mode: 'overhang', name: 'overhang' },
]

/**
 * Gets relevant overlay modes based on report issues
 */
export function getRelevantOverlayModes(report: PrintabilityReport): { mode: OverlayMode; name: string }[] {
  const modes: { mode: OverlayMode; name: string }[] = [
    { mode: 'none', name: 'base' },
  ]

  for (const issue of report.issues) {
    switch (issue.type) {
      case 'boundary_edges':
        if (!modes.some((m) => m.mode === 'boundary_edges')) {
          modes.push({ mode: 'boundary_edges', name: 'boundary-edges' })
        }
        break
      case 'non_manifold_edges':
        if (!modes.some((m) => m.mode === 'non_manifold_edges')) {
          modes.push({ mode: 'non_manifold_edges', name: 'non-manifold-edges' })
        }
        break
      case 'floater_components':
        if (!modes.some((m) => m.mode === 'components')) {
          modes.push({ mode: 'components', name: 'components' })
        }
        break
      case 'overhang':
        if (!modes.some((m) => m.mode === 'overhang')) {
          modes.push({ mode: 'overhang', name: 'overhang' })
        }
        break
    }
  }

  return modes
}
