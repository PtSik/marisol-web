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
        muted: {
          DEFAULT: "#6F6457",
          2: "#8C8074",
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
