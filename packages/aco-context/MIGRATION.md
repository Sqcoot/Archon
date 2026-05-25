# ACO Context Migration

S8 owns the `aco-context` command primitives that S7 exposed as safe CLI stubs.

The package is contract-first and pure: it models context status, compiled context packages,
approval capsules, and capsule verification over structured inputs. Runtime workflow parity,
artifact persistence, graph refresh, provider calls, and UI/API integration remain deferred.

Future workflow parity should consume these contracts instead of reimplementing context policy in
workflow YAML or CLI adapters.
