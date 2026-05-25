import type { ArtifactRef, ProviderManifestRecord } from '@archon/aco-core';
import type { CodexBootstrapInput, CodexHarnessResult } from './schemas';

export interface CodexHarness<TSession, TEvent> {
  readonly manifest: ProviderManifestRecord;
  start(input: CodexBootstrapInput): Promise<TSession>;
  send(session: TSession, event: TEvent): Promise<CodexHarnessResult>;
  attachArtifacts(session: TSession, artifacts: readonly ArtifactRef<string>[]): Promise<void>;
  close(session: TSession): Promise<void>;
}
