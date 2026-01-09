# Ticket Purchasing from Artist Gatefold

**Status:** Partially Complete (Core feature live, monetization pending)
**Target Version:** next
**Priority:** Low
**Estimated Complexity:** Low (affiliate setup + analytics only)
**Dependencies:** Ticketmaster Partner Program approval, Google Analytics setup
**Related Specs:** [google-analytics-tracking.md](./google-analytics-tracking.md) (comprehensive GA4 implementation for all scenes)

---

## Executive Summary

**Current State:** Users can already purchase concert tickets directly from the artist gatefold view. The Tour Dates Panel displays "Buy Tickets" buttons that link to Ticketmaster event pages. However, affiliate tracking parameters are not yet configured, so the app generates no revenue from these referrals.

**What's Left:** This spec focuses on the remaining monetization setup:

1. Establish Ticketmaster Partner Program account and obtain affiliate tracking ID
2. Add affiliate parameters to existing ticket URLs
3. Set up Google Analytics to track conversion funnel
4. Monitor revenue attribution through Ticketmaster's partner dashboard

**Why this matters:**

- **Monetization**: Generates passive revenue through affiliate commissions on existing traffic
- **User value**: Already delivered—one click from tour dates to ticket purchase
- **Natural fit**: Feature is live and working; we're just adding revenue tracking

**How it fits the product:**

- Tour Dates Panel (v1.6.0) already shows ticket links
- Ticketmaster API integration already fetches event URLs
- This work adds tracking without changing any user-facing behavior

---

## 🚀 Implementation Quick Start

**Copy/paste this prompt when starting a NEW Claude Code session (no prior context):**

```text
I need to add affiliate tracking and analytics to the existing Ticketmaster ticket links in Morperhaus Concerts.

**CURRENT STATE:**
- "Buy Tickets" buttons already exist in the Tour Dates Panel
- Links to Ticketmaster event pages are live and functional
- NO affiliate tracking parameters are configured yet
- NO analytics tracking is set up

**WHAT NEEDS TO BE DONE:**
1. Add affiliate UTM parameters to existing Ticketmaster URLs
2. Set up Google Analytics 4 for the web app
3. Add GA4 event tracking for ticket button clicks

**PREREQUISITES (must be completed first):**
- [ ] Ticketmaster Partner Program account approved (see "Affiliate Setup" section)
- [ ] Affiliate tracking ID obtained from Ticketmaster
- [ ] Google Analytics 4 property created for concerts.morperhaus.org

**Key References:**
- Full Spec: docs/specs/future/artists-ticket-purchasing.md
- Ticketmaster Service: src/services/ticketmaster.ts
- Tour Dates Panel: src/components/scenes/ArtistScene/TourDatesPanel.tsx
- API Integration Guide: .claude/skills/api-integration/SKILL.md

**Implementation Steps:**
1. Modify `buildTicketUrl()` in ticketmaster.ts to add affiliate parameters
2. Install and configure Google Analytics 4
3. Add GA4 event tracking to "Buy Tickets" button click handler
4. Test affiliate parameters in live URLs

**Files to Modify:**
- `src/services/ticketmaster.ts` (~15 LOC) — Add UTM params to URLs
- `src/components/scenes/ArtistScene/TourDatesPanel.tsx` (~10 LOC) — Add GA4 tracking
- `index.html` (~5 LOC) — Add GA4 script tag
- `.env.example` (~2 LOC) — Document affiliate ID variable

Should I start by reading the Ticketmaster service to understand how URLs are currently generated?
```

---

## Design Philosophy

**Current Implementation:** The ticket purchasing feature is live and functional. "Buy Tickets" buttons appear in the Tour Dates Panel for events with available Ticketmaster links. The UI seamlessly integrates into the existing tour dates experience—buttons feel like natural extensions of event cards rather than advertisements.

**What's Working:**

