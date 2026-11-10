"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { compile, freshChain, deploy, ethers } = require("../lib/evm");

const contracts = compile(path.join(__dirname, "../contracts/03-tx-origin/TxOrigin.sol"));
const E = ethers.parseEther.bind(ethers);

async function setup(walletName) {
  const { provider, signers } = await freshChain();
  const [deployer, owner, attackerEOA] = signers;
  // The owner funds their own wallet on deployment.
  const wallet = await deploy(contracts, walletName, owner, [], { value: E("5") });
  const phish = await deploy(contracts, "PhishingAttacker", deployer,
    [await wallet.getAddress(), await attackerEOA.getAddress()]);
  return { provider, wallet, phish, owner, attackerEOA };
}

test("tx.origin wallet is drained when the owner is phished", async () => {
  const { provider, wallet, phish, owner, attackerEOA } = await setup("VulnerableWallet");
  const before = await provider.getBalance(await attackerEOA.getAddress());
  // The owner is tricked into calling the attacker's contract (the "phishing click").
  await (await phish.connect(owner).ping()).wait();
  assert.equal(await provider.getBalance(await wallet.getAddress()), 0n, "wallet drained");
  assert.ok(await provider.getBalance(await attackerEOA.getAddress()) > before, "attacker received the funds");
});

test("SecureWallet (msg.sender) resists the phish", async () => {
  const { provider, wallet, phish, owner } = await setup("SecureWallet");
  await assert.rejects(phish.connect(owner).ping(), "transfer must revert: caller is the attacker contract");
  assert.equal(await provider.getBalance(await wallet.getAddress()), E("5"), "funds intact");
});
