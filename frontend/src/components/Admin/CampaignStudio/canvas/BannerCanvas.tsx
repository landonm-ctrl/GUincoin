import { useEffect, useRef, useState, useCallback } from 'react';
import { useStudio, CanvasLayer } from '../context/StudioContext';
import TextInputDialog, { TextDialogResult } from './TextInputDialog';

// Constants for resize handles
const HANDLE_SIZE = 10;
type HandlePosition = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

// Cursor mapping for resize handles
const HANDLE_CURSORS: Record<HandlePosition, string> = {
  nw: 'nwse-resize',
  n: 'ns-resize',
  ne: 'nesw-resize',
  e: 'ew-resize',
  se: 'nwse-resize',
  s: 'ns-resize',
  sw: 'nesw-resize',
  w: 'ew-resize',
};

// Banner dimension presets
const BANNER_PRESETS = {
  header: { width: 728, height: 90, label: 'Header (728x90)' },
  sidebar: { width: 160, height: 600, label: 'Sidebar (160x600)' },
  poster: { width: 800, height: 600, label: 'Poster (800x600)' },
  email: { width: 600, height: 200, label: 'Email (600x200)' },
  chat: { width: 400, height: 300, label: 'Chat (400x300)' },
  background: { width: 1920, height: 1080, label: 'Background (1920x1080)' },
};

type BannerPreset = keyof typeof BANNER_PRESETS;

