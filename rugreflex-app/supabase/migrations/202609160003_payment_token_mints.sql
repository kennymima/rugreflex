alter table public.payment_config
  add column if not exists token_mint text;

comment on column public.payment_config.token_mint
  is 'Solana SPL token mint used for payment verification. Nullable until a payment token is deployed/configured.';
