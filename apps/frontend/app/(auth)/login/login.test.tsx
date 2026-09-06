import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LoginPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock('../../../context/auth-context', () => ({
  useAuth: () => ({
    login: vi.fn().mockResolvedValue({}),
  }),
}));

describe('LoginPage - Smoke Test', () => {
  it('renders login form elements and input fields', () => {
    render(<LoginPage />);

    expect(screen.getByRole('heading', { name: /Welcome Back/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Forgot password\?/i })).toBeInTheDocument();
  });

  it('allows user to enter email and password into input fields', () => {
    render(<LoginPage />);

    const emailInput = screen.getByLabelText(/Email Address/i) as HTMLInputElement;
    const passwordInput = screen.getByLabelText(/Password/i) as HTMLInputElement;

    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'mysecretpass' } });

    expect(emailInput.value).toBe('user@example.com');
    expect(passwordInput.value).toBe('mysecretpass');
  });
});