export default function BannerCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { canvasState, selectedCampaign, getCurrentTheme, setSelectedObjects, setCanvasTool, layers, setLayers } = useStudio();

  const [selectedPreset, setSelectedPreset] = useState<BannerPreset>('header');
  const [canvasDimensions, setCanvasDimensions] = useState(BANNER_PRESETS.header);
  const [isDragOver, setIsDragOver] = useState(false);
  const [loadedImages, setLoadedImages] = useState<Map<string, HTMLImageElement>>(new Map());

  // Drag and resize state
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [activeHandle, setActiveHandle] = useState<HandlePosition | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; layerX: number; layerY: number } | null>(null);
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; layerX: number; layerY: number; layerWidth: number; layerHeight: number } | null>(null);
  const [cursorStyle, setCursorStyle] = useState<string>('default');

  // Text input dialog state
  const [showTextDialog, setShowTextDialog] = useState(false);
  const [textDialogPosition, setTextDialogPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Shape drawing state
  const [isDrawingShape, setIsDrawingShape] = useState(false);
  const [shapeDrawStart, setShapeDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [shapeDrawCurrent, setShapeDrawCurrent] = useState<{ x: number; y: number } | null>(null);

  // History state for undo/redo - using local history but syncing with context layers
  const [layerHistory, setLayerHistory] = useState<CanvasLayer[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < layerHistory.length - 1;

  // Sync context layers with local history
  useEffect(() => {
    if (JSON.stringify(layers) !== JSON.stringify(layerHistory[historyIndex])) {
      // External change - add to history
      const newHistory = layerHistory.slice(0, historyIndex + 1);
      newHistory.push(layers);
      setLayerHistory(newHistory.slice(-50)); // Limit to 50 entries
      setHistoryIndex(newHistory.length - 1);
    }
  }, [layers]);

  const pushLayers = useCallback((newLayers: CanvasLayer[]) => {
    setLayers(newLayers);
  }, [setLayers]);

  const undo = useCallback(() => {
    if (canUndo) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setLayers(layerHistory[newIndex]);
    }
  }, [canUndo, historyIndex, layerHistory, setLayers]);

  const redo = useCallback(() => {
    if (canRedo) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setLayers(layerHistory[newIndex]);
    }
  }, [canRedo, historyIndex, layerHistory, setLayers]);

  const theme = getCurrentTheme();

  // Get canvas coordinates from mouse event
  const getCanvasCoordinates = useCallback((e: React.MouseEvent | MouseEvent): { x: number; y: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scale = calculateScale();
    return {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale,
    };
  }, []);

  // Get which handle (if any) is at the given position for a layer
  const getHandleAtPosition = useCallback((x: number, y: number, layer: CanvasLayer): HandlePosition | null => {
    const halfHandle = HANDLE_SIZE / 2;
    const handles: { pos: HandlePosition; cx: number; cy: number }[] = [
      { pos: 'nw', cx: layer.x, cy: layer.y },
      { pos: 'n', cx: layer.x + layer.width / 2, cy: layer.y },
      { pos: 'ne', cx: layer.x + layer.width, cy: layer.y },
      { pos: 'e', cx: layer.x + layer.width, cy: layer.y + layer.height / 2 },
      { pos: 'se', cx: layer.x + layer.width, cy: layer.y + layer.height },
      { pos: 's', cx: layer.x + layer.width / 2, cy: layer.y + layer.height },
      { pos: 'sw', cx: layer.x, cy: layer.y + layer.height },
      { pos: 'w', cx: layer.x, cy: layer.y + layer.height / 2 },
    ];

    for (const handle of handles) {
      if (
        x >= handle.cx - halfHandle &&
        x <= handle.cx + halfHandle &&
        y >= handle.cy - halfHandle &&
        y <= handle.cy + halfHandle
      ) {
        return handle.pos;
      }
    }
    return null;
  }, []);

  // Calculate new dimensions based on resize handle and mouse position
  const calculateResize = useCallback((
    handle: HandlePosition,
    currentX: number,
    currentY: number,
    start: NonNullable<typeof resizeStart>,
    shiftKey: boolean
  ): { x: number; y: number; width: number; height: number } => {
    let newX = start.layerX;
    let newY = start.layerY;
    let newWidth = start.layerWidth;
    let newHeight = start.layerHeight;

    const deltaX = currentX - start.x;
    const deltaY = currentY - start.y;
    const aspectRatio = start.layerWidth / start.layerHeight;

    switch (handle) {
      case 'e':
        newWidth = Math.max(20, start.layerWidth + deltaX);
        if (shiftKey) newHeight = newWidth / aspectRatio;
        break;
      case 'w':
        newWidth = Math.max(20, start.layerWidth - deltaX);
        newX = start.layerX + (start.layerWidth - newWidth);
        if (shiftKey) newHeight = newWidth / aspectRatio;
        break;
      case 's':
        newHeight = Math.max(20, start.layerHeight + deltaY);
        if (shiftKey) newWidth = newHeight * aspectRatio;
        break;
      case 'n':
        newHeight = Math.max(20, start.layerHeight - deltaY);
        newY = start.layerY + (start.layerHeight - newHeight);
        if (shiftKey) newWidth = newHeight * aspectRatio;
        break;
      case 'se':
        newWidth = Math.max(20, start.layerWidth + deltaX);
        newHeight = Math.max(20, start.layerHeight + deltaY);
        if (shiftKey) {
          const ratio = Math.max(deltaX / start.layerWidth, deltaY / start.layerHeight);
          newWidth = Math.max(20, start.layerWidth * (1 + ratio));
          newHeight = newWidth / aspectRatio;
        }
        break;
      case 'sw':
        newWidth = Math.max(20, start.layerWidth - deltaX);
        newHeight = Math.max(20, start.layerHeight + deltaY);
        newX = start.layerX + (start.layerWidth - newWidth);
        if (shiftKey) {
          newHeight = newWidth / aspectRatio;
        }
        break;
      case 'ne':
        newWidth = Math.max(20, start.layerWidth + deltaX);
        newHeight = Math.max(20, start.layerHeight - deltaY);
        newY = start.layerY + (start.layerHeight - newHeight);
        if (shiftKey) {
          newHeight = newWidth / aspectRatio;
          newY = start.layerY + start.layerHeight - newHeight;
        }
        break;
      case 'nw':
        newWidth = Math.max(20, start.layerWidth - deltaX);
        newHeight = Math.max(20, start.layerHeight - deltaY);
        newX = start.layerX + (start.layerWidth - newWidth);
        newY = start.layerY + (start.layerHeight - newHeight);
        if (shiftKey) {
          const ratio = Math.max(-deltaX / start.layerWidth, -deltaY / start.layerHeight);
          newWidth = Math.max(20, start.layerWidth * (1 + ratio));
          newHeight = newWidth / aspectRatio;
          newX = start.layerX + start.layerWidth - newWidth;
          newY = start.layerY + start.layerHeight - newHeight;
        }
        break;
    }

    return { x: newX, y: newY, width: newWidth, height: newHeight };
  }, []);

  // Load image helper
  const loadImage = useCallback((url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }, []);

  // Render canvas
  const renderCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvasDimensions.width;
    canvas.height = canvasDimensions.height;

    // Draw background
    const bgColor = rgbToHex(theme.surfaceColor);
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw gradient overlay
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, rgbToHex(theme.primaryColor) + '20');
    gradient.addColorStop(1, rgbToHex(theme.secondaryColor) + '20');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw layers (sorted by zIndex)
    const sortedLayers = [...layers].sort((a, b) => a.zIndex - b.zIndex);

    for (const layer of sortedLayers) {
      if (layer.type === 'image') {
        let img = loadedImages.get(layer.content);
        if (!img) {
          try {
            img = await loadImage(layer.content);
            setLoadedImages(prev => new Map(prev).set(layer.content, img!));
          } catch (e) {
            console.error('Failed to load image:', e);
            // Draw placeholder for failed image
            ctx.fillStyle = '#e5e7eb';
            ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
            ctx.fillStyle = '#9ca3af';
            ctx.font = '14px system-ui';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Image failed to load', layer.x + layer.width / 2, layer.y + layer.height / 2);
            continue;
          }
        }
        ctx.drawImage(img, layer.x, layer.y, layer.width, layer.height);
      } else if (layer.type === 'text') {
        const style = layer.textStyle || {
          fontFamily: 'system-ui',
          fontSize: 24,
          fontWeight: 'bold' as const,
          fontStyle: 'normal' as const,
          color: rgbToHex(theme.textPrimaryColor),
          textAlign: 'left' as const,
        };

        ctx.fillStyle = style.color;
        ctx.font = `${style.fontStyle === 'italic' ? 'italic ' : ''}${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`;
        ctx.textAlign = style.textAlign;
        ctx.textBaseline = 'top';

        // Word wrap support
        const words = layer.content.split(' ');
        const maxWidth = layer.width || canvasDimensions.width - layer.x - 20;
        let line = '';
        let lineY = layer.y;
        const lineHeight = style.fontSize * 1.2;

        for (const word of words) {
          const testLine = line + (line ? ' ' : '') + word;
          const metrics = ctx.measureText(testLine);

          if (metrics.width > maxWidth && line) {
            const drawX = style.textAlign === 'center' ? layer.x + maxWidth / 2
                        : style.textAlign === 'right' ? layer.x + maxWidth
                        : layer.x;
            ctx.fillText(line, drawX, lineY);
            line = word;
            lineY += lineHeight;
          } else {
            line = testLine;
          }
        }

        if (line) {
          const drawX = style.textAlign === 'center' ? layer.x + maxWidth / 2
                      : style.textAlign === 'right' ? layer.x + maxWidth
                      : layer.x;
          ctx.fillText(line, drawX, lineY);
        }
      } else if (layer.type === 'shape') {
        const style = layer.shapeStyle || {
          fill: '#3b82f6',
          stroke: '#1e40af',
          strokeWidth: 2,
        };

        ctx.fillStyle = style.fill;
        ctx.strokeStyle = style.stroke;
        ctx.lineWidth = style.strokeWidth;

        switch (layer.shapeType) {
          case 'rectangle':
            ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
            if (style.strokeWidth > 0) {
              ctx.strokeRect(layer.x, layer.y, layer.width, layer.height);
            }
            break;
          case 'circle':
            ctx.beginPath();
            ctx.ellipse(
              layer.x + layer.width / 2,
              layer.y + layer.height / 2,
              layer.width / 2,
              layer.height / 2,
              0, 0, Math.PI * 2
            );
            ctx.fill();
            if (style.strokeWidth > 0) {
              ctx.stroke();
            }
            break;
          case 'line':
            ctx.beginPath();
            ctx.moveTo(layer.x, layer.y);
            ctx.lineTo(layer.x + layer.width, layer.y + layer.height);
            ctx.stroke();
            break;
        }
      }

      // Draw selection border and resize handles if selected
      if (canvasState.selectedObjectIds.includes(layer.id)) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(layer.x - 2, layer.y - 2, layer.width + 4, layer.height + 4);
        ctx.setLineDash([]);

        // Draw resize handles
        const halfHandle = HANDLE_SIZE / 2;
        const handles = [
          { x: layer.x, y: layer.y }, // NW
          { x: layer.x + layer.width / 2, y: layer.y }, // N
          { x: layer.x + layer.width, y: layer.y }, // NE
          { x: layer.x + layer.width, y: layer.y + layer.height / 2 }, // E
          { x: layer.x + layer.width, y: layer.y + layer.height }, // SE
          { x: layer.x + layer.width / 2, y: layer.y + layer.height }, // S
          { x: layer.x, y: layer.y + layer.height }, // SW
          { x: layer.x, y: layer.y + layer.height / 2 }, // W
        ];

        for (const handle of handles) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(handle.x - halfHandle, handle.y - halfHandle, HANDLE_SIZE, HANDLE_SIZE);
          ctx.strokeStyle = '#3b82f6';
          ctx.lineWidth = 1;
          ctx.strokeRect(handle.x - halfHandle, handle.y - halfHandle, HANDLE_SIZE, HANDLE_SIZE);
        }
      }
    }

    // Draw shape preview while drawing
    if (isDrawingShape && shapeDrawStart && shapeDrawCurrent && canvasState.selectedTool === 'shape') {
      const x = Math.min(shapeDrawStart.x, shapeDrawCurrent.x);
      const y = Math.min(shapeDrawStart.y, shapeDrawCurrent.y);
      const width = Math.abs(shapeDrawCurrent.x - shapeDrawStart.x);
      const height = Math.abs(shapeDrawCurrent.y - shapeDrawStart.y);

      ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);

      // Use selectedShapeType from context or default to rectangle
      const shapeType = (canvasState as { selectedShapeType?: string }).selectedShapeType || 'rectangle';

      switch (shapeType) {
        case 'rectangle':
          ctx.fillRect(x, y, width, height);
          ctx.strokeRect(x, y, width, height);
          break;
        case 'circle':
          ctx.beginPath();
          ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          break;
        case 'line':
          ctx.beginPath();
          ctx.moveTo(shapeDrawStart.x, shapeDrawStart.y);
          ctx.lineTo(shapeDrawCurrent.x, shapeDrawCurrent.y);
          ctx.stroke();
          break;
      }
      ctx.setLineDash([]);
    }

    // If no layers, draw placeholder text
    if (layers.length === 0) {
      ctx.fillStyle = rgbToHex(theme.textPrimaryColor);
      ctx.font = 'bold 24px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const text = selectedCampaign?.name || 'Drop images here';
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    }

    // Draw border
    ctx.strokeStyle = rgbToHex(theme.primaryColor);
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);

  }, [canvasDimensions, theme, selectedCampaign, layers, loadedImages, loadImage, canvasState.selectedObjectIds, canvasState.selectedTool, canvasState, isDrawingShape, shapeDrawStart, shapeDrawCurrent]);

  // Re-render on changes
  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Handle preset change
  const handlePresetChange = (preset: BannerPreset) => {
    setSelectedPreset(preset);
    setCanvasDimensions(BANNER_PRESETS[preset]);
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  // Handle drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const data = e.dataTransfer.getData('application/json');
    if (!data) return;

    try {
      const asset = JSON.parse(data);
      if (!asset.url) return;

      // Calculate drop position relative to canvas
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scale = calculateScale();
      const x = (e.clientX - rect.left) / scale;
      const y = (e.clientY - rect.top) / scale;

      // Calculate size to fit within canvas while maintaining aspect ratio
      const maxWidth = canvasDimensions.width * 0.8;
      const maxHeight = canvasDimensions.height * 0.8;
      let width = asset.dimensions?.width || maxWidth;
      let height = asset.dimensions?.height || maxHeight;

      if (width > maxWidth) {
        const ratio = maxWidth / width;
        width = maxWidth;
        height = height * ratio;
      }
      if (height > maxHeight) {
        const ratio = maxHeight / height;
        height = maxHeight;
        width = width * ratio;
      }

      // Center the dropped image at drop point
      const layerId = `layer-${Date.now()}`;
      const newLayer: CanvasLayer = {
        id: layerId,
        type: 'image',
        x: Math.max(0, Math.min(x - width / 2, canvasDimensions.width - width)),
        y: Math.max(0, Math.min(y - height / 2, canvasDimensions.height - height)),
        width,
        height,
        content: asset.url,
        zIndex: layers.length,
      };

      pushLayers([...layers, newLayer]);
      setSelectedObjects([layerId]);

      // Show success toast
      if (typeof window !== 'undefined' && (window as { showToast?: (msg: string, type: string) => void }).showToast) {
        (window as { showToast?: (msg: string, type: string) => void }).showToast?.('Image added', 'success');
      }
    } catch (err) {
      console.error('Failed to parse dropped asset:', err);
      // Show error toast
      if (typeof window !== 'undefined' && (window as { showToast?: (msg: string, type: string) => void }).showToast) {
        (window as { showToast?: (msg: string, type: string) => void }).showToast?.('Failed to add image', 'error');
      }
    }
  };

  // Handle canvas mouse down
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    const coords = getCanvasCoordinates(e);
    const { x, y } = coords;

    // Handle text tool - open dialog on click
    if (canvasState.selectedTool === 'text') {
      setTextDialogPosition({ x, y });
      setShowTextDialog(true);
      return;
    }

    // Handle shape tool - start drawing
    if (canvasState.selectedTool === 'shape') {
      setIsDrawingShape(true);
      setShapeDrawStart({ x, y });
      setShapeDrawCurrent({ x, y });
      return;
    }

    // For select tool, check if clicking on a selected layer's resize handle
    if (canvasState.selectedObjectIds.length > 0) {
      const selectedLayer = layers.find(l => canvasState.selectedObjectIds.includes(l.id));
      if (selectedLayer) {
        const handle = getHandleAtPosition(x, y, selectedLayer);
        if (handle) {
          setIsResizing(true);
          setActiveHandle(handle);
          setResizeStart({
            x,
            y,
            layerX: selectedLayer.x,
            layerY: selectedLayer.y,
            layerWidth: selectedLayer.width,
            layerHeight: selectedLayer.height,
          });
          return;
        }

        // Check if clicking inside the selected layer (for dragging)
        if (
          x >= selectedLayer.x &&
          x <= selectedLayer.x + selectedLayer.width &&
          y >= selectedLayer.y &&
          y <= selectedLayer.y + selectedLayer.height
        ) {
          setIsDragging(true);
          setDragStart({
            x,
            y,
            layerX: selectedLayer.x,
            layerY: selectedLayer.y,
          });
          return;
        }
      }
    }

    // Find clicked layer (top-most first)
    const sortedLayers = [...layers].sort((a, b) => b.zIndex - a.zIndex);
    for (const layer of sortedLayers) {
      if (
        x >= layer.x &&
        x <= layer.x + layer.width &&
        y >= layer.y &&
        y <= layer.y + layer.height
      ) {
        setSelectedObjects([layer.id]);
        // Start dragging immediately if we just selected
        setIsDragging(true);
        setDragStart({
          x,
          y,
          layerX: layer.x,
          layerY: layer.y,
        });
        return;
      }
    }

    // Clicked on empty area
    setSelectedObjects([]);
  };

  // Handle canvas mouse move
  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    const coords = getCanvasCoordinates(e);
    const { x, y } = coords;

    // Handle shape drawing preview
    if (isDrawingShape && canvasState.selectedTool === 'shape') {
      setShapeDrawCurrent({ x, y });
      return;
    }

    // Handle dragging
    if (isDragging && dragStart && canvasState.selectedObjectIds.length > 0) {
      const deltaX = x - dragStart.x;
      const deltaY = y - dragStart.y;

      const updatedLayers = layers.map(layer => {
        if (canvasState.selectedObjectIds.includes(layer.id)) {
          return {
            ...layer,
            x: Math.max(0, Math.min(dragStart.layerX + deltaX, canvasDimensions.width - layer.width)),
            y: Math.max(0, Math.min(dragStart.layerY + deltaY, canvasDimensions.height - layer.height)),
          };
        }
        return layer;
      });

      // Update layers without pushing to history (will push on mouse up)
      pushLayers(updatedLayers);
      return;
    }

    // Handle resizing
    if (isResizing && resizeStart && activeHandle && canvasState.selectedObjectIds.length > 0) {
      const newDimensions = calculateResize(activeHandle, x, y, resizeStart, e.shiftKey);

      const updatedLayers = layers.map(layer => {
        if (canvasState.selectedObjectIds.includes(layer.id)) {
          return {
            ...layer,
            x: Math.max(0, newDimensions.x),
            y: Math.max(0, newDimensions.y),
            width: newDimensions.width,
            height: newDimensions.height,
          };
        }
        return layer;
      });

      pushLayers(updatedLayers);
      return;
    }

    // Update cursor based on hover position
    if (canvasState.selectedObjectIds.length > 0) {
      const selectedLayer = layers.find(l => canvasState.selectedObjectIds.includes(l.id));
      if (selectedLayer) {
        const handle = getHandleAtPosition(x, y, selectedLayer);
        if (handle) {
          setCursorStyle(HANDLE_CURSORS[handle]);
          return;
        }

        if (
          x >= selectedLayer.x &&
          x <= selectedLayer.x + selectedLayer.width &&
          y >= selectedLayer.y &&
          y <= selectedLayer.y + selectedLayer.height
        ) {
          setCursorStyle('move');
          return;
        }
      }
    }

    setCursorStyle('default');
  };

  // Handle canvas mouse up
  const handleCanvasMouseUp = (e: React.MouseEvent) => {
    // Finalize shape drawing
    if (isDrawingShape && shapeDrawStart && shapeDrawCurrent && canvasState.selectedTool === 'shape') {
      const x = Math.min(shapeDrawStart.x, shapeDrawCurrent.x);
      const y = Math.min(shapeDrawStart.y, shapeDrawCurrent.y);
      const width = Math.abs(shapeDrawCurrent.x - shapeDrawStart.x);
      const height = Math.abs(shapeDrawCurrent.y - shapeDrawStart.y);

      // Only create shape if it has some size
      if (width > 5 && height > 5) {
        const shapeType = ((canvasState as { selectedShapeType?: string }).selectedShapeType || 'rectangle') as 'rectangle' | 'circle' | 'line';
        const layerId = `layer-${Date.now()}`;
        const newLayer: CanvasLayer = {
          id: layerId,
          type: 'shape',
          x,
          y,
          width,
          height,
          content: '',
          zIndex: layers.length,
          shapeType,
          shapeStyle: {
            fill: '#3b82f6',
            stroke: '#1e40af',
            strokeWidth: 2,
          },
        };

        pushLayers([...layers, newLayer]);
        setSelectedObjects([layerId]);
        setCanvasTool('select');

        // Show success toast
        if (typeof window !== 'undefined' && (window as { showToast?: (msg: string, type: string) => void }).showToast) {
          (window as { showToast?: (msg: string, type: string) => void }).showToast?.('Shape added', 'success');
        }
      }

      setIsDrawingShape(false);
      setShapeDrawStart(null);
      setShapeDrawCurrent(null);
      return;
    }

    // End dragging/resizing
    setIsDragging(false);
    setIsResizing(false);
    setActiveHandle(null);
    setDragStart(null);
    setResizeStart(null);
  };

  // Handle text dialog submit
  const handleTextDialogSubmit = (result: TextDialogResult) => {
    const layerId = `layer-${Date.now()}`;
    const newLayer: CanvasLayer = {
      id: layerId,
      type: 'text',
      x: textDialogPosition.x,
      y: textDialogPosition.y,
      width: 200,
      height: result.fontSize * 1.5,
      content: result.text,
      zIndex: layers.length,
      textStyle: {
        fontFamily: result.fontFamily,
        fontSize: result.fontSize,
        fontWeight: result.bold ? 'bold' : 'normal',
        fontStyle: result.italic ? 'italic' : 'normal',
        color: result.color,
        textAlign: 'left',
      },
    };

    pushLayers([...layers, newLayer]);
    setSelectedObjects([layerId]);
    setShowTextDialog(false);
    setCanvasTool('select');

    // Show success toast
    if (typeof window !== 'undefined' && (window as { showToast?: (msg: string, type: string) => void }).showToast) {
      (window as { showToast?: (msg: string, type: string) => void }).showToast?.('Text created', 'success');
    }
  };

  // Delete selected layer
  const handleDeleteSelected = useCallback(() => {
    if (canvasState.selectedObjectIds.length === 0) return;
    pushLayers(layers.filter(l => !canvasState.selectedObjectIds.includes(l.id)));
    setSelectedObjects([]);
  }, [canvasState.selectedObjectIds, setSelectedObjects, layers, pushLayers]);

  // Clear all layers
  const handleClearCanvas = () => {
    if (!confirm('Clear all layers from the canvas?')) return;
    pushLayers([]);
    setSelectedObjects([]);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Ctrl+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) undo();
        return;
      }

      // Ctrl+Y or Ctrl+Shift+Z for redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        if (canRedo) redo();
        return;
      }

      // Delete or Backspace to remove selected layer
      if ((e.key === 'Delete' || e.key === 'Backspace') && canvasState.selectedObjectIds.length > 0) {
        e.preventDefault();
        handleDeleteSelected();
      }

      // Escape to deselect
      if (e.key === 'Escape') {
        setSelectedObjects([]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canvasState.selectedObjectIds, handleDeleteSelected, setSelectedObjects, canUndo, canRedo, undo, redo]);

  // Calculate scale to fit canvas in container
  const calculateScale = () => {
    if (!containerRef.current) return 1;

    const containerWidth = containerRef.current.clientWidth - 48;
    const containerHeight = containerRef.current.clientHeight - 120;

    const scaleX = containerWidth / canvasDimensions.width;
    const scaleY = containerHeight / canvasDimensions.height;

    return Math.min(scaleX, scaleY, 1) * canvasState.zoom;
  };

  const scale = calculateScale();

  return (
    <div ref={containerRef} className="h-full flex flex-col bg-gray-100">
      {/* Preset Selector */}
      <div className="p-3 bg-white border-b border-gray-200 flex items-center gap-4">
        <label className="text-sm font-medium text-gray-700">Canvas Size:</label>
        <select
          value={selectedPreset}
          onChange={(e) => handlePresetChange(e.target.value as BannerPreset)}
          className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {Object.entries(BANNER_PRESETS).map(([key, value]) => (
            <option key={key} value={key}>
              {value.label}
            </option>
          ))}
        </select>

        <span className="text-sm text-gray-500">
          {canvasDimensions.width} x {canvasDimensions.height}px
        </span>

        {/* Undo/Redo buttons */}
        <div className="flex items-center gap-1 border-l border-gray-200 pl-4 ml-2">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
            title="Undo (Ctrl+Z)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="p-1.5 text-gray-600 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
            title="Redo (Ctrl+Y)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
            </svg>
          </button>
        </div>

        <div className="flex-1" />

        {layers.length > 0 && (
          <>
            {canvasState.selectedObjectIds.length > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-md"
              >
                Delete Selected
              </button>
            )}
            <button
              onClick={handleClearCanvas}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
            >
              Clear All
            </button>
          </>
        )}

        <button
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
          onClick={() => {
            try {
              const canvas = canvasRef.current;
              if (!canvas) {
                throw new Error('Canvas not available');
              }
              const link = document.createElement('a');
              link.download = `${selectedCampaign?.slug || 'banner'}-${selectedPreset}.png`;
              link.href = canvas.toDataURL('image/png');
              link.click();

              // Show success toast
              if (typeof window !== 'undefined' && (window as { showToast?: (msg: string, type: string) => void }).showToast) {
                (window as { showToast?: (msg: string, type: string) => void }).showToast?.('Image exported successfully', 'success');
              }
            } catch (err) {
              console.error('Failed to export canvas:', err);
              // Show error toast
              if (typeof window !== 'undefined' && (window as { showToast?: (msg: string, type: string) => void }).showToast) {
                (window as { showToast?: (msg: string, type: string) => void }).showToast?.('Failed to export image. Some images may have CORS restrictions.', 'error');
              }
            }
          }}
        >
          Export PNG
        </button>
      </div>

      {/* Canvas Area */}
      <div
        className="flex-1 flex items-center justify-center p-6 overflow-auto"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div
          className={`relative bg-white shadow-lg transition-all ${
            isDragOver ? 'ring-4 ring-blue-400 ring-opacity-50' : ''
          }`}
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
          }}
        >
          {/* Checkerboard background for transparency */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `
                linear-gradient(45deg, #ccc 25%, transparent 25%),
                linear-gradient(-45deg, #ccc 25%, transparent 25%),
                linear-gradient(45deg, transparent 75%, #ccc 75%),
                linear-gradient(-45deg, transparent 75%, #ccc 75%)
              `,
              backgroundSize: '20px 20px',
              backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
            }}
          />

          <canvas
            ref={canvasRef}
            className="relative"
            style={{
              width: canvasDimensions.width,
              height: canvasDimensions.height,
              cursor: canvasState.selectedTool === 'text' ? 'text'
                    : canvasState.selectedTool === 'shape' ? 'crosshair'
                    : cursorStyle,
            }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
          />

          {/* Drop overlay */}
          {isDragOver && (
            <div className="absolute inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center pointer-events-none">
              <div className="bg-white px-4 py-2 rounded-lg shadow-lg">
                <span className="text-blue-600 font-medium">Drop to add image</span>
              </div>
            </div>
          )}

          {/* Dimension labels */}
          <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs text-gray-500">
            {canvasDimensions.width}px
          </div>
          <div className="absolute -right-8 top-1/2 transform -translate-y-1/2 rotate-90 text-xs text-gray-500">
            {canvasDimensions.height}px
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="p-3 bg-white border-t border-gray-200 text-center text-sm text-gray-500">
        {!selectedCampaign ? (
          'Select a campaign to start designing'
        ) : canvasState.selectedTool === 'text' ? (
          'Click on the canvas to add text'
        ) : canvasState.selectedTool === 'shape' ? (
          'Click and drag to draw a shape'
        ) : layers.length === 0 ? (
          <>
            Drag images from the Asset Library to add them to the canvas.
            <span className="mx-2">|</span>
            Click on a layer to select it.
          </>
        ) : (
          <>
            {layers.length} layer(s)
            <span className="mx-2">|</span>
            {canvasState.selectedObjectIds.length > 0
              ? 'Drag to move, drag handles to resize, Delete to remove'
              : 'Click a layer to select'}
          </>
        )}
      </div>

      {/* Text Input Dialog */}
      {showTextDialog && (
        <TextInputDialog
          onSubmit={handleTextDialogSubmit}
          onCancel={() => setShowTextDialog(false)}
        />
      )}
    </div>
  );
}

function rgbToHex(rgb: string): string {
  const parts = rgb.split(' ').map(Number);
  if (parts.length !== 3) return '#3b82f6';
  const [r, g, b] = parts;
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
