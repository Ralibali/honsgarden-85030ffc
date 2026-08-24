import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StreakRescueCard from '../dashboard/StreakRescueCard';

describe('StreakRescueCard', () => {
  it('visar varning när streaken är i fara (streak ≥ 2, inga ägg idag)', () => {
    render(<StreakRescueCard streak={9} todayEggs={0} />);
    expect(screen.getByText(/9 dagar i rad/)).toBeInTheDocument();
    expect(screen.getByText(/innan midnatt/)).toBeInTheDocument();
  });

  it('är dold när dagens ägg redan är loggade', () => {
    const { container } = render(<StreakRescueCard streak={9} todayEggs={3} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('är dold för korta streakar (under 2 dagar)', () => {
    const { container } = render(<StreakRescueCard streak={1} todayEggs={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('anropar onLogClick vid klick', () => {
    const onLog = vi.fn();
    render(<StreakRescueCard streak={5} todayEggs={0} onLogClick={onLog} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onLog).toHaveBeenCalledTimes(1);
  });
});
