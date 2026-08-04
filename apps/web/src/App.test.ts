import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, it, expect, vi } from "vitest";
import PrimeVue from "primevue/config";
import Aura from "@primevue/themes/aura";
import App from "./App.vue";
const mountApp = () =>
  mount(App, {
    global: { plugins: [[PrimeVue, { theme: { preset: Aura } }]] },
  });
const response = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(body),
  blob: () => Promise.resolve(new Blob(["download"])),
});
const library = {
  items: [
    {
      id: 1,
      uploaded_at: "2026-08-04T00:00:00.000Z",
      filename: "file.txt",
      mime_type: "text/plain",
      byte_size: 8,
    },
  ],
  page: 1,
  pageSize: 20,
  total: 1,
};
const defaultFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const path = String(input);
  if (path.includes("/api/library")) {
    if (init?.method === "POST") return response({ items: [{ id: 2 }] }, 201);
    if (init?.method === "DELETE") return response(null, 204);
    if (path.includes("/download")) return response(null);
    return response(library);
  }
  if (path.includes("history")) return response({ items: [], total: 0 });
  if (path.includes("settings"))
    return response({ defaultAction: "save", historyPageSize: 20 });
  return response({ status: "ok" });
};
const fetchMock = vi.fn(defaultFetch);
vi.stubGlobal("fetch", fetchMock);
beforeEach(() => {
  localStorage.clear();
  fetchMock.mockClear();
  fetchMock.mockImplementation(defaultFetch);
});
describe("App", () => {
  it("asks for a token when none is stored", () =>
    expect(mountApp().text()).toContain("Connect to Passthrough"));
  it("stores a verified token and shows the dashboard", async () => {
    const wrapper = mountApp();
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
    const wrapper = mountApp();
    await flushPromises();
    expect(localStorage.getItem("passthrough-token")).toBeNull();
    expect(wrapper.text()).toContain("That token was rejected.");
  });
  it("uploads selected files to the separate library endpoint", async () => {
    localStorage.setItem("passthrough-token", "0123456789abcdef");
    const wrapper = mountApp();
    await flushPromises();
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Library")!
      .trigger("click");
    const input = wrapper.get('input[type="file"]');
    Object.defineProperty(input.element, "files", {
      value: [new File(["content"], "upload.txt", { type: "text/plain" })],
    });
    await input.trigger("change");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    const call = fetchMock.mock.calls.find(
      ([path, init]) =>
        String(path) === "/api/library" && init?.method === "POST",
    );
    expect(call?.[1]?.headers).toEqual({
      Authorization: "Bearer 0123456789abcdef",
    });
    expect((call?.[1]?.body as FormData).getAll("files")).toHaveLength(1);
    expect(wrapper.text()).toContain("1 file uploaded.");
  });
  it("downloads with authentication and confirms permanent deletion", async () => {
    localStorage.setItem("passthrough-token", "0123456789abcdef");
    const createObjectURL = vi.fn(() => "blob:file"),
      revokeObjectURL = vi.fn(),
      click = vi
        .spyOn(HTMLAnchorElement.prototype, "click")
        .mockImplementation(() => {}),
      confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    Object.defineProperties(URL, {
      createObjectURL: { configurable: true, value: createObjectURL },
      revokeObjectURL: { configurable: true, value: revokeObjectURL },
    });
    const wrapper = mountApp();
    await flushPromises();
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Library")!
      .trigger("click");
    const action = (label: string) =>
      wrapper.findAll("button").find((button) => button.text() === label)!;

    await action("Download").trigger("click");
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledWith("/api/library/1/download", {
      headers: expect.objectContaining({
        Authorization: "Bearer 0123456789abcdef",
      }),
    });
    expect(click).toHaveBeenCalled();

    await action("Delete").trigger("click");
    expect(
      fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE"),
    ).toBe(false);
    confirm.mockReturnValue(true);
    await action("Delete").trigger("click");
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledWith("/api/library/1", {
      method: "DELETE",
      headers: expect.any(Object),
    });
  });
});
