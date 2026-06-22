<script setup lang="ts">
import { ref } from "vue";
import { dispatchApi } from "../../api";

const postId = ref("3");
const loading = ref(false);

const defaultResult = ref<string>("");
const customResult = ref<string>("");
const handlerResult = ref<string>("");
const handlerLogs = ref<string[]>([]);

const defaultStatus = ref<"idle" | "success" | "error">("idle");
const customStatus = ref<"idle" | "success" | "error">("idle");
const handlerStatus = ref<"idle" | "success" | "error">("idle");

async function runDefault() {
  if (!postId.value) return;
  loading.value = true;
  defaultStatus.value = "idle";
  defaultResult.value = "";
  try {
    const post = await dispatchApi.getPostDefault(postId.value);
    defaultResult.value = JSON.stringify(post, null, 2);
    defaultStatus.value = "success";
  } catch (e) {
    defaultResult.value = (e as Error).message;
    defaultStatus.value = "error";
  } finally {
    loading.value = false;
  }
}

async function runCustom() {
  if (!postId.value) return;
  loading.value = true;
  customStatus.value = "idle";
  customResult.value = "";
  try {
    const post = await dispatchApi.getPostCustom(postId.value);
    customResult.value = JSON.stringify(post, null, 2);
    customStatus.value = "success";
  } catch (e) {
    customResult.value = (e as Error).message;
    customStatus.value = "error";
  } finally {
    loading.value = false;
  }
}

// biome-ignore lint/correctness/noUnusedVariables: used in Vue template
async function runWithHandler() {
  if (!postId.value) return;
  loading.value = true;
  handlerStatus.value = "idle";
  handlerResult.value = "";
  handlerLogs.value = [];
  dispatchApi.logs.length = 0;
  try {
    const post = await dispatchApi.getPostWithHandler(postId.value);
    handlerResult.value = JSON.stringify(post, null, 2);
    handlerStatus.value = "success";
  } catch (e) {
    handlerResult.value = (e as Error).message;
    handlerStatus.value = "error";
  } finally {
    loading.value = false;
    handlerLogs.value = [...dispatchApi.logs];
  }
}
</script>

<template>
  <div class="scenario-header">
    <div class="scenario-title">08 — 응답 직접 처리 (dispatch)</div>
    <div class="scenario-desc">
      메서드 바디에서 <code>return this.dispatch()</code> 로 기본 흐름을 실행하거나,<br />
      <code>dispatch(executor)</code> 로 <code>AxiosResponse</code>를 직접 처리해 <code>resolve / reject</code>를 제어할 수 있습니다.<br />
      executor가 resolve 한 값은 이후 <code>@SUCCESS_HANDLER</code> 체인으로 전달됩니다.
    </div>
  </div>

  <div class="scenario-grid">
    <div class="panel">
      <div class="panel-header"><span class="dot"></span> 데코레이터 정의</div>
      <div class="panel-body">
        <div class="code-block">
          <pre><span class="cmt">// ① dispatch() — 기본 동작 (field `!` 스타일과 동일)</span>
<span class="dec">@McAxios.GET</span>(<span class="str">`${BASE}/posts/{id}`</span>, <span class="cls">PostEntity</span>)
<span class="fn">getPostDefault</span>(_id: <span class="ty">string</span>): <span class="ty">Promise</span>&lt;<span class="cls">PostEntity</span>&gt; {
  <span class="kw">return this</span>.<span class="fn">dispatch</span>();
}

<span class="cmt">// ② dispatch(executor) — 응답을 직접 처리</span>
<span class="dec">@McAxios.GET</span>(<span class="str">`${BASE}/posts/{id}`</span>, <span class="cls">PostEntity</span>)
<span class="fn">getPostCustom</span>(_id: <span class="ty">string</span>): <span class="ty">Promise</span>&lt;<span class="cls">PostEntity</span>&gt; {
  <span class="kw">return this</span>.<span class="fn">dispatch</span>&lt;<span class="cls">PostEntity</span>&gt;((response, resolve, reject) =&gt; {
    response.data?.id
      ? <span class="fn">resolve</span>(response.data <span class="kw">as</span> <span class="cls">PostEntity</span>)
      : <span class="fn">reject</span>(<span class="kw">new</span> <span class="cls">Error</span>(<span class="str">"응답 데이터가 비어 있습니다."</span>));
  });
}

