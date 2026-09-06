import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import AssetClassToggle from './AssetClassToggle';
import { AssetClassProvider, useAssetClass } from '../context/asset-class-context';

function TestConsumer() {
  const { assetClass, isCrypto } = useAssetClass();
  return (
    <div>
      <span data-testid="current-class">{assetClass}</span>
      <span data-testid="is-crypto">{isCrypto ? 'true' : 'false'}</span>
      <AssetClassToggle />
    </div>
  );
}

describe('AssetClassToggle Component', () => {
  it('renders Stocks and Crypto options and defaults to stocks', () => {
    render(
      <AssetClassProvider>
        <TestConsumer />
      </AssetClassProvider>,
    );

    expect(screen.getByText('Stocks')).toBeInTheDocument();
    expect(screen.getByText('Crypto')).toBeInTheDocument();
    expect(screen.getByTestId('current-class').textContent).toBe('stocks');
    expect(screen.getByTestId('is-crypto').textContent).toBe('false');
  });

  it('switches to crypto mode when Crypto button is clicked', () => {
    render(
      <AssetClassProvider>
        <TestConsumer />
      </AssetClassProvider>,
    );

    const cryptoBtn = screen.getByText('Crypto');
    fireEvent.click(cryptoBtn);

    expect(screen.getByTestId('current-class').textContent).toBe('crypto');
    expect(screen.getByTestId('is-crypto').textContent).toBe('true');
  });

  it('switches back to stocks mode when Stocks button is clicked', () => {
    render(
      <AssetClassProvider>
        <TestConsumer />
      </AssetClassProvider>,
    );

    const cryptoBtn = screen.getByText('Crypto');
    fireEvent.click(cryptoBtn);
    expect(screen.getByTestId('current-class').textContent).toBe('crypto');

    const stocksBtn = screen.getByText('Stocks');
    fireEvent.click(stocksBtn);
    expect(screen.getByTestId('current-class').textContent).toBe('stocks');
    expect(screen.getByTestId('is-crypto').textContent).toBe('false');
  });
});
