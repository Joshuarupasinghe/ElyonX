name: elyonx-frontend-developer
description: "Frontend development guidelines"

## Project: ML Powered Intelligent Mixing System UI

### Project Context
The goal is to develop a highly interactive and visually rich cross-platform user interface for an intelligent audio mixing system. The UI mimics professional audio workstation (DAW) plugins, featuring complex components like an interactive equalizer, rotary knobs, and vertical faders. The application needs to run natively on Windows, macOS, and iOS from a single React Native codebase.
ElyonX is a Machine Learning-powered Intelligent Mixing System (IMS) designed to act as an AI co-pilot for live Front-Of-House (FOH) sound engineering. Initially targeting the Rock music genre, it captures live room sound via a calibrated Behringer ECM8000 RTA microphone (routed through a Focusrite Scarlett 2i2) and uses closed-loop ML models to adjust mixing parameters dynamically. This skill provides the definitive blueprint for the system's 8-month research and development cycle, ensuring that all code generated adheres to strict latency, acoustic, and architectural requirements.


### Goals
*   **Cross-Platform Fidelity:** Replicate the provided UI design pixel-perfectly across Windows, macOS, and iOS.
*   **High Interactivity:** Implement smooth, responsive, and intuitive interactions for all UI elements, especially the EQ, knobs, and faders.
*   **Performance:** Ensure a fluid user experience suitable for real-time audio control applications.
*   **Scalability:** Design a component architecture that is maintainable and extensible.

### Target Platforms
*   **Desktop:** Windows (using `react-native-windows`), macOS (using `react-native-macos`)
*   **Mobile:** iOS (using standard React Native)

### Technologies & Libraries (Recommended for implementation)
*   **Core Framework:** React Native
*   **Styling:** Styled Components or a similar robust styling solution for theme management and component encapsulation.
*   **Graphics & Animation:**
    *   `react-native-svg` (for drawing the EQ curve, grid lines, and custom knob/fader graphics).
    *   `react-native-skia` (alternative/supplementary for advanced 2D graphics, if SVG performance becomes a concern for the EQ).
    *   `react-native-gesture-handler` (for advanced touch/mouse interactions like dragging EQ points, faders, rotating knobs).
    *   `react-native-reanimated` (for smooth animations and gesture-driven UI updates, crucial for interactive elements).
*   **State Management:** Redux Toolkit, Zustand, or a well-structured React Context API for managing application state (channel data, EQ parameters, fader values, UI settings).
*   **Navigation:** React Navigation (if multiple screens are introduced later, otherwise basic screen setup suffices).

### Required Skills (for Antigravity AI Recognition)

#### 1. Core React Native Setup & Cross-Platform Configuration
*   **Skill:** `react_native_multiplatform_project_setup`
*   **Description:** Initialize and configure a React Native project to support Windows, macOS, and iOS platforms using `react-native-windows` and `react-native-macos` alongside the default iOS target. Includes environment setup and platform-specific build adjustments.

#### 2. Theming and Global Layout
*   **Skill:** `react_native_dark_theme_implementation`
*   **Description:** Implement a comprehensive dark mode theme, defining color palettes, typography, and spacing variables consistent with the provided UI.
*   **Skill:** `react_native_flexbox_layout_system`
*   **Description:** Construct the main application layout using React Native's Flexbox, ensuring components are properly positioned and scale responsively across different screen sizes and orientations (desktop vs. mobile).

#### 3. Channel Selection Module
*   **Skill:** `react_native_interactive_list_view`
*   **Description:** Develop a scrollable list component displaying channels with names, input indicators, and an interactive mute/solo (speaker) icon. The selected channel should have distinct styling.
*   **Interactive Elements:** `react_native_touchable_components` for channel selection and icon interactions.
*   **Skill:** `react_native_add_channel_button`
*   **Description:** Implement a prominent button for "ADD A NEW CHANNEL" functionality.

