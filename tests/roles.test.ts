import { describe, it, expect } from "vitest";

// Mirrors the nav-locking logic in src/routes/_authenticated.tsx.
// Roles come from the `user_roles` table + has_role() SECURITY DEFINER fn.
type Role = "fan" | "volunteer" | "ops";

function canAccess(route: "/fan" | "/staff" | "/ops", roles: Role[]): boolean {
  if (route === "/fan") return true; // any authenticated user
  if (route === "/staff") return roles.includes("volunteer") || roles.includes("ops");
  if (route === "/ops") return roles.includes("ops");
  return false;
}

describe("role-based routing", () => {
  it("fans can only reach /fan", () => {
    const roles: Role[] = ["fan"];
    expect(canAccess("/fan", roles)).toBe(true);
    expect(canAccess("/staff", roles)).toBe(false);
    expect(canAccess("/ops", roles)).toBe(false);
  });

  it("volunteers reach fan + staff, but not ops", () => {
    const roles: Role[] = ["fan", "volunteer"];
    expect(canAccess("/fan", roles)).toBe(true);
    expect(canAccess("/staff", roles)).toBe(true);
    expect(canAccess("/ops", roles)).toBe(false);
  });

  it("ops reach every route", () => {
    const roles: Role[] = ["fan", "volunteer", "ops"];
    expect(canAccess("/fan", roles)).toBe(true);
    expect(canAccess("/staff", roles)).toBe(true);
    expect(canAccess("/ops", roles)).toBe(true);
  });

  it("user with no roles still gets fan", () => {
    expect(canAccess("/fan", [])).toBe(true);
    expect(canAccess("/staff", [])).toBe(false);
    expect(canAccess("/ops", [])).toBe(false);
  });

  it("ops role alone is enough for /ops (fan not required)", () => {
    expect(canAccess("/ops", ["ops"])).toBe(true);
  });
});
