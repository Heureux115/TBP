---
name: TutorConnect
description: A trustworthy, local, product-first tutor booking marketplace for Vietnam.
colors:
  surface: "#f9f9ff"
  surface-container-lowest: "#ffffff"
  surface-container-low: "#f0f3ff"
  surface-container: "#e7eeff"
  surface-container-high: "#dee8ff"
  surface-container-highest: "#d8e3fb"
  foreground: "#111c2d"
  on-surface: "#111c2d"
  on-surface-variant: "#414750"
  outline: "#717781"
  outline-variant: "#c1c7d1"
  primary: "#004271"
  primary-container: "#0d5a94"
  primary-fixed: "#d1e4ff"
  secondary: "#855300"
  secondary-container: "#fea619"
  tertiary: "#004a31"
  tertiary-container: "#006444"
  tertiary-fixed: "#6ffbbe"
  error: "#ba1a1a"
  error-container: "#ffdad6"
typography:
  display:
    fontFamily: "Be Vietnam Pro, Arial, Helvetica, sans-serif"
    fontSize: "48px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "normal"
  headline:
    fontFamily: "Be Vietnam Pro, Arial, Helvetica, sans-serif"
    fontSize: "36px"
    fontWeight: 900
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Be Vietnam Pro, Arial, Helvetica, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "normal"
  body:
    fontFamily: "Be Vietnam Pro, Arial, Helvetica, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Be Vietnam Pro, Arial, Helvetica, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "0.025em"
rounded:
  md: "6px"
  lg: "8px"
  xl: "12px"
  2xl: "32px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  3xl: "32px"
  4xl: "40px"
  5xl: "48px"
  6xl: "64px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface-container-lowest}"
    rounded: "{rounded.lg}"
    padding: "12px 20px"
  button-primary-hover:
    backgroundColor: "{colors.primary-container}"
    textColor: "{colors.surface-container-lowest}"
    rounded: "{rounded.lg}"
    padding: "12px 20px"
  button-outline:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.primary}"
    rounded: "{rounded.lg}"
    padding: "12px 20px"
  input-default:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.lg}"
    padding: "12px 16px"
  card-default:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.xl}"
    padding: "24px"
  chip-status:
    backgroundColor: "{colors.surface-container-high}"
    textColor: "{colors.on-surface-variant}"
    rounded: "{rounded.full}"
    padding: "4px 12px"
---

# Design System: TutorConnect

## 1. Overview

**Creative North Star: "The Trusted Booking Desk"**

TutorConnect currently uses a restrained product system: cool near-white surfaces, deep blue primary actions, amber payment emphasis, green verification success, and red error states. The system is built for task flow clarity across public discovery, student dashboards, tutor onboarding, wallet actions, payment receipts, and admin review queues.

The visual language is familiar and operational. Rounded white panels, thin blue-gray borders, compact labels, Material Symbols icons, and light shadows make the app feel calm and practical. The current system is not a redesign target yet; document it as a reliable baseline, then standardize the gaps before adding more expression.

The system explicitly rejects gimmicky edtech visuals, childish illustrations, generic SaaS gradients, vague marketing language, decorative dashboards, excessive animation, and hidden booking or payment states.

**Key Characteristics:**
- Cool blue-tinted product surfaces (`#f9f9ff`, `#f0f3ff`, `#e7eeff`) with white cards.
- Deep primary blue (`#004271`) for navigation, current state, primary actions, and key headings.
- Amber (`#fea619`, `#855300`) for payments, warnings, and commercial emphasis.
- Green (`#004a31`, `#006444`, `#6ffbbe`) for verified, approved, completed, and successful states.
- Dense but readable product layouts: side navigation, sticky headers, card grids, filters, tables, and status panels.

## 2. Colors

The palette is a Material-like cool surface system with one dominant trust color, one payment/warning accent, one verification/success accent, and explicit error colors.

### Primary
- **Trust Blue**: The primary action and navigation color. Use for main CTAs, selected nav items, key dashboard headings, links, progress bars, icon accents, and active states.
- **Action Blue**: The primary hover and stronger action container color. Use where the interface needs a deeper blue fill without changing semantic meaning.
- **Pale Verification Blue**: The light blue support surface for avatars, icon circles, subtle primary backgrounds, and low-emphasis blue fills.

### Secondary
- **Escrow Amber**: The payment, price, and warning accent. Use it for commercial emphasis, payment prompts, star ratings, and pending review states.
- **Payment Gold**: The brighter amber fill used for high-attention payment CTAs and warning chips. It should remain sparse because it competes with primary actions.

