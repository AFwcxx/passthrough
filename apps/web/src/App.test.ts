import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, it, expect, vi } from "vitest";
import App from "./App.vue";
const response = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(body),
});
const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
  const path = String(input);
  if (path.includes("history")) return response({ items: [], total: 0 });
  if (path.includes("settings"))
    return response({ defaultAction: "save", historyPageSize: 20 });
  return response({ status: "ok" });
});
vi.stubGlobal("fetch", fetchMock);
beforeEach(() => {
  localStorage.clear();
  fetchMock.mockClear();
  fetchMock.mockImplementation(async (input) => {
    const path = String(input);
    if (path.includes("history")) return response({ items: [], total: 0 });
    if (path.includes("settings"))
      return response({ defaultAction: "save", historyPageSize: 20 });
    return response({ status: "ok" });
  });
});
describe("App", () => {
  it("asks for a token when none is stored", () =>
    expect(mount(App).text()).toContain("Connect to Passthrough"));
  it("stores a verified token and shows the dashboard", async () => {
    const wrapper = mount(App);
    await flushPromises();
    await wrapper.get('input[type="password"]').setValue("0123456789abcdef");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(localStorage.getItem("passthrough-token")).toBe("0123456789abcdef");
    expect(wrapper.text()).toContain("Recent transfers");
  });
  it("clears a rejected stored token", async () => {
    localStorage.setItem("passthrough-token", "wrong-token-value");
    fetchMock.mockImplementation(async (input) =>
      String(input).includes("health")
        ? response({ status: "ok" })
        : response({}, 401),
    );
    const wrapper = mount(App);
    await flushPromises();
    expect(localStorage.getItem("passthrough-token")).toBeNull();
    expect(wrapper.text()).toContain("That token was rejected.");
  });
});
