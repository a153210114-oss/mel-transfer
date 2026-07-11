# HuaBan Compliance Readiness Checklist

Updated: 2026-07-11

This file is an internal operating checklist for launch, investor diligence, and quarterly compliance self-review. It is not legal advice. Local counsel should review this before any regulated payment, redemption, virtual asset, financial product, remittance, or investment-like feature is launched.

## 1. Public Terms Gate

- User agreement must state that contribution points are contribution records only.
- User agreement must state points are not cash, deposits, debt, equity, securities, fund interests, financial products, crypto assets, fixed income, or investment products.
- User agreement must state there is no guaranteed return, fixed redemption price, guaranteed conversion ratio, token issuance promise, listing promise, or capital protection.
- Redemption wording must say: only if the platform has actual distributable net income, the rules are open, identity/tax/compliance checks are complete, and local law permits.
- Disputed, refunded, cancelled, fraudulent, duplicate, or unverified actions must be excluded from redeemable weight or enter manual review.
- Terms and privacy pages must show update date and remain accessible from public pages and app store listings.

Current public files:

- `terms.html`
- `privacy.html`
- `PLATFORM_DISCLAIMER.md`

## 2. Privacy And Identity Gate

- Privacy policy must cover phone number, verification state, device identifier, login state, friend code, invite/referral relationship, account merge, and device change records.
- If Face ID, fingerprint, voice, or device biometric unlock is offered, raw biometric templates should not be stored by HuaBan unless a separate legal/privacy review approves it.
- Voice input may be transcribed for chat, transaction confirmation, support, and debugging.
- Location, camera, microphone, contacts, and notification permissions must be tied to user action and explained.
- Transaction, points, redemption, audit, dispute, and compliance records must have clear retention purpose.
- Users must have a support path for access, correction, deletion, appeal, and complaint.

## 3. Legal Consultation Record

Keep a written record for every legal review, even if it is only an email or memo.

Minimum fields:

- Date
- Lawyer or firm
- Jurisdiction
- Question asked
- Facts provided
- Conclusion
- Remaining uncertainty
- Product decision made
- Link to document or email

Do not rely on verbal advice for points, redemption, virtual assets, payments, remittance, or securities analysis.

## 4. Key Decision Records

Keep short written records for major compliance decisions.

Required decision records:

- Why users do not make an investment into HuaBan.
- Why contribution points are not securities or financial products under the reviewed jurisdiction.
- Why users receive points only for real contribution, not for paying money.
- Why points are not transferable or tradeable unless a separate legal review permits it.
- Why redemption, if any, is conditional on actual distributable net income and compliance review.
- Why transaction payments remain freely agreed between buyer and seller unless HuaBan later becomes a payment intermediary.
- Why identity checks are required before redemption or payout.

Suggested format:

```text
Decision:
Date:
Jurisdiction:
Facts:
Conclusion:
Evidence:
Reviewed by:
Next review trigger:
```

## 5. Data And Audit Trail

System records should be append-friendly and traceable.

Must retain:

- User behavior events: page view, first message, feature use, share, invite open, profile completion.
- Identity events: phone verification, account merge, device change, referral bind, manual override.
- Points ledger: action, owner, related user/order/object, points, status, risk reason, audit result, timestamp.
- Transaction events: demand, match, temporary session, confirmation card, both-party confirmation,履约 confirmation, payment state, dispute or refund.
- Redemption events: request, identity/tax review, compliance review, approval/rejection, settlement proof.
- Admin actions: who changed what, before/after where possible, reason, timestamp.
- Policy versions: terms version, privacy version, points rule version, contract framework version.

Avoid silent overwrites. Prefer event logs, status transitions, or version snapshots for critical records.

## 6. Quarterly Self-Review

Run once per quarter and before any major release.

Checklist:

- Public terms still match current product.
- Privacy policy still matches data actually collected.
- Points copy does not imply fixed returns, securities, token value, guaranteed payouts, or investment profit.
- Referral copy is based on real contribution and anti-abuse review, not payment for recruitment alone.
- Logs can reconstruct points and transaction decisions.
- No redemption or payout has been processed without identity/tax/compliance review.
- Legal advice records are saved for new payment, crypto, token, wallet, or redemption features.
- User complaint, refund, dispute, and fraud cases have owner and status.
- Thresholds below are reviewed and updated.

## 7. Operating Scale Warning Lines

These are internal triggers for legal review, not legal conclusions.

Re-review before any of the following:

- HuaBan holds customer money, custody balances, escrow, stored value, or settlement funds.
- HuaBan controls, exchanges, transfers, issues, redeems, or markets crypto assets or virtual assets.
- Points become transferable, tradable, sellable, or priced outside HuaBan.
- Any cash, token, or platform-balance redemption is opened to users.
- Cross-border transfers, remittance-like services, or pooled settlement are introduced.
- Users can top up, withdraw, cash out, or send value to other users.
- Monthly gross transaction value exceeds AUD 100,000 in Australia or equivalent in any launch country.
- Any single user payout or transaction reaches AUD 10,000 or equivalent.
- Aggregate pending redemption requests exceed AUD 25,000 or equivalent.
- More than 1,000 users hold redeemable points in one jurisdiction.
- A regulator, bank, payment provider, app store, lawyer, accountant, or auditor asks whether HuaBan is a financial product, virtual asset service provider, digital currency exchange, remittance provider, payment facilitator, or stored-value provider.

Australia note:

- AUSTRAC materials identify virtual asset service providers and remittance service providers as regulated categories. If HuaBan introduces virtual asset exchange, transfer, redemption, remittance, or payment intermediation, complete legal review before launch.
- AUSTRAC reporting obligations can include threshold transaction reporting, suspicious matter reporting, international value transfer reporting, and enrolment/registration obligations depending on the service. Do not rely on product intuition; confirm with counsel and the official AUSTRAC guidance at the time.

## 8. Launch Position For Current Version

Current preferred position:

- HuaBan does not ask users to invest money.
- HuaBan records contribution points for real usage and contribution.
- HuaBan does not promise fixed return or fixed redemption value.
- HuaBan does not operate a public token, exchange, remittance, or stored-value wallet in the current release.
- Buyer and seller can freely agree payment method; HuaBan records transaction consensus and履约 confirmation.
- Any future redemption is conditional on actual net income, announced rules, identity/tax/compliance review, and local law.