### Tertiary
- **Verified Green**: The success and approval text color. Use for verified tutors, completed payment/session states, and approved documents.
- **Approval Green**: The filled success action color. Use when a user or admin confirms completion or approval.
- **Mint Success Surface**: The light success surface. Use for approved or completed badges and success feedback panels.

### Neutral
- **App Surface**: The default page background. It is a cool near-white, not a warm paper tone.
- **White Panel**: The default card and form panel surface.
- **Blue-Tinted Containers**: Low to high blue-gray fills for sidebars, filter panels, table headers, skeletons, and inactive controls.
- **Ink**: The primary text color for body copy, headings, data, and labels.
- **Muted Ink**: The secondary text color for helper copy, captions, descriptions, and metadata.
- **Outline Gray** and **Soft Outline**: Borders, dividers, and inactive icon color.

### Named Rules
**The Trust Blue Rule.** Primary blue is the action and orientation color. Do not use it as free decoration.

**The Status Color Rule.** Amber means payment, warning, pending, or commercial emphasis; green means verified, approved, completed, or successful; red means error, rejection, cancellation, or destructive action.

**The Token Gap Rule.** Several screens reference colors that are not defined in `globals.css` (`--surface-bright`, `--surface-variant`, `--secondary-fixed`, `--secondary-fixed-dim`, `--tertiary-fixed-dim`, `--on-primary-container`, `--on-secondary-container`). Standardize these before expanding the system.

## 3. Typography

**Display Font:** Be Vietnam Pro with Arial, Helvetica, and sans-serif fallback.
**Body Font:** Be Vietnam Pro with Arial, Helvetica, and sans-serif fallback.
**Label/Mono Font:** Courier New is declared for mono, but the product UI is overwhelmingly sans-serif.

**Character:** The current type system is a single-family Vietnamese product stack. It is direct, practical, and dense enough for dashboards while still readable on public discovery and auth pages.

### Hierarchy
- **Display** (700, 48-60px, 1.15): Used mostly on the landing hero and major public-page headings.
- **Headline** (900 or 700, 30-40px, 1.2): Used for dashboard page titles, payment success titles, tutor discovery titles, and key operational pages.
- **Title** (700, 20-24px, 1.35): Used for card titles, panel headers, empty states, and section headings.
- **Body** (400-600, 14-16px, 1.5-1.75): Used for descriptions, form helper text, table content, dashboard cards, and product copy. Long prose should stay under 75ch when possible.
- **Label** (700, 12px, normal to uppercase): Used for form labels, metadata, KPI labels, table headers, status captions, and compact operational labels.

### Named Rules
**The One Family Rule.** Keep Be Vietnam Pro as the only UI family unless a future brand refresh deliberately introduces a second display family.

**The Density Rule.** Product pages use compact 14px labels and body text; public hero pages may use larger headings, but authenticated surfaces should stay fixed-scale and task-first.

## 4. Elevation

The system uses a hybrid of tonal layering, borders, and light shadows. Most depth comes from white panels on cool blue surfaces with `1px` blue-gray borders. Shadows are restrained (`shadow-sm`, occasional `shadow-lg` or custom soft shadows) and should support state or hierarchy, not decoration.

### Shadow Vocabulary
- **Panel Shadow** (`box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)`): Default for cards, forms, tables, headers, and dashboard panels.
- **Floating Search Shadow** (`box-shadow: 0 10px 25px rgba(30,41,59,0.1)`): Used on the landing search form and small floating trust panels.
- **Modal/Receipt Shadow** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`): Used on the payment success receipt panel.
- **Mobile Nav Shadow** (`box-shadow: 0 -8px 24px rgba(0,0,0,0.08)`): Used for bottom mobile navigation.

### Named Rules
**The Border-First Rule.** Use tonal background and `1px` borders before adding stronger shadows.

**The Shadow Restraint Rule.** Shadows should mark hierarchy, hover, or floating controls. Avoid decorative glass panels except where they already exist and are intentionally being preserved.

## 5. Components

### Buttons
- **Shape:** Gently rounded controls (`8px` radius) are the default. Some larger CTA/sidebar buttons use `12px`.
- **Primary:** Deep blue fill with white text, usually `12px 20px`, `12px 24px`, or `16px 24px` padding. Used for search, booking, profile completion, approval, payment, and dashboard actions.
- **Hover / Focus:** Hover usually deepens to `#0d5a94` or adds a subtle background fill. Form fields often use a blue border and a soft blue focus ring.
- **Secondary / Outline:** White or transparent background with blue border and blue text. Used for back links, details, messages, and secondary navigation.
- **Commercial CTA:** Bright amber fill is used for payment prompts and "book lesson" moments; it should be standardized separately from warning states.
- **Destructive:** Red text or red border; full red fill appears for explicit rejected/document-upload actions.

