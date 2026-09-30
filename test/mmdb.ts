import { writeFile } from 'node:fs/promises';
import { isIPv4 } from 'node:net';

type MmdbValue = string | number | MmdbValue[] | { [key: string]: MmdbValue };

export type MmdbNetwork = {
  network: string;
  record: Record<string, MmdbValue>;
};

export type MmdbFixture = {
  ipVersion: 4 | 6;
  networks: MmdbNetwork[];
};

type TrieNode = { children: [Branch, Branch] };

type Branch = TrieNode | { data: number } | undefined;

const recordBytes = 4;

const dataSectionSeparator = 16;

const metadataMarker = Buffer.from([
  0xab,
  0xcd,
  0xef,
  ...Buffer.from('MaxMind.com'),
]);

const ipv4Bytes = (address: string) => address.split('.').map(Number);

const ipv6Bytes = (address: string) => {
  const [head = '', tail] = address.split('::');
  const groupsOf = (part: string) => (part ? part.split(':') : []);
  const left = groupsOf(head);
  const right = tail === undefined ? [] : groupsOf(tail);
  const groups = [
    ...left,
    ...Array(8 - left.length - right.length).fill('0'),
    ...right,
  ];
  return groups.flatMap((group) => {
    const value = Number.parseInt(group, 16);
    return [value >> 8, value & 0xff];
  });
};

const addressBits = (address: string, ipVersion: 4 | 6) => {
  const bytes = isIPv4(address)
    ? [...(ipVersion === 6 ? Array(12).fill(0) : []), ...ipv4Bytes(address)]
    : ipv6Bytes(address);
  return bytes.flatMap((byte) =>
    Array.from({ length: 8 }, (_, bit) => (byte >> (7 - bit)) & 1),
  );
};

const control = (type: number, size: number) => {
  const sizeBytes =
    size < 29
      ? [size]
      : size < 285
        ? [29, size - 29]
        : [30, (size - 285) >> 8, (size - 285) & 0xff];
  const [first = 0, ...rest] = sizeBytes;
  return type <= 7
    ? Buffer.from([(type << 5) | first, ...rest])
    : Buffer.from([first, type - 7, ...rest]);
};

const encode = (value: MmdbValue): Buffer => {
  if (typeof value === 'string') {
    const bytes = Buffer.from(value, 'utf8');
    return Buffer.concat([control(2, bytes.length), bytes]);
  }
  if (typeof value === 'number') {
    const bytes = Buffer.alloc(4);
    bytes.writeUInt32BE(value);
    return Buffer.concat([control(6, 4), bytes]);
  }
  if (Array.isArray(value)) {
    return Buffer.concat([control(11, value.length), ...value.map(encode)]);
  }
  const entries = Object.entries(value);
  return Buffer.concat([
    control(7, entries.length),
    ...entries.flatMap(([key, entry]) => [encode(key), encode(entry)]),
  ]);
};

const insert = (root: TrieNode, bits: number[], data: number) => {
  let node = root;
  bits.forEach((bit, index) => {
    const side = bit as 0 | 1;
    if (index === bits.length - 1) {
      node.children[side] = { data };
      return;
    }
    const next = node.children[side];
    const child: TrieNode =
      next && 'children' in next ? next : { children: [undefined, undefined] };
    node.children[side] = child;
    node = child;
  });
};

const nodesOf = (root: TrieNode) => {
  const nodes: TrieNode[] = [];
  const queue = [root];
  for (let node = queue.shift(); node; node = queue.shift()) {
    nodes.push(node);
    for (const child of node.children) {
      if (child && 'children' in child) {
        queue.push(child);
      }
    }
  }
  return nodes;
};

export const mmdbBytes = ({ ipVersion, networks }: MmdbFixture) => {
  const root: TrieNode = { children: [undefined, undefined] };
  const records: Buffer[] = [];
  let dataOffset = 0;
  for (const { network, record } of networks) {
    const [address = '', prefix = ''] = network.split('/');
    const encoded = encode(record);
    insert(
      root,
      addressBits(address, ipVersion).slice(
        0,
        Number(prefix) + (ipVersion === 6 && isIPv4(address) ? 96 : 0),
      ),
      dataOffset,
    );
    records.push(encoded);
    dataOffset += encoded.length;
  }

  const nodes = nodesOf(root);
  const nodeCount = nodes.length;
  const tree = Buffer.alloc(nodeCount * recordBytes * 2);
  nodes.forEach((node, index) => {
    node.children.forEach((child, side) => {
      const value =
        child === undefined
          ? nodeCount
          : 'data' in child
            ? nodeCount + dataSectionSeparator + child.data
            : nodes.indexOf(child);
      tree.writeUInt32BE(value, (index * 2 + side) * recordBytes);
    });
  });

  const metadata = encode({
    node_count: nodeCount,
    record_size: recordBytes * 8,
    ip_version: ipVersion,
    database_type: `city ipv${ipVersion}`,
    languages: [],
    binary_format_major_version: 2,
    binary_format_minor_version: 0,
    build_epoch: 0,
    description: {},
  });

  return Buffer.concat([
    tree,
    Buffer.alloc(dataSectionSeparator),
    ...records,
    metadataMarker,
    metadata,
  ]);
};

export const writeMmdb = (path: string, fixture: MmdbFixture) =>
  writeFile(path, mmdbBytes(fixture));
