import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Rocketfun } from "../target/types/rocketfun";
import { TestValues, createValues, mintingTokens } from "./utils";

describe("Mint", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Rocketfun as Program<Rocketfun>;
  const connection = provider.connection;

  let values: TestValues;

  beforeEach(async () => {
    values = createValues();

    await program.methods
      .createAmm(values.id)
      .accounts({ amm: values.ammKey, admin: values.admin.publicKey })
      .rpc();
  });
  it("Mint tokens with metadata", async () => {
    await mintingTokens({
      program,
      connection,
      creator: values.admin,
      mintAKeypair: values.mintAKeypair,
    });
  });
});
