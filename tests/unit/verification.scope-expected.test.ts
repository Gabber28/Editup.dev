import { describe, it, expect } from "vitest";
import { checkScope } from "@verify/scope.js";
import type { ElementSnapshot } from "@verify/scope.js";
import { makeSnapshot, makeChange } from "../helpers/fixtures.js";

function makeRelated(overrides: Partial<ElementSnapshot> = {}): ElementSnapshot {
  return {
    selector: ".btn-secondary",
    classes: ["btn-secondary"],
    preEditComputed: { "background-color": "rgb(200, 200, 200)" },
    postEditComputed: { "background-color": "rgb(200, 200, 200)" },
    ...overrides,
  };
}

describe("verification — scope expected side effects", () => {
  it("unchanged related elements produce pass", () => {
    const result = checkScope({
      snapshot: makeSnapshot(),
      declaredSideEffects: [],
      relatedElements: [makeRelated()],
    });
    expect(result.status).toBe("pass");
    expect(result.unexpectedChanges).toHaveLength(0);
  });

  it("undeclared change is flagged as unexpected", () => {
    const changed = makeRelated({
      preEditComputed: { "background-color": "rgb(200, 200, 200)" },
      postEditComputed: { "background-color": "rgb(0, 0, 0)" },
    });
    const result = checkScope({
      snapshot: makeSnapshot(),
      declaredSideEffects: [],
      relatedElements: [changed],
    });
    expect(result.status).toBe("fail");
    expect(result.unexpectedChanges).toHaveLength(1);
  });

  it("declared side effect with matching class is expected", () => {
    const changed = makeRelated({
      classes: ["btn-secondary"],
      preEditComputed: { "background-color": "rgb(200, 200, 200)" },
      postEditComputed: { "background-color": "rgb(0, 0, 0)" },
    });
    const result = checkScope({
      snapshot: makeSnapshot(),
      declaredSideEffects: ["btn-secondary will also change"],
      relatedElements: [changed],
    });
    expect(result.status).toBe("pass");
    expect(result.expectedChanges).toHaveLength(1);
    expect(result.unexpectedChanges).toHaveLength(0);
  });

  it("declared side effect with component source match is expected", () => {
    const changed = makeRelated({
      componentSource: "ButtonGroup",
      preEditComputed: { "background-color": "rgb(200, 200, 200)" },
      postEditComputed: { "background-color": "rgb(0, 0, 0)" },
    });
    const result = checkScope({
      snapshot: makeSnapshot(),
      declaredSideEffects: ["ButtonGroup components affected"],
      relatedElements: [changed],
    });
    expect(result.status).toBe("pass");
    expect(result.expectedChanges).toHaveLength(1);
  });

  it("mix of expected and unexpected changes", () => {
    const expected = makeRelated({
      classes: ["btn-secondary"],
      preEditComputed: { "background-color": "rgb(200, 200, 200)" },
      postEditComputed: { "background-color": "rgb(100, 100, 100)" },
    });
    const unexpected = makeRelated({
      selector: ".nav-link",
      classes: ["nav-link"],
      preEditComputed: { "background-color": "rgb(50, 50, 50)" },
      postEditComputed: { "background-color": "rgb(0, 0, 0)" },
    });
    const result = checkScope({
      snapshot: makeSnapshot(),
      declaredSideEffects: ["btn-secondary changes expected"],
      relatedElements: [expected, unexpected],
    });
    expect(result.status).toBe("fail");
    expect(result.expectedChanges).toHaveLength(1);
    expect(result.unexpectedChanges).toHaveLength(1);
  });
});
