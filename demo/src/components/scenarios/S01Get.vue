<script setup lang="ts">
import { ref } from "vue";
import { api } from "../../api";

const loading = ref(false);
const result = ref<string>("");
const status = ref<"idle" | "success" | "error">("idle");

async function run() {
  loading.value = true;
  status.value = "idle";
  result.value = "";
  try {
    const post = await api.getFirstPost();
    result.value = JSON.stringify(post, null, 2);
    status.value = "success";
  } catch (e) {
    result.value = (e as Error).message;
    status.value = "error";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="scenario-header">
    <div class="scenario-title">01 — GET</div>
    <div class="scenario-desc">
      <code>@McAxios.GET(url, ResponseType)</code> 으로 메서드를 HTTP GET 엔드포인트에 바인딩합니다.<br />
      응답은 <code>@McEntity.ENTITY</code> 데코레이터를 통해 <code>PostEntity</code> 인스턴스로 자동 매핑됩니다.
    </div>
  </div>

  <div class="scenario-grid">
    <div class="panel">
      <div class="panel-header"><span class="dot"></span> 데코레이터 정의</div>
      <div class="panel-body">
        <div class="code-block">
          <pre><span class="cmt">// entities/PostEntity.ts</span>
<span class="dec">@McEntity.ENTITY</span>
<span class="kw">class</span> <span class="cls">PostEntity</span> {
  <span class="dec">@McEntity.FIELD</span>(<span class="cls">Number</span>) id!: <span class="ty">number</span>;
  <span class="dec">@McEntity.FIELD</span>(<span class="cls">Number</span>) userId!: <span class="ty">number</span>;
  <span class="dec">@McEntity.FIELD</span>(<span class="cls">String</span>) title!: <span class="ty">string</span>;
  <span class="dec">@McEntity.FIELD</span>(<span class="cls">String</span>) body!: <span class="ty">string</span>;
}

<span class="cmt">// api.ts</span>
<span class="dec">@McAxios.GET</span>(<span class="str">`${BASE}/posts/1`</span>, <span class="cls">PostEntity</span>)
<span class="fn">getFirstPost</span>!: () =&gt; <span class="ty">Promise</span>&lt;<span class="cls">PostEntity</span>&gt;;</pre>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header"><span class="dot"></span> 실행</div>
      <div class="panel-body">
        <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 16px;">
          JSONPlaceholder <code>/posts/1</code>에 GET 요청을 보내고<br />
          응답을 <code>PostEntity</code> 인스턴스로 매핑합니다.
        </p>
        <button class="btn" :disabled="loading" @click="run">
          <span v-if="loading" class="spinner"></span>
          <span v-else>▶</span>
          {{ loading ? "요청 중..." : "getFirstPost() 실행" }}
        </button>

        <div v-if="result" style="margin-top: 16px;">
          <span :class="['status-badge', status]">
            {{ status === 'success' ? '✓ PostEntity' : '✕ Error' }}
          </span>
          <div :class="['result-box', status]">{{ result }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
