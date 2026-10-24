import { describe, expect, it } from "vitest";
import { checkoutNet, periodPrice } from "./products";

describe("pricing", () => {
  it("yearly costs 10 months", () => expect(periodPrice(249, "yearly")).toBe(2490));
  it("monthly is unchanged", () => expect(periodPrice(249, "monthly")).toBe(249));
  it("clinic pays 1000 setup on first payment", () =>
    expect(checkoutNet({ monthlySar: 499, period: "monthly", clinic: true, setupPaid: false }).total).toBe(1499));
  it("clinic setup fee charged only once", () =>
    expect(checkoutNet({ monthlySar: 499, period: "monthly", clinic: true, setupPaid: true }).total).toBe(499));
  it("non-clinic has no setup fee", () =>
    expect(checkoutNet({ monthlySar: 499, period: "yearly", clinic: false, setupPaid: false }).total).toBe(4990));
});
