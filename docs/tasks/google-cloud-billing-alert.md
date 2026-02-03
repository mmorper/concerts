# Task: Set Up Google Cloud Billing Alert

**Priority:** Medium
**Estimated Time:** 5 minutes
**Status:** To Do

---

## Context

Google Places API costs money after exceeding the free tier ($200/month credit). Setting up a billing alert prevents surprise charges if API usage spikes unexpectedly (e.g., runaway script, API abuse, misconfiguration).

**Current Usage:**
- Monthly estimate: ~$6.50 (well within free tier)
- Annual estimate: ~$78
- Free tier: $200/month credit

**Why This Matters:**
- Early warning if automated refresh workflow has issues
- Catch API key abuse if someone extracts and misuses it
- Peace of mind with proactive monitoring

---

## Step-by-Step Instructions

### 1. Navigate to Billing

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the hamburger menu (☰) in top-left
3. Select **"Billing"** from the menu
4. If you have multiple billing accounts, select the one linked to your Concert Archives project

### 2. Create Budget Alert

1. In the left sidebar, click **"Budgets & alerts"**
2. Click **"+ CREATE BUDGET"** button at the top

### 3. Configure Budget - Step 1: Scope

**Budget name:**
```
Concert Archives - Places API Alert
```

**Projects:**
- Select your Concert Archives project (or leave as "All projects" if you only have one)

**Services:**
- Option A (Recommended): Select **"Places API (new)"** only
- Option B: Leave as "All services" to monitor total spend

**Click "NEXT"** to continue.

### 4. Configure Budget - Step 2: Amount

**Budget type:**
- Select **"Specified amount"**

**Target amount:**
- Enter: `$10` USD

**Why $10?**
- Normal usage: $6.50/month
- $10 threshold = 50% buffer for normal variation
- Well below free tier ($200) so you have time to respond
- High enough to avoid false alarms

**Include credits:**
- ✅ Check "Include credits in cost" (so alert fires based on actual charges, not just pre-credit costs)

**Click "NEXT"** to continue.

### 5. Configure Budget - Step 3: Actions

Set up multiple alert thresholds:

**Alert threshold rules:**

Add the following thresholds (click "+ ADD THRESHOLD" for each):

| Threshold | Trigger | Purpose |
|-----------|---------|---------|
| 50% ($5) | Actual spend | Early warning |
| 80% ($8) | Actual spend | Getting close to budget |
| 100% ($10) | Actual spend | Budget exceeded |
| 120% ($12) | Forecasted | Projected to exceed |

**How to add each threshold:**
1. Click "+ ADD THRESHOLD"
2. Enter percentage (e.g., `50`)
3. Select "Actual" or "Forecasted"
4. Repeat for each threshold above

### 6. Configure Notifications

**Email alerts:**
- ✅ Check "Email alerts to billing admins and users"
- This sends emails to the billing account owner automatically

**Additional recipients (optional):**
- Click "MANAGE EMAIL NOTIFICATION CHANNELS"
- Add additional email addresses if you want notifications sent to multiple people

**Pub/Sub notifications (optional - skip for now):**
- Leave unchecked unless you want to integrate with Slack/Discord/etc.

**Click "FINISH"** to create the budget.

---

## Verification

After creating the budget:

1. You should see it listed under **Budgets & alerts**
2. Status should show as "Active"
3. Current spend should be visible ($0-7 depending on recent activity)
4. You can click into it to see details and forecast

**Test (Optional):**
- Google doesn't provide a way to test alerts
- You'll receive an email when a threshold is first crossed
- Check spam folder if you don't see it

---

## What Happens When Alert Triggers

You'll receive an email like:

```
Subject: [Google Cloud] Budget alert: "Concert Archives - Places API Alert"
         has exceeded 50% of $10.00 USD

Your Google Cloud budget "Concert Archives - Places API Alert" has exceeded
50% of the target amount ($10.00 USD).

Current spend: $5.23 USD
Budget period: Monthly (Jan 1 - Jan 31)

View details: [Link to budget]
```

### Response Actions

**If alert triggers unexpectedly:**

1. **Check usage in Cloud Console:**
   - Billing → Reports
   - Filter by "Places API (new)"
   - Look for unusual spikes in requests

2. **Review recent changes:**
   - Did automated refresh workflow run?
   - Any recent deployments or data pipeline changes?
   - Check GitHub Actions workflow logs

3. **Investigate API calls:**
   - Go to APIs & Services → Places API (new) → Metrics
   - Look at request count timeline
   - Identify source of unexpected calls

4. **Take action if needed:**
   - Pause GitHub Actions workflow temporarily
   - Rotate API key if abuse suspected
   - Adjust cache TTL to reduce refresh frequency
   - Contact support if unexplained charges

**Normal alert (expected):**
- If you're running enrichment frequently during development
- After adding many new venues
- This is fine - just awareness

---

## Related Documentation

- [API Setup Guide](../api-setup.md) - Places API configuration
- [Data Pipeline](../DATA_PIPELINE.md) - Venue enrichment process
- [GitHub Actions Spec](../specs/future/global-venue-photo-refresh.md) - Automated refresh workflow
- [Google Cloud Billing Docs](https://cloud.google.com/billing/docs/how-to/budgets)

---

## Completion Checklist

- [ ] Created budget named "Concert Archives - Places API Alert"
- [ ] Set target amount to $10 USD
- [ ] Added all 4 threshold rules (50%, 80%, 100%, 120%)
- [ ] Enabled email alerts to billing admin
- [ ] Verified budget shows as "Active" in console
- [ ] (Optional) Added additional email recipients
- [ ] Marked this task as complete

---

## Notes

- Budget alerts are **informational only** - they don't stop billing or API access
- To hard-cap spending, you'd need to set up API quotas (more complex, not recommended)
- Review billing quarterly to ensure estimates are accurate
- Update budget amount if usage patterns change significantly

---

**Created:** 2026-02-02
**Last Updated:** 2026-02-02
