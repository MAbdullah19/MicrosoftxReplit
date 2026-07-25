// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title AttestAnchorRegistry
/// @notice Commits one Merkle root per epoch. No claim text ever goes
///         on-chain — deliberately: permanent storage of user content is a
///         privacy and moderation disaster. A 32-byte root is enough to prove
///         a verdict existed and has not been altered.
/// @dev    NOT built in this repo (§13.1). Deploy via Remix with Solidity
///         0.8.24 to Base Sepolia (chain 84532); the app only needs the ABI,
///         which is inlined at shared/abi.ts.
///
///         Centralisation, stated plainly: there is one `anchorer` key today.
///         The roadmap is multi-sig, then threshold signature, then
///         permissionless anchoring with a bond. A stated limitation is more
///         honest than an overclaim.
contract AttestAnchorRegistry {
    struct Anchor {
        bytes32 root;
        uint64 leafCount;
        uint64 timestamp;
    }

    mapping(uint64 => Anchor) public anchors;
    uint64 public latestEpoch;
    address public anchorer;

    event Anchored(uint64 indexed epoch, bytes32 root, uint64 leafCount);

    error NotAuthorised();
    error AlreadyAnchored();

    constructor(address _anchorer) {
        anchorer = _anchorer;
    }

    /// @notice Write one epoch's Merkle root. Epochs are append-only: an
    ///         already-anchored epoch reverts, which is what makes the
    ///         off-chain anchor job safe to retry.
    function submitAnchor(uint64 epoch, bytes32 root, uint64 leafCount) external {
        if (msg.sender != anchorer) revert NotAuthorised();
        if (anchors[epoch].timestamp != 0) revert AlreadyAnchored();
        anchors[epoch] = Anchor(root, leafCount, uint64(block.timestamp));
        if (epoch > latestEpoch) latestEpoch = epoch;
        emit Anchored(epoch, root, leafCount);
    }

    /// @notice Verify a Merkle proof against a stored root.
    /// @dev    Internal nodes use domain separator 0x01 (I8). This must stay
    ///         byte-identical to verifyProof() in shared/merkle.ts — the
    ///         browser walks the same proof and must reach the same root.
    function verify(uint64 epoch, bytes32 leaf, bytes32[] calldata proof, uint256 index)
        external
        view
        returns (bool)
    {
        bytes32 h = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            h = (index >> i) & 1 == 0
                ? sha256(abi.encodePacked(bytes1(0x01), h, proof[i]))
                : sha256(abi.encodePacked(bytes1(0x01), proof[i], h));
        }
        return h == anchors[epoch].root;
    }
}
