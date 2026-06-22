<script setup lang="ts">
import { ref } from "vue";
import { api, UpdatePostRequest } from "../../api";

const postId = ref("1");
const title = ref("수정된 포스트 제목");
const body = ref("@REQUEST 데코레이터로 명시 지정된 요청 바디입니다.");
const userId = ref(1);
const loading = ref(false);

const indexResult = ref<string>("");
const nameResult = ref<string>("");
const indexSent = ref<string>("");
const nameSent = ref<string>("");
const indexStatus = ref<"idle" | "success" | "error">("idle");
const nameStatus = ref<"idle" | "success" | "error">("idle");

// biome-ignore lint/correctness/noUnusedVariables: used in Vue template
async function runByIndex() {
  if (!postId.value) return;
  loading.value = true;
  indexStatus.value = "idle";
  indexResult.value = "";
  const data = new UpdatePostRequest(title.value, body.value, userId.value);
  indexSent.value = JSON.stringify(data.toJson(), null, 2);
  try {
    const post = await api.updatePost(postId.value, data);
    indexResult.value = JSON.stringify(post, null, 2);
    indexStatus.value = "success";
  } catch (e) {
    indexResult.value = (e as Error).message;
    indexStatus.value = "error";
  } finally {
    loading.value = false;
  }
}

// biome-ignore lint/correctness/noUnusedVariables: used in Vue template
async function runByName() {
  if (!postId.value) return;
  loading.value = true;
  nameStatus.value = "idle";
  nameResult.value = "";
  const data = new UpdatePostRequest(title.value, body.value, userId.value);
  nameSent.value = JSON.stringify(data.toJson(), null, 2);
  try {
    const post = await api.updatePostByName(postId.value, data);
    nameResult.value = JSON.stringify(post, null, 2);
    nameStatus.value = "success";
  } catch (e) {
    nameResult.value = (e as Error).message;
    nameStatus.value = "error";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="scenario-header">
    <div class="scenario-title">07 — @REQUEST 명시</div>
    <div class="scenario-desc">
      경로 파라미터와 요청 바디가 함께 있을 때 <code>@McAxios.REQUEST("label", index)</code> 로 바디 인수를 명시합니다.<br />
      선언 스타일(<code>!</code>)에서는 <strong>인덱스(숫자)</strong>로, <code>dispatch()</code> 스타일에서는 <strong>파라미터 이름(문자열)</strong>로 지정할 수 있습니다.
    </div>
  </div>

  <div class="scenario-grid">
    <div class="panel">
      <div class="panel-header"><span class="dot"></span> 데코레이터 정의</div>
      <div class="panel-body">
        <div class="code-block">
          <pre><span class="cmt">// ① 선언 스타일 — 인덱스로 명시</span>
<span class="dec">@McAxios.PUT</span>(<span class="str">`${BASE}/posts/{id}`</span>, <span class="cls">PostEntity</span>)
<span class="dec">@McAxios.REQUEST</span>(<span class="str">"body"</span>, <span class="num">1</span>)  <span class="cmt">// arg 1 → 요청 바디</span>
<span class="fn">updatePost</span>!: (id: <span class="ty">string</span>, data: <span class="cls">UpdatePostRequest</span>) =&gt; <span class="ty">Promise</span>&lt;<span class="cls">PostEntity</span>&gt;;

<span class="cmt">// ② dispatch 스타일 — 파라미터 이름으로 명시</span>
<span class="dec">@McAxios.PUT</span>(<span class="str">`${BASE}/posts/{id}`</span>, <span class="cls">PostEntity</span>)
<span class="dec">@McAxios.REQUEST</span>(<span class="str">"body"</span>, <span class="str">"data"</span>)  <span class="cmt">// "data" 파라미터 → 요청 바디</span>
<span class="fn">updatePostByName</span>(_id: <span class="ty">string</span>, _data: <span class="cls">UpdatePostRequest</span>): <span class="ty">Promise</span>&lt;<span class="cls">PostEntity</span>&gt; {
  <span class="kw">return this</span>.<span class="fn">dispatch</span>();
}</pre>
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

        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="btn" :disabled="loading || !postId" @click="runByIndex">
            <span v-if="loading" class="spinner"></span>
            <span v-else>▶</span>
            ① 인덱스 (updatePost)
          </button>
          <button class="btn" :disabled="loading || !postId" @click="runByName" style="background: #2563eb;">
            <span v-if="loading" class="spinner"></span>
            <span v-else>▶</span>
            ② 이름 (updatePostByName)
          </button>
        </div>

        <template v-if="indexSent || indexResult">
          <div style="margin-top: 16px;">
            <div class="panel-header" style="border-radius: 6px 6px 0 0; margin: 0;">
              <span class="dot" style="background: var(--yellow);"></span> ① 전송된 JSON
            </div>
            <div class="result-box" style="border-radius: 0 0 6px 6px; border-top: none; margin-top: 0; color: var(--yellow);">{{ indexSent }}</div>
          </div>
          <div v-if="indexResult" style="margin-top: 8px;">
            <span :class="['status-badge', indexStatus]">
              {{ indexStatus === 'success' ? `✓ PUT /posts/${postId}` : '✕ Error' }}
            </span>
            <div :class="['result-box', indexStatus]">{{ indexResult }}</div>
          </div>
        </template>

        <template v-if="nameSent || nameResult">
          <div style="margin-top: 16px;">
            <div class="panel-header" style="border-radius: 6px 6px 0 0; margin: 0;">
              <span class="dot" style="background: var(--yellow);"></span> ② 전송된 JSON
            </div>
            <div class="result-box" style="border-radius: 0 0 6px 6px; border-top: none; margin-top: 0; color: var(--yellow);">{{ nameSent }}</div>
          </div>
          <div v-if="nameResult" style="margin-top: 8px;">
            <span :class="['status-badge', nameStatus]">
              {{ nameStatus === 'success' ? `✓ PUT /posts/${postId}` : '✕ Error' }}
            </span>
            <div :class="['result-box', nameStatus]">{{ nameResult }}</div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
