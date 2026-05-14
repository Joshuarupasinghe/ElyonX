import React from 'react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { LoginScreen } from './LoginScreen';

const noop = () => undefined;

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not submit until email and password are present', () => {
    const onLogin = jest.fn<(email: string, password: string) => void>();
    render(
      <LoginScreen
        onLogin={onLogin}
        onNavigateToSignUp={noop}
        onGoogleSignIn={noop}
      />,
    );

    fireEvent.changeText(screen.getByLabelText('Email address'), 'foh@elyonx.com');
    fireEvent.press(screen.getByLabelText('Login'));

    expect(onLogin).not.toHaveBeenCalled();
  });

  it('submits trimmed credentials', () => {
    const onLogin = jest.fn<(email: string, password: string) => void>();
    render(
      <LoginScreen
        onLogin={onLogin}
        onNavigateToSignUp={noop}
        onGoogleSignIn={noop}
      />,
    );

    fireEvent.changeText(screen.getByLabelText('Email address'), '  foh@elyonx.com  ');
    fireEvent.changeText(screen.getByLabelText('Password'), 'showtime');
    fireEvent.press(screen.getByLabelText('Login'));

    expect(onLogin).toHaveBeenCalledWith('foh@elyonx.com', 'showtime');
  });

  it('routes secondary auth actions', () => {
    const onNavigateToSignUp = jest.fn<() => void>();
    const onGoogleSignIn = jest.fn<() => void>();
    render(
      <LoginScreen
        onLogin={noop}
        onNavigateToSignUp={onNavigateToSignUp}
        onGoogleSignIn={onGoogleSignIn}
      />,
    );

    fireEvent.press(screen.getByLabelText('Continue with Google'));
    fireEvent.press(screen.getByLabelText('Create account'));

    expect(onGoogleSignIn).toHaveBeenCalledTimes(1);
    expect(onNavigateToSignUp).toHaveBeenCalledTimes(1);
  });

  it('renders server-side auth feedback and submitting state', () => {
    render(
      <LoginScreen
        onLogin={noop}
        onNavigateToSignUp={noop}
        onGoogleSignIn={noop}
        errorMessage="Invalid email or password"
        isSubmitting
      />,
    );

    expect(screen.getByText('Invalid email or password')).toBeTruthy();
    expect(screen.getByText('LOGGING IN')).toBeTruthy();
  });
});
