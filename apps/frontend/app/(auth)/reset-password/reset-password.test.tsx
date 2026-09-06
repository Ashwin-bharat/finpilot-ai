import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ResetPasswordPage from './page';
import * as authLib from '../../../lib/auth';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => ({
    get: (key: string) => (key === 'token' ? 'sample_token_123' : null),
  }),
}));

vi.mock('../../../lib/auth', () => ({
  resetPasswordApi: vi.fn(),
}));

describe('ResetPasswordPage', () => {
  it('renders password fields and submit button', () => {
    render(<ResetPasswordPage />);

    expect(screen.getByRole('heading', { name: /Set New Password/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^New Password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Confirm New Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Update Password/i })).toBeInTheDocument();
  });

  it('submits new password and shows success screen', async () => {
    vi.mocked(authLib.resetPasswordApi).mockResolvedValue({
      message: 'Password has been reset successfully.',
    });

    render(<ResetPasswordPage />);

    const newPwdInput = screen.getByLabelText(/^New Password/i);
    const confirmPwdInput = screen.getByLabelText(/Confirm New Password/i);

    fireEvent.change(newPwdInput, { target: { value: 'NewSecureP@ss123' } });
    fireEvent.change(confirmPwdInput, { target: { value: 'NewSecureP@ss123' } });

    const submitBtn = screen.getByRole('button', { name: /Update Password/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Password Reset Complete/i })).toBeInTheDocument();
    });

    expect(authLib.resetPasswordApi).toHaveBeenCalledWith('sample_token_123', 'NewSecureP@ss123');
  });
});
