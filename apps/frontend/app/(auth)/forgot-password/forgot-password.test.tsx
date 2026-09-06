import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ForgotPasswordPage from './page';
import * as authLib from '../../../lib/auth';

vi.mock('../../../lib/auth', () => ({
  forgotPasswordApi: vi.fn(),
}));

describe('ForgotPasswordPage', () => {
  it('renders email input and submit button', () => {
    render(<ForgotPasswordPage />);

    expect(screen.getByRole('heading', { name: /Reset Password/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Registered Email Address/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Send Reset Link/i })).toBeInTheDocument();
  });

  it('submits form and displays success state', async () => {
    vi.mocked(authLib.forgotPasswordApi).mockResolvedValue({
      message: 'If an account with that email exists, a password reset link has been sent.',
    });

    render(<ForgotPasswordPage />);

    const emailInput = screen.getByLabelText(/Registered Email Address/i);
    fireEvent.change(emailInput, { target: { value: 'trader@example.com' } });

    const submitBtn = screen.getByRole('button', { name: /Send Reset Link/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Check Your Inbox/i })).toBeInTheDocument();
    });

    expect(authLib.forgotPasswordApi).toHaveBeenCalledWith('trader@example.com');
  });
});
