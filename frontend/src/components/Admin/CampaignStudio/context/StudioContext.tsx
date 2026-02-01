import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { Campaign, CampaignTheme, CampaignTask, WellnessTask, getThemePresets, getCampaigns, getCampaign, getCampaignTasks, getAllWellnessTasks } from '../../../../services/api';

export type ThemeMode = 'manual' | 'campaign';

// Layer types - shared with BannerCanvas
export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  color: string;
  textAlign: 'left' | 'center' | 'right';
}

export interface ShapeStyle {
  fill: string;
  stroke: string;
  strokeWidth: number;
}

export interface CanvasLayer {
  id: string;
  type: 'image' | 'text' | 'shape';
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  zIndex: number;
  textStyle?: TextStyle;
  shapeType?: 'rectangle' | 'circle' | 'line';
  shapeStyle?: ShapeStyle;
}

export interface CanvasState {
  selectedTool: 'select' | 'text' | 'shape' | 'image' | 'pan';
  selectedShapeType: 'rectangle' | 'circle' | 'line';
  zoom: number;
  selectedObjectIds: string[];
  history: unknown[];
  historyIndex: number;
}

export interface PreviewState {
  isOpen: boolean;
  device: 'desktop' | 'tablet' | 'mobile';
  previewTheme: CampaignTheme | null;
}

export interface ActivationState {
  isWizardOpen: boolean;
  step: number;
  checklist: {
    themeReady: boolean;
    assetsReady: boolean;
    tasksLinked: boolean;
  };
  rolloutOptions: {
    applyTheme: boolean;
    sendEmail: boolean;
    postChat: boolean;
  };
}

interface StudioContextType {
  // Loading & Error States
  isInitializing: boolean;
  error: string | null;
  clearError: () => void;

  // Campaign Selection
  campaigns: Campaign[];
  selectedCampaign: Campaign | null;
  campaignsLoading: boolean;
  selectCampaign: (id: string | null) => Promise<void>;
  refreshCampaigns: () => Promise<void>;

  // Theme Mode
  themeMode: ThemeMode;
  manualTheme: CampaignTheme | null;
  themePresets: Record<string, CampaignTheme>;
  setThemeMode: (mode: ThemeMode) => void;
  setManualTheme: (theme: CampaignTheme) => void;
  getCurrentTheme: () => CampaignTheme;

  // Canvas State
  canvasState: CanvasState;
  setCanvasTool: (tool: CanvasState['selectedTool']) => void;
  setSelectedShapeType: (shapeType: CanvasState['selectedShapeType']) => void;
  setCanvasZoom: (zoom: number) => void;
  setSelectedObjects: (ids: string[]) => void;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;

  // Layer State (shared with BannerCanvas)
  layers: CanvasLayer[];
  setLayers: (layers: CanvasLayer[]) => void;
  updateLayer: (layerId: string, updates: Partial<CanvasLayer>) => void;
  getSelectedLayer: () => CanvasLayer | null;

  // Preview State
  previewState: PreviewState;
  togglePreview: () => void;
  setPreviewDevice: (device: PreviewState['device']) => void;
  applyPreviewTheme: (theme: CampaignTheme | null) => void;

  // Activation State
  activationState: ActivationState;
  openActivationWizard: () => void;
  closeActivationWizard: () => void;
  setActivationStep: (step: number) => void;
  updateRolloutOptions: (options: Partial<ActivationState['rolloutOptions']>) => void;
  updateChecklist: (checklist: Partial<ActivationState['checklist']>) => void;

  // Unsaved Changes
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (value: boolean) => void;

  // Asset Library
  selectedAssetType: 'banner' | 'poster' | 'email' | 'chat' | 'all';
  setSelectedAssetType: (type: 'banner' | 'poster' | 'email' | 'chat' | 'all') => void;

  // Panels
  leftPanelTab: 'campaigns' | 'assets' | 'layers';
  rightPanelTab: 'properties' | 'theme' | 'tasks' | 'ai';
  setLeftPanelTab: (tab: 'campaigns' | 'assets' | 'layers') => void;
  setRightPanelTab: (tab: 'properties' | 'theme' | 'tasks' | 'ai') => void;

  // Tasks
  campaignTasks: CampaignTask[];
  wellnessTasks: WellnessTask[];
  tasksLoading: boolean;
  refreshCampaignTasks: () => Promise<void>;
}

const DEFAULT_THEME: CampaignTheme = {
  primaryColor: '37 99 235',
  primaryHoverColor: '29 78 216',
  primaryLightColor: '219 234 254',
  secondaryColor: '124 58 237',
  accentColor: '16 185 129',
  backgroundColor: '249 250 251',
  surfaceColor: '255 255 255',
  textPrimaryColor: '17 24 39',
  textSecondaryColor: '107 114 128',
  enableAnimations: false,
  animationType: 'none',
};

const StudioContext = createContext<StudioContextType | undefined>(undefined);

interface StudioProviderProps {
  children: ReactNode;
}

