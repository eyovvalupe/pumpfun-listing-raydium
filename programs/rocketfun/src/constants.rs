use anchor_lang::prelude::*;
use solana_program::native_token::LAMPORTS_PER_SOL;

#[constant]
pub const AUTHORITY_SEED: &str = "authority";

#[constant]
pub const VIRTUAL_SOL: u64 = 24 * LAMPORTS_PER_SOL;
pub const FEE: u16 = 100;
pub const TOTAL_SUPPLY: u64 = 1000000000 * 10u64.pow(TOKEN_DECIMAL as u32);
pub const TOKEN_DECIMAL: u8 = 6;
