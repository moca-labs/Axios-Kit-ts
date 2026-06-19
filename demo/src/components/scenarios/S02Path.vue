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
    const post = await api.getPost(postId.value);
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
    <div class="scenario-title">02 — PATH</div>
    <div class="scenario-desc">
      URL 템플릿의 <code>{id}</code> 플레이스홀더가 파라미터 이름 <code>id</code>와 자동으로 매핑됩니다.<br />
      별도의 <code>@McAxios.PATH</code> 데코레이터 없이 파라미터 이름만으로 경로 치환이 동작합니다.
    </div>
  </div>

  <div class="scenario-grid">
    <div class="panel">
      <div class="panel-header"><span class="dot"></span> 데코레이터 정의</div>
      <div class="panel-body">
        <div class="code-block">
          <pre><span class="dec">@McAxios.GET</span>(<span class="str">`${BASE}/posts/{id}`</span>, <span class="cls">PostEntity</span>)
<span class="fn">getPost</span>(id: <span class="ty">string</span>): <span class="ty">Promise</span>&lt;<span class="cls">PostEntity</span>&gt; {
  <span class="kw">return</span> <span class="kw">this</span>.<span class="fn">stub</span>();
}

<span class="cmt">// 파라미터명 'id'가 {id}에 자동 매핑됨:</span>
<span class="cmt">// getPost("5")  → GET /posts/5</span>
<span class="cmt">// getPost("10") → GET /posts/10</span></pre>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header"><span class="dot"></span> 실행</div>
      <div class="panel-body">
        <div class="form-group">
          <label>Post ID (1 ~ 100)</label>
          <input v-model="postId" type="number" min="1" max="100" placeholder="3" />
        </div>
        <button class="btn" :disabled="loading || !postId" @click="run">
          <span v-if="loading" class="spinner"></span>
          <span v-else>▶</span>
          {{ loading ? "요청 중..." : `getPost("${postId}") 실행` }}
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