- Tour dates are eager-loaded and displayed in the gatefold (v1.6.0)
- Each event card shows: date, venue, location, and "Buy Tickets" button (when available)
- Clicking opens Ticketmaster in a new tab (doesn't navigate away from the app)
- Clean, non-commercial aesthetic is maintained

**What's Missing:**

- Affiliate tracking parameters (no revenue attribution)
- Analytics events (can't track conversion funnel)
- Monetization dashboard visibility (can't see ROI)

---

## Visual Design

### Current Tour Date Row Implementation

**Existing Specifications:**

- **Button style**: Solid indigo button matching Tour Badge active state
- **Button dimensions**:
  - Desktop: `h-8 px-4` (compact inline style)
  - Mobile: `h-10 w-full` (full-width for touch targets)
- **Typography**: Source Sans 3, `text-sm font-medium`, white text
- **Icon**: External link icon (Lucide `ExternalLink`, 16px) positioned right of text
- **Colors**:
  - Default: `bg-indigo-600`
  - Hover: `bg-indigo-700`
  - Focus: `ring-2 ring-indigo-500 ring-offset-2`
- **Spacing**:
  - Desktop: `ml-auto` (right-aligned)
  - Mobile: `mt-3` (below venue info)

**Layout (Desktop):**

```text
┌───────────────────────────────────────────────────────┐
│ FRI, MAY 15                                           │
│ Hollywood Bowl                    [ Buy Tickets ↗ ]  │
│ Los Angeles, CA                                       │
└───────────────────────────────────────────────────────┘
```

**Layout (Mobile):**

```text
┌──────────────────────────┐
│ FRI, MAY 15              │
│ Hollywood Bowl           │
│ Los Angeles, CA          │
│ ┌──────────────────────┐ │
│ │  Buy Tickets ↗       │ │
│ └──────────────────────┘ │
└──────────────────────────┘
```

**No visual changes needed** — this work only adds tracking parameters to URLs and analytics events.

---

## Interaction Design

### Current Button Behavior (Already Implemented)

**States:**

1. **Default**: Visible only if `event.ticketUrl` exists
2. **Hover**: Background darkens to `bg-indigo-700`, subtle scale `scale-[1.02]`
3. **Active**: Brief scale-down effect `scale-[0.98]`
4. **Focus**: Ring outline for keyboard navigation

**Click Action (needs GA4 tracking added):**

```typescript
onClick={(e) => {
  e.stopPropagation() // Prevent row collapse if expandable

  // TODO: Add GA4 event tracking here
  // gtag('event', 'purchase_intent', {
  //   artist: artistName,
  //   venue: event.venue,
  //   event_date: event.date,
  //   event_id: event.id
  // })

  window.open(event.ticketUrl, '_blank', 'noopener,noreferrer')
}}
```

### Accessibility (Already Implemented)

- **Label**: Visible text "Buy Tickets" + external link icon
- **ARIA**: `aria-label="Buy tickets for {artist} at {venue} on {date}"`
- **Keyboard**: Focusable button, activates on Enter/Space
- **Screen reader**: Announces as "link, opens in new window"
- **Color contrast**: White on indigo-600 = 4.8:1 (WCAG AA compliant)

---

## Affiliate Program Setup (Required First)

### Ticketmaster Partner Program

**Prerequisites:**

- Live website with concert/event content (✅ concerts.morperhaus.org)
- Legitimate use case for affiliate links (✅ personal concert archive with tour dates)
- Business entity or individual tax information for payments

**Application Process:**

1. **Apply at Ticketmaster Partner Hub**
   - URL: <https://partners.ticketmaster.com> (or <https://universe.ticketmaster.com/partners>)
   - Fill out application form with:
     - Website URL: `https://concerts.morperhaus.org`
     - Traffic volume: Estimate monthly visitors (check Google Analytics if available)
     - Content type: "Personal concert archive with artist tour dates"
     - Monetization intent: "Affiliate links on upcoming tour dates"
   - Approval can take 1-2 weeks

2. **Obtain Affiliate Tracking ID**
   - Once approved, log into partner dashboard
   - Navigate to "Tracking" or "Affiliate Links" section
   - Copy your unique affiliate ID (format varies: may be numeric like `12345` or alphanumeric like `morperhaus-01`)
   - Document the exact parameter name Ticketmaster expects (typically `aff` or `affiliate_id`)

3. **Understand Commission Structure**
   - Ticketmaster typically pays 3-5% commission on ticket sales
   - Payment threshold: Usually $50-100 minimum before payout
   - Payment frequency: Monthly or quarterly
   - Cookie duration: 30 days (user has 30 days to purchase after clicking)

4. **Set Up Payment Information**
   - Add bank account or PayPal for commission payouts
   - Provide W-9 (US) or W-8 (international) tax forms

### Alternative: If Ticketmaster Partner Program is unavailable

- Check if Ticketmaster has an affiliate network partnership (e.g., ShareASale, CJ Affiliate)
- Join the network and search for "Ticketmaster" offers
- Use the network's tracking links instead of direct Ticketmaster affiliate parameters

**What You'll Receive:**

- Affiliate ID: `YOUR_AFFILIATE_ID_HERE`
- Tracking parameter format: `?aff=YOUR_AFFILIATE_ID` or `?affiliate_id=YOUR_AFFILIATE_ID`
- Dashboard URL: For monitoring clicks, conversions, and revenue

---

## Google Analytics Setup (Required for Tracking)

> **Note**: This section provides minimal GA4 setup for tracking ticket purchase intent. For comprehensive analytics tracking across all scenes and interactions, see [google-analytics-tracking.md](./google-analytics-tracking.md). If you implement that spec first, you can skip this section and use the shared analytics service.

### Create GA4 Property

**Steps:**

1. **Sign up for Google Analytics 4**
   - Go to <https://analytics.google.com>
   - Create account (if new) or use existing Google account
   - Click "Admin" (gear icon) → "Create Property"
   - Property name: "Morperhaus Concerts"
   - Time zone: Your timezone
   - Currency: USD (or your local currency)

2. **Set Up Data Stream**
   - Platform: Web
   - Website URL: `https://concerts.morperhaus.org`
   - Stream name: "Concert Archives Web"
   - Copy the **Measurement ID** (format: `G-XXXXXXXXXX`)

3. **Install GA4 Tracking Code**
   - Add to `index.html` (see Technical Implementation below)
   - Use the Measurement ID from step 2

4. **Configure Events (Optional but Recommended)**
   - In GA4 dashboard, go to "Configure" → "Events"
   - Create custom event: `purchase_intent` (triggered when "Buy Tickets" clicked)
   - Parameters to track:
     - `artist`: Artist name
     - `venue`: Venue name
     - `event_date`: Concert date
     - `event_id`: Ticketmaster event ID

5. **Verify Installation**
   - Open your site in browser
   - Open GA4 Real-time reports
   - Verify you see your own visit
   - Click a "Buy Tickets" button
   - Verify the event appears in Real-time → Events

**What You'll Receive:**

- Measurement ID: `G-XXXXXXXXXX`
- Real-time dashboard for monitoring traffic and events
- Conversion funnel visibility (artist views → button clicks → purchases)

---

## Technical Implementation

### Component Architecture

**Files to modify:**

```text
src/
├── services/
│   └── ticketmaster.ts              # Add affiliate params to URLs
└── components/scenes/ArtistScene/
    └── TourDatesPanel.tsx           # Add GA4 event tracking
index.html                            # Add GA4 script tag
.env.example                          # Document affiliate ID variable
```

### Current Data Flow

```text
Ticketmaster API Response (event.url exists)
  ↓
fetchTourDates() returns events with URLs
  ↓
TourEvent[] with url field
  ↓
useTourDates() hook (cached)
  ↓
TourDatesPanel renders "Buy Tickets" buttons
  ↓
User clicks → Opens Ticketmaster (NO TRACKING YET)
```

### Updated Data Flow (After Implementation)

```text
Ticketmaster API Response (event.url exists)
  ↓
buildTicketUrl() adds affiliate params + UTM tags
  ↓
TourEvent[] with enhanced URL
  ↓
useTourDates() hook (cached)
  ↓
TourDatesPanel renders buttons
  ↓
User clicks → GA4 event fires → Opens Ticketmaster with tracking
  ↓
Ticketmaster tracks referral → Revenue attribution
```

### Affiliate Tracking Implementation

**Modify `src/services/ticketmaster.ts`:**

```typescript
// Add to top of file or .env
const AFFILIATE_ID = import.meta.env.VITE_TICKETMASTER_AFFILIATE_ID || 'YOUR_AFFILIATE_ID'

function buildTicketUrl(event: TicketmasterEvent): string | undefined {
  const baseUrl = event.url // Ticketmaster event URL from API
  if (!baseUrl) return undefined

  try {
    const url = new URL(baseUrl)

    // Add Ticketmaster affiliate tracking
    url.searchParams.set('aff', AFFILIATE_ID)

    // Add UTM parameters for analytics attribution
    url.searchParams.set('utm_source', 'morperhaus_concerts')
    url.searchParams.set('utm_medium', 'web')
    url.searchParams.set('utm_campaign', 'artist_gatefold')
    url.searchParams.set('utm_content', 'buy_tickets_button')

    return url.toString()
  } catch (error) {
    console.error('Error building ticket URL:', error)
    return baseUrl // Fallback to original URL
  }
}

// Call this function when processing Ticketmaster API responses
// Ensure each TourEvent's `url` field is passed through buildTicketUrl()
```

**Update `.env.example`:**

```bash
# Ticketmaster Affiliate ID (obtain from partners.ticketmaster.com)
VITE_TICKETMASTER_AFFILIATE_ID=your_affiliate_id_here
```

**Create `.env.local` (git-ignored):**

```bash
VITE_TICKETMASTER_AFFILIATE_ID=actual_affiliate_id_from_ticketmaster
```

### Google Analytics 4 Implementation

**Add to `index.html` (in `<head>` section):**

```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

**Modify `src/components/scenes/ArtistScene/TourDatesPanel.tsx`:**

```typescript
// Add type declaration at top of file
declare global {
  interface Window {
    gtag?: (command: string, ...args: any[]) => void
  }
}

// Update button onClick handler
onClick={(e) => {
  e.stopPropagation()

  // Track GA4 event
  if (window.gtag) {
    window.gtag('event', 'purchase_intent', {
      artist: artistName,
      venue: event.venue,
      event_date: event.date,
      event_id: event.id,
      ticket_url: event.ticketUrl
    })
  }

  window.open(event.ticketUrl, '_blank', 'noopener,noreferrer')
}}
```

### Revenue Tracking

**Ticketmaster Partner Dashboard:**

- Log in to Ticketmaster Partner Hub
- View clicks, conversions, and commission earnings
- Revenue typically updates 24-48 hours after purchase
- No additional code needed (server-side tracking)

**Google Analytics 4 Dashboard:**

- Go to Reports → Engagement → Events
- Find `purchase_intent` event
- Set up custom dashboard:
  - Total clicks by artist
  - Total clicks by venue
  - Conversion rate (if you have e-commerce tracking)

---

## Testing Strategy

### Manual Testing Checklist (Post-Implementation)

**Affiliate Tracking Verification:**

- [ ] Affiliate ID is correctly loaded from `.env.local`
- [ ] Clicking "Buy Tickets" opens URL with `?aff=YOUR_AFFILIATE_ID` parameter
- [ ] UTM parameters present: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`
- [ ] URL format is valid (no double `?` or broken parameters)
- [ ] Fallback works if `buildTicketUrl()` fails (opens original URL)

**Google Analytics Verification:**

- [ ] GA4 script loads in browser (check Network tab)
- [ ] Real-time dashboard shows active users
- [ ] Clicking "Buy Tickets" fires `purchase_intent` event
- [ ] Event parameters captured: `artist`, `venue`, `event_date`, `event_id`
- [ ] Events appear in GA4 Real-time → Events within 5 seconds
- [ ] No console errors related to gtag

**Cross-Browser Testing:**

- [ ] Chrome: Affiliate params + GA4 events work
- [ ] Safari: Affiliate params + GA4 events work
- [ ] Firefox: Affiliate params + GA4 events work
- [ ] Mobile Safari: Affiliate params + GA4 events work
- [ ] Mobile Chrome: Affiliate params + GA4 events work

**Edge Cases:**

- [ ] Artist with no tour dates → No buttons shown (no errors)
- [ ] Ticketmaster API down → No buttons shown (graceful failure)
- [ ] GA4 blocked by ad blocker → Button still works, no console errors
- [ ] Missing affiliate ID → Button works with UTM params only (no affiliate param)

### Test Artists

**Use these artists to verify implementation:**

- Depeche Mode (frequent touring, 10+ dates)
- The National (active tour schedule, 5-10 dates)
- Nine Inch Nails (sporadic shows, 1-3 dates)

### Revenue Verification (Post-Deployment)

**Week 1:**

1. Deploy changes to production
2. Click a "Buy Tickets" button yourself (test the flow)
3. Check Ticketmaster Partner Dashboard for recorded click
4. Check GA4 Events report for `purchase_intent` event

**Week 2-4:**

1. Monitor Ticketmaster dashboard for conversions (purchases)
2. Compare GA4 click counts to Ticketmaster referral counts (should match ±5%)
3. Calculate conversion rate: (purchases / clicks) × 100%

---

## Implementation Plan

### Prerequisites (Complete Before Coding)

#### Step 1: Apply to Ticketmaster Partner Program

- [ ] Submit application at <https://partners.ticketmaster.com>
- [ ] Wait for approval (1-2 weeks)
- [ ] Obtain affiliate tracking ID
- [ ] Document the parameter format (`aff` or `affiliate_id`)

#### Step 2: Set Up Google Analytics 4

- [ ] Create GA4 property at <https://analytics.google.com>
- [ ] Set up web data stream for concerts.morperhaus.org
- [ ] Copy Measurement ID (format: `G-XXXXXXXXXX`)
- [ ] Note: Do NOT install GA4 code until approved (wait for Phase 2)

### Phase 1: Add Affiliate Tracking (Estimated: 30 minutes)

**Prerequisites:** Ticketmaster affiliate ID obtained

**Files to Modify:**

- `src/services/ticketmaster.ts` (~20 LOC)
- `.env.example` (~2 LOC)
- `.env.local` (~1 LOC, git-ignored)

**Tasks:**

1. Read existing `ticketmaster.ts` to find where event URLs are processed
2. Create `buildTicketUrl()` helper function (see Technical Implementation section)
3. Add affiliate ID and UTM parameters to URLs
4. Update `.env.example` to document `VITE_TICKETMASTER_AFFILIATE_ID`
5. Create `.env.local` with actual affiliate ID
6. Test by inspecting URLs in browser (should see `?aff=...&utm_source=...`)

**Acceptance Criteria:**

- [ ] Event URLs include `?aff=YOUR_AFFILIATE_ID` parameter
- [ ] UTM parameters present: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`
- [ ] Existing "Buy Tickets" buttons still work (no regressions)
- [ ] TypeScript compiles without errors
- [ ] No console errors

**Commit message:** `feat: Add Ticketmaster affiliate tracking to tour date URLs`

### Phase 2: Add Google Analytics Tracking (Estimated: 45 minutes)

**Prerequisites:** GA4 Measurement ID obtained

**Files to Modify:**

- `index.html` (~10 LOC)
- `src/components/scenes/ArtistScene/TourDatesPanel.tsx` (~15 LOC)

**Tasks:**

1. Add GA4 script tag to `index.html` `<head>` section (see Technical Implementation)
2. Read existing `TourDatesPanel.tsx` to locate button click handler
3. Add `gtag` type declaration at top of file
4. Add GA4 event tracking to button `onClick` handler
5. Test in GA4 Real-time dashboard (should see `purchase_intent` events)
6. Test with ad blocker enabled (should fail gracefully, no errors)

**Acceptance Criteria:**

- [ ] GA4 script loads on page (check Network tab)
- [ ] Clicking "Buy Tickets" fires `purchase_intent` event
- [ ] Event parameters captured correctly (artist, venue, date, ID)
- [ ] Events appear in GA4 Real-time dashboard within 5 seconds
- [ ] Button still works if GA4 is blocked (graceful degradation)
- [ ] No console errors
- [ ] TypeScript compiles without errors

**Commit message:** `feat: Add GA4 event tracking for ticket purchase intent`

### Phase 3: Testing & Verification (Estimated: 30 minutes)

**Tasks:**

1. Cross-browser testing (Chrome, Safari, Firefox)
2. Mobile testing (iOS Safari, Android Chrome)
3. Verify affiliate parameters in all browsers
4. Verify GA4 events in all browsers
5. Test edge cases (no tour dates, API failure, ad blocker)
6. Document affiliate setup process (update this spec if needed)

**Acceptance Criteria:**

- [ ] All items in "Manual Testing Checklist" pass
- [ ] No console errors or warnings
- [ ] Code follows existing patterns (matches codebase style)

**Commit message:** `test: Verify affiliate tracking and GA4 across browsers`

### Phase 4: Deploy & Monitor (Ongoing)

**Tasks:**

1. Deploy to production
2. Test affiliate tracking on live site (inspect URLs)
3. Test GA4 events on live site (check Real-time dashboard)
4. Wait 24-48 hours for first Ticketmaster dashboard data
5. Monitor for 2-4 weeks to establish baseline metrics

**Monitoring Checklist:**

- [ ] Ticketmaster dashboard shows clicks (within 24 hours)
- [ ] GA4 dashboard shows `purchase_intent` events
- [ ] Click counts match between Ticketmaster and GA4 (±5%)
- [ ] First conversion appears in Ticketmaster dashboard (may take weeks)
- [ ] No errors in production logs

**Deliverables:**

- Working affiliate tracking on all tour date links
- GA4 event tracking for conversion funnel analysis
- Baseline metrics documented (clicks/week, conversion rate)

---

## Future Enhancements

### Post-MVP Improvements

1. **Price display**: Show ticket price range from Ticketmaster API (requires parsing `priceRanges` field)
2. **Availability badge**: "Low availability" or "Selling fast" indicators
3. **Multi-platform**: Add links to other ticket sellers (AXS, StubHub) if available
4. **Conversion tracking**: Send GA4 event when button clicked (for funnel analysis)
5. **Notification opt-in**: "Notify me when tickets go on sale" for announced-but-not-yet-available shows
6. **Seat selection**: Deep link directly to seat map (requires Ticketmaster partner tier upgrade)

### Revenue Optimization

1. **A/B test button copy**: "Buy Tickets" vs "Get Tickets" vs "See Tickets"
2. **A/B test button placement**: Inline vs full-width on desktop
3. **Dynamic CTA**: Change button text based on event proximity ("Buy Now" for soon, "Get Tickets" for far future)
4. **Tour package upsell**: Link to VIP packages if available

---

## Questions for Review

### Before Implementation

- **Ticketmaster Partner Account**: Do you already have an approved Ticketmaster Partner account? If not, should we apply first or implement with a placeholder affiliate ID?
- **Google Analytics**: Do you have a GA4 property set up? If not, should we create one together or should I document the setup steps?
- **Legal Disclosure**: Should we add a revenue disclosure statement ("We may earn a commission from ticket sales")? If so, where should it appear?
  - Option A: Footer of the site (subtle, one-time addition)
  - Option B: Tooltip on "Buy Tickets" button hover (more visible, may clutter UI)
  - Option C: Separate "About" or "Legal" page (least visible, most comprehensive)
  - Option D: No disclosure (affiliate tracking is transparent to users, doesn't affect price)

### Implementation Decisions

- **Environment Variables**: Should affiliate ID be in `.env.local` (git-ignored, manual setup) or hardcoded in `ticketmaster.ts` (simpler, but less flexible)?
- **Analytics Platform**: This spec assumes Google Analytics 4. If you prefer another platform (Plausible, Fathom, Mixpanel), let me know.
- **Error Handling**: If `buildTicketUrl()` fails, should we:
  - Option A: Fall back to original URL (graceful degradation, no tracking)
  - Option B: Log error and hide button (safer, but reduces conversion)
- **Button Text**: Current implementation uses "Buy Tickets". Is this still the preferred copy, or would you like to test alternatives ("Get Tickets", "View Tickets")?

---

## Revision History

- **2026-01-08 (v2.0.0):** Major revision reflecting current state
  - Updated to reflect that "Buy Tickets" UI is already implemented and live
  - Narrowed scope to affiliate tracking and analytics setup only
  - Added comprehensive Ticketmaster Partner Program application guide
  - Added Google Analytics 4 setup documentation
  - Removed UI implementation sections (already complete)
  - Updated implementation plan to focus on tracking setup
  - Status changed from "Planned" to "Partially Complete"
- **2026-01-08 (v1.0.0):** Initial specification created
- **Author:** Claude Code + User
- **Status:** Partially Complete (UI live, monetization pending)
