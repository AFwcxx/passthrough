<script setup lang="ts">
import { ref, onMounted } from "vue";
import Button from "primevue/button";
import Card from "primevue/card";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Select from "primevue/select";
import InputNumber from "primevue/inputnumber";
const page = ref("Dashboard"),
  token = ref(localStorage.getItem("passthrough-token") ?? ""),
  enteredToken = ref(""),
  authError = ref(""),
  connecting = ref(false),
  health = ref<any>(),
  history = ref<any>({ items: [] }),
  library = ref<any>({ items: [], page: 1, pageSize: 20, total: 0 }),
  selectedFiles = ref<File[]>([]),
  fileInput = ref<HTMLInputElement>(),
  uploading = ref(false),
  libraryMessage = ref(""),
  libraryError = ref(false),
  settings = ref<any>({ defaultAction: "save", historyPageSize: 20 });
const headers = (value = token.value) => ({
  Authorization: `Bearer ${value}`,
  "Content-Type": "application/json",
});
async function load(value = token.value) {
  health.value = await fetch("/api/health").then((r) => r.json());
  if (!value) return true;
  const [historyResponse, libraryResponse, settingsResponse] =
    await Promise.all([
      fetch("/api/history", { headers: headers(value) }),
      fetch("/api/library", { headers: headers(value) }),
      fetch("/api/settings", { headers: headers(value) }),
    ]);
  if (
    historyResponse.status === 401 ||
    libraryResponse.status === 401 ||
    settingsResponse.status === 401
  )
    return false;
  if (!historyResponse.ok || !libraryResponse.ok || !settingsResponse.ok)
    throw new Error("Unable to load Passthrough");
  history.value = await historyResponse.json();
  library.value = await libraryResponse.json();
  settings.value = await settingsResponse.json();
  return true;
}
function rejectToken() {
  localStorage.removeItem("passthrough-token");
  token.value = "";
  authError.value = "That token was rejected.";
}
async function connect() {
  connecting.value = true;
  authError.value = "";
  try {
    if (!(await load(enteredToken.value))) {
      rejectToken();
      return;
    }
    token.value = enteredToken.value;
    localStorage.setItem("passthrough-token", token.value);
    enteredToken.value = "";
  } catch {
    authError.value = "Unable to verify the token.";
  } finally {
    connecting.value = false;
  }
}
async function save() {
  await fetch("/api/settings", {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify(settings.value),
  });
  await load();
}
function chooseFiles(event: Event) {
  selectedFiles.value = Array.from(
    (event.target as HTMLInputElement).files ?? [],
  );
}
function showLibraryError(message: string) {
  libraryError.value = true;
  libraryMessage.value = message;
}
async function loadLibrary(nextPage = 1) {
  const response = await fetch(`/api/library?page=${nextPage}`, {
    headers: headers(),
  });
  if (!response.ok) throw new Error("Unable to load the library.");
  library.value = await response.json();
}
async function changeLibraryPage(nextPage: number) {
  try {
    await loadLibrary(nextPage);
  } catch {
    showLibraryError("Unable to load the library.");
  }
}
async function uploadFiles() {
  uploading.value = true;
  libraryMessage.value = "";
  libraryError.value = false;
  const body = new FormData();
  for (const file of selectedFiles.value) body.append("files", file);
  try {
    const response = await fetch("/api/library", {
      method: "POST",
      headers: { Authorization: `Bearer ${token.value}` },
      body,
    });
    if (!response.ok) {
      const result = await response.json();
      throw new Error(
        result.error?.message ??
          result.validationErrors?.[0] ??
          "Upload failed.",
      );
    }
    const result = await response.json();
    selectedFiles.value = [];
    if (fileInput.value) fileInput.value.value = "";
    libraryMessage.value = `${result.items.length} file${result.items.length === 1 ? "" : "s"} uploaded.`;
    await loadLibrary(1);
  } catch (error) {
    showLibraryError(error instanceof Error ? error.message : "Upload failed.");
  } finally {
    uploading.value = false;
  }
}
async function downloadFile(file: any) {
  try {
    const response = await fetch(`/api/library/${file.id}/download`, {
      headers: headers(),
    });
    if (!response.ok) throw new Error();
    const url = URL.createObjectURL(await response.blob()),
      link = document.createElement("a");
    link.href = url;
    link.download = file.filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  } catch {
    showLibraryError("Download failed.");
  }
}
async function deleteFile(file: any) {
  if (!window.confirm(`Permanently delete ${file.filename}?`)) return;
  try {
    const response = await fetch(`/api/library/${file.id}`, {
      method: "DELETE",
      headers: headers(),
    });
    if (!response.ok) throw new Error();
    libraryError.value = false;
    libraryMessage.value = `${file.filename} deleted.`;
    await loadLibrary(
      library.value.items.length === 1 && library.value.page > 1
        ? library.value.page - 1
        : library.value.page,
    );
  } catch {
    showLibraryError("Delete failed.");
  }
}
onMounted(async () => {
  if (token.value && !(await load())) rejectToken();
});
</script>
<template>
  <header>
    <h1>Passthrough</h1>
    <nav v-if="token">
      <Button
        v-for="p in ['Dashboard', 'Library', 'History', 'Settings']"
        :key="p"
        :label="p"
        text
        @click="page = p"
      />
    </nav>
  </header>
  <main>
    <Card v-if="!token"
      ><template #title>Connect to Passthrough</template
      ><template #content
        ><form @submit.prevent="connect">
          <label
            >Access token<input
              v-model="enteredToken"
              type="password"
              autocomplete="current-password"
              minlength="16"
              required
              autofocus /></label
          ><small v-if="authError" class="error" role="alert">{{
            authError
          }}</small
          ><Button
            type="submit"
            label="Connect"
            :loading="connecting"
          /></form></template
    ></Card>
    <template v-else-if="page === 'Dashboard'"
      ><div class="grid">
        <Card
          ><template #title>API</template
          ><template #content>{{
            health?.status ?? "Checking…"
          }}</template></Card
        ><Card
          ><template #title>Clipboard agent</template
          ><template #content>{{
            health?.clipboardAgent?.status ?? "Unknown"
          }}</template></Card
        ><Card
          ><template #title>Upload directory</template
          ><template #content>{{
            health?.uploadDirectory ?? "Unknown"
          }}</template></Card
        ><Card
          ><template #title>Recent transfers</template
          ><template #content>{{ history.total ?? 0 }}</template></Card
        >
      </div></template
    >
    <Card v-else-if="page === 'Library'"
      ><template #title>File library</template
      ><template #content
        ><form @submit.prevent="uploadFiles">
          <label
            >Files<input
              ref="fileInput"
              type="file"
              multiple
              required
              @change="chooseFiles"
          /></label>
          <Button
            type="submit"
            label="Upload"
            :loading="uploading"
            :disabled="!selectedFiles.length"
          />
        </form>
        <p
          v-if="libraryMessage"
          :class="{ error: libraryError }"
          :role="libraryError ? 'alert' : 'status'"
        >
          {{ libraryMessage }}
        </p>
        <DataTable
          :value="library.items"
          paginator
          lazy
          :rows="library.pageSize"
          :first="(library.page - 1) * library.pageSize"
          :total-records="library.total"
          @page="changeLibraryPage($event.page + 1)"
          ><Column field="uploaded_at" header="Uploaded" /><Column
            field="filename"
            header="File" /><Column field="mime_type" header="Type" /><Column
            field="byte_size"
            header="Size" /><Column header="Actions"
            ><template #body="{ data }"
              ><div class="actions">
                <Button label="Download" text @click="downloadFile(data)" />
                <Button
                  label="Delete"
                  severity="danger"
                  text
                  @click="deleteFile(data)"
                /></div></template></Column></DataTable></template
    ></Card>
    <DataTable
      v-else-if="page === 'History'"
      :value="history.items"
      paginator
      :rows="settings.historyPageSize"
      ><Column field="timestamp" header="Timestamp" /><Column
        field="label"
        header="Item" /><Column field="mime_type" header="Type" /><Column
        field="byte_size"
        header="Size" /><Column field="action" header="Action" /><Column
        field="save_result"
        header="Save" /><Column field="clipboard_result" header="Clipboard"
    /></DataTable>
    <Card v-else
      ><template #title>Settings</template
      ><template #content
        ><form @submit.prevent="save">
          <label
            >Default action<Select
              v-model="settings.defaultAction"
              :options="['save', 'clipboard', 'both']" /></label
          ><label
            >History page size<InputNumber
              v-model="settings.historyPageSize"
              :min="5"
              :max="100" /></label
          ><Button type="submit" label="Save" /></form></template
    ></Card>
  </main>
</template>
