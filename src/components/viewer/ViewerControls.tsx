'use client'

import { useViewerStore } from '@/stores/viewerStore'

export function ViewerControls() {
  const { showGrid, showAxes, wireframe, toggleGrid, toggleAxes, toggleWireframe } =
    useViewerStore()

  return (
    <div className="absolute bottom-4 left-4 flex gap-2">
      <button
        onClick={toggleGrid}
        className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
          showGrid
            ? 'bg-blue-600 text-white'
            : 'bg-neutral-700 text-gray-300 hover:bg-neutral-600'
        }`}
        title="Toggle Grid"
      >
        Grid
      </button>
      <button
        onClick={toggleAxes}
        className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
          showAxes
            ? 'bg-blue-600 text-white'
            : 'bg-neutral-700 text-gray-300 hover:bg-neutral-600'
        }`}
        title="Toggle Axes"
      >
        Axes
      </button>
      <button
        onClick={toggleWireframe}
        className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
          wireframe
            ? 'bg-blue-600 text-white'
            : 'bg-neutral-700 text-gray-300 hover:bg-neutral-600'
        }`}
        title="Toggle Wireframe"
      >
        Wire
      </button>
    </div>
  )
}
