// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ResumeTabCard } from './ResumeTabCard';
import * as client from '../api/client';

// Mock apiFetch
vi.mock('../api/client', () => ({
  apiFetch: vi.fn(),
}));

// Mock browser globals for jsdom
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

describe('ResumeTabCard Component (Feature 021D)', () => {
  it('G1: accepts userEvent.type and input.value matches typed URL', async () => {
    const user = userEvent.setup();
    render(<ResumeTabCard />);

    const input = screen.getByPlaceholderText('https://meinungsplatz.ch/...') as HTMLInputElement;
    expect(input).toBeDefined();
    expect(input.value).toBe('');

    // Simulate typing
    await user.type(input, 'https://meinungsplatz.ch/survey/123');
    expect(input.value).toBe('https://meinungsplatz.ch/survey/123');
  });

  it('activates button only when URL is valid', async () => {
    const user = userEvent.setup();
    render(<ResumeTabCard />);

    const input = screen.getByPlaceholderText('https://meinungsplatz.ch/...') as HTMLInputElement;
    const submitBtn = screen.getByRole('button', { name: /Продовжити/i }) as HTMLButtonElement;

    // Initially disabled
    expect(submitBtn.disabled).toBe(true);

    // Invalid URL -> disabled
    await user.type(input, 'not-a-valid-url');
    expect(submitBtn.disabled).toBe(true);

    // Clear and enter valid URL -> enabled
    await user.clear(input);
    await user.type(input, 'https://meinungsplatz.ch/de/survey/456');
    expect(submitBtn.disabled).toBe(false);
  });

  it('submits resume request with persona and url', async () => {
    const user = userEvent.setup();
    const mockResumed = vi.fn();
    (client.apiFetch as any).mockResolvedValueOnce({ status: 'success' });

    render(<ResumeTabCard onResumed={mockResumed} />);

    const input = screen.getByPlaceholderText('https://meinungsplatz.ch/...') as HTMLInputElement;
    const submitBtn = screen.getByRole('button', { name: /Продовжити/i }) as HTMLButtonElement;

    await user.type(input, 'https://meinungsplatz.ch/survey/789');
    expect(submitBtn.disabled).toBe(false);

    await user.click(submitBtn);

    await waitFor(() => {
      expect(client.apiFetch).toHaveBeenCalledWith('/api/survey/resume_tab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: 'arno', resume_tab_url: 'https://meinungsplatz.ch/survey/789' }),
      });
      expect(mockResumed).toHaveBeenCalledTimes(1);
    });
  });
});
