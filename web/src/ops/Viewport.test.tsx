// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter } from 'react-router';
import { Viewport } from './Viewport';
import { normalizeInputChange } from '../ui/primitives';

beforeEach(() => {
  vi.clearAllMocks();
  if (typeof window !== 'undefined') {
    window.matchMedia = window.matchMedia || function () {
      return {
        matches: false,
        media: '',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      } as any;
    };
  }
  if (typeof HTMLElement !== 'undefined') {
    HTMLElement.prototype.showPopover = vi.fn();
    HTMLElement.prototype.hidePopover = vi.fn();
  }
});

afterEach(() => {
  cleanup();
});

describe('Track B UI Fixes (U1 - U6)', () => {
  it('U1: renders layout-box scaled with width and minWidth for zoom > 100%', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Viewport
          screenshotSrc="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
          status="running"
        />
      </MemoryRouter>
    );

    const zoomLabel = screen.getByTestId('viewport-zoom-label');
    expect(zoomLabel.textContent).toContain('100%');

    const inner = screen.getByTestId('viewport-canvas-inner');
    expect(inner.style.width).toBe('100%');

    // Click zoom in (+) multiple times
    const zoomInBtn = screen.getByRole('button', { name: '+' });
    await user.click(zoomInBtn);
    await user.click(zoomInBtn);

    expect(zoomLabel.textContent).toContain('120%');
    expect(inner.style.width).toBe('120%');
    expect(inner.style.minWidth).toBe('120%');
  });

  it('U2: "✎ Виправити" button in focus/fullscreen mode opens correction form and submits correction object', async () => {
    const user = userEvent.setup();
    const mockOnCorrect = vi.fn();

    render(
      <MemoryRouter>
        <Viewport
          screenshotSrc="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
          status="waiting_verification"
          onCorrect={mockOnCorrect}
        />
      </MemoryRouter>
    );

    // Switch to focus mode so action bar is visible
    const focusBtn = screen.getByRole('button', { name: /Фокус/i });
    await user.click(focusBtn);

    // Click "✎ Виправити"
    const correctBtn = screen.getByRole('button', { name: /✎ Виправити/i });
    await user.click(correctBtn);

    // Form should appear
    const overrideInput = screen.getByPlaceholderText(/Введіть правильну відповідь/i);
    expect(overrideInput).toBeDefined();

    const noteInput = screen.getByPlaceholderText(/Пояснення для запису уроку/i);
    expect(noteInput).toBeDefined();

    fireEvent.change(overrideInput, { target: { value: 'Button.submit' } });
    fireEvent.change(noteInput, { target: { value: 'Target was wrong' } });

    const submitCorrectionBtn = screen.getByRole('button', { name: /Надіслати виправлення/i });
    await user.click(submitCorrectionBtn);

    expect(mockOnCorrect).toHaveBeenCalledWith({
      kind: 'override_click',
      reason_code: 'wrong_element',
      override_value: 'Button.submit',
      note: 'Target was wrong',
    });
  }, 15000);

  it('U4: displays "Крок N / M" format when stepTotal is provided', () => {
    render(
      <MemoryRouter>
        <Viewport
          screenshotSrc="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
          status="running"
          stepIndex={3}
          stepTotal={10}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Крок 3 / 10')).toBeDefined();
  });

  it('U5: normalizeInputChange correctly extracts strings and event object values', () => {
    expect(normalizeInputChange('direct string')).toBe('direct string');
    expect(normalizeInputChange({ target: { value: 'from event' } })).toBe('from event');
    expect(normalizeInputChange(null)).toBe('');
    expect(normalizeInputChange(undefined)).toBe('');
    expect(normalizeInputChange(123)).toBe('');
  });
});
