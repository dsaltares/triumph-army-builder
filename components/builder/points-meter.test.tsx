import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PointsMeterBar } from '@/components/builder/points-meter';
import { pointsMeter } from '@/lib/domain/army/builder';
import type { ArmyPoints } from '@/lib/domain/army/points';
import { renderUi } from '@/test/ui';

const points = (overrides: Partial<ArmyPoints> = {}): ArmyPoints => ({
  standPoints: 0,
  allyStandPoints: 0,
  battleCardPoints: 0,
  total: 0,
  standLines: [],
  battleCardLines: [],
  ...overrides,
});

const show = (armyPoints: ArmyPoints) =>
  renderUi(<PointsMeterBar meter={pointsMeter(armyPoints)} />);

const bar = () => screen.getByRole('progressbar', { name: 'Points spent' });

describe('PointsMeterBar', () => {
  it('reads an empty army as nothing spent and the cap left', () => {
    show(points());

    expect(screen.getByText('/ 48')).toBeInTheDocument();
    expect(screen.getByText('48 left')).toBeInTheDocument();
    expect(bar()).toHaveAttribute('aria-valuenow', '0');
  });

  it('splits the total into stands and battle cards', () => {
    show(points({ standPoints: 44, battleCardPoints: 2, total: 46 }));

    expect(screen.getByText('Stands 44 · Battle cards 2')).toBeInTheDocument();
    expect(screen.getByText('2 left')).toBeInTheDocument();
  });

  it('tells what the ally costs apart from the rest of the stands', () => {
    show(points({ standPoints: 44, allyStandPoints: 8, total: 44 }));

    expect(
      screen.getByText('Stands 44 · Battle cards 0 · 8 allied'),
    ).toBeInTheDocument();
  });

  it('leaves the allied subtotal out of an army with no ally', () => {
    show(points({ standPoints: 44, total: 44 }));

    expect(screen.getByText('Stands 44 · Battle cards 0')).toBeInTheDocument();
  });

  it('prints the half points a battle card can cost', () => {
    show(points({ standPoints: 44, battleCardPoints: 0.5, total: 44.5 }));

    expect(screen.getByText(/Battle cards ½/)).toBeInTheDocument();
    expect(screen.getByText('3½ left')).toBeInTheDocument();
  });

  it('says when an army is exactly full', () => {
    show(points({ standPoints: 48, total: 48 }));

    expect(screen.getByText('Full army')).toBeInTheDocument();
    expect(bar()).toHaveAttribute('aria-valuenow', '48');
  });

  it('says how far over the cap an army is, without moving the bar past it', () => {
    show(points({ standPoints: 52, total: 52 }));

    expect(screen.getByText('4 over')).toBeInTheDocument();
    expect(bar()).toHaveAttribute('aria-valuenow', '48');
  });

  it('carries the total for a screen reader as well as the bar', () => {
    show(points({ standPoints: 12, total: 12 }));

    expect(bar()).toHaveAttribute('aria-valuetext', '12 of 48 points, 36 left');
    expect(screen.getByRole('status')).toHaveTextContent(
      /^12\s*\/ 48\s*points/,
    );
  });
});
