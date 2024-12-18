import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Rocketfun } from "../target/types/rocketfun";
import { TestValues, createValues, mintingTokens, expectRevert } from "./utils";
import { BN } from "bn.js";
import BigNumber from "bignumber.js";
import { expect } from "chai";
import { TOKEN_PROGRAM_ID, getMint } from "@solana/spl-token";

describe("Swap", () => {
  const provider = anchor.AnchorProvider.env();
  const connection = provider.connection;
  anchor.setProvider(provider);

  const program = anchor.workspace.Rocketfun as Program<Rocketfun>;

  let values: TestValues;

  beforeEach(async () => {
    values = createValues();

    await program.methods
      .createAmm(values.id)
      .accounts({ amm: values.ammKey, admin: values.admin.publicKey })
      .rpc();

    await mintingTokens({
      program,
      connection,
      creator: values.admin,
      mintAKeypair: values.mintAKeypair,
    });

    await program.methods
      .createPool()
      .accounts({
        amm: values.ammKey,
        pool: values.poolKey,
        poolAuthority: values.poolAuthority,
        mintA: values.mintAKeypair.publicKey,
        poolAccountA: values.poolAccountA,
      })
      .rpc();

    await program.methods
      .depositLiquidity(values.depositAmountA)
      .accounts({
        pool: values.poolKey,
        poolAuthority: values.poolAuthority,
        depositor: values.admin.publicKey,
        mintA: values.mintAKeypair.publicKey,
        poolAccountA: values.poolAccountA,
        depositorAccountA: values.holderAccountA,
      })
      .signers([values.admin])
      .rpc({ skipPreflight: true });
  });

  it("Swap between tokens", async () => {
    console.log(`   ------ Buy token A with SOL ------`);

    const mintAAccountData = await getMint(
      connection,
      values.mintAKeypair.publicKey,
      TOKEN_PROGRAM_ID
    );

    // Extract the mint authority
    const mintACreator = new anchor.web3.PublicKey(
      mintAAccountData.mintAuthority
    );

    //the lamports of trader before transaction
    const exTraderLamports = await connection.getBalance(
      values.trader.publicKey
    );
    //the lamports of treasury before transaction
    const exTreasuryLamports = await connection.getBalance(
      values.treasury.publicKey
    );
    // the balance of token A before transaction
    const extraderTokenAAmount = await connection
      .getTokenAccountBalance(values.traderAccountA)
      .then((data) => {
        data.value.amount;
      })
      .catch(() => {
        return 0;
      });

    const input = new BN(1).mul(new BN(10 ** 9));
    const tx = await program.methods
      .swapExactTokensForTokens(
        false,
        input,
        new BN(30000000).mul(new BN(10 ** 6))
      )
      .accounts({
        amm: values.ammKey,
        pool: values.poolKey,
        poolAuthority: values.poolAuthority,
        trader: values.trader.publicKey,
        mintA: values.mintAKeypair.publicKey,
        mintACreator: mintACreator,
        poolAccountA: values.poolAccountA,
        traderAccountA: values.traderAccountA,
        treasury: values.treasury.publicKey,
        treasuryAccountA: values.treasuryAccountA,
      })
      .signers([values.trader])
      .rpc({ skipPreflight: true });

    console.log(
      `     Transaction Signature: https://solscan.io/tx/${tx}?cluster=devnet`
    );

    //the lamports of trader after transaction
    const curTraderLamports = await connection.getBalance(
      values.trader.publicKey
    );
    //the lamports of treasury after transaction
    const curTreasuryLamports = await connection.getBalance(
      values.treasury.publicKey
    );
    //the balance of trader's token A after transaction
    const curtraderTokenAccountA = await connection.getTokenAccountBalance(
      values.traderAccountA
    );

    expect(Number(curTreasuryLamports)).to.equal(
      new BN(exTreasuryLamports).add(new BN(Number(input) * 0.01)).toNumber()
    );
    expect(Number(curTraderLamports)).to.equal(
      new BN(exTraderLamports).sub(new BN(Number(input) * 1.01)).toNumber()
    );
    expect(
      new BigNumber(curtraderTokenAccountA.value.amount).isGreaterThan(
        new BigNumber(Number(extraderTokenAAmount))
      )
    ).to.be.true;

    console.log(`   ------ Sell token A to SOL ------- `);
    const sell_input = new BN(30000000).mul(new BN(10 ** 6));
    const sell_tx = await program.methods
      .swapExactTokensForTokens(
        true,
        sell_input,
        new BN(0.8).mul(new BN(10 ** 9))
      )
      .accounts({
        amm: values.ammKey,
        pool: values.poolKey,
        poolAuthority: values.poolAuthority,
        trader: values.trader.publicKey,
        mintA: values.mintAKeypair.publicKey,
        mintACreator: mintACreator,
        poolAccountA: values.poolAccountA,
        traderAccountA: values.traderAccountA,
        treasury: values.treasury.publicKey,
        treasuryAccountA: values.treasuryAccountA,
      })
      .signers([values.trader])
      .rpc({ skipPreflight: true });

    console.log(
      `     Transaction Signature: https://solscan.io/tx/${sell_tx}?cluster=devnet`
    );
  });

  it("Invalid buy too many tokens!", async () => {
    const mintAAccountData = await getMint(
      connection,
      values.mintAKeypair.publicKey,
      TOKEN_PROGRAM_ID
    );

    // Extract the mint authority
    const mintACreator = new anchor.web3.PublicKey(
      mintAAccountData.mintAuthority
    );

    const input = new BN(5).mul(new BN(10 ** 9));
    await expectRevert(
      program.methods
        .swapExactTokensForTokens(
          false,
          input,
          new BN(100000000).mul(new BN(10 ** 6))
        )
        .accounts({
          amm: values.ammKey,
          pool: values.poolKey,
          poolAuthority: values.poolAuthority,
          trader: values.admin.publicKey,
          mintA: values.mintAKeypair.publicKey,
          mintACreator: mintACreator,
          poolAccountA: values.poolAccountA,
          traderAccountA: values.holderAccountA,
          treasury: values.treasury.publicKey,
          treasuryAccountA: values.treasuryAccountA,
        })
        .signers([values.admin])
        .rpc({ skipPreflight: true })
    );
  });
});
