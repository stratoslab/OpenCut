import { describe, it, expect } from "bun:test";
import { isValidActionType, validatePlan, ACTION_TYPES, type EditingPlan } from "../types";

function generateRandomActionType(): string {
  const randomChars = "abcdefghijklmnopqrstuvwxyz-";
  let result = "";
  for (let i = 0; i < 10; i++) {
    result += randomChars[Math.floor(Math.random() * randomChars.length)];
  }
  return result;
}

function createValidPlan(stepCount: number): EditingPlan {
  return {
    id: "test-plan",
    goal: "Test goal",
    steps: Array.from({ length: stepCount }, (_, i) => ({
      id: `step-${i}`,
      actionType: ACTION_TYPES[i % ACTION_TYPES.length],
      description: `Step ${i + 1}`,
      params: {},
    })),
    estimatedDuration: stepCount * 5,
  };
}

describe("AiAgent types and validation (Req 1.1-1.6)", () => {
  it("Property: Only 19 defined action types are accepted", () => {
    expect(ACTION_TYPES).toHaveLength(19);

    for (const action of ACTION_TYPES) {
      expect(isValidActionType(action)).toBe(true);
    }
  });

  it("Property: Random strings are rejected as action types", () => {
    for (let run = 0; run < 200; run++) {
      const randomAction = generateRandomActionType();

      if (!ACTION_TYPES.includes(randomAction as never)) {
        expect(isValidActionType(randomAction)).toBe(false);
      }
    }
  });

  it("Property: Plans with valid action types pass validation", () => {
    for (let run = 0; run < 100; run++) {
      const stepCount = 1 + Math.floor(Math.random() * 10);
      const plan = createValidPlan(stepCount);

      const result = validatePlan(plan);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    }
  });

  it("Property: Plans with invalid action types fail validation", () => {
    for (let run = 0; run < 100; run++) {
      const plan: EditingPlan = {
        id: "test-plan",
        goal: "Test",
        steps: [
          {
            id: "step-0",
            actionType: generateRandomActionType() as never,
            description: "Invalid step",
            params: {},
          },
        ],
        estimatedDuration: 0,
      };

      const result = validatePlan(plan);

      if (!ACTION_TYPES.includes(plan.steps[0].actionType as never)) {
        expect(result.valid).toBe(false);
        expect(result.error).toContain("Invalid action type");
      }
    }
  });

  it("Property: Empty plans fail validation", () => {
    const emptyPlan: EditingPlan = {
      id: "empty",
      goal: "Empty plan",
      steps: [],
      estimatedDuration: 0,
    };

    const result = validatePlan(emptyPlan);

    expect(result.valid).toBe(false);
    expect(result.error).toContain("no steps");
  });

  it("validates all 19 action types in a single plan", () => {
    const plan: EditingPlan = {
      id: "all-actions",
      goal: "Test all actions",
      steps: ACTION_TYPES.map((action, i) => ({
        id: `step-${i}`,
        actionType: action,
        description: `Test ${action}`,
        params: {},
      })),
      estimatedDuration: 0,
    };

    const result = validatePlan(plan);

    expect(result.valid).toBe(true);
    expect(plan.steps).toHaveLength(19);
  });

  it("rejects plan with mixed valid and invalid actions", () => {
    const plan: EditingPlan = {
      id: "mixed",
      goal: "Mixed plan",
      steps: [
        {
          id: "step-0",
          actionType: "split-clip",
          description: "Valid step",
          params: {},
        },
        {
          id: "step-1",
          actionType: "invalid-action" as never,
          description: "Invalid step",
          params: {},
        },
      ],
      estimatedDuration: 0,
    };

    const result = validatePlan(plan);

    expect(result.valid).toBe(false);
    expect(result.error).toContain("invalid-action");
  });
});
