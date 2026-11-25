/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#f7f8f9',
    tint: '#3CB4E5',

    // Core surfaces
    background: '#00416B',
    foreground: '#f7f8f9',

    // Cards / elevated surfaces
    card: '#4D4D4F',
    cardForeground: '#f7f8f9',

    // Primary action color (buttons, links, active states)
    primary: '#3CB4E5',
    primaryForeground: '#00416B',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#4D4D4F',
    secondaryForeground: '#f7f8f9',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#4D4D4F',
    mutedForeground: '#d2d4d6',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#FED925',
    accentForeground: '#00416B',

    // Destructive actions (delete, error states)
    destructive: '#FF6B6B',
    destructiveForeground: '#ffffff',

    // Borders and input outlines
    border: '#536978',
    input: '#536978',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 8,
};

export default colors;
