## 2024-05-18 - Added `aria-label` to icon-only buttons
**Learning:** Icon-only buttons for toggling password visibility and dismissing toast notifications in authentication forms (`Login.tsx`, `Register.tsx`) lacked `aria-label`s, rendering them inaccessible to screen readers. They also lacked `focus-visible` styling for keyboard users.
**Action:** Always verify icon-only buttons have descriptive `aria-label` attributes and explicit `focus-visible` ring styles (e.g. `focus-visible:ring-2`) to ensure both screen reader compatibility and keyboard navigation clarity.
