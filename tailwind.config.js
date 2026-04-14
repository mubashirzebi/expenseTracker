/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require("nativewind/preset")],
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}", "./hooks/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#10b981", // vibrant mint green
        primaryDark: "#059669",
        bgLight: "#f8fafc",
        cardBg: "#ffffff",
        textMain: "#1e293b",
        textMuted: "#64748b",
        danger: "#ef4444",
        dangerLight: "#fee2e2",
        income: "#10b981",
        incomeLight: "#d1fae5",
      }
    },
  },
  plugins: [],
}
