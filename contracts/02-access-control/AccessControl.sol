// SPDX-License-Identifier: MIT
// INTENTIONALLY VULNERABLE TEACHING CONTRACTS. Local test chains only. Do not deploy.
pragma solidity ^0.8.20;

/// @dev VULNERABLE: changeOwner has no access control, so anyone can make
/// themselves the owner and then drain the vault.
/// Audit tell: a state-changing function that alters privileged state (owner,
/// roles, pause flags) with no `onlyOwner`/role check. (SWC-105)
contract VulnerableVault {
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    function deposit() external payable {}

    function changeOwner(address newOwner) external {   // <-- missing access control
        owner = newOwner;
    }

    function withdrawAll() external {
        require(msg.sender == owner, "not owner");
        payable(msg.sender).transfer(address(this).balance);
    }

    function balance() external view returns (uint256) {
        return address(this).balance;
    }
}

/// @dev FIXED: ownership changes require the current owner.
contract SecureVault {
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    function deposit() external payable {}

    function changeOwner(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero owner");
        owner = newOwner;
    }

    function withdrawAll() external onlyOwner {
        payable(msg.sender).transfer(address(this).balance);
    }

    function balance() external view returns (uint256) {
        return address(this).balance;
    }
}