export function StudioProvider({ children }: StudioProviderProps) {
  // Loading & Error state
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  // Campaign state
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [campaignsLoading, setCampaignsLoading] = useState(false);

  // Theme state
  const [themeMode, setThemeMode] = useState<ThemeMode>('campaign');
  const [manualTheme, setManualTheme] = useState<CampaignTheme | null>(null);
  const [themePresets, setThemePresets] = useState<Record<string, CampaignTheme>>({});

  // Canvas state
  const [canvasState, setCanvasState] = useState<CanvasState>({
    selectedTool: 'select',
    selectedShapeType: 'rectangle',
    zoom: 1,
    selectedObjectIds: [],
    history: [],
    historyIndex: -1,
  });

  // Preview state
  const [previewState, setPreviewState] = useState<PreviewState>({
    isOpen: false,
    device: 'desktop',
    previewTheme: null,
  });

  // Activation state
  const [activationState, setActivationState] = useState<ActivationState>({
    isWizardOpen: false,
    step: 0,
    checklist: {
      themeReady: false,
      assetsReady: false,
      tasksLinked: false,
    },
    rolloutOptions: {
      applyTheme: true,
      sendEmail: false,
      postChat: false,
    },
  });

  // UI state
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [selectedAssetType, setSelectedAssetType] = useState<'banner' | 'poster' | 'email' | 'chat' | 'all'>('all');
  const [leftPanelTab, setLeftPanelTab] = useState<'campaigns' | 'assets' | 'layers'>('campaigns');
  const [rightPanelTab, setRightPanelTab] = useState<'properties' | 'theme' | 'tasks' | 'ai'>('theme');

  // Layer state (lifted from BannerCanvas for PropertiesPanel access)
  const [layers, setLayersState] = useState<CanvasLayer[]>([]);

  // Task state
  const [campaignTasks, setCampaignTasks] = useState<CampaignTask[]>([]);
  const [wellnessTasks, setWellnessTasks] = useState<WellnessTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);

  // Load campaigns, presets, and wellness tasks on mount
  useEffect(() => {
    const loadInitialData = async () => {
      setIsInitializing(true);
      setCampaignsLoading(true);
      setError(null);
      try {
        const [campaignsRes, presetsRes, wellnessRes] = await Promise.all([
          getCampaigns(),
          getThemePresets(),
          getAllWellnessTasks(),
        ]);
        setCampaigns(campaignsRes.data || []);
        setThemePresets(presetsRes.data || {});
        setWellnessTasks(wellnessRes.data || []);
      } catch (err) {
        console.error('Failed to load studio data:', err);
        setError('Failed to load Campaign Studio data. Please try refreshing.');
        // Set fallback empty data
        setCampaigns([]);
        setThemePresets({});
        setWellnessTasks([]);
      } finally {
        setCampaignsLoading(false);
        setIsInitializing(false);
      }
    };
    loadInitialData();
  }, []);

  // Campaign selection
  const selectCampaign = useCallback(async (id: string | null) => {
    if (!id) {
      setSelectedCampaign(null);
      setCampaignTasks([]);
      return;
    }
    try {
      setTasksLoading(true);
      const [campaignRes, tasksRes] = await Promise.all([
        getCampaign(id),
        getCampaignTasks(id),
      ]);
      setSelectedCampaign(campaignRes.data);
      setCampaignTasks(tasksRes.data || []);

      // Update checklist based on campaign data
      const campaign = campaignRes.data;
      const tasks = tasksRes.data || [];
      setActivationState(prev => ({
        ...prev,
        checklist: {
          themeReady: !!campaign.theme,
          assetsReady: !!(campaign.bannerImageUrl || campaign.posterImageUrl),
          tasksLinked: tasks.length > 0,
        },
      }));
    } catch (error) {
      console.error('Failed to load campaign:', error);
    } finally {
      setTasksLoading(false);
    }
  }, []);

  // Refresh campaign tasks
  const refreshCampaignTasks = useCallback(async () => {
    if (!selectedCampaign) return;
    setTasksLoading(true);
    try {
      const res = await getCampaignTasks(selectedCampaign.id);
      setCampaignTasks(res.data || []);
      // Update checklist
      setActivationState(prev => ({
        ...prev,
        checklist: {
          ...prev.checklist,
          tasksLinked: (res.data?.length ?? 0) > 0,
        },
      }));
    } catch (error) {
      console.error('Failed to refresh campaign tasks:', error);
    } finally {
      setTasksLoading(false);
    }
  }, [selectedCampaign]);

  const refreshCampaigns = useCallback(async () => {
    setCampaignsLoading(true);
    try {
      const res = await getCampaigns();
      setCampaigns(res.data);
    } catch (error) {
      console.error('Failed to refresh campaigns:', error);
    } finally {
      setCampaignsLoading(false);
    }
  }, []);

  // Get current effective theme
  const getCurrentTheme = useCallback((): CampaignTheme => {
    if (themeMode === 'manual' && manualTheme) {
      return manualTheme;
    }
    if (selectedCampaign?.theme) {
      return selectedCampaign.theme;
    }
    return DEFAULT_THEME;
  }, [themeMode, manualTheme, selectedCampaign]);

  // Canvas controls
  const setCanvasTool = useCallback((tool: CanvasState['selectedTool']) => {
    setCanvasState(prev => ({ ...prev, selectedTool: tool }));
  }, []);

  const setSelectedShapeType = useCallback((shapeType: CanvasState['selectedShapeType']) => {
    setCanvasState(prev => ({ ...prev, selectedShapeType: shapeType, selectedTool: 'shape' }));
  }, []);

  // Layer management
  const setLayers = useCallback((newLayers: CanvasLayer[]) => {
    setLayersState(newLayers);
    setHasUnsavedChanges(true);
  }, []);

  const updateLayer = useCallback((layerId: string, updates: Partial<CanvasLayer>) => {
    setLayersState(prev => prev.map(layer =>
      layer.id === layerId ? { ...layer, ...updates } : layer
    ));
    setHasUnsavedChanges(true);
  }, []);

  const getSelectedLayer = useCallback((): CanvasLayer | null => {
    if (canvasState.selectedObjectIds.length === 0) return null;
    return layers.find(l => canvasState.selectedObjectIds.includes(l.id)) || null;
  }, [canvasState.selectedObjectIds, layers]);

  const setCanvasZoom = useCallback((zoom: number) => {
    setCanvasState(prev => ({ ...prev, zoom: Math.max(0.1, Math.min(3, zoom)) }));
  }, []);

  const setSelectedObjects = useCallback((ids: string[]) => {
    setCanvasState(prev => ({ ...prev, selectedObjectIds: ids }));
  }, []);

  const canUndo = canvasState.historyIndex > 0;
  const canRedo = canvasState.historyIndex < canvasState.history.length - 1;

  const undo = useCallback(() => {
    if (canUndo) {
      setCanvasState(prev => ({
        ...prev,
        historyIndex: prev.historyIndex - 1,
      }));
    }
  }, [canUndo]);

  const redo = useCallback(() => {
    if (canRedo) {
      setCanvasState(prev => ({
        ...prev,
        historyIndex: prev.historyIndex + 1,
      }));
    }
  }, [canRedo]);

  // Preview controls
  const togglePreview = useCallback(() => {
    setPreviewState(prev => ({ ...prev, isOpen: !prev.isOpen }));
  }, []);

  const setPreviewDevice = useCallback((device: PreviewState['device']) => {
    setPreviewState(prev => ({ ...prev, device }));
  }, []);

  const applyPreviewTheme = useCallback((theme: CampaignTheme | null) => {
    setPreviewState(prev => ({ ...prev, previewTheme: theme }));
  }, []);

  // Activation controls
  const openActivationWizard = useCallback(() => {
    setActivationState(prev => ({ ...prev, isWizardOpen: true, step: 0 }));
  }, []);

  const closeActivationWizard = useCallback(() => {
    setActivationState(prev => ({ ...prev, isWizardOpen: false }));
  }, []);

  const setActivationStep = useCallback((step: number) => {
    setActivationState(prev => ({ ...prev, step }));
  }, []);

  const updateRolloutOptions = useCallback((options: Partial<ActivationState['rolloutOptions']>) => {
    setActivationState(prev => ({
      ...prev,
      rolloutOptions: { ...prev.rolloutOptions, ...options },
    }));
  }, []);

  const updateChecklist = useCallback((checklist: Partial<ActivationState['checklist']>) => {
    setActivationState(prev => ({
      ...prev,
      checklist: { ...prev.checklist, ...checklist },
    }));
  }, []);

  const value: StudioContextType = {
    // Loading & Error
    isInitializing,
    error,
    clearError,

    // Campaign
    campaigns,
    selectedCampaign,
    campaignsLoading,
    selectCampaign,
    refreshCampaigns,

    // Theme
    themeMode,
    manualTheme,
    themePresets,
    setThemeMode,
    setManualTheme,
    getCurrentTheme,

    // Canvas
    canvasState,
    setCanvasTool,
    setSelectedShapeType,
    setCanvasZoom,
    setSelectedObjects,
    canUndo,
    canRedo,
    undo,
    redo,

    // Layers
    layers,
    setLayers,
    updateLayer,
    getSelectedLayer,

    // Preview
    previewState,
    togglePreview,
    setPreviewDevice,
    applyPreviewTheme,

    // Activation
    activationState,
    openActivationWizard,
    closeActivationWizard,
    setActivationStep,
    updateRolloutOptions,
    updateChecklist,

    // UI
    hasUnsavedChanges,
    setHasUnsavedChanges,
    selectedAssetType,
    setSelectedAssetType,
    leftPanelTab,
    rightPanelTab,
    setLeftPanelTab,
    setRightPanelTab,

    // Tasks
    campaignTasks,
    wellnessTasks,
    tasksLoading,
    refreshCampaignTasks,
  };

  return (
    <StudioContext.Provider value={value}>
      {children}
    </StudioContext.Provider>
  );
}

export function useStudio() {
  const context = useContext(StudioContext);
  if (context === undefined) {
    throw new Error('useStudio must be used within a StudioProvider');
  }
  return context;
}

export { DEFAULT_THEME };
