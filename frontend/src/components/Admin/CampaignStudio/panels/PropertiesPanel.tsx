import { useState, useEffect } from 'react';
import { useStudio } from '../context/StudioContext';
import { updateCampaign } from '../../../../services/api';

export default function PropertiesPanel() {
  const {
    selectedCampaign,
    selectCampaign,
    canvasState,
    setHasUnsavedChanges,
    getSelectedLayer,
    updateLayer,
  } = useStudio();

  const [saving, setSaving] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const hasSelectedObjects = canvasState.selectedObjectIds.length > 0;
  const selectedLayer = getSelectedLayer();

  // Local state for property inputs
  const [posX, setPosX] = useState(0);
  const [posY, setPosY] = useState(0);
  const [width, setWidth] = useState(100);
  const [height, setHeight] = useState(100);
  const [opacity, setOpacity] = useState(100);

  // Text-specific state
  const [textColor, setTextColor] = useState('#000000');
  const [fontSize, setFontSize] = useState(24);
  const [fontFamily, setFontFamily] = useState('Arial');

  // Shape-specific state
  const [shapeFill, setShapeFill] = useState('#3b82f6');
  const [shapeStroke, setShapeStroke] = useState('#1e40af');
  const [strokeWidth, setStrokeWidth] = useState(2);

  // Sync local state with selected layer
  useEffect(() => {
    if (selectedLayer) {
      setPosX(Math.round(selectedLayer.x));
      setPosY(Math.round(selectedLayer.y));
      setWidth(Math.round(selectedLayer.width));
      setHeight(Math.round(selectedLayer.height));

      if (selectedLayer.type === 'text' && selectedLayer.textStyle) {
        setTextColor(selectedLayer.textStyle.color);
        setFontSize(selectedLayer.textStyle.fontSize);
        setFontFamily(selectedLayer.textStyle.fontFamily);
      }

      if (selectedLayer.type === 'shape' && selectedLayer.shapeStyle) {
        setShapeFill(selectedLayer.shapeStyle.fill);
        setShapeStroke(selectedLayer.shapeStyle.stroke);
        setStrokeWidth(selectedLayer.shapeStyle.strokeWidth);
      }
    }
  }, [selectedLayer]);

  // Update layer position
  const handlePositionChange = (axis: 'x' | 'y', value: number) => {
    if (!selectedLayer) return;
    updateLayer(selectedLayer.id, { [axis]: value });
  };

  // Update layer size
  const handleSizeChange = (dimension: 'width' | 'height', value: number) => {
    if (!selectedLayer) return;
    updateLayer(selectedLayer.id, { [dimension]: Math.max(1, value) });
  };

  // Update text style
  const handleTextStyleChange = (updates: Partial<typeof selectedLayer.textStyle>) => {
    if (!selectedLayer || selectedLayer.type !== 'text') return;
    updateLayer(selectedLayer.id, {
      textStyle: { ...selectedLayer.textStyle!, ...updates },
    });
  };

  // Update shape style
  const handleShapeStyleChange = (updates: Partial<typeof selectedLayer.shapeStyle>) => {
    if (!selectedLayer || selectedLayer.type !== 'shape') return;
    updateLayer(selectedLayer.id, {
      shapeStyle: { ...selectedLayer.shapeStyle!, ...updates },
    });
  };

  const startEditing = () => {
    if (selectedCampaign) {
      setEditedName(selectedCampaign.name);
      setEditedDescription(selectedCampaign.description || '');
      setIsEditing(true);
    }
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditedName('');
    setEditedDescription('');
  };

  const saveChanges = async () => {
    if (!selectedCampaign) return;

    setSaving(true);
    try {
      await updateCampaign(selectedCampaign.id, {
        name: editedName,
        description: editedDescription || undefined,
      });
      await selectCampaign(selectedCampaign.id);
      setIsEditing(false);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to save campaign:', error);
    } finally {
      setSaving(false);
    }
  };

  // Show canvas object properties if something is selected
  if (hasSelectedObjects && selectedLayer) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-3 border-b border-gray-200">
          <h3 className="font-medium text-gray-900">Object Properties</h3>
          <p className="text-xs text-gray-500 mt-1">
            {selectedLayer.type.charAt(0).toUpperCase() + selectedLayer.type.slice(1)} Layer
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* Position */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Position</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">X</label>
                <input
                  type="number"
                  value={posX}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setPosX(val);
                    handlePositionChange('x', val);
                  }}
                  className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Y</label>
                <input
                  type="number"
                  value={posY}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setPosY(val);
                    handlePositionChange('y', val);
                  }}
                  className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Size */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Size</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Width</label>
                <input
                  type="number"
                  value={width}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1;
                    setWidth(val);
                    handleSizeChange('width', val);
                  }}
                  min="1"
                  className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Height</label>
                <input
                  type="number"
                  value={height}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1;
                    setHeight(val);
                    handleSizeChange('height', val);
                  }}
                  min="1"
                  className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Text-specific properties */}
          {selectedLayer.type === 'text' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Text Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => {
                      setTextColor(e.target.value);
                      handleTextStyleChange({ color: e.target.value });
                    }}
                    className="w-10 h-10 border border-gray-300 rounded-md cursor-pointer"
                  />
                  <input
                    type="text"
                    value={textColor}
                    onChange={(e) => {
                      setTextColor(e.target.value);
                      handleTextStyleChange({ color: e.target.value });
                    }}
                    className="flex-1 text-sm border border-gray-300 rounded-md px-2 py-1.5 font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Font Size</label>
                <input
                  type="number"
                  value={fontSize}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 12;
                    setFontSize(val);
                    handleTextStyleChange({ fontSize: val });
                  }}
                  min="8"
                  max="200"
                  className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Font Family</label>
                <select
                  value={fontFamily}
                  onChange={(e) => {
                    setFontFamily(e.target.value);
                    handleTextStyleChange({ fontFamily: e.target.value });
                  }}
                  className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="Arial">Arial</option>
                  <option value="Helvetica">Helvetica</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Verdana">Verdana</option>
                  <option value="Courier New">Courier New</option>
                </select>
              </div>
            </>
          )}

          {/* Shape-specific properties */}
          {selectedLayer.type === 'shape' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Fill Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={shapeFill}
                    onChange={(e) => {
                      setShapeFill(e.target.value);
                      handleShapeStyleChange({ fill: e.target.value });
                    }}
                    className="w-10 h-10 border border-gray-300 rounded-md cursor-pointer"
                  />
                  <input
                    type="text"
                    value={shapeFill}
                    onChange={(e) => {
                      setShapeFill(e.target.value);
                      handleShapeStyleChange({ fill: e.target.value });
                    }}
                    className="flex-1 text-sm border border-gray-300 rounded-md px-2 py-1.5 font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Stroke Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={shapeStroke}
                    onChange={(e) => {
                      setShapeStroke(e.target.value);
                      handleShapeStyleChange({ stroke: e.target.value });
                    }}
                    className="w-10 h-10 border border-gray-300 rounded-md cursor-pointer"
                  />
                  <input
                    type="text"
                    value={shapeStroke}
                    onChange={(e) => {
                      setShapeStroke(e.target.value);
                      handleShapeStyleChange({ stroke: e.target.value });
                    }}
                    className="flex-1 text-sm border border-gray-300 rounded-md px-2 py-1.5 font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Stroke Width</label>
                <input
                  type="number"
                  value={strokeWidth}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setStrokeWidth(val);
                    handleShapeStyleChange({ strokeWidth: val });
                  }}
                  min="0"
                  max="20"
                  className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </>
          )}

          {/* Opacity (works for all types) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Opacity: {opacity}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={opacity}
              onChange={(e) => setOpacity(parseInt(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      </div>
    );
  }

  // Show campaign properties by default
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900">Campaign Properties</h3>
          {selectedCampaign && !isEditing && (
            <button
              onClick={startEditing}
              className="p-1 hover:bg-gray-100 rounded-md transition-colors"
              title="Edit"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {!selectedCampaign ? (
          <div className="text-center text-gray-500 text-sm py-8">
            <svg className="w-12 h-12 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Select a campaign to view properties
          </div>
        ) : isEditing ? (
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                rows={3}
                className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={saveChanges}
                disabled={saving || !editedName.trim()}
                className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={cancelEditing}
                className="px-3 py-2 bg-gray-200 text-gray-700 text-sm rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Name</label>
              <p className="text-sm font-medium text-gray-900">{selectedCampaign.name}</p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Description</label>
              <p className="text-sm text-gray-700">
                {selectedCampaign.description || <span className="italic text-gray-400">No description</span>}
              </p>
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Status</label>
              <span
                className={`inline-block px-2 py-1 text-xs rounded-full font-medium ${
                  selectedCampaign.status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : selectedCampaign.status === 'draft'
                    ? 'bg-gray-100 text-gray-800'
                    : selectedCampaign.status === 'scheduled'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-purple-100 text-purple-800'
                }`}
              >
                {selectedCampaign.status}
              </span>
            </div>

            {/* Slug */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Slug</label>
              <p className="text-sm text-gray-700 font-mono">{selectedCampaign.slug}</p>
            </div>

            {/* Dates */}
            {(selectedCampaign.startDate || selectedCampaign.endDate) && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Duration</label>
                <p className="text-sm text-gray-700">
                  {selectedCampaign.startDate
                    ? new Date(selectedCampaign.startDate).toLocaleDateString()
                    : 'No start date'}
                  {' - '}
                  {selectedCampaign.endDate
                    ? new Date(selectedCampaign.endDate).toLocaleDateString()
                    : 'No end date'}
                </p>
              </div>
            )}

            {/* Tasks */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Linked Tasks</label>
              <p className="text-sm text-gray-700">
                {selectedCampaign.campaignTasks?.length || 0} tasks
              </p>
            </div>

            {/* Created */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Created</label>
              <p className="text-sm text-gray-700">
                {new Date(selectedCampaign.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
