import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { Rocketfun } from "../target/types/rocketfun";
import { TestValues, createValues, mintingTokens, expectRevert } from "./utils";

describe("Create pool", () => {
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
  });

  it("Creation", async () => {
    await program.methods
      .createPool()
      .accounts({
        amm: values.ammKey,
        pool: values.poolKey,
        poolAuthority: values.poolAuthority,
        mintA: values.mintAKeypair.publicKey,
        poolAccountA: values.poolAccountA,
      })
      .rpc({ skipPreflight: true });
  });

  it("Invalid mints", async () => {
    values = createValues({
      poolKey: PublicKey.findProgramAddressSync(
        [values.id.toBuffer(), values.mintAKeypair.publicKey.toBuffer()],
        program.programId
      )[0],
      poolAuthority: PublicKey.findProgramAddressSync(
        [
          values.id.toBuffer(),
          values.mintAKeypair.publicKey.toBuffer(),
          Buffer.from("authority"),
        ],
        program.programId
      )[0],
    });

    await expectRevert(
      program.methods
        .createPool()
        .accounts({
          amm: values.ammKey,
          pool: values.poolKey,
          poolAuthority: values.poolAuthority,
          mintA: values.mintAKeypair.publicKey,
          poolAccountA: values.poolAccountA,
        })
        .rpc({ skipPreflight: true })
    );
  });
});
