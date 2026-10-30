import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WeekInsightLine from '@/components/dashboard/WeekInsightLine';
import type { PremiumInsight } from '@/lib/premiumInsights';

const insights: PremiumInsight[] = [
  { id: 'best_layer_week', title: 'Veckans värpdrottning', body: 'Gun-Britt toppar veckan med 7 ägg de senaste 7 dagarna.' },
  { id: 'cost_per_egg', title: 'Din äggkostnad', body: 'Fodret kostar just nu 1,20 kr/ägg.' },
];

describe('WeekInsightLine', () => {
  it('visar insikten för Plus', () => {
    render(<MemoryRouter><WeekInsightLine insights={insights} isPlus /></MemoryRouter>);
    expect(screen.getByText(/Gun-Britt toppar veckan/)).toBeInTheDocument();
    expect(screen.getByText('1 till i Insikter')).toBeInTheDocument();
  });

  it('visar bara vilken sorts insikt som väntar för gratis – inga egna siffror i DOM:en', () => {
    const { container } = render(<MemoryRouter><WeekInsightLine insights={insights} isPlus={false} /></MemoryRouter>);
    expect(screen.getByTestId('week-insight-teaser')).toHaveTextContent('Veckans värpdrottning');
    expect(screen.getByText(/Se vilken höna som toppar veckan · ingår i Plus/)).toBeInTheDocument();
    expect(container.textContent).not.toContain('Gun-Britt');
  });

  it('renderar ingenting utan insikter', () => {
    const { container } = render(<MemoryRouter><WeekInsightLine insights={[]} isPlus={false} /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
  });
});
