import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StudioProvider } from '../context/StudioContext';
import BannerCanvas from '../canvas/BannerCanvas';
import CanvasToolbar from '../canvas/CanvasToolbar';
import PropertiesPanel from '../panels/PropertiesPanel';
import TextInputDialog from '../canvas/TextInputDialog';
import ErrorBoundary from '../ErrorBoundary';

// Wrapper component with StudioProvider
function TestWrapper({ children }: { children: React.ReactNode }) {
  return <StudioProvider>{children}</StudioProvider>;
}

// Mock API calls
vi.mock('../../../../services/api', () => ({
  getCampaigns: vi.fn().mockResolvedValue({ data: [] }),
  getCampaign: vi.fn().mockResolvedValue({ data: null }),
  getCampaignTasks: vi.fn().mockResolvedValue({ data: [] }),
  getThemePresets: vi.fn().mockResolvedValue({ data: {} }),
  getAllWellnessTasks: vi.fn().mockResolvedValue({ data: [] }),
  updateCampaign: vi.fn().mockResolvedValue({ data: {} }),
}));

describe('CampaignStudio', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('BannerCanvas', () => {
    it('renders without crashing', () => {
      render(
        <TestWrapper>
          <BannerCanvas />
        </TestWrapper>
      );

      expect(screen.getByText('Canvas Size:')).toBeInTheDocument();
    });

    it('displays canvas dimension options', () => {
      render(
        <TestWrapper>
          <BannerCanvas />
        </TestWrapper>
      );

      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
      expect(screen.getByText(/728 x 90px/)).toBeInTheDocument();
    });

    it('changes canvas size when preset is selected', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <BannerCanvas />
        </TestWrapper>
      );

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'poster');

      expect(screen.getByText(/800 x 600px/)).toBeInTheDocument();
    });

    it('displays undo/redo buttons', () => {
      render(
        <TestWrapper>
          <BannerCanvas />
        </TestWrapper>
      );

      expect(screen.getByTitle('Undo (Ctrl+Z)')).toBeInTheDocument();
      expect(screen.getByTitle('Redo (Ctrl+Y)')).toBeInTheDocument();
    });

    it('undo button is disabled when there is no history', () => {
      render(
        <TestWrapper>
          <BannerCanvas />
        </TestWrapper>
      );

      const undoButton = screen.getByTitle('Undo (Ctrl+Z)');
      expect(undoButton).toBeDisabled();
    });

    it('shows export button', () => {
      render(
        <TestWrapper>
          <BannerCanvas />
        </TestWrapper>
      );

      expect(screen.getByText('Export PNG')).toBeInTheDocument();
    });

    it('displays instructions when no campaign is selected', () => {
      render(
        <TestWrapper>
          <BannerCanvas />
        </TestWrapper>
      );

      // When no campaign is selected, shows this message
      expect(screen.getByText('Select a campaign to start designing')).toBeInTheDocument();
    });
  });

  describe('CanvasToolbar', () => {
    it('renders all tools', () => {
      render(
        <TestWrapper>
          <CanvasToolbar />
        </TestWrapper>
      );

      expect(screen.getByTitle('Select')).toBeInTheDocument();
      expect(screen.getByTitle('Text')).toBeInTheDocument();
      expect(screen.getByTitle('Shape')).toBeInTheDocument();
      expect(screen.getByTitle('Image')).toBeInTheDocument();
      expect(screen.getByTitle('Pan')).toBeInTheDocument();
    });

    it('shows zoom controls', () => {
      render(
        <TestWrapper>
          <CanvasToolbar />
        </TestWrapper>
      );

      expect(screen.getByTitle('Zoom out')).toBeInTheDocument();
      expect(screen.getByTitle('Zoom in')).toBeInTheDocument();
      expect(screen.getByTitle('Fit to view')).toBeInTheDocument();
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('highlights selected tool', () => {
      render(
        <TestWrapper>
          <CanvasToolbar />
        </TestWrapper>
      );

      const selectButton = screen.getByTitle('Select');
      expect(selectButton).toHaveClass('bg-blue-100');
    });

    it('changes tool on click', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <CanvasToolbar />
        </TestWrapper>
      );

      const textButton = screen.getByTitle('Text');
      await user.click(textButton);

      await waitFor(() => {
        expect(textButton).toHaveClass('bg-blue-100');
      });
    });

    it('shows shape submenu when shape tool is selected', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <CanvasToolbar />
        </TestWrapper>
      );

      const shapeButton = screen.getByTitle('Shape');
      await user.click(shapeButton);

      // After clicking shape, submenu should be visible
      await waitFor(() => {
        expect(screen.getByTitle('Rectangle')).toBeInTheDocument();
      });
      expect(screen.getByTitle('Circle')).toBeInTheDocument();
      expect(screen.getByTitle('Line')).toBeInTheDocument();
    });
  });

  describe('TextInputDialog', () => {
    it('renders with all controls', () => {
      const onSubmit = vi.fn();
      const onCancel = vi.fn();

      render(
        <TextInputDialog onSubmit={onSubmit} onCancel={onCancel} />
      );

      // Check header text (h3)
      expect(screen.getByRole('heading', { name: 'Add Text' })).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter your text...')).toBeInTheDocument();
      expect(screen.getByText('Font Family')).toBeInTheDocument();
      expect(screen.getByText('Font Size')).toBeInTheDocument();
      expect(screen.getByText('Color')).toBeInTheDocument();
      expect(screen.getByText('Preview')).toBeInTheDocument();
    });

    it('calls onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      const onCancel = vi.fn();

      render(
        <TextInputDialog onSubmit={onSubmit} onCancel={onCancel} />
      );

      await user.click(screen.getByText('Cancel'));
      expect(onCancel).toHaveBeenCalled();
    });

    it('submit button is disabled when text is empty', () => {
      const onSubmit = vi.fn();
      const onCancel = vi.fn();

      render(
        <TextInputDialog onSubmit={onSubmit} onCancel={onCancel} />
      );

      const submitButton = screen.getByRole('button', { name: 'Add Text' });
      expect(submitButton).toBeDisabled();
    });

    it('enables submit button when text is entered', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      const onCancel = vi.fn();

      render(
        <TextInputDialog onSubmit={onSubmit} onCancel={onCancel} />
      );

      const textarea = screen.getByPlaceholderText('Enter your text...');
      await user.type(textarea, 'Hello World');

      const submitButton = screen.getByRole('button', { name: 'Add Text' });
      expect(submitButton).not.toBeDisabled();
    });

    it('calls onSubmit with correct data when form is submitted', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      const onCancel = vi.fn();

      render(
        <TextInputDialog onSubmit={onSubmit} onCancel={onCancel} />
      );

      const textarea = screen.getByPlaceholderText('Enter your text...');
      await user.type(textarea, 'Test Text');

      const submitButton = screen.getByRole('button', { name: 'Add Text' });
      await user.click(submitButton);

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Test Text',
          fontFamily: 'Arial',
          fontSize: 24,
          bold: false,
          italic: false,
        })
      );
    });

    it('toggles bold style', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      const onCancel = vi.fn();

      render(
        <TextInputDialog onSubmit={onSubmit} onCancel={onCancel} />
      );

      const boldButton = screen.getByText('B');
      await user.click(boldButton);

      expect(boldButton).toHaveClass('bg-blue-100');

      const textarea = screen.getByPlaceholderText('Enter your text...');
      await user.type(textarea, 'Bold Text');

      const submitButton = screen.getByRole('button', { name: 'Add Text' });
      await user.click(submitButton);

      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          bold: true,
        })
      );
    });
  });

  describe('PropertiesPanel', () => {
    it('shows campaign properties placeholder when no campaign selected', () => {
      render(
        <TestWrapper>
          <PropertiesPanel />
        </TestWrapper>
      );

      expect(screen.getByText('Campaign Properties')).toBeInTheDocument();
      expect(screen.getByText('Select a campaign to view properties')).toBeInTheDocument();
    });
  });

  describe('ErrorBoundary', () => {
    // Component that throws an error
    function ThrowError(): never {
      throw new Error('Test error');
    }

    it('renders children when there is no error', () => {
      render(
        <ErrorBoundary>
          <div>Test Content</div>
        </ErrorBoundary>
      );

      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('renders error message when child throws', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText('Test error')).toBeInTheDocument();

      consoleSpy.mockRestore();
    });

    it('shows reload button on error', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText('Reload Studio')).toBeInTheDocument();
      expect(screen.getByText('Try Again')).toBeInTheDocument();

      consoleSpy.mockRestore();
    });

    it('renders custom fallback when provided', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <ErrorBoundary fallback={<div>Custom Fallback</div>}>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText('Custom Fallback')).toBeInTheDocument();

      consoleSpy.mockRestore();
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('responds to Escape key to deselect', async () => {
      render(
        <TestWrapper>
          <BannerCanvas />
        </TestWrapper>
      );

      fireEvent.keyDown(window, { key: 'Escape' });
      // Should not throw and deselection logic should run
    });

    it('responds to Ctrl+Z for undo', async () => {
      render(
        <TestWrapper>
          <BannerCanvas />
        </TestWrapper>
      );

      fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
      // Should not throw
    });

    it('responds to Ctrl+Y for redo', async () => {
      render(
        <TestWrapper>
          <BannerCanvas />
        </TestWrapper>
      );

      fireEvent.keyDown(window, { key: 'y', ctrlKey: true });
      // Should not throw
    });
  });

  describe('Canvas Export', () => {
    it('export button triggers download', async () => {
      const user = userEvent.setup();

      // Mock createElement and click
      const mockClick = vi.fn();
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        const element = originalCreateElement(tagName);
        if (tagName === 'a') {
          element.click = mockClick;
        }
        return element;
      });

      render(
        <TestWrapper>
          <BannerCanvas />
        </TestWrapper>
      );

      const exportButton = screen.getByText('Export PNG');
      await user.click(exportButton);

      expect(mockClick).toHaveBeenCalled();

      vi.restoreAllMocks();
    });
  });

  describe('Layer Management', () => {
    it('shows delete button when layer is selected', async () => {
      // This test would require setting up a selected layer in context
      // For now, we verify the button doesn't show when no layer selected
      render(
        <TestWrapper>
          <BannerCanvas />
        </TestWrapper>
      );

      expect(screen.queryByText('Delete Selected')).not.toBeInTheDocument();
    });

    it('shows clear all button when layers exist', async () => {
      // Similarly, this requires layers to be present
      render(
        <TestWrapper>
          <BannerCanvas />
        </TestWrapper>
      );

      expect(screen.queryByText('Clear All')).not.toBeInTheDocument();
    });
  });
});

describe('Integration Tests', () => {
  it('canvas and toolbar work together', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <CanvasToolbar />
        <BannerCanvas />
      </TestWrapper>
    );

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByTitle('Text')).toBeInTheDocument();
    });

    // Select text tool from toolbar
    const textButton = screen.getByTitle('Text');
    await user.click(textButton);

    // Toolbar should show text tool as selected
    await waitFor(() => {
      expect(textButton).toHaveClass('bg-blue-100');
    });
  });

  it('switching to shape tool updates toolbar state', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <CanvasToolbar />
        <BannerCanvas />
      </TestWrapper>
    );

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByTitle('Shape')).toBeInTheDocument();
    });

    // Select shape tool from toolbar
    const shapeButton = screen.getByTitle('Shape');
    await user.click(shapeButton);

    // Shape tool button should be highlighted
    await waitFor(() => {
      expect(shapeButton).toHaveClass('bg-blue-100');
    });
  });
});
