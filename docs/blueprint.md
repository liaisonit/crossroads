# **App Name**: Crossroads Timesheet

## Core Features:

- Foreman Login: Secure login with foreman selection, persisting user preference in local storage.
- Daily Work Log: Display a daily work log with job details (date, job name), dynamically populated from Firestore.
- Employee Entry: Add employee work entries with dropdowns for employee and pay rate.
- Remove Employee Entry: Enable removal of employee entries with a fade-out animation.
- Signature Capture: Signature capture via a glassmorphism modal and save the signature as a Base64 PNG string.
- Offline Mode: Implement offline persistence using Firestore's offline capabilities.
- Theme Toggle Persistence: Persist light/dark mode toggle in local storage.
- Submission Viewer: A basic, read-only web page where the Pune team can log in and see a list of all submitted daily reports.
- Manual Entry for Secondary Data Fields: Simple text boxes or checkboxes for foremen to manually enter Materials Used and select the Surface Preparation Performed.

## Style Guidelines:

- Light Mode: Background #F8F9FA (very light grey) with a light orange to transparent radial gradient. Glass Color: rgba(255, 255, 255, 0.6). Text Color: Dark grey (#212529). Accent Color: Vibrant orange gradient (#FF8C00 to #FFA500).
- Dark Mode: Background #121212 (very dark charcoal) with a dark orange to transparent radial gradient. Glass Color: rgba(30, 30, 30, 0.6). Text Color: Off-white (#E9ECEF). Accent Color: Same vibrant orange gradient as light mode (#FF8C00 to #FFA500).
- Primary font: 'Montserrat' (sans-serif) for all weights (400, 500, 600, 700).
- Implement glassmorphism design for all containers, cards, and modals using backdrop-filter: blur(12px). Subtle, semi-transparent white/light grey borders enhance the glass effect. Use Tailwind CSS for responsive layout.
- Design as a single-page application (SPA) with a two-column desktop layout and single-column mobile layout.
- Incorporate smooth transition effects for interactive elements. Buttons should have a subtle 'lift' effect on hover/press. Employ fade-in/out animations for adding/removing employee entry cards.
- Use a sleek sun/moon icon for the dark/light mode toggle.