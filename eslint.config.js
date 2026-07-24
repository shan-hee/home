import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginVue from "eslint-plugin-vue";

const autoImportGlobals = {
  computed: "readonly",
  defineComponent: "readonly",
  defineEmits: "readonly",
  defineProps: "readonly",
  ElMessage: "readonly",
  ElMessageBox: "readonly",
  envConfig: "readonly",
  h: "readonly",
  nextTick: "readonly",
  onBeforeUnmount: "readonly",
  onMounted: "readonly",
  onUnmounted: "readonly",
  reactive: "readonly",
  ref: "readonly",
  watch: "readonly",
};

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "src/auto-imports.d.ts", "src/components.d.ts"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs["flat/essential"],
  {
    files: ["src/**/*.{ts,vue}", "vite.config.ts", "uno.config.ts"],
    languageOptions: {
      globals: { ...globals.browser, ...autoImportGlobals },
      parserOptions: { parser: tseslint.parser, sourceType: "module" },
    },
    rules: {
      "no-undef": "off",
      "vue/multi-word-component-names": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["functions/**/*.ts"],
    languageOptions: {
      globals: { ...globals.serviceworker },
      parserOptions: { parser: tseslint.parser, sourceType: "module" },
    },
  },
);
