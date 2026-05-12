/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "SFMono-Regular", "ui-monospace", "monospace"]
      },
      colors: {
        ink: "#071014",
        panel: "#0b151a",
        line: "#1d3038",
        cyan: "#20d3ee",
        amber: "#f6b43b",
        signal: "#82f2b5"
      }
    }
  },
  plugins: []
};
