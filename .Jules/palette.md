## 2024-06-27 - Missing ARIA Labels on Icon-Only Buttons
**Learning:** Found a recurring pattern in the app's components (Login, Register, Monitor) where icon-only buttons (like password visibility toggles, toast notifications close buttons, and refresh actions) lacked `aria-label`s. This makes them completely opaque to screen readers.
**Action:** Always verify that buttons containing only an icon (e.g., `<Eye />`, `&times;`, `<RefreshCw />`) have an appropriate and descriptive `aria-label` to ensure accessibility for assistive technologies.
