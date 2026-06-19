<script setup lang="ts">
import { ref } from "vue";
import { api } from "../../api";

const postId = ref("3");
const loading = ref(false);
const result = ref<string>("");
const status = ref<"idle" | "success" | "error">("idle");

async function run() {
  if (!postId.value) return;
  loading.value = true;
  status.value = "idle";
  result.value = "";
  try {
    const post = await api.getPostByPostId(postId.value);
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
    <div class="scenario-title">06 — @PATH 명시</div>
    <div class="scenario-desc">
      URL 플레이스홀더 이름과 파라미터 이름이 다를 때 <code>@McAxios.PATH("urlKey", "paramName")</code> 으로 명시합니다.<br />
      생략하면 자동 감지, 이름이 다를 경우에만 필요합니다.
    </div>
  </div>

  <div class="scenario-grid">
    <div class="panel">
      <div class="panel-header"><span class="dot"></span> 데코레이터 정의</div>
      <div class="panel-body">
        <div class="code-block">
          <pre><span class="cmt">// ✅ 자동 감지: 파라미터명 = URL 플레이스홀더명</span>
<span class="dec">@McAxios.GET</span>(<span class="str">`${BASE}/posts/{id}`</span>, <span class="cls">PostEntity</span>)
<span class="fn">getPost</span>(id: <span class="ty">string</span>) { ... }

<span class="cmt">// ⚠️ 이름 불일치 → @PATH 명시 필요</span>
<span class="cmt">// 미명시 시 {id}와 postId 가 달라 치환 안 됨</span>
<span class="dec">@McAxios.GET</span>(<span class="str">`${BASE}/posts/{id}`</span>, <span class="cls">PostEntity</span>)
<span class="dec">@McAxios.PATH</span>(<span class="str">"id"</span>, <span class="str">"postId"</span>)
<span class="fn">getPostByPostId</span>(postId: <span class="ty">string</span>) { ... }

<span class="cmt">// getPostByPostId("5") → GET /posts/5</span></pre>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header"><span class="dot"></span> 실행</div>
      <div class="panel-body">
        <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 12px;">
          파라미터명 <code>postId</code>가 URL 플레이스홀더 <code>{id}</code>와 다르지만<br />
          <code>@McAxios.PATH("id", "postId")</code> 로 명시 매핑되어 정상 동작합니다.
        </p>
        <div class="form-group">
          <label>Post ID (1 ~ 100)</label>
          <input v-model="postId" type="number" min="1" max="100" placeholder="3" />
        </div>
        <button class="btn" :disabled="loading || !postId" @click="run">
          <span v-if="loading" class="spinner"></span>
          <span v-else>▶</span>
          {{ loading ? "요청 중..." : `getPostByPostId("${postId}") 실행` }}
        </button>

        <div v-if="result" style="margin-top: 16px;">
          <span :class="['status-badge', status]">
            {{ status === 'success' ? `✓ GET /posts/${postId}` : '✕ Error' }}
          </span>
          <div :class="['result-box', status]">{{ result }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
