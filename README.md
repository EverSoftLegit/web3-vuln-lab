# Web3 Vulnerability Lab

![ci](https://github.com/EverSoftLegit/web3-vuln-lab/actions/workflows/ci.yml/badge.svg)

> ⚠️ **Intentionally vulnerable smart contracts for learning. They run only on a local, in-memory test chain. Do not deploy them to any network.**

A small set of deliberately vulnerable Solidity contracts that teach the vulnerability classes behind most real smart-contract exploits. For each one you get the vulnerable contract, a working exploit that drains it on a local chain, the **fixed** contract that resists the same exploit, and an explanation of how an auditor spots the bug. Same idea as OpenZeppelin's Ethernaut or Damn Vulnerable DeFi, kept small and fully tested.

## Vulnerabilities covered

| # | Class | What the exploit does | How an auditor spots it | The fix |
|---|---|---|---|---|
| 1 | **Reentrancy** (SWC-107) | An attacker contract re-enters `withdraw()` from its `receive()` while the bank still holds funds, draining every depositor | An external call (`call{value:…}`) that happens **before** the caller's balance is updated | Checks-effects-interactions (update state first) and/or a `nonReentrant` guard |
| 2 | **Broken access control** (SWC-105) | Anyone calls the unprotected `changeOwner()`, becomes owner, and drains the vault | A state-changing function that alters privileged state (owner, roles) with no `onlyOwner`/role check | Add the `onlyOwner` modifier to privileged functions |
| 3 | **`tx.origin` authentication** (SWC-115) | A phishing contract the owner is tricked into calling moves the owner's funds, because `tx.origin` is still the owner | `require(tx.origin == …)` used for authorisation | Authorise with `msg.sender`, the immediate caller |

## How it's built

- **Solidity** — the contracts, each in `contracts/<n>-<name>/`. Every file contains the `Vulnerable…` version, the `Secure…` version, and (where needed) the attacker contract an auditor would write to prove the finding.
- **JavaScript** — the exploit harness. `lib/evm.js` compiles the contracts with `solc` (offline, no toolchain download), spins up an in-process EVM with `ganache`, and deploys/exploits them with `ethers`. `test/*.test.js` runs the exploits with Node's built-in test runner.

There is deliberately **no real network, no private keys, and no external RPC** — everything happens on a throwaway in-memory chain created fresh for each test.

## Run it

```bash
npm install
npm test
```

Expected output: each vulnerability's exploit **succeeds** against the vulnerable contract and **fails** against the fixed one — six tests in all.

```
ok 1 - reentrancy drains the VulnerableBank
ok 2 - SecureBank resists the same attack
ok 3 - anyone can seize ownership of VulnerableVault and drain it
ok 4 - SecureVault blocks the ownership takeover
ok 5 - tx.origin wallet is drained when the owner is phished
ok 6 - SecureWallet (msg.sender) resists the phish
```

CI runs the same thing on Node 20 and 22 on every push.

## How to study it

1. Open a challenge's `.sol` file and read only the `Vulnerable…` contract. Try to spot the bug using the "how an auditor spots it" column above before reading further.
2. Read the matching `test/*.test.js` to see the exploit written out.
3. Compare the `Vulnerable…` and `Secure…` contracts to see the one change that closes the hole.
4. Run `npm test` and watch the exploit drain the vulnerable contract and bounce off the fixed one.

## A note on `npm audit`

`npm install` reports advisories (several high/critical) in the **test-only dev dependencies** — chiefly `ganache`, which is deprecated and drags in an old transitive tree. None of this is part of the lab's product: the deliverable is the Solidity in `contracts/`, and `npm ci --omit=dev` installs nothing, so nothing here is shipped or deployed. The advisories live in local tooling used to run the exploit tests.

The clean long-term fix is to migrate the harness off `ganache` to **Foundry** or **Hardhat**; that's the planned v2. Until then the tradeoff is explicit here rather than hidden.

## Scope and intent

This exists to train developers and auditors to find and fix these bugs. The contracts are classic teaching examples (mapped to the [SWC Registry](https://swcregistry.io/) and covered in every smart-contract security course), they run only on a local test chain, and each ships with its fix. It is not tooling aimed at any live contract, and nothing here should be deployed.

## License

MIT
