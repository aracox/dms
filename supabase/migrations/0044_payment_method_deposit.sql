-- 0044_payment_method_deposit.sql
-- A payment taken out of the tenant's deposit at move-out, when the owner
-- chooses to clear unpaid bills that way (settle_deposit, 0045). Kept apart
-- from cash / transfer / PromptPay so collection reports can tell money that
-- arrived this month from a deposit held since move-in.
--
-- Its own migration: a new enum value cannot be used in the transaction that
-- adds it.

alter type payment_method add value if not exists 'deposit';
