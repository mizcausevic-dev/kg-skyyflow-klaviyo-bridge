# Security policy

## Supported versions

Only the latest `main` branch and the most recent tagged release receive security fixes.

## Reporting a vulnerability

Please report security issues privately by opening a [GitHub security advisory](https://github.com/mizcausevic-dev/kg-skyyflow-klaviyo-bridge/security/advisories/new) on this repository. Do not open public issues for security-relevant bugs.

## Scope

This library is a Skyyflow vault bridge for Klaviyo profile exports. In-scope concerns include:

- Decision Card parsing correctness (refusing malformed or downgraded versions)
- Vault contract correctness (no field reveal without `callerRoles ∩ revealRoles`)
- Token determinism leakage (token format must not leak the underlying PII value)
- CLI argument handling (no path traversal, no JSON injection)

Out of scope:

- The hosted Skyyflow vault implementation itself
- The Klaviyo platform
- Any downstream consumer of the vaulted export