<span class="cmt">// ③ dispatch(executor) + @SUCCESS_HANDLER 체인</span>
<span class="dec">@McAxios.GET</span>(<span class="str">`${BASE}/posts/{id}`</span>, <span class="cls">PostEntity</span>)
<span class="dec">@McAxios.SUCCESS</span>(ON_DISPATCH_SUCCESS)
<span class="fn">getPostWithHandler</span>(_id: <span class="ty">string</span>): <span class="ty">Promise</span>&lt;<span class="cls">PostEntity</span>&gt; {
  <span class="kw">return this</span>.<span class="fn">dispatch</span>&lt;<span class="cls">PostEntity</span>&gt;((response, resolve, reject) =&gt; {
    response.data?.id
      ? <span class="fn">resolve</span>(response.data <span class="kw">as</span> <span class="cls">PostEntity</span>)
      : <span class="fn">reject</span>(<span class="kw">new</span> <span class="cls">Error</span>(<span class="str">"응답 데이터가 비어 있습니다."</span>));
  });
}

<span class="cmt">// executor 가 resolve 한 값이 핸들러로 전달됨</span>
<span class="dec">@McAxios.SUCCESS_HANDLER</span>(ON_DISPATCH_SUCCESS)
<span class="fn">onDispatchSuccess</span>(result: <span class="ty">unknown</span>): <span class="ty">unknown</span> {
  <span class="kw">const</span> post = result <span class="kw">as</span> <span class="cls">PostEntity</span>;
  <span class="kw">this</span>.logs.<span class="fn">push</span>(<span class="str">`✅ 핸들러 수행 — title: "${post.title}"`</span>);
  <span class="kw">return</span> result;
}</pre>
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

        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="btn" :disabled="loading || !postId" @click="runDefault">
            <span v-if="loading" class="spinner"></span>
            <span v-else>▶</span>
            ① dispatch() 기본
          </button>
          <button class="btn" :disabled="loading || !postId" @click="runCustom" style="background: #2563eb;">
            <span v-if="loading" class="spinner"></span>
            <span v-else>▶</span>
            ② dispatch(executor)
          </button>
          <button class="btn" :disabled="loading || !postId" @click="runWithHandler" style="background: #7c3aed;">
            <span v-if="loading" class="spinner"></span>
            <span v-else>▶</span>
            ③ executor + 핸들러
          </button>
        </div>

        <div v-if="defaultResult" style="margin-top: 16px;">
          <span :class="['status-badge', defaultStatus]">
            {{ defaultStatus === 'success' ? '① 기본 흐름' : '✕ Error' }}
          </span>
          <div :class="['result-box', defaultStatus]">{{ defaultResult }}</div>
        </div>

        <div v-if="customResult" style="margin-top: 12px;">
          <span :class="['status-badge', customStatus]">
            {{ customStatus === 'success' ? '② executor 직접 처리' : '✕ Error' }}
          </span>
          <div :class="['result-box', customStatus]">{{ customResult }}</div>
        </div>

        <div v-if="handlerLogs.length || handlerResult" style="margin-top: 12px;">
          <div v-if="handlerLogs.length" style="margin-bottom: 8px;">
            <div style="font-size: 12px; color: var(--text-dim); margin-bottom: 6px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em;">
              핸들러 실행 로그
            </div>
            <ul class="log-list">
              <li v-for="(log, i) in handlerLogs" :key="i" class="ok">{{ log }}</li>
            </ul>
          </div>
          <span v-if="handlerResult" :class="['status-badge', handlerStatus]">
            {{ handlerStatus === 'success' ? '③ executor + 핸들러 체인' : '✕ Error' }}
          </span>
          <div v-if="handlerResult" :class="['result-box', handlerStatus]">{{ handlerResult }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
