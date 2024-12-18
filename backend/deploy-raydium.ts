import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

import {
  createAssociatedTokenAccountIfNotExist,
  createMarket,
  getAssociatedPoolKeys,
  getMarket,
  sleep,
  retry,
} from "./util";

import { BN } from "bn.js";

import { Rocketfun } from "../target/types/rocketfun";
import {
  getAssociatedTokenAddress,
  getAccount,
  createBurnInstruction,
} from "@solana/spl-token";
import { mintingTokens } from "../tests/utils";
require("dotenv").config();

const globalInfo = {
  marketProgram: new PublicKey(process.env.MARKET_PROGRAM_PUBLICKEY),
  ammProgram: new PublicKey(process.env.AMM_PROGRAM_PUBLICKEY),
  ammCreateFeeDestination: new PublicKey(process.env.AMM_FEE_DESTINATION),
  market: new Keypair(),
};

const confirmOptions = {
  skipPreflight: true,
};

describe("deploy to raydium", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const owner = anchor.Wallet.local().payer;
  const program = anchor.workspace.Rocketfun as Program<Rocketfun>;
  const marketId = globalInfo.market.publicKey.toString();
  const mintAKeypair = Keypair.generate();

  it("amm anchor test!", async () => {
    let conn = anchor.getProvider().connection;

    await mintingTokens({
      program,
      connection: conn,
      creator: owner,
      mintAKeypair,
    });
    // create serum market
    const marketInfo = await retry(
      async () => {
        return await createMarket({
          connection: conn,
          wallet: anchor.Wallet.local(),
          baseMint: mintAKeypair.publicKey,
          quoteMint: new PublicKey(process.env.WSOL_MINT_KEY),
          baseLotSize: 1,
          quoteLotSize: 1,
          dexProgram: globalInfo.marketProgram,
          market: globalInfo.market,
        });
      },
      5,
      2000
    );
    // wait for transaction success
    sleep(60000);

    // get serum market info
    const market = await getMarket(
      conn,
      marketId,
      globalInfo.marketProgram.toString()
    );
    // console.log("market info:", JSON.stringify(market));

    const poolKeys = await retry(
      async () => {
        return await getAssociatedPoolKeys({
          programId: globalInfo.ammProgram,
          serumProgramId: globalInfo.marketProgram,
          marketId: market.address,
          baseMint: market.baseMint,
          quoteMint: market.quoteMint,
        });
      },
      5,
      2000
    );
    // console.log("amm poolKeys: ", JSON.stringify(poolKeys));

    const ammAuthority = poolKeys.authority;
    const nonce = poolKeys.nonce;
    const ammId: PublicKey = poolKeys.id;
    const ammCoinVault: PublicKey = poolKeys.baseVault;
    const ammPcVault: PublicKey = poolKeys.quoteVault;
    const lpMintAddress: PublicKey = poolKeys.lpMint;
    const ammTargetOrders: PublicKey = poolKeys.targetOrders;
    const ammOpenOrders: PublicKey = poolKeys.openOrders;

    const [amm_config, _] = await getAmmConfigAddress(globalInfo.ammProgram);
    console.log("amm config:", amm_config.toString());
    /************************************ initialize test ***********************************************************************/

    const transaction = new Transaction();
    const userCoinTokenAccount = await createAssociatedTokenAccountIfNotExist(
      owner.publicKey,
      market.baseMint,
      transaction,
      anchor.getProvider().connection
    );

    const userPcTokenAccount = await createAssociatedTokenAccountIfNotExist(
      owner.publicKey,
      market.quoteMint,
      transaction,
      anchor.getProvider().connection
    );

    const userLPTokenAccount: PublicKey = await getAssociatedTokenAddress(
      poolKeys.lpMint,
      owner.publicKey
    );

    const tx = await retry(
      async () => {
        return await program.methods
          .proxyInitialize(
            nonce,
            new anchor.BN(0),
            new BN(79).mul(new BN(10 ** 7)),
            new BN(20600000).mul(new BN(10 ** 6))
          )
          .accounts({
            ammProgram: globalInfo.ammProgram,
            amm: ammId,
            ammAuthority: ammAuthority,
            ammOpenOrders: ammOpenOrders,
            ammLpMint: lpMintAddress,
            ammCoinMint: market.baseMintAddress,
            ammPcMint: market.quoteMintAddress,
            ammCoinVault: ammCoinVault,
            ammPcVault: ammPcVault,
            ammTargetOrders: ammTargetOrders,
            ammConfig: amm_config,
            createFeeDestination: globalInfo.ammCreateFeeDestination,
            marketProgram: globalInfo.marketProgram,
            market: marketId,
            userWallet: owner.publicKey,
            userTokenCoin: userCoinTokenAccount,
            userTokenPc: userPcTokenAccount,
            userTokenLp: userLPTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            sysvarRent: SYSVAR_RENT_PUBKEY,
          })
          .rpc(confirmOptions);
      },
      5,
      2000
    );

    console.log(
      `     Transaction Signature: https://solscan.io/tx/${tx}?cluster=devnet`
    );

    const userLPTokenAccountInfo = await getAccount(conn, userLPTokenAccount);

    const total_lp = userLPTokenAccountInfo.amount;

    const burnInstruction = createBurnInstruction(
      userLPTokenAccount,
      poolKeys.lpMint,
      owner.publicKey,
      total_lp,
      [],
      TOKEN_PROGRAM_ID
    );

    const burn_transaction = new Transaction().add(burnInstruction);

    const burn_tx = await retry(
      async () => {
        await anchor.AnchorProvider.env().sendAndConfirm(burn_transaction, [
          owner,
        ]);
      },
      5,
      2000
    );

    console.log(
      `     Burn Transaction Signature: https://solscan.io/tx/${burn_tx}?cluster=devnet`
    );
  });
});

export async function getAmmConfigAddress(
  programId: PublicKey
): Promise<[PublicKey, number]> {
  const [address, bump] = await PublicKey.findProgramAddress(
    [Buffer.from(anchor.utils.bytes.utf8.encode("amm_config_account_seed"))],
    programId
  );
  return [address, bump];
}
