export type FlowArc = {
  supply: number;
  demand: number;
  cost: number;
};

export type FlowProblem = {
  supplies: readonly number[];
  demands: readonly number[];
  arcs: readonly FlowArc[];
};

type Edge = {
  tail: number;
  head: number;
  capacity: number;
  cost: number;
  reverse: Edge;
};

export type FlowEdge = Pick<Edge, 'reverse'>;

export type FlowNetwork = {
  adjacency: Edge[][];
};

export const flowNetwork = (): FlowNetwork => ({ adjacency: [] });

export const addNode = (network: FlowNetwork): number =>
  network.adjacency.push([]) - 1;

export const connect = (
  network: FlowNetwork,
  tail: number,
  head: number,
  capacity: number,
  cost: number,
): FlowEdge => {
  const forward = { tail, head, capacity, cost } as Edge;
  const backward = { tail: head, head: tail, capacity: 0, cost: -cost } as Edge;
  forward.reverse = backward;
  backward.reverse = forward;
  network.adjacency[tail]?.push(forward);
  network.adjacency[head]?.push(backward);
  return forward;
};

export const flowThrough = ({ reverse }: FlowEdge) => reverse.capacity;

type Path = {
  edges: readonly Edge[];
  cost: number;
};

const cheapestPath = (
  { adjacency }: FlowNetwork,
  source: number,
  sink: number,
): Path | null => {
  const distance = new Array<number>(adjacency.length).fill(Infinity);
  const via = new Array<Edge | undefined>(adjacency.length);
  const queued = new Array<boolean>(adjacency.length).fill(false);
  const queue = [source];
  distance[source] = 0;
  queued[source] = true;
  for (let next = 0; next < queue.length; next += 1) {
    const node = queue[next] as number;
    queued[node] = false;
    const from = distance[node] as number;
    for (const edge of adjacency[node] ?? []) {
      if (
        edge.capacity > 0 &&
        from + edge.cost < (distance[edge.head] as number)
      ) {
        distance[edge.head] = from + edge.cost;
        via[edge.head] = edge;
        if (!queued[edge.head]) {
          queued[edge.head] = true;
          queue.push(edge.head);
        }
      }
    }
  }
  const edges: Edge[] = [];
  for (let edge = via[sink]; edge; edge = via[edge.tail]) {
    edges.unshift(edge);
  }
  return edges.length > 0 ? { edges, cost: distance[sink] as number } : null;
};

const pushFlow = (
  network: FlowNetwork,
  source: number,
  sink: number,
  worthSending: (cost: number) => boolean,
) => {
  for (
    let path = cheapestPath(network, source, sink);
    path && worthSending(path.cost);
    path = cheapestPath(network, source, sink)
  ) {
    const bottleneck = Math.min(...path.edges.map(({ capacity }) => capacity));
    for (const edge of path.edges) {
      edge.capacity -= bottleneck;
      edge.reverse.capacity += bottleneck;
    }
  }
};

export const minCostFlow = (
  network: FlowNetwork,
  source: number,
  sink: number,
) => pushFlow(network, source, sink, (cost) => cost < 0);

export const minCostMaxFlow = ({
  supplies,
  demands,
  arcs,
}: FlowProblem): readonly number[] => {
  const network = flowNetwork();
  const source = addNode(network);
  const supplyNodes = supplies.map(() => addNode(network));
  const demandNodes = demands.map(() => addNode(network));
  const sink = addNode(network);
  supplies.forEach((capacity, index) => {
    connect(network, source, supplyNodes[index] as number, capacity, 0);
  });
  demands.forEach((capacity, index) => {
    connect(network, demandNodes[index] as number, sink, capacity, 0);
  });
  const arcEdges = arcs.map(({ supply, demand, cost }) =>
    connect(
      network,
      supplyNodes[supply] as number,
      demandNodes[demand] as number,
      Infinity,
      cost,
    ),
  );
  pushFlow(network, source, sink, () => true);
  return arcEdges.map(flowThrough);
};
