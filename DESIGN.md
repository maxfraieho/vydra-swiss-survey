# DESIGN.md — Impeccable Design System & Visual Guidelines for Astryx UI

> **Framework:** Impeccable Design System (pbakaus/impeccable)  
> **Schema Version:** Impeccable 3.5.0  
> **Target:** Astryx React Console (`web/src/`)  

---

## 🎨 Colors & Token Palette

### Primary Surface Tokens (Dark Mode Glassmorphism)
- **Background Base:** `hsl(222, 24%, 9%)` (`#0f131a`)
- **Card Surface:** `rgba(22, 29, 41, 0.75)` with `backdrop-filter: blur(12px)`
- **Border Subtlety:** `rgba(255, 255, 255, 0.08)`
- **Primary Accent:** `hsl(217, 91%, 60%)` (`#3b82f6` - Electric Blue)
- **Success Accent:** `hsl(142, 71%, 45%)` (`#22c55e` - Emerald Green)
- **Warning Accent:** `hsl(38, 92%, 50%)` (`#f59e0b` - Amber)
- **Danger Accent:** `hsl(0, 84%, 60%)` (`#ef4444` - Crimson)

---

## ✒️ Typography & Layout System

- **Font Family:** Modern Sans (`Inter`, `system-ui`, `-apple-system`, `sans-serif`)
- **Code & Logs:** `JetBrains Mono`, `Fira Code`, `monospace`
- **Border Radius:** `8px` (Cards), `6px` (Buttons), `20px` (Pills/Badges)
- **Transitions:** `all 0.2s cubic-bezier(0.4, 0, 0.2, 1)`

---

## 🧩 Components Section & System Norms

1. **Card & Container Surfacing:**
   - Standardized via `@astryxdesign/core/Card` with `.impeccable-glass` utility class.
2. **Interactive Controls & Touch Area:**
   - All `Button`, `IconButton`, `Switch`, `TextInput` controls MUST maintain $\ge 44\text{px}$ touch target height.
3. **Status Indicators:**
   - State indicators MUST use `@astryxdesign/core/StatusDot` combined with `@astryxdesign/core/Badge`.
4. **Code & Pattern Selectors:**
   - Code snippets and selectors MUST render inside `@astryxdesign/core/CodeBlock`.
