## Rocketfun Solana

**Automated Market Makers (AMM)** - Your Gateway to Effortless Trading!
Welcome to the world of Automated Market Makers (AMM), where seamless trading is made possible with the power of automation. The primary goal of AMMs is to act as automatic buyers and sellers, readily available whenever users wish to trade their assets.

**Advantages of AMMs:**

- Always Available Trading: Thanks to the algorithmic trading, AMMs are operational round-the-clock, ensuring you never miss a trading opportunity.

- Low Operational Costs: Embrace cheaper trades as AMMs eliminate the need for a market-making firm. Say goodbye to hefty fees! (In practice, MEV bots handle this role.)

Meet the Constant Product AMM (CPAMM): Among the simplest CFAMMs and made popular by Uniswap V2, the CPAMM ensures the product of both reserves (xy) remains constant (K) for a given liquidity quantity. Simply put, if x denotes the reserve of token A and y denotes the reserve of token B, then xy = K, with K depending on the liquidity.

## Program Implementation

### Design

Let's go over the essential requirements for our smart contract design:

- Fee Distribution: Every pool must have a fee to charge treasury. This fee is charged on trades and paid directly in the traded token. To maintain consistency across all pools, the fees will be shared.

- Single Pool per Asset Pair: Each asset pair will have precisely one pool. This approach avoids liquidity fragmentation and simplifies the process for developers to locate the appropriate pool.

- Max per wallet: Each user can only buy below max tokens.

- lock: We use lock boolean value to evaluate the state of raydium deploy, The default value is false.

By implementing these strategies, we are creating a solana program that efficiently manages reward and maintains a seamless trading experience across various asset pairs.

## Principals

Here are some essential principles to consider when building on-chain programs in Solana:

- Store Keys in the Account: It's beneficial to store keys in the account when creating Program Derived Accounts (PDAs) using seeds. While this may increase account rent slightly, it offers significant advantages. By having all the necessary keys in the account, it becomes effortless to locate the account (since you can recreate its public key). Additionally, this approach works seamlessly with Anchor's has_one clause, streamlining the process.

- Simplicity in Seeds: When creating PDA seeds, prioritize simplicity. Using a straightforward logic for seeds makes it easier to remember and clarifies the relationship between accounts. A logical approach is to first include the seeds of the parent account and then use the current object's identifiers, preferably in alphabetical order. For example, in an AMM account storing configuration (with no parent), adding an identifier attribute, usually a pubkey, becomes necessary since the admin can change. For pools, which have the AMM as a parent and are uniquely defined by the tokens they facilitate trades for, it's advisable to use the AMM's pubkey as the seed, followed by token A's pubkey and then token B's.

- Minimize Instruction's Scope: Keeping each instruction's scope as small as possible is crucial for several reasons. It helps reduce transaction size by limiting the number of accounts touched simultaneously. Moreover, it enhances composability, readability, and security. However, a trade-off to consider is that it may lead to an increase in Lines Of Code (LOC).

- By following these principles, you can build on-chain programs in Solana that are efficient, well-organized, and conducive to seamless interactions, ensuring a robust foundation for your blockchain projects.

## Code Examples

```file structure
programs/rocketfun/src/
├── constants.rs
├── errors.rs
├── instructions
│   ├── create_amm.rs
│   ├── create_pool.rs
│   ├── create-token-mint.rs
│   ├── deposit_liquidity.rs
│   ├── mod.rs
│   ├── swap_exact_tokens_for_tokens.rs
│   └── raydium_initialize.rs
├── lib.rs
└── state.rs
```

1. **Entrypoint**

This code is entrypoint using the **`anchor_lang`** library. The **`anchor_lang`** library provides tools for creating Solana programs using the Anchor framework.

Each function in this module represents an entry point to the smart contract. Each entry point function takes a **`Context`** parameter, which provides essential information for executing the function, such as the accounts involved and the transaction context.

The entry point functions call their respective functions from the **`instructions`** module, passing the required arguments.

Overall, this code defines a Rust module for a Solana program using the Anchor framework. The program supports functions related to creating an Automated Market Maker (AMM) and interacting with it, such as creating a pool, depositing liquidity, withdrawing liquidity, and swapping tokens using an AMM mechanism.

2. **Account Definitions**

Let's embark on our exploration by charting the course for our accounts. Each account will be thoughtfully defined, beginning with their keys arranged in the precise order they will appear in the seeds. Following the keys, we'll list the attributes that are utilized for each account. As we journey through this process, we'll unravel the intricate web of connections and forge a path towards a cohesive and well-structured design. Let the exploration begin!

The above code declares an account structure called **`Amm`**. The **`#[account]`** attribute indicates that this structure will be used as an account on the Solana blockchain. The **`#[derive(Default)]`** attribute automatically generates a default implementation of the struct with all fields set to their default values.

