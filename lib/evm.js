"use strict";
// Minimal test harness: compile Solidity with solc-js (offline, no binary
// download) and run contracts on an in-process ganache EVM via ethers. Kept
// dependency-light on purpose so the lab is easy to read and run.

const fs = require("fs");
const path = require("path");
const solc = require("solc");
const ganache = require("ganache");
const { ethers } = require("ethers");

/** Compile one .sol file; return { ContractName: { abi, bytecode } }. */
function compile(solPath) {
  const source = fs.readFileSync(solPath, "utf8");
  const fileName = path.basename(solPath);
  const input = {
    language: "Solidity",
    sources: { [fileName]: { content: source } },
    settings: { optimizer: { enabled: true, runs: 200 },
                outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (output.errors || []).filter((e) => e.severity === "error");
  if (errors.length) {
    throw new Error("Solidity compilation failed:\n" + errors.map((e) => e.formattedMessage).join("\n"));
  }
  const contracts = {};
  for (const [name, c] of Object.entries(output.contracts[fileName])) {
    contracts[name] = { abi: c.abi, bytecode: c.evm.bytecode.object };
  }
  return contracts;
}

/** Start a fresh in-process chain. Returns { provider, signers } with funded accounts. */
async function freshChain(accountEther = 1000) {
  const provider = new ethers.BrowserProvider(
    ganache.provider({ logging: { quiet: true }, wallet: { defaultBalance: accountEther } }),
    undefined,
    { cacheTimeout: -1 } // ethers v6 caches getBalance etc. for ~250ms; disable so before/after reads are accurate
  );
  const signers = [];
  for (let i = 0; i < 5; i++) signers.push(await provider.getSigner(i));
  return { provider, signers };
}

/** Deploy a compiled contract. */
async function deploy(compiled, name, signer, args = [], overrides = {}) {
  const factory = new ethers.ContractFactory(compiled[name].abi, compiled[name].bytecode, signer);
  const contract = await factory.deploy(...args, overrides);
  await contract.waitForDeployment();
  return contract;
}

module.exports = { compile, freshChain, deploy, ethers };
