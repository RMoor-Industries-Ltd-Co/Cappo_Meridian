import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// RTL's auto-cleanup only self-registers when it detects test-framework
// globals (`test.globals: true`); this repo's tests import `afterEach`
// explicitly instead, so register cleanup here to avoid DOM leaking between
// tests (which otherwise causes "multiple elements found" failures).
afterEach(() => cleanup());
