import { describe, expect, it } from 'vitest';
import {
  addNode,
  connect,
  flowNetwork,
  flowThrough,
  minCostFlow,
  minCostMaxFlow,
} from './min-cost-flow';

describe('minCostMaxFlow', () => {
  it('sends nothing when nothing connects supply to demand', () => {
    expect(minCostMaxFlow({ supplies: [3], demands: [2], arcs: [] })).toEqual(
      [],
    );
  });

  it('never sends more than a supply holds or a demand asks', () => {
    expect(
      minCostMaxFlow({
        supplies: [5],
        demands: [2],
        arcs: [{ supply: 0, demand: 0, cost: 0 }],
      }),
    ).toEqual([2]);
  });

  it('reroutes an earlier choice when that is the only way to send more', () => {
    expect(
      minCostMaxFlow({
        supplies: [2, 2],
        demands: [2, 2],
        arcs: [
          { supply: 0, demand: 0, cost: 0 },
          { supply: 0, demand: 1, cost: 5 },
          { supply: 1, demand: 0, cost: 9 },
        ],
      }),
    ).toEqual([0, 2, 2]);
  });

  it('takes the cheaper of two ways to send the same amount', () => {
    expect(
      minCostMaxFlow({
        supplies: [2, 2],
        demands: [2],
        arcs: [
          { supply: 0, demand: 0, cost: 3 },
          { supply: 1, demand: 0, cost: 1 },
        ],
      }),
    ).toEqual([0, 2]);
  });
});

describe('minCostFlow', () => {
  const network = () => {
    const graph = flowNetwork();
    const source = addNode(graph);
    const middle = addNode(graph);
    const sink = addNode(graph);
    return { graph, source, middle, sink };
  };

  it('sends what lowers the cost', () => {
    const { graph, source, middle, sink } = network();
    connect(graph, source, middle, 3, 0);
    const edge = connect(graph, middle, sink, Infinity, -2);

    minCostFlow(graph, source, sink);

    expect(flowThrough(edge)).toBe(3);
  });

  it('stops before a path that would cost more than it saves', () => {
    const { graph, source, middle, sink } = network();
    connect(graph, source, middle, 1, -5);
    const pricey = connect(graph, source, sink, 4, 1);
    const edge = connect(graph, middle, sink, 1, 0);

    minCostFlow(graph, source, sink);

    expect(flowThrough(edge)).toBe(1);
    expect(flowThrough(pricey)).toBe(0);
  });
});
