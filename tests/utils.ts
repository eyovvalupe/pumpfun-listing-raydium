import * as anchor from "@coral-xyz/anchor";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Keypair, PublicKey, Connection, Signer } from "@solana/web3.js";
import { BN } from "bn.js";
import { Metadata } from "@metaplex-foundation/mpl-token-metadata";
require("dotenv").config();

const fs = require("fs");
const path = require("path");

export async function sleep(seconds: number) {
  new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

export const generateSeededKeypair = (seed: string) => {
  return Keypair.fromSeed(
    anchor.utils.bytes.utf8.encode(anchor.utils.sha256.hash(seed)).slice(0, 32)
  );
};

export const expectRevert = async (promise: Promise<any>) => {
  try {
    await promise;
    throw new Error("Expected a revert");
  } catch {
    return;
  }
};

export const mintingTokens = async ({
  program,
  connection,
  creator,
  mintAKeypair,
}: {
  program: any;
  connection: Connection;
  creator: Signer;
  holder?: Signer;
  mintAKeypair: Keypair;
  mintedAmount?: number;
}) => {
  const metadata = {
    name: "Rocket Fun",
    symbol: "ROCKETFUN",
    uri: "https://gateway.pinata.cloud/ipfs/QmRRn1UZJHKjLbq2EtZcrEjn2qeUX6B2cjYLir233Dk5vn",
  };

  const associatedTokenAccount = await getAssociatedTokenAddressSync(
    mintAKeypair.publicKey,
    creator.publicKey
  );

  // Derive PDA for metadata account
  const [metadataPDA, _] = await PublicKey.findProgramAddress(
    [
      Buffer.from("metadata"),
      new PublicKey(process.env.METADATA_PROGRAM_ID).toBuffer(),
      mintAKeypair.publicKey.toBuffer(),
    ],
    new PublicKey(process.env.METADATA_PROGRAM_ID) // The public key of the token metadata program
  );

  const tx = await program.methods
    .createTokenMint(metadata.name, metadata.symbol, metadata.uri)
    .accounts({
      payer: creator.publicKey,
      mintAccount: mintAKeypair.publicKey,
      associatedTokenAccount,
      metadataAccount: metadataPDA,
      tokenMetadataProgram: new PublicKey(process.env.METADATA_PROGRAM_ID),
    })
    .signers([mintAKeypair, creator])
    .rpc();

  // Fetch and decode the metadata account
  const metadataAccountInfo = await connection.getAccountInfo(metadataPDA);
  if (metadataAccountInfo === null) {
    throw new Error("Failed to fetch metadata account info");
  }

  const MetaData = Metadata.deserialize(metadataAccountInfo.data)[0];

  // Check if the update authority was renounced
  if (MetaData.updateAuthority.toString() !== PublicKey.default.toString()) {
    throw new Error("Metadata update authority was not renounced");
  }

  // console.log(
  //   `     Transaction Signature: https://solscan.io/tx/${tx}?cluster=devnet`
  // );
};

export interface TestValues {
  id: PublicKey;
  fee: number;
  maxPerWallet: anchor.BN;
  admin: Keypair;
  trader: Keypair;
  mintAKeypair: Keypair;
  defaultSupply: anchor.BN;
  ammKey: PublicKey;
  minimumLiquidity: anchor.BN;
  poolKey: PublicKey;
  poolAuthority: PublicKey;
  mintLiquidity: PublicKey;
  depositAmountA: anchor.BN;
  liquidityAccount: PublicKey;
  poolAccountA: PublicKey;
  holderAccountA: PublicKey;
  traderAccountA: PublicKey;
  treasury: Keypair;
  treasuryAccountA: PublicKey;
}

type TestValuesDefaults = {
  [K in keyof TestValues]+?: TestValues[K];
};

export function createValues(defaults?: TestValuesDefaults): TestValues {
  const id = defaults?.id || Keypair.generate().publicKey;

  const homeDir = process.env.HOME || process.env.USERPROFILE;
  const keypairPath = path.join(homeDir, ".config", "solana", "id.json");

  const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf8"));
  const admin = Keypair.fromSecretKey(new Uint8Array(secretKey));

  const trader_secretKey = JSON.parse(
    fs.readFileSync("./client/trader.json", "utf8")
  );
  const trader = Keypair.fromSecretKey(new Uint8Array(trader_secretKey));

  const ammKey = PublicKey.findProgramAddressSync(
    [id.toBuffer()],
    anchor.workspace.Rocketfun.programId
  )[0];

  // Making sure tokens are in the right order
  const mintAKeypair = Keypair.generate();

  const treasury = Keypair.generate();

  const poolAuthority = PublicKey.findProgramAddressSync(
    [
      ammKey.toBuffer(),
      mintAKeypair.publicKey.toBuffer(),
      Buffer.from("authority"),
    ],
    anchor.workspace.Rocketfun.programId
  )[0];

  const mintLiquidity = PublicKey.findProgramAddressSync(
    [
      ammKey.toBuffer(),
      mintAKeypair.publicKey.toBuffer(),
      Buffer.from("liquidity"),
    ],
    anchor.workspace.Rocketfun.programId
  )[0];

  const poolKey = PublicKey.findProgramAddressSync(
    [ammKey.toBuffer(), mintAKeypair.publicKey.toBuffer()],
    anchor.workspace.Rocketfun.programId
  )[0];

  return {
    id,
    fee: 100,
    maxPerWallet: new BN(100000000).mul(new BN(10 ** 9)),
    admin,
    trader,
    ammKey,
    mintAKeypair,
    mintLiquidity,
    poolKey,
    poolAuthority,
    poolAccountA: getAssociatedTokenAddressSync(
      mintAKeypair.publicKey,
      poolAuthority,
      true
    ),
    liquidityAccount: getAssociatedTokenAddressSync(
      mintLiquidity,
      admin.publicKey,
      true
    ),
    holderAccountA: getAssociatedTokenAddressSync(
      mintAKeypair.publicKey,
      admin.publicKey,
      true
    ),
    traderAccountA: getAssociatedTokenAddressSync(
      mintAKeypair.publicKey,
      trader.publicKey,
      true
    ),
    treasury,
    treasuryAccountA: getAssociatedTokenAddressSync(
      mintAKeypair.publicKey,
      treasury.publicKey,
      true
    ),
    depositAmountA: new BN(800000000).mul(new BN(10 ** 6)),
    minimumLiquidity: new BN(100),
    defaultSupply: new BN(1000000000).mul(new BN(10 ** 6)),
  };
}
