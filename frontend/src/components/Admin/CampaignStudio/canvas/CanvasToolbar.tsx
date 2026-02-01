import { useStudio } from '../context/StudioContext';

interface Tool {
  id: 'select' | 'text' | 'shape' | 'image' | 'pan';
  label: string;
  icon: JSX.Element;
}

const TOOLS: Tool[] = [
  {
    id: 'select',
    label: 'Select',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
      </svg>
    ),
  },
  {
    id: 'text',
    label: 'Text',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h8m-8 6h16" />
      </svg>
    ),
  },
  {
    id: 'shape',
    label: 'Shape',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" />
      </svg>
    ),
  },
  {
    id: 'image',
    label: 'Image',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: 'pan',
    label: 'Pan',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
      </svg>
    ),
  },
];

export default function CanvasToolbar() {
  const {
    canvasState,
    setCanvasTool,
    setSelectedShapeType,
    setCanvasZoom,
    canUndo,
    canRedo,
    undo,
    redo,
  } = useStudio();

  const handleZoomReset = () => {
    setCanvasZoom(1);
  };

  const handleZoomFit = () => {
    // TODO: Calculate fit zoom based on canvas and container size
    setCanvasZoom(0.8);
  };

  return (
    <div className="h-12 border-b border-gray-200 bg-white flex items-center justify-between px-3">
      {/* Left: Tools */}
      <div className="flex items-center gap-1">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            onClick={() => setCanvasTool(tool.id)}
            className={`p-2 rounded-md transition-colors ${
              canvasState.selectedTool === tool.id
                ? 'bg-blue-100 text-blue-600'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            title={tool.label}
          >
            {tool.icon}
          </button>
        ))}

        <div className="w-px h-6 bg-gray-200 mx-2" />

        {/* Shape submenu (when shape tool selected) */}
        {canvasState.selectedTool === 'shape' && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSelectedShapeType('rectangle')}
              className={`p-2 rounded-md transition-colors ${
                canvasState.selectedShapeType === 'rectangle'
                  ? 'bg-blue-100 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
              title="Rectangle"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" />
              </svg>
            </button>
            <button
              onClick={() => setSelectedShapeType('circle')}
              className={`p-2 rounded-md transition-colors ${
                canvasState.selectedShapeType === 'circle'
                  ? 'bg-blue-100 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
              title="Circle"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="8" strokeWidth={2} />
              </svg>
            </button>
            <button
              onClick={() => setSelectedShapeType('line')}
              className={`p-2 rounded-md transition-colors ${
                canvasState.selectedShapeType === 'line'
                  ? 'bg-blue-100 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
              title="Line"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 20l16-16" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Center: Undo/Redo */}
      <div className="flex items-center gap-1">
        <button
          onClick={undo}
          disabled={!canUndo}
          className={`p-2 rounded-md transition-colors ${
            canUndo ? 'text-gray-600 hover:bg-gray-100' : 'text-gray-300 cursor-not-allowed'
          }`}
          title="Undo (Ctrl+Z)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          className={`p-2 rounded-md transition-colors ${
            canRedo ? 'text-gray-600 hover:bg-gray-100' : 'text-gray-300 cursor-not-allowed'
          }`}
          title="Redo (Ctrl+Y)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
          </svg>
        </button>
      </div>

      {/* Right: Zoom & View */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setCanvasZoom(canvasState.zoom - 0.1)}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
          title="Zoom out"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
          </svg>
        </button>

        <button
          onClick={handleZoomReset}
          className="px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded min-w-[60px]"
          title="Reset zoom"
        >
          {Math.round(canvasState.zoom * 100)}%
        </button>

        <button
          onClick={() => setCanvasZoom(canvasState.zoom + 0.1)}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
          title="Zoom in"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
          </svg>
        </button>

        <div className="w-px h-6 bg-gray-200 mx-1" />

        <button
          onClick={handleZoomFit}
          className="p-1.5 rounded hover:bg-gray-100 text-gray-600"
          title="Fit to view"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
      </div>
    </div>
  );
}
