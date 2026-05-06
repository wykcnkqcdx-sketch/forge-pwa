import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import App from './App';

jest.mock('./components/AppProviders', () => ({
  AppProviders: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('./components/AppRouter', () => ({
  AppRouter: () => <Text>AppRouter</Text>,
}));

describe('App Entry Point', () => {
  it('renders the AppProviders and AppRouter successfully', () => {
    const { getByText } = render(<App />);
    expect(getByText('AppRouter')).toBeTruthy();
  });
});