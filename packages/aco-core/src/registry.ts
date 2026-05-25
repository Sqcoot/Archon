import type { Registry, RegistryContract } from './contracts';

class ImmutableRegistry<
  TKind extends string,
  TContract extends RegistryContract<TKind>,
> implements Registry<TKind, TContract> {
  readonly kind: TKind;
  readonly bootloaded: boolean;
  private readonly entries: ReadonlyMap<string, TContract>;

  constructor(kind: TKind, entries?: ReadonlyMap<string, TContract>, bootloaded = false) {
    this.kind = kind;
    this.entries = entries ?? new Map<string, TContract>();
    this.bootloaded = bootloaded;
  }

  get(id: string): TContract | undefined {
    return this.entries.get(id);
  }

  list(): readonly TContract[] {
    return [...this.entries.values()].sort((left, right) => left.id.localeCompare(right.id));
  }

  register(contract: TContract): Registry<TKind, TContract> {
    if (this.bootloaded) {
      throw new Error(`Registry ${this.kind} is immutable after bootload`);
    }
    if (contract.kind !== this.kind) {
      throw new Error(`Registry ${this.kind} cannot register ${contract.kind}`);
    }
    if (this.entries.has(contract.id)) {
      throw new Error(`Registry ${this.kind} already has id ${contract.id}`);
    }

    const nextEntries = new Map(this.entries);
    nextEntries.set(contract.id, contract);
    return new ImmutableRegistry(this.kind, nextEntries, false);
  }

  bootload(): Registry<TKind, TContract> {
    return new ImmutableRegistry(this.kind, new Map(this.entries), true);
  }
}

export function createRegistry<TKind extends string, TContract extends RegistryContract<TKind>>(
  kind: TKind
): Registry<TKind, TContract> {
  return new ImmutableRegistry<TKind, TContract>(kind);
}
