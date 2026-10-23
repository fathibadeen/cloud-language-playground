import { test } from "node:test";
import assert from "node:assert/strict";
import { dashboardAccess } from "./dashboard-access";

const now = new Date("2026-10-23T23:34:00Z");
const trial = { status: "trialing", current_period_end: "2026-10-22T00:00:00Z" };

test("an expired trial can open billing", () => {
  assert.equal(dashboardAccess("active", trial, "/dashboard/billing", now).blocked, false);
});
test("an expired trial can confirm payment", () => {
  assert.equal(dashboardAccess("active", trial, "/dashboard/billing-callback", now).blocked, false);
});
test("expired subscriptions still block operational routes", () => {
  for (const status of ["trialing", "past_due", "canceled"]) {
    assert.equal(dashboardAccess("active", { ...trial, status }, "/dashboard/agents", now).blocked, true);
    assert.equal(dashboardAccess("active", { ...trial, status }, "/dashboard/billing", now).blocked, false);
  }
});
test("suspended companies cannot bypass the block through billing", () => {
  for (const path of ["/dashboard/billing", "/dashboard/billing-callback", "/dashboard"]) {
    assert.equal(dashboardAccess("suspended", trial, path, now).blocked, true);
  }
});
test("billing exceptions match exact paths only", () => {
  assert.equal(dashboardAccess("active", trial, "/dashboard/billing-other", now).blocked, true);
});