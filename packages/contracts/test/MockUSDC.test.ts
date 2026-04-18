import { expect } from "chai";
import { ethers } from "hardhat";
import { MockUSDC } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("MockUSDC", function () {
  let usdc: MockUSDC;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;
  let facilitator: SignerWithAddress;

  beforeEach(async function () {
    [owner, addr1, addr2, facilitator] = await ethers.getSigners();
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy() as MockUSDC;
  });

  describe("Deployment", function () {
    it("should have correct name and symbol", async function () {
      expect(await usdc.name()).to.equal("USD Coin");
      expect(await usdc.symbol()).to.equal("USDC");
    });

    it("should have 6 decimals", async function () {
      expect(await usdc.decimals()).to.equal(6);
    });

    it("should start with zero total supply", async function () {
      expect(await usdc.totalSupply()).to.equal(0);
    });

    it("should expose DOMAIN_SEPARATOR", async function () {
      const ds = await usdc.DOMAIN_SEPARATOR();
      expect(ds).to.not.equal(ethers.ZeroHash);
    });
  });

  describe("Minting", function () {
    it("should allow anyone to mint", async function () {
      const amount = 1000000n;
      await usdc.connect(addr1).mint(addr2.address, amount);
      expect(await usdc.balanceOf(addr2.address)).to.equal(amount);
    });

    it("should update total supply after mint", async function () {
      const amount = 10000000n;
      await usdc.mint(addr1.address, amount);
      expect(await usdc.totalSupply()).to.equal(amount);
    });
  });

  describe("Transfers", function () {
    it("should transfer tokens between accounts", async function () {
      const amount = 5000000n;
      await usdc.mint(addr1.address, amount);
      await usdc.connect(addr1).transfer(addr2.address, amount);
      expect(await usdc.balanceOf(addr1.address)).to.equal(0);
      expect(await usdc.balanceOf(addr2.address)).to.equal(amount);
    });

    it("should emit Transfer event", async function () {
      const amount = 1000000n;
      await usdc.mint(addr1.address, amount);
      await expect(usdc.connect(addr1).transfer(addr2.address, amount))
        .to.emit(usdc, "Transfer")
        .withArgs(addr1.address, addr2.address, amount);
    });
  });

  describe("TransferWithAuthorization (EIP-3009)", function () {
    const amount = 1000000n; // 1 USDC

    async function signAuthorization(
      signer: SignerWithAddress,
      to: string,
      value: bigint,
      validAfter: number,
      validBefore: number,
      nonce: string,
    ) {
      const domain = {
        name: "USD Coin",
        version: "2",
        chainId: (await ethers.provider.getNetwork()).chainId,
        verifyingContract: await usdc.getAddress(),
      };

      const types = {
        TransferWithAuthorization: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "validAfter", type: "uint256" },
          { name: "validBefore", type: "uint256" },
          { name: "nonce", type: "bytes32" },
        ],
      };

      const message = {
        from: signer.address,
        to,
        value,
        validAfter,
        validBefore,
        nonce,
      };

      const signature = await signer.signTypedData(domain, types, message);
      const { v, r, s } = ethers.Signature.from(signature);
      return { v, r, s };
    }

    it("should execute authorized transfer", async function () {
      await usdc.mint(addr1.address, amount);

      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const now = Math.floor(Date.now() / 1000);
      const { v, r, s } = await signAuthorization(addr1, addr2.address, amount, now - 60, now + 300, nonce);

      // Facilitator executes the transfer on behalf of addr1
      await usdc.connect(facilitator).transferWithAuthorization(
        addr1.address, addr2.address, amount, now - 60, now + 300, nonce, v, r, s
      );

      expect(await usdc.balanceOf(addr1.address)).to.equal(0);
      expect(await usdc.balanceOf(addr2.address)).to.equal(amount);
    });

    it("should emit AuthorizationUsed event", async function () {
      await usdc.mint(addr1.address, amount);

      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const now = Math.floor(Date.now() / 1000);
      const { v, r, s } = await signAuthorization(addr1, addr2.address, amount, now - 60, now + 300, nonce);

      await expect(
        usdc.connect(facilitator).transferWithAuthorization(
          addr1.address, addr2.address, amount, now - 60, now + 300, nonce, v, r, s
        )
      ).to.emit(usdc, "AuthorizationUsed").withArgs(addr1.address, nonce);
    });

    it("should mark nonce as used", async function () {
      await usdc.mint(addr1.address, amount);

      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const now = Math.floor(Date.now() / 1000);
      const { v, r, s } = await signAuthorization(addr1, addr2.address, amount, now - 60, now + 300, nonce);

      expect(await usdc.authorizationState(addr1.address, nonce)).to.equal(false);

      await usdc.connect(facilitator).transferWithAuthorization(
        addr1.address, addr2.address, amount, now - 60, now + 300, nonce, v, r, s
      );

      expect(await usdc.authorizationState(addr1.address, nonce)).to.equal(true);
    });

    it("should reject replay (same nonce)", async function () {
      await usdc.mint(addr1.address, amount * 2n);

      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const now = Math.floor(Date.now() / 1000);
      const { v, r, s } = await signAuthorization(addr1, addr2.address, amount, now - 60, now + 300, nonce);

      await usdc.connect(facilitator).transferWithAuthorization(
        addr1.address, addr2.address, amount, now - 60, now + 300, nonce, v, r, s
      );

      await expect(
        usdc.connect(facilitator).transferWithAuthorization(
          addr1.address, addr2.address, amount, now - 60, now + 300, nonce, v, r, s
        )
      ).to.be.revertedWith("Authorization already used");
    });

    it("should reject expired authorization", async function () {
      await usdc.mint(addr1.address, amount);

      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const { v, r, s } = await signAuthorization(addr1, addr2.address, amount, 0, 1, nonce);

      await expect(
        usdc.connect(facilitator).transferWithAuthorization(
          addr1.address, addr2.address, amount, 0, 1, nonce, v, r, s
        )
      ).to.be.revertedWith("Authorization expired");
    });

    it("should reject wrong signer", async function () {
      await usdc.mint(addr1.address, amount);

      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const now = Math.floor(Date.now() / 1000);
      // addr2 signs but from=addr1
      const { v, r, s } = await signAuthorization(addr2, addr2.address, amount, now - 60, now + 300, nonce);

      await expect(
        usdc.connect(facilitator).transferWithAuthorization(
          addr1.address, addr2.address, amount, now - 60, now + 300, nonce, v, r, s
        )
      ).to.be.revertedWith("Invalid signature");
    });

    it("should reject insufficient balance", async function () {
      // addr1 has 0 USDC
      const nonce = ethers.hexlify(ethers.randomBytes(32));
      const now = Math.floor(Date.now() / 1000);
      const { v, r, s } = await signAuthorization(addr1, addr2.address, amount, now - 60, now + 300, nonce);

      await expect(
        usdc.connect(facilitator).transferWithAuthorization(
          addr1.address, addr2.address, amount, now - 60, now + 300, nonce, v, r, s
        )
      ).to.be.reverted; // ERC20 insufficient balance
    });
  });
});
