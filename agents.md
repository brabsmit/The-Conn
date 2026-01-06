# Project Context: "The Conn"

## 1. Mission Overview
We are building a **High-Fidelity Submarine Command Simulator** called "The Conn."
The player acts as the Officer of the Deck (OOD), managing a submarine through a "Glass Cockpit" interface. The gameplay focuses on information management, mental modeling, and tension—not twitch reflexes.

* **Genre:** Simulation / Strategy
* **Visual Style:** "Industrial Low-Fi" / Diegetic Pixel Art (Reference: *Highfleet*, *Slots & Daggers*).
* **Core Loop:** Cross-referencing data from three distinct stations (Sonar, Helm, TMA) to build a firing solution.

## 2. Technical Architecture
We are using a **Web-Native Sim** approach. The simulation logic runs "headless" in the background, updating a global state store. The UI is a "dumb terminal" that renders this state 60 times a second.

* **Framework:** React + TypeScript (Vite)
* **Styling:** Tailwind CSS (v3 legacy mode for stability)
* **Simulation State:** Zustand (Global store for physics/contacts)
* **High-Perf Rendering:** PixiJS (For Sonar/Radar/TMA screens)
* **Effects:** `pixi-filters` (CRT scanlines, glow, noise)

## 3. Design Language & Constraints
* **The "Desk" Metaphor:** The screen is a physical metal bulkhead. UI elements are "Panels" bolted to the wall.
* **No 3D Models:** Depth is achieved via CSS shadows (`box-shadow`), borders, and lighting tricks.
* **Color Palette:**
    * Background: `#1a1b1e` (Bulkhead)
    * Phosphor: `#33ff33` (Active Data)
    * Alert: `#ff4444` (Danger)
    * Screen Off: `#021204` (The "black level" of a CRT)

## 4. Current Status
* [x] **Phase 1: Skeleton:** Project initialized. Grid layout established. `Panel` components created. Tailwind theme configured.
* [x] **Phase 2: The Brain:** Implementing the simulation loop and physics (Zustand).
* [x] **Phase 3: The Eyes:** Implementing the active PixiJS Sonar screen.
* [ ] **Phase 4: The UI:** Implementing Multi Function Displays (MFDs).
* [ ] **Phase 5: The Teeth:** Weapons Launch.

# 5. Weapon Control System (WCS)

## 1. Mission Overview
**Objective:** Implement a high-fidelity "Tube Board" simulation.
* **UI Pattern:** The Center Console becomes a Multi-Function Display (Swappable between TMA/WCS).
* **Core Mechanic:** The "Make Ready" procedure (Load -> Flood -> Equalize -> Open).

---