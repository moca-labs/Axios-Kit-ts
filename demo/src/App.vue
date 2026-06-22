<script setup lang="ts">
import { type Component, markRaw, ref } from "vue";
import S01Get from "./components/scenarios/S01Get.vue";
import S02Path from "./components/scenarios/S02Path.vue";
import S03Post from "./components/scenarios/S03Post.vue";
import S04Header from "./components/scenarios/S04Header.vue";
import S05Handlers from "./components/scenarios/S05Handlers.vue";
import S06PathExplicit from "./components/scenarios/S06PathExplicit.vue";
import S07RequestExplicit from "./components/scenarios/S07RequestExplicit.vue";
import S08Dispatch from "./components/scenarios/S08Dispatch.vue";

const tabs: Array<{ id: string; label: string; tag: string; component: Component }> = [
  { id: "s01", label: "GET", tag: "01", component: markRaw(S01Get) },
  { id: "s02", label: "PATH", tag: "02", component: markRaw(S02Path) },
  { id: "s03", label: "POST", tag: "03", component: markRaw(S03Post) },
  { id: "s04", label: "HEADER", tag: "04", component: markRaw(S04Header) },
  { id: "s05", label: "핸들러", tag: "05", component: markRaw(S05Handlers) },
  { id: "s06", label: "@PATH 명시", tag: "06", component: markRaw(S06PathExplicit) },
  { id: "s07", label: "@REQUEST 명시", tag: "07", component: markRaw(S07RequestExplicit) },
  { id: "s08", label: "응답 직접 처리", tag: "08", component: markRaw(S08Dispatch) },
];

// biome-ignore lint/correctness/noUnusedVariables: used in Vue template
const active = ref(tabs[0]);
</script>

<template>
  <header class="app-header">
    <span class="logo">
      <span>@moca-labs</span>/axios-kit-ts
    </span>
    <span class="badge">Demo</span>
    <span class="sub">JSONPlaceholder · jsonplaceholder.typicode.com</span>
  </header>

  <div class="app-body">
    <nav class="sidebar">
      <div class="sidebar-section">시나리오</div>
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="['tab-btn', { active: active.id === tab.id }]"
        @click="active = tab"
      >
        {{ tab.label }}
        <span class="tag">{{ tab.tag }}</span>
      </button>
    </nav>

    <main class="main">
      <component :is="active.component" />
    </main>
  </div>
</template>
