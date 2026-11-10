"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { compile, freshChain, deploy, ethers } = require("../lib/evm");

const contracts = compile(path.join(__dirname, "../contracts/01-reentrancy/Reentrancy.sol"));
const E = ethers.parseEther.bind(ethers);

async function setup(bankName) {
  const { provider, signers } = await freshChain();
  const [deployer, victim, attackerEOA] = signers;
  const bank = await deploy(contracts, bankName, deployer);
  await (await bank.connect(victim).deposit({ value: E("10") })).wait();   // victim funds the bank
  const attacker = await deploy(contracts, "ReentrancyAttacker", attackerEOA, [await bank.getAddress()]);
  return { provider, bank, attacker, attackerEOA };
}

test("reentrancy drains the VulnerableBank", async () => {
  const { provider, bank, attacker, attackerEOA } = await setup("VulnerableBank");
  await (await attacker.connect(attackerEOA).attack({ value: E("1") })).wait();
  assert.equal(await bank.totalDeposits(), 0n, "bank should be fully drained");
  const loot = await provider.getBalance(await attacker.getAddress());
  assert.ok(loot > E("10"), `attacker should hold >10 ETH (1 deposited + 10 stolen), got ${ethers.formatEther(loot)}`);
});

test("SecureBank resists the same attack", async () => {
  const { bank, attacker, attackerEOA } = await setup("SecureBank");
  await assert.rejects(
    attacker.connect(attackerEOA).attack({ value: E("1") }),
    "the reentrant withdraw must revert",
  );
  assert.equal(await bank.totalDeposits(), E("10"), "victim funds must be intact");
});
