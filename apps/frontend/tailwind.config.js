/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      "colors": {
        "tertiary-fixed-dim": "#ffb786",
        "on-primary": "#002e6a",
        "inverse-primary": "#005ac2",
        "on-tertiary-fixed": "#311400",
        "secondary-fixed": "#6bff8f",
        "error-container": "#93000a",
        "on-surface": "#e1e2ec",
        "on-primary-container": "#00285d",
        "tertiary": "#ffb786",
        "on-error": "#690005",
        "surface-container-highest": "#32353c",
        "on-tertiary-container": "#461f00",
        "secondary": "#4ae176",
        "on-secondary": "#003915",
        "on-primary-fixed-variant": "#004395",
        "on-primary-fixed": "#001a42",
        "surface-dim": "#10131a",
        "surface-tint": "#adc6ff",
        "surface-container-high": "#272a31",
        "on-background": "#e1e2ec",
        "on-tertiary": "#502400",
        "primary-fixed-dim": "#adc6ff",
        "on-surface-variant": "#c2c6d6",
        "outline-variant": "#424754",
        "primary-fixed": "#d8e2ff",
        "primary-container": "#4d8eff",
        "surface-variant": "#32353c",
        "primary": "#adc6ff",
        "surface-bright": "#363941",
        "inverse-surface": "#e1e2ec",
        "on-error-container": "#ffdad6",
        "tertiary-fixed": "#ffdcc6",
        "inverse-on-surface": "#2e3038",
        "on-secondary-container": "#004119",
        "on-secondary-fixed": "#002109",
        "on-secondary-fixed-variant": "#005321",
        "surface": "#10131a",
        "secondary-container": "#00b954",
        "surface-container-low": "#191b23",
        "surface-container-lowest": "#0b0e15",
        "secondary-fixed-dim": "#4ae176",
        "surface-container": "#1d2027",
        "background": "#10131a",
        "outline": "#8c909f",
        "tertiary-container": "#df7412",
        "on-tertiary-fixed-variant": "#723600",
        "error": "#ffb4ab"
      },
      "borderRadius": {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "full": "9999px"
      },
      "spacing": {
        "gutter": "16px",
        "sidebar-width": "260px",
        "container-padding": "24px",
        "card-gap": "16px",
        "unit": "4px"
      },
      "fontFamily": {
        "body-sm": ["Inter"],
        "label-caps": ["Inter"],
        "display-lg": ["Inter"],
        "mono-data": ["monospace"],
        "body-md": ["Inter"],
        "headline-md": ["Inter"],
        "title-sm": ["Inter"]
      },
      "fontSize": {
        "body-sm": ["14px", {"lineHeight": "20px", "fontWeight": "400"}],
        "label-caps": ["12px", {"lineHeight": "16px", "letterSpacing": "0.05em", "fontWeight": "700"}],
        "display-lg": ["32px", {"lineHeight": "40px", "letterSpacing": "-0.02em", "fontWeight": "700"}],
        "mono-data": ["14px", {"lineHeight": "20px", "fontWeight": "500"}],
        "body-md": ["16px", {"lineHeight": "24px", "fontWeight": "400"}],
        "headline-md": ["24px", {"lineHeight": "32px", "letterSpacing": "-0.01em", "fontWeight": "600"}],
        "title-sm": ["18px", {"lineHeight": "24px", "fontWeight": "600"}]
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries')
  ],
}
