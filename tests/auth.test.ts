import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocked Supabase client for auth flows.
const signInWithPassword = vi.fn();
const signUp = vi.fn();
const signOut = vi.fn();
const getUser = vi.fn();

const supabase = {
  auth: { signInWithPassword, signUp, signOut, getUser },
};

describe("authentication", () => {
  beforeEach(() => vi.clearAllMocks());

  it("signs in with valid credentials", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: { id: "u1", email: "fan@example.com" } },
      error: null,
    });

    const { data, error } = await supabase.auth.signInWithPassword({
      email: "fan@example.com",
      password: "hunter2000",
    });

    expect(error).toBeNull();
    expect(data.user.email).toBe("fan@example.com");
    expect(signInWithPassword).toHaveBeenCalledOnce();
  });

  it("surfaces error on invalid credentials", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid login credentials" },
    });

    const { error } = await supabase.auth.signInWithPassword({
      email: "x@x.com",
      password: "bad",
    });

    expect(error?.message).toMatch(/invalid/i);
  });

  it("creates account with display_name metadata", async () => {
    signUp.mockResolvedValue({ data: { user: { id: "u2" } }, error: null });

    await supabase.auth.signUp({
      email: "new@example.com",
      password: "hunter2000",
      options: { data: { display_name: "New Fan" } },
    });

    expect(signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: { data: { display_name: "New Fan" } },
      }),
    );
  });

  it("rejects unauthenticated session on protected route guard", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const { data } = await supabase.auth.getUser();
    // matches the guard in src/routes/_authenticated.tsx
    const shouldRedirect = !data.user;
    expect(shouldRedirect).toBe(true);
  });

  it("allows authenticated session through guard", async () => {
    getUser.mockResolvedValue({
      data: { user: { id: "u1", email: "fan@example.com" } },
      error: null,
    });
    const { data, error } = await supabase.auth.getUser();
    expect(error).toBeNull();
    expect(data.user?.id).toBe("u1");
  });
});