#### 4. Advanced Interactive Equalizer (Pro Q-4 Like)
*   **Skill:** `react_native_eq_frequency_response_graph`
*   **Description:** Create a dynamic and interactive equalizer graph. This involves:
    *   **Curve Rendering:** Utilize `react-native-svg` (or `react-native-skia`) to draw complex Bézier curves representing the EQ's frequency response based on band parameters.
    *   **Grid and Labels:** Render a logarithmic frequency grid and linear gain grid with corresponding axis labels.
*   **Skill:** `react_native_draggable_eq_points`
*   **Description:** Implement draggable control points on the EQ curve. Each point corresponds to an EQ band, allowing users to intuitively adjust frequency and gain by dragging. This requires `react-native-gesture-handler` and `react-native-reanimated` for smooth interaction.
*   **Skill:** `react_native_rotary_knobs_for_audio_control`
*   **Description:** Develop custom, highly interactive rotary (circular) knobs for precise control of EQ band parameters (Frequency, Gain, Q). Knobs should respond to drag gestures, provide visual rotation feedback, and display current numerical values. Requires `react-native-svg` for custom drawing and `react-native-gesture-handler`/`reanimated` for interaction.
*   **Skill:** `react_native_numeric_input_fields_with_unit`
*   **Description:** Implement numeric input fields for displaying and manually setting exact values for Frequency (Hz), Gain (dB), and Q factor. Includes unit display.
*   **Skill:** `react_native_dropdown_menu_for_eq_band_type`
*   **Description:** Create a dropdown component to select the EQ band type (e.g., Bell, Shelf, High-pass, Low-pass), indicated by "Bnd" in the design.
*   **Skill:** `react_native_toggle_checkboxes`
*   **Description:** Implement checkboxes for display options like "Log-scale automated freq.", "Show grid", "Show phase", and "Compact mode".
*   **Skill:** `react_native_icon_buttons_for_eq_actions`
*   **Description:** Develop icon buttons for power toggle, adding a new EQ band (+), and removing an EQ band (X) within the band detail pop-up.
*   **Skill:** `react_native_vertical_gain_fader`
*   **Description:** Implement the overall gain fader on the right side of the EQ graph, allowing vertical dragging to adjust gain from -150dB to +30dB.

#### 5. Fader Bank Module
*   **Skill:** `react_native_interactive_vertical_faders`
*   **Description:** Create a bank of individual channel faders and a master fader. These faders should be vertically draggable, display current dB values, and provide visual feedback. Requires `react-native-gesture-handler`/`reanimated`.
*   **Skill:** `react_native_mute_solo_toggle_buttons`
*   **Description:** Implement interactive "M" (Mute) and "S" (Solo) buttons above each channel fader, toggling their respective states with visual indicators.

#### 6. Global Utility and Control Panel
*   **Skill:** `react_native_action_buttons`
*   **Description:** Implement distinct, styled action buttons: "ANALYZE SELECTED", "SNAPSHOT", and "FINALIZE MIX".
*   **Skill:** `react_native_toggle_switch_component`
*   **Description:** Develop a custom toggle switch component for the "AI ASSIST" feature.
*   **Skill:** `react_native_status_indicator_light`
*   **Description:** Implement a visual "MIXER CONNECTED" status indicator (green dot and text).
*   **Skill:** `react_native_settings_icon_button`
*   **Description:** Display an interactive gear icon for settings access.
*   **Skill:** `react_native_profile_avatar`
*   **Description:** Implement a placeholder for a user profile or active session indicator (purple circle).

#### 7. General Development Practices
*   **Skill:** `react_native_state_management_implementation`
*   **Description:** Apply a robust state management pattern (e.g., Redux Toolkit, Zustand) to handle the complex state of all interactive UI components, ensuring data consistency and reactivity.
*   **Skill:** `react_native_performance_optimization`
*   **Description:** Implement techniques to ensure smooth animations and interactions, especially for graphical components, preventing UI freezes or choppiness.

By breaking down the UI into these specific, detailed skills, Antigravity's AI should be able to accurately identify the complexity of the project and generate a React Native frontend solution tailored for Windows, macOS, and iOS, with a strong focus on the interactive audio control elements.