import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('react-native-gesture-handler', () => ({}));
vi.mock('./lib/backgroundTasks', () => ({}));

vi.mock('./components/AppProviders', () => ({
  AppProviders: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./components/AppRouter', () => ({
  AppRouter: () => <span>AppRouter</span>,
}));

describe('App Entry Point', () => {
  it('renders the AppProviders and AppRouter successfully', () => {
    const { getByText } = render(<App />);
    expect(getByText('AppRouter')).toBeTruthy();
  });
});
