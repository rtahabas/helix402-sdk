import { ethers } from "hardhat";
import * as fs from "fs";

interface TestnetDeployment {
  network: string;
  chainId: number;
  usdc: string;
  deployer: string;
  merchant: string;
  agent: string;
  deployedAt: string;
  blockExplorer: string;
}

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("Deploying MockUSDC on", network.name, "(chain", network.chainId.toString() + ")");
  console.log("Deployer:", deployer.address);
  console.log("Chain ID:", network.chainId.toString());

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  if (balance === 0n) {
    throw new Error("Deployer has no ETH for gas");
  }

  // Deploy MockUSDC
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();

  const usdcAddress = await usdc.getAddress();
  console.log("MockUSDC deployed to:", usdcAddress);

  // Create merchant + agent wallets (deterministic from deployer for demo)
  const merchantWallet = ethers.Wallet.createRandom();
  const agentWallet = ethers.Wallet.createRandom();

  // Mint 100 USDC to agent
  const mintAmount = 100n * 10n ** 6n;
  const mintTx = await usdc.mint(agentWallet.address, mintAmount);
  await mintTx.wait();
  console.log("Minted 100 USDC to agent:", agentWallet.address);

  const deployment: TestnetDeployment = {
    network: network.name,
    chainId: Number(network.chainId),
    usdc: usdcAddress,
    deployer: deployer.address,
    merchant: merchantWallet.address,
    agent: agentWallet.address,
    deployedAt: new Date().toISOString(),
    blockExplorer: (Number(network.chainId) === 11155111 ? "https://sepolia.etherscan.io/address/" : Number(network.chainId) === 80002 ? "https://amoy.polygonscan.com/address/" : "https://sepolia.basescan.org/address/") + usdcAddress,
  };

  // Save deployment info (public)
  fs.writeFileSync("./deployment-testnet.json", JSON.stringify(deployment, null, 2));

  // Save keys separately (gitignored)
  const keys = {
    merchantPrivateKey: merchantWallet.privateKey,
    agentPrivateKey: agentWallet.privateKey,
  };
  fs.writeFileSync("./testnet-keys.json", JSON.stringify(keys, null, 2));

  console.log("");
  console.log("=== Deployment Summary ===");
  console.log("USDC:", usdcAddress);
  console.log("Explorer:", deployment.blockExplorer);
  console.log("Merchant:", merchantWallet.address);
  console.log("Agent:", agentWallet.address);
  console.log("");
  console.log("Keys saved to testnet-keys.json (DO NOT COMMIT)");
  console.log("Deployment info saved to deployment-testnet.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
