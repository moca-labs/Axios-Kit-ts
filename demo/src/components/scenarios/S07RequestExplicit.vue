<script setup lang="ts">
import { ref } from "vue";
import { api, UpdatePostRequest } from "../../api";

const postId = ref("1");
const title = ref("수정된 포스트 제목");
const body = ref("@REQUEST 데코레이터로 명시 지정된 요청 바디입니다.");
const userId = ref(1);
const loading = ref(false);
const result = ref<string>("");
const sent = ref<string>("");
const status = ref<"idle" | "success" | "error">("idle");

async function run() {
  if (!postId.value) return;
  loading.value = true;
  status.value = "idle";
  result.value = "";
  const data = new UpdatePostRequest(title.value, body.value, userId.value);
  sent.value = JSON.stringify(data.toJson(), null, 2);
  try {
    const post = await api.updatePost(postId.value, data);
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
    <div class="scenario-title">07 — @REQUEST 명시</div>
    <div class="scenario-desc">
      복수 파라미터(경로 파라미터 + 요청 바디)가 있을 때 <code>@McAxios.REQUEST("label", "paramName")</code> 으로 바디를 명시합니다.<br />
      생략 시 <code>instanceof McRequest</code> 로 자동 감지되며, 명시는 의도를 명확히 할 때 사용합니다.
    </div>
  </div>

  <div class="scenario-grid">
    <div class="panel">
      <div class="panel-header"><span class="dot"></span> 데코레이터 정의</div>
      <div class="panel-body">
        <div class="code-block">
          <pre><span class="cmt">// PUT /posts/{id} — 경로 파라미터 + 요청 바디</span>
<span class="dec">@McAxios.PUT</span>(<span class="str">`${BASE}/posts/{id}`</span>, <span class="cls">PostEntity</span>)
<span class="dec">@McAxios.PATH</span>(<span class="str">"id"</span>, <span class="str">"postId"</span>)       <span class="cmt">// {id} → postId</span>
<span class="dec">@McAxios.REQUEST</span>(<span class="str">"body"</span>, <span class="str">"data"</span>)  <span class="cmt">// data → 요청 바디</span>
<span class="fn">updatePost</span>(
  postId: <span class="ty">string</span>,
  data: <span class="cls">UpdatePostRequest</span>,
): <span class="ty">Promise</span>&lt;<span class="cls">PostEntity</span>&gt; { ... }

<span class="cmt">// updatePost("1", req)</span>
<span class="cmt">// → PUT /posts/1  body: req.toJson()</span></pre>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header"><span class="dot"></span> 실행</div>
      <div class="panel-body">
        <div class="form-group">
          <label>Post ID (1 ~ 100)</label>
          <input v-model="postId" type="number" min="1" max="100" />
        </div>
        <div class="form-group">
          <label>title</label>
          <input v-model="title" type="text" placeholder="수정할 제목" />
        </div>
        <div class="form-group">
          <label>body</label>
          <textarea v-model="body" placeholder="수정할 본문"></textarea>
        </div>
        <div class="form-group">
          <label>userId</label>
          <input v-model.number="userId" type="number" min="1" max="10" />
        </div>

        <button class="btn" :disabled="loading || !postId" @click="run">
          <span v-if="loading" class="spinner"></span>
          <span v-else>▶</span>
          {{ loading ? "요청 중..." : `updatePost("${postId}", data) 실행` }}
        </button>

        <div v-if="sent" style="margin-top: 16px;">
          <div class="panel-header" style="border-radius: 6px 6px 0 0; margin: 0;">
            <span class="dot" style="background: var(--yellow);"></span> 전송된 JSON (data.toJson())
          </div>
          <div class="result-box" style="border-radius: 0 0 6px 6px; border-top: none; margin-top: 0; color: var(--yellow);">{{ sent }}</div>
        </div>

        <div v-if="result" style="margin-top: 12px;">
          <span :class="['status-badge', status]">
            {{ status === 'success' ? `✓ PUT /posts/${postId}` : '✕ Error' }}
          </span>
          <div :class="['result-box', status]">{{ result }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
