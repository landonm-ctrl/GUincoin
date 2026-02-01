import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock canvas context
class MockCanvasRenderingContext2D {
  fillStyle = '';
  strokeStyle = '';
  lineWidth = 1;
  font = '';
  textAlign = 'left';
  textBaseline = 'top';
  shadowColor = '';
  shadowBlur = 0;
  shadowOffsetX = 0;
  shadowOffsetY = 0;

  fillRect = vi.fn();
  strokeRect = vi.fn();
  clearRect = vi.fn();
  fillText = vi.fn();
  strokeText = vi.fn();
  measureText = vi.fn(() => ({ width: 100 }));
  beginPath = vi.fn();
  closePath = vi.fn();
  moveTo = vi.fn();
  lineTo = vi.fn();
  arc = vi.fn();
  ellipse = vi.fn();
  fill = vi.fn();
  stroke = vi.fn();
  drawImage = vi.fn();
  createLinearGradient = vi.fn(() => ({
    addColorStop: vi.fn(),
  }));
  setLineDash = vi.fn();
  save = vi.fn();
  restore = vi.fn();
  translate = vi.fn();
  rotate = vi.fn();
  scale = vi.fn();
}

// Mock HTMLCanvasElement
HTMLCanvasElement.prototype.getContext = vi.fn(function(this: HTMLCanvasElement, contextId: string) {
  if (contextId === '2d') {
    return new MockCanvasRenderingContext2D() as unknown as CanvasRenderingContext2D;
  }
  return null;
}) as typeof HTMLCanvasElement.prototype.getContext;

HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,mockdata');

// Mock window.showToast
Object.defineProperty(window, 'showToast', {
  value: vi.fn(),
  writable: true,
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock Image
class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  crossOrigin = '';
  private _src = '';

  get src() {
    return this._src;
  }

  set src(value: string) {
    this._src = value;
    // Simulate async image load
    setTimeout(() => {
      if (value.includes('error')) {
        this.onerror?.();
      } else {
        this.onload?.();
      }
    }, 0);
  }

  width = 100;
  height = 100;
}

global.Image = MockImage as unknown as typeof Image;
