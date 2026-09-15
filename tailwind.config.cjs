/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: "#FBF6EF",
          100: "#F6EFE6",
          200: "#EFE7DD",
          300: "#F4EFE7",
        },
        ink: "#241B14",
        offwhite: "#FFFDF9",
        teal: "#4F8C80",
        success: "#2C7A4B",
        danger: "#B4452C",
        // The one caution tone: the checkout-conflict notice. Amber over cream, with its own
        // darker text shade because #B97E24 on a 10% wash of itself does not reach 4.5:1.
        gold: { DEFAULT: "#B97E24", ink: "#8A5D17" },
        muted: {
          DEFAULT: "#6F6457",
          2: "#796E61",
          3: "#B9A892",
          4: "#A99D8F",
        },
      },
      fontFamily: {
        display: ["Fraunces", "ui-serif", "Georgia", "serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      maxWidth: {
        shell: "1088px",
        content: "1000px",
      },
    },
  },
  plugins: [],
};
