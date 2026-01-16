# 🚀 Stripe Connect Quick Start

## ✅ Status: READY TO ENABLE

**Current:** Flag is OFF, normal payment flow  
**When Enabled:** Automatic payout routing to drivers

---

## 💰 Money Math

```
Example: $10 Ride

Customer Pays:    $10.00 (fare)
                + $ 1.50 (rider fee)
                = $11.50 TOTAL CHARGE

Driver Receives:  $10.00 (fare)
                - $ 1.50 (driver fee)  
                = $ 8.50 PAYOUT

Platform Keeps:   $ 1.50 (rider fee)
                + $ 1.50 (driver fee)
                = $ 3.00 PLATFORM FEE
```

---

## 🔧 Enable in 3 Steps

### 1. Turn ON Flag (Emulator)
```typescript
// Firebase Emulator UI: http://localhost:4000
// Navigate to: config/runtimeFlags
enableStripeConnect: true
```

### 2. Create Test Driver with Connect Account
```bash
# In Stripe TEST dashboard: dashboard.stripe.com/test/connect/accounts
# Click "Add Account" → Express → Complete onboarding
# Copy account ID: acct_...

# Add to driver document:
{
  stripeConnectAccountId: "acct_...",
  stripeConnectStatus: "active"
}
```

### 3. Test Ride End-to-End
```
1. Request ride → 2. Accept ride → 3. Complete trip
4. Authorize payment (4242 4242 4242 4242)
5. Check Stripe dashboard for:
   - PaymentIntent with $3.00 application fee
   - Transfer to driver Connect account
```

---

## ✅ Verification

### In Firebase Logs:
```
✓ [customerConfirmPayment] Using Stripe Connect for driver
✓ Connect enabled - fee structure: { platformFee: 300, driverPayout: 850 }
✓ Created PaymentIntent: { connect: true }
```

### In Stripe Dashboard:
```
✓ Payment: $11.50 charged
✓ Application Fee: $3.00
✓ Transfer Destination: acct_...
✓ Driver Balance: +$8.50
```

### In Ride Document:
```typescript
{
  totalChargeCents: 1150,
  platformFeeCents: 300,
  driverPayoutCents: 850,
  stripeConnectAccountId: "acct_..."
}
```

---

## 🔒 Safety

- ✅ **Flag OFF** → Current behavior, zero changes
- ✅ **Driver without Connect** → Falls back to normal flow
- ✅ **Driver with `status='pending'`** → Falls back to normal flow  
- ✅ **Only `status='active'`** → Connect routing enabled

---

## 📚 Full Docs

See: [STRIPE_CONNECT_IMPLEMENTATION.md](STRIPE_CONNECT_IMPLEMENTATION.md)

- Complete money flow diagrams
- Step-by-step testing guide
- Production readiness checklist
- All implementation files

---

**Ready when you are!** 🚀
