import{mount}from "@vue/test-utils";import{describe,it,expect,vi}from "vitest";import App from "./App.vue";
vi.stubGlobal("fetch",vi.fn().mockResolvedValue({json:()=>Promise.resolve({status:"ok",items:[]})}));describe("App",()=>it("renders dashboard",()=>expect(mount(App).text()).toContain("Passthrough")));