The **`Amm`** struct has five fields:

1. **`id`**: The primary key of the AMM, represented as a **`Pubkey`**.
2. **`admin`**: The account that has admin authority over the AMM, represented as a **`Pubkey`**.
3. **`fee`**: The LP fee taken on each trade, represented as a **`u16`** (unsigned 16-bit integer) in basis points.
4. **`max_per_wallet`**: The user can only buy limited tokens.
5. **`lock`**: This bool valuse is used to evaluate the state of raydium-deploy.

The above code declares an account structure called Amm. The #[account] attribute indicates that this structure will be used as an account on the Solana blockchain. The #[derive(Default)] attribute automatically generates a default implementation of the struct with all fields set to their default values.

```
    #[account]
    #[derive(Default)]
    pub struct Amm {
        /// The primary key of the AMM
        pub id: Pubkey,

        /// Account that has admin authority over the AMM
        pub admin: Pubkey,

        /// The LP fee taken on each trade, in basis points
        pub fee: u16,

        /// Max tokens per wallet
        pub max_per_wallet: u64,

        /// Bool value for lock of bonding curves
        pub lock: bool,
    }
```

The code declares another account structure called **`Pool`**. As before, the **`#[account]`** attribute indicates that this struct will be used as an account on the Solana blockchain, and the **`#[derive(Default)]`** attribute generates a default implementation with all fields set to their default values.

The **`Pool`** struct has three fields:

1. **`amm`**: The primary key of the AMM (Automated Market Maker) that this pool belongs to, represented as a **`Pubkey`**.
2. **`mint_a`**: The mint of token A associated with this pool, represented as a **`Pubkey`**.

```
    #[account]
    #[derive(Default)]
    pub struct Pool {
        /// Primary key of the AMM
        pub amm: Pubkey,

        /// Mint of token A
        pub mint_a: Pubkey,
    }
```

This code implements a constant LEN for the Pool struct, which represents the size of the Pool account in bytes.