### Chips
- **Style:** Rounded-full status pills use compact horizontal padding (`4px 12px` or `8px 16px`) and strong `12px` or `14px` bold labels.
- **State:** Verification and payment chips use semantic colors: green success, amber pending/payment, red rejected/error, blue active/default, and blue-gray neutral.
- **Filter Tags:** Tutor discovery filters use filled primary-blue chips with white text for active filters and blue-gray fills for subject/level tags.

### Cards / Containers
- **Corner Style:** Most product containers use `12px` radius. Landing image cards sometimes use `32px` radius.
- **Background:** White is the default card surface; low-emphasis cards use `#f0f3ff` or `#e7eeff`.
- **Shadow Strategy:** Most cards use `shadow-sm`; hover cards may translate up by `4px` and increase shadow.
- **Border:** Default border is `1px solid #c1c7d1`.
- **Internal Padding:** Cards commonly use `20px`, `24px`, or `32px`, depending on density and importance.

### Inputs / Fields
- **Style:** Rounded `8px` fields with soft outline borders, white or blue-tinted background, and `12px 16px` padding.
- **Focus:** Blue border, sometimes with a pale blue focus ring (`#d1e4ff` or `var(--primary) / 20%`).
- **Error / Disabled:** Errors use red text or red container fills. Disabled buttons rely mostly on opacity and should be standardized with cursor and contrast rules later.
- **Search Fields:** Discovery and dashboard search fields combine icons, labels, and compact controls inside rounded panels.

### Navigation
- **Public Header:** Fixed top bar, white/95 background, subtle border, shadow, and optional backdrop blur. Links are compact rounded text buttons.
- **Dashboard Shell:** Product app shell uses a sticky left sidebar on desktop (`280px`) and bottom tab navigation on mobile. Active items use primary blue fill with white text; inactive items use muted ink and hover blue-gray fills.
- **Brand Mark:** TutorConnect logo uses the primary blue and a compact graduation-cap mark inside a narrow bordered square.
- **Notification Panel:** Right-aligned dropdown with white surface, `12px` radius, border, shadow-xl, and unread state highlighted by a pale primary tint.

### Status, Empty, and Error States
- **Status Banners:** Tutor profile and booking detail screens use bordered panels with icon circles and plain explanatory copy.
- **Empty States:** Existing empty states are mostly functional: dashed border panels or centered white cards with a large Material icon, short explanation, and direct CTA.
- **Error States:** Error panels use `#ffdad6` backgrounds or red text and include retry/back actions. Keep errors explicit and actionable.
- **Skeletons:** Loading uses a blue-gray shimmer ramp (`#f0f3ff` to `#dee8ff`) rather than central spinners.

### Tables and Operational Lists
- **Tables:** Admin and dashboard tables use white containers, blue-gray header rows, uppercase 12px labels, row dividers, and subtle hover fills.
- **Operational Cards:** Admin stat cards and tutor metrics use icon accents, compact labels, bold numbers, and restrained shadows.
- **Progress:** Progress bars use rounded tracks in `surface-container-high` with primary, tertiary, or secondary fills based on semantic meaning.

## 6. Do's and Don'ts

### Do:
- **Do** keep the existing cool surface ramp as the default product atmosphere: `#f9f9ff`, `#f0f3ff`, `#e7eeff`, `#dee8ff`, and white panels.
- **Do** use `#004271` for primary actions, selected navigation, progress, and orientation.
- **Do** use status color semantically: amber for payment/pending, green for verified/success, red for rejected/error.
- **Do** preserve the single-family Be Vietnam Pro typography system for Vietnamese readability.
- **Do** document booking, payment, verification, cancellation, withdrawal, and admin decision states explicitly in UI copy.
- **Do** standardize undefined CSS variables before creating new screens.
- **Do** keep cards, forms, and tables product-dense, with visible labels and direct next actions.

### Don't:
- **Don't** redesign the app from this file. This document captures the current system and names what should be standardized later.
- **Don't** use gimmicky edtech visuals, childish illustrations, generic SaaS gradients, vague marketing language, decorative dashboards, excessive animation, or overly playful interaction patterns.
- **Don't** hide booking terms, pricing, tutor verification, cancellation policy, payment status, or admin decision history behind vague labels.
- **Don't** introduce LMS, video-platform, or AI-first visual patterns into the MVP marketplace loop.
- **Don't** add gradient text, decorative glassmorphism, side-stripe card accents, or repeated hero-metric templates.
- **Don't** create new button, input, badge, or card vocabularies without first standardizing the existing rounded-lg/rounded-xl product primitives.
