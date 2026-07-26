import type { MainState } from "@/typings/store";

type ValidatedKey = "playerOrder";

const validationRules: Record<ValidatedKey, readonly (string | number)[]> = {
  playerOrder: ["list", "single", "shuffle"],
};

export const validateMainPatch = (patch: Partial<MainState>, current: MainState) => {
  const validated = { ...patch };
  (Object.keys(validationRules) as ValidatedKey[]).forEach((key) => {
    if (!(key in validated)) return;
    const allowed = validationRules[key];
    const incoming = validated[key];
    const value = typeof allowed[0] === "number" ? Number(incoming) : incoming;
    if (allowed.includes(value as never)) {
      (validated as Record<string, unknown>)[key] = value;
      return;
    }
    (validated as Record<string, unknown>)[key] = current[key];
    console.error(`不支持将变量 '${key}' 的值设置为 '${String(incoming)}'，已阻止更改。`);
  });
  return validated;
};
