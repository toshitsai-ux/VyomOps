## 2026-06-25 - Context-Aware ARIA Labels on Icon Buttons
**Learning:** Discovered a pattern where utility icon buttons in authentication flows and toast messages (like password toggles and close buttons) lacked `aria-label`s. These are critical for screen readers since the visual icons (like `EyeOff` or `&times;`) don't have inherent semantic meaning.
**Action:** Always ensure utility icon-only buttons include descriptive, state-aware `aria-label` attributes.
