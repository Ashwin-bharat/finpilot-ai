import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import IndiaCryptoTaxDisclaimer from './IndiaCryptoTaxDisclaimer';

describe('IndiaCryptoTaxDisclaimer Component', () => {
  it('renders 30% rate and 1% TDS warning prominently', () => {
    render(<IndiaCryptoTaxDisclaimer />);

    expect(screen.getByText(/30% rate/i)).toBeInTheDocument();
    expect(screen.getByText(/1% TDS on transactions/i)).toBeInTheDocument();
    expect(screen.getByText(/STATUTORY INDIA TAX DISCLOSURE/i)).toBeInTheDocument();
    expect(screen.getByText(/Losses cannot be offset/i)).toBeInTheDocument();
  });
});
