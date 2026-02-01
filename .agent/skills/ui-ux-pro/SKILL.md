---
name: UI/UX Pro
description: Expert guidelines for creating modern, accessible, and visually stunning user interfaces.
---

# UI/UX Pro Skill

## Core Design Philosophy
- **User-Centric**: Every decision should prioritize the user's needs, comfort, and efficiency.
- **Simplicity**: Avoid clutter. Use whitespace effectively to guide the user's focus.
- **Consistency**: Maintain uniform styles, behaviors, and terminology across the application.
- **Feedback**: Provide immediate and clear feedback for all user interactions (hover, click, loading, success, error).

## Visual Aesthetics

### 1. Color Palette
- **Primary**: Define a strong primary color for main actions (e.g., specific branding blue or purple).
- **Secondary**: Use complementary colors for accents and secondary actions.
- **Neutral**: Use a range of greys for text, borders, and backgrounds.
- **Semantic**:
  - Success: Green (e.g., #10B981)
  - Error: Red (e.g., #EF4444)
  - Warning: Yellow/Orange (e.g., #F59E0B)
  - Info: Blue (e.g., #3B82F6)
- **Dark Mode**: Always design with high-quality dark mode support in mind. Use off-black (e.g., #121212) rather than pure black to reduce eye strain.

### 2. Typography
- **Font Family**: Use modern sans-serif fonts (e.g., Inter, Roboto, Helvetica Neue) for readability.
- **Hierarchy**: distinct font sizes and weights to establish hierarchy.
  - H1: 2rem+ (Bold)
  - H2: 1.5rem (SemiBold)
  - Body: 1rem (Regular)
  - Small: 0.875rem (Regular/Medium)
- **Line Height**: Use relaxed line heights (1.5 for body text) to improve readability.

### 3. Spacing & Layout
- **Grid System**: Use a flexible grid (e.g., 8-point grid system).
- **Whitespace**: Be generous with padding and margins. Do not crowd elements.
- **Responsive**: Mobile-first approach. Ensure layouts adapt fluidly to tablet and desktop breakpoints.

## Component Standards

### Buttons
- **Primary**: Solid background, high contrast text.
- **Secondary**: Outline or ghost style.
- **States**: Define clear styles for Default, Hover, Active, Disabled, and Loading states.
- **Touch Target**: Minimum 44x44px for touch devices.

### Inputs & Forms
- **Labels**: Always visible or clear placeholders (floating labels preferred).
- **Validation**: Real-time validation with clear error messages below the field.
- **Focus**: Distinct focus rings for accessibility.

### Cards & Surfaces
- **Shadows**: Use soft, diffused shadows to create depth (elevation).
- **Borders**: Subtle borders (e.g., 1px solid #E5E7EB) for definition.
- **Radius**: Consistent border-radius (e.g., 0.5rem or 8px) for a polished look.

## Interaction Design
- **Micro-interactions**: Use subtle animations (transition: all 0.2s ease) for hover effects and state changes.
- **Transitions**: Smooth transitions between pages and modals.
- **Loading States**: Use skeletons or spinners instead of blank screens.

## Accessibility (A11y)
- **Contrast**: Ensure WCAG AA compliance (4.5:1 ratio) for text.
- **Keyboard Navigation**: All interactive elements must be focusable and usable via keyboard.
- **ARIA**: Use proper ARIA labels and roles where semantic HTML is insufficient.
- **Alt Text**: Descriptive alt text for all images.

## Technology Stack Recommendations
- **CSS**: Tailwind CSS is highly recommended for rapid, consistent styling.
- **Icons**: Lucide React, Heroicons, or FontAwesome.
- **Animation**: Framer Motion for React applications.