3.  **Instructions**

    3.1 **create amm**

    ```
         use anchor_lang::prelude::*;

         use crate::{errors::*, state::Amm};

         pub fn create_amm(
             ctx: Context<CreateAmm>,
             id: Pubkey,
             fee: u16,
             max_per_wallet: u64,
         ) -> Result<()> {
             let amm = &mut ctx.accounts.amm;
             amm.id = id;
             amm.admin = ctx.accounts.admin.key();
             amm.fee = fee;
             amm.max_per_wallet = max_per_wallet;
             amm.lock = false;

             Ok(())
         }
    ```

    The above code defines a function named **`create_amm`** that is used to create an AMM account. It takes four parameters:

    The function does the following:

    - It gets a mutable reference to the AMM account from the context using **`let amm = &mut ctx.accounts.amm;`**.
    - It sets the fields of the AMM account with the provided values using **`amm.id = id;`**, **`amm.admin = ctx.accounts.admin.key();`**, and **`amm.fee = fee;`**, **`amm.max_per_wallet = max_per_wallet;`**,**`amm.lock = false;`**.
    - It returns **`Ok(())`** to indicate the success of the operation.

    This code defines a struct **`CreateAmm`** using the **`Accounts`** attribute, which serves as the accounts instruction for the **`create_amm`** function.

    The **`CreateAmm`** struct has four fields:

    1. **`amm`**: An account field marked with **`init`** attribute, which represents the AMM account to be created. It uses the provided **`id`** as a seed to derive the account address, sets the required space for the account using **`Amm::LEN`**, and uses the **`payer`** account for paying rent. Additionally, it specifies a constraint to ensure that the fee is less than 10000 basis points; otherwise, it will raise the error **`TutorialError::InvalidFee`**.
    2. **`admin`**: An **`AccountInfo`** field representing the admin account for the AMM. It is read-only and not mutable.
    3. **`payer`**: A **`Signer`** field representing the account that pays for the rent of the AMM account. It is marked as mutable.
    4. **`system_program`**: A **`Program`** field representing the Solana system program, used for certain system operations.

    TLDR-, this code sets up the instruction structure for the **`create_amm`** function, defining how the accounts should be initialized, accessed, and used when calling the function.

    3.2 **create pool**

    ```
        pub fn create_pool(ctx: Context<CreatePool>) -> Result<()> {
            let pool = &mut ctx.accounts.pool;
            pool.amm = ctx.accounts.amm.key();
            pool.mint_a = ctx.accounts.mint_a.key();

            Ok(())
        }
    ```

    The above code defines a function named **`create_pool`** that creates a liquidity pool. It takes a single parameter, **`ctx`**, which represents the **`Context<CreatePool>`** used to execute the function.

    The function does the following:

    - It gets a mutable reference to the **`Pool`** account from the context using **`let pool = &mut ctx.accounts.pool;`**.
    - It sets the fields of the **`Pool`** account with the keys of the associated accounts using **`pool.amm = ctx.accounts.amm.key();`**, **`pool.mint_a = ctx.accounts.mint_a.key();`**.
    - It returns **`Ok(())`** to indicate the success of the operation.

    Here's an explanation of each field of strunct:

    1. **`amm`**: An account field representing the AMM (Automated Market Maker) associated with the pool. It derives the address of the account using the seed of the AMM account.
    2. **`pool`**: An account field that will be initialized as the new liquidity pool account. It specifies the required space for the account, derives the address using seeds derived from the AMM.
    3. **`pool_authority`**: An account info field representing the read-only authority account for the pool
    4. **`mint_a`** and **`mint_b`**: Boxed account fields representing the mints for token A and token B, respectively.
    5. **`pool_account_a`**: Boxed account fields representing the associated token accounts for token A for the pool. This account is associated with their mints and have **`pool_authority`** as their authority.
    6. **`payer`**: A signer field representing the account that pays for the rent of the new accounts.
    7. **`token_program`**, **`associated_token_program`**, and **`system_program`**: Program fields representing the Solana token program, associated token program, and system program, respectively.

    TLDR, this code defines the accounts instruction structure for the **`create_pool`** function, specifying how the accounts should be initialized, accessed, and used when calling the function.

    3.3 **deposite liquidity**

    ```
        pub fn deposit_liquidity(ctx: Context<DepositLiquidity>, amount_a: u64) -> Result<()> {
            // Prevent depositing assets the depositor does not own
            let amount_a = if amount_a > ctx.accounts.depositor_account_a.amount {
                ctx.accounts.depositor_account_a.amount
            } else {
                amount_a
            };

            // Making sure they are provided in the same proportion as existing liquidity
            let pool_a = &ctx.accounts.pool_account_a;
            let pool_b = &ctx.accounts.pool_authority;
            // Defining pool creation like this allows attackers to frontrun pool creation with bad ratios
            assert!(pool_a.amount == 0 && pool_b.lamports() == 0);

            // Transfer tokens to the pool
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.depositor_account_a.to_account_info(),
                        to: ctx.accounts.pool_account_a.to_account_info(),
                        authority: ctx.accounts.depositor.to_account_info(),
                    },
                ),
                amount_a,
            )?;

            Ok(())
        }
    ```

    The above code defines a function named **`deposit_liquidity`** that allows depositing liquidity into the pool. It takes three parameters:

    1. **`ctx`**: The **`Context<DepositLiquidity>`** parameter contains the context data required to execute the function.
    2. **`amount_a`**: The **`u64`** parameter represents the amount of token A to be deposited.

    This code uses the token::transfer function from the Anchor SPL token crate to transfer the deposited amounts of tokens A and B from the depositor's accounts (depositor_account_a and depositor_account_b, respectively) to the pool's accounts (pool_account_a and pool_account_b, respectively). It does this through cross-program invocation (CPI) using the token program, and the authority for the transfer is the depositor.

    TRDR, this code implements the logic to deposit liquidity into the pool, ensuring correct proportions, handling the initial pool creation, and minting the corresponding liquidity tokens to the depositor.

    3.4 **swap exact tokens**

    ```
        use anchor_lang::{prelude::*, system_program};
        use anchor_spl::{
            associated_token::AssociatedToken,
            token::{self, Mint, Token, TokenAccount, Transfer},
        };
        use fixed::types::I128F0;

        use crate::{
            constants::{AUTHORITY_SEED, VIRTUAL_SOL},
            errors::*,
            state::{Amm, Pool},
        };
    ```

    This code defines a function named **`swap_exact_tokens_for_tokens`** that allows swapping tokens A for SOL (and vice versa) in the AMM pool. It takes five parameters:

    1. **`ctx`**: The **`Context<SwapExactTokensForTokens>`** parameter contains the context data required to execute the function.
    1. **`swap_a`**: The **`bool`** parameter indicates whether tokens A should be swapped for SOL (**`true`**) or SOL should be swapped for tokens A (**`false`**).
    1. **`input_amount`**: The **`u64`** parameter represents the amount of tokens to be swapped.
    1. **`min_output_amount`**: The **`u64`** parameter represents the minimum expected output amount after the swap.

    The function does the following:

    - It checks if the trader has enough tokens for the input amount of the specified token (**`swap_a`**) before proceeding with the swap. If the trader doesn't have enough tokens, it uses the available amount for the swap.

    ```
        let output = if swap_a {
            I128F0::from_num(input)
                .checked_mul(I128F0::from_num(pool_b.lamports() + VIRTUAL_SOL))
                .unwrap()
                .checked_div(
                    I128F0::from_num(pool_a.amount)
                        .checked_add(I128F0::from_num(input))
                        .unwrap(),
                )
                .unwrap()
        } else {
            I128F0::from_num(input)
                .checked_mul(I128F0::from_num(pool_a.amount))
                .unwrap()
                .checked_div(
                    I128F0::from_num(pool_b.lamports() + VIRTUAL_SOL)
                        .checked_add(I128F0::from_num(input))
                        .unwrap(),
                )
                .unwrap()
        }
        .to_num::<u64>();
    ```

    This code calculates the output amount of the swapped token based on the taxed_input, current pool balances (pool_a.amount and pool_b.amount), and whether the swap is from token A to SOL or vice versa. It uses fixed-point arithmetic to ensure precise calculations. Also, We use VIRTUAL_SOL(24 virtual sol not real) to calculate output.The resulting output represents the amount of tokens the trader will receive after the swap.

    ```
        if output < min_output_amount {
            return err!(TutorialError::OutputTooSmall);
        }
    ```

    This code checks if the calculated **`output`** is less than the specified **`min_output_amount`**. If so, it returns an error, indicating that the output amount is too small.

    ```
        if !swap_a && output > amm.max_per_wallet {
            return err!(TutorialError::InvalidTooMany);
        }
    ```

    This code checks if the calculated **`output`** is less than the specified **`max_per_wallet`**. If so, it returns an error, indicating that You can't but too many tokens.

    ```
        let authority_bump = ctx.bumps.pool_authority;
        let authority_seeds = &[
            &ctx.accounts.pool.amm.to_bytes(),
            &ctx.accounts.mint_a.key().to_bytes(),
            AUTHORITY_SEED.as_bytes(),
            &[authority_bump],
        ];
        let signer_seeds = &[&authority_seeds[..]];
        if swap_a {
            token::transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.trader_account_a.to_account_info(),
                        to: ctx.accounts.pool_account_a.to_account_info(),
                        authority: ctx.accounts.trader.to_account_info(),
                    },
                ),
                input,
            )?;

            system_program::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.pool_authority.to_account_info(),
                        to: ctx.accounts.trader.to_account_info(),
                    },
                    signer_seeds,
                ),
                output - output * amm.fee as u64 / 10000,
            )?;

            system_program::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.pool_authority.to_account_info(),
                        to: ctx.accounts.treasury.to_account_info(),
                    },
                    signer_seeds,
                ),
                output * amm.fee as u64 / 10000,
            )?;
            ...
            ...
            ...
    ```

    This code transfers the input and output amounts of tokens between the trader and the pool, performing the token swap. It uses the **`token::transfer`** function from the Anchor SPL token crate to transfer tokens from one account to another. The **`CpiContext`** is used for Cross-Program Invocation (CPI) to interact with the SPL token program.

    The code chooses the appropriate token accounts to perform the transfer based on whether the swap is from token A to SOL or vice versa (**`swap_a`**). The transfer authority is specified as either **`trader`** or **`pool_authority`** based on the situation.

    ```
        if pool_b.lamports() > 85 * VIRTUAL_SOL {
            amm.lock = true;

            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.pool_account_a.to_account_info(),
                        to: ctx.accounts.treasury_account_a.to_account_info(),
                        authority: ctx.accounts.pool_authority.to_account_info(),
                    },
                    signer_seeds,
                ),
                pool_a.amount,
            )?;

            let rent = &ctx.accounts.rent;
            let rent_exempt_minimum = rent.minimum_balance(48);

            system_program::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::Transfer {
                        from: ctx.accounts.pool_authority.to_account_info(),
                        to: ctx.accounts.treasury.to_account_info(),
                    },
                    signer_seeds,
                ),
                pool_b.lamports() - rent_exempt_minimum,
            )?;
        }
    ```

    This code transfers entire token A and SOL in pool when SOL is above 85 SOL,
    Here, 2 SOL to treasury and 79Sol and remainder token A are transfered to raydium.

    3.5 **raydium initialize**

    ```
        pub fn initialize(
            ctx: Context<ProxyInitialize>,
            nonce: u8,
            open_time: u64,
            init_pc_amount: u64,
            init_coin_amount: u64,
        ) -> Result<()> {
            amm_anchor::initialize(
                ctx.accounts.into(),
                nonce,
                open_time,
                init_pc_amount,
                init_coin_amount,
            )
        }
    ```

    This code initializes the raydium pool when toke is deployed into raydium.

## How to run

### environment:

**`anchor-cli:`** 0.29.0,
**`solana-cli:`** 1.18.14,
**`rustc:`** 1.77.2

### run:

    ```
        anchor build
        anchor test

    ```
