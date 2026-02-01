import { useState, useRef, useEffect, useCallback } from 'react';

interface TextOverlayComposerProps {
  backgroundImage: string;
  onExport: (dataUrl: string) => void;
  onCancel: () => void;
  width?: number;
  height?: number;
}

interface TextOverlay {
  text: string;
  position: 'top' | 'center' | 'bottom';
  fontSize: number;
  color: string;
  fontFamily: string;
  shadow: boolean;
  shadowColor: string;
  shadowBlur: number;
}

const FONT_FAMILIES = [
  'Arial',
  'Helvetica',
  'Georgia',
  'Times New Roman',
  'Verdana',
  'Impact',
  'Arial Black',
];

export default function TextOverlayComposer({
  backgroundImage,
  onExport,
  onCancel,
  width = 1920,
  height = 1080,
}: TextOverlayComposerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [bgImage, setBgImage] = useState<HTMLImageElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [overlay, setOverlay] = useState<TextOverlay>({
    text: 'Your Text Here',
    position: 'center',
    fontSize: 72,
    color: '#ffffff',
    fontFamily: 'Arial',
    shadow: true,
    shadowColor: '#000000',
    shadowBlur: 10,
  });

  // Load background image
  useEffect(() => {
    setLoading(true);
    setError(null);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setBgImage(img);
      setLoading(false);
    };
    img.onerror = () => {
      setError('Failed to load background image');
      setLoading(false);
    };
    img.src = backgroundImage;
  }, [backgroundImage]);

  // Render canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bgImage) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = width;
    canvas.height = height;

    // Draw background image (cover)
    const imgRatio = bgImage.width / bgImage.height;
    const canvasRatio = width / height;

    let drawWidth, drawHeight, drawX, drawY;

    if (imgRatio > canvasRatio) {
      drawHeight = height;
      drawWidth = bgImage.width * (height / bgImage.height);
      drawX = (width - drawWidth) / 2;
      drawY = 0;
    } else {
      drawWidth = width;
      drawHeight = bgImage.height * (width / bgImage.width);
      drawX = 0;
      drawY = (height - drawHeight) / 2;
    }

    ctx.drawImage(bgImage, drawX, drawY, drawWidth, drawHeight);

    // Draw text overlay
    if (overlay.text) {
      ctx.font = `bold ${overlay.fontSize}px ${overlay.fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Calculate Y position based on position setting
      let textY: number;
      switch (overlay.position) {
        case 'top':
          textY = height * 0.15;
          break;
        case 'bottom':
          textY = height * 0.85;
          break;
        case 'center':
        default:
          textY = height / 2;
      }

      // Draw shadow if enabled
      if (overlay.shadow) {
        ctx.shadowColor = overlay.shadowColor;
        ctx.shadowBlur = overlay.shadowBlur;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
      }

      // Draw text
      ctx.fillStyle = overlay.color;

      // Word wrap for long text
      const words = overlay.text.split(' ');
      const maxWidth = width * 0.8;
      const lines: string[] = [];
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const metrics = ctx.measureText(testLine);

        if (metrics.width > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);

      // Draw each line
      const lineHeight = overlay.fontSize * 1.2;
      const totalHeight = lines.length * lineHeight;
      const startY = textY - totalHeight / 2 + lineHeight / 2;

      lines.forEach((line, index) => {
        ctx.fillText(line, width / 2, startY + index * lineHeight);
      });

      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }
  }, [bgImage, width, height, overlay]);

  // Re-render on changes
  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Handle export
  const handleExport = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const dataUrl = canvas.toDataURL('image/png');
      onExport(dataUrl);
    } catch (err) {
      setError('Failed to export image. The background may have CORS restrictions.');
    }
  };

  // Calculate preview scale
  const previewScale = Math.min(600 / width, 400 / height);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Text Overlay Composer</h3>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-gray-100 rounded-md transition-colors"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="flex gap-6">
            {/* Preview */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Preview</label>
              <div className="bg-gray-100 rounded-lg p-4 flex items-center justify-center">
                {loading ? (
                  <div className="text-gray-500">Loading background...</div>
                ) : error ? (
                  <div className="text-red-500">{error}</div>
                ) : (
                  <canvas
                    ref={canvasRef}
                    style={{
                      width: width * previewScale,
                      height: height * previewScale,
                    }}
                    className="shadow-lg rounded"
                  />
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">
                {width} x {height}px
              </p>
            </div>

            {/* Controls */}
            <div className="w-72 space-y-4">
              {/* Text Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Overlay Text
                </label>
                <textarea
                  value={overlay.text}
                  onChange={(e) => setOverlay(prev => ({ ...prev, text: e.target.value }))}
                  rows={3}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your text..."
                />
              </div>

              {/* Position */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Position
                </label>
                <div className="flex gap-2">
                  {(['top', 'center', 'bottom'] as const).map((pos) => (
                    <button
                      key={pos}
                      onClick={() => setOverlay(prev => ({ ...prev, position: pos }))}
                      className={`flex-1 py-2 text-sm rounded-md border transition-colors ${
                        overlay.position === pos
                          ? 'bg-blue-100 border-blue-500 text-blue-700'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {pos.charAt(0).toUpperCase() + pos.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Family */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Font Family
                </label>
                <select
                  value={overlay.fontFamily}
                  onChange={(e) => setOverlay(prev => ({ ...prev, fontFamily: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {FONT_FAMILIES.map((font) => (
                    <option key={font} value={font} style={{ fontFamily: font }}>
                      {font}
                    </option>
                  ))}
                </select>
              </div>

              {/* Font Size */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Font Size: {overlay.fontSize}px
                </label>
                <input
                  type="range"
                  min="24"
                  max="200"
                  value={overlay.fontSize}
                  onChange={(e) => setOverlay(prev => ({ ...prev, fontSize: parseInt(e.target.value) }))}
                  className="w-full"
                />
              </div>

              {/* Text Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Text Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={overlay.color}
                    onChange={(e) => setOverlay(prev => ({ ...prev, color: e.target.value }))}
                    className="w-10 h-10 border border-gray-300 rounded-md cursor-pointer"
                  />
                  <input
                    type="text"
                    value={overlay.color}
                    onChange={(e) => setOverlay(prev => ({ ...prev, color: e.target.value }))}
                    className="flex-1 text-sm border border-gray-300 rounded-md px-2 py-1.5 font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Shadow Toggle */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={overlay.shadow}
                    onChange={(e) => setOverlay(prev => ({ ...prev, shadow: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Enable Shadow</span>
                </label>
              </div>

              {/* Shadow Options */}
              {overlay.shadow && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Shadow Color
                    </label>
                    <input
                      type="color"
                      value={overlay.shadowColor}
                      onChange={(e) => setOverlay(prev => ({ ...prev, shadowColor: e.target.value }))}
                      className="w-full h-8 border border-gray-300 rounded-md cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Shadow Blur: {overlay.shadowBlur}px
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="50"
                      value={overlay.shadowBlur}
                      onChange={(e) => setOverlay(prev => ({ ...prev, shadowBlur: parseInt(e.target.value) }))}
                      className="w-full"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={loading || !!error}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Export Image
          </button>
        </div>
      </div>
    </div>
  );
}
