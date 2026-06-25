<script setup lang="ts">
import { ref } from "vue";
import { handlerApi } from "../../api";

const postId = ref("1");
const loading = ref(false);
const result = ref<string>("");
const logs = ref<string[]>([]);
const status = ref<"idle" | "success" | "error">("idle");

async function run() {
	if (!postId.value) return;
	loading.value = true;
	status.value = "idle";
	result.value = "";
	handlerApi.logs.length = 0;
	try {
		const post = await handlerApi.getPost(postId.value);
		result.value = JSON.stringify(post, null, 2);
		status.value = "success";
	} catch (e) {
		result.value = (e as Error).message;
		status.value = "error";
	} finally {
		loading.value = false;
		logs.value = [...handlerApi.logs];
	}
}
</script>

<template>
  <div class="scenario-header">
    <div class="scenario-title">05 — SUCCESS / ERROR 핸들러</div>
    <div class="scenario-desc">
      <code>@McAxios.SUCCESS(sym)</code> / <code>@McAxios.ERROR(sym)</code> 로 응답 핸들러를 지정하고,<br />
      <code>@McAxios.SUCCESS_HANDLER(sym)</code> / <code>@McAxios.ERROR_HANDLER(sym)</code> 로 같은 클래스 내 메서드를 핸들러로 등록합니다.
    </div>
  </div>

  <div class="scenario-grid">
    <div class="panel">
      <div class="panel-header"><span class="dot"></span> 데코레이터 정의</div>
      <div class="panel-body">
        <div class="code-block">
          <pre><span class="kw">const</span> ON_SUCCESS = <span class="cls">Symbol</span>(<span class="str">"onSuccess"</span>);
<span class="kw">const</span> ON_ERROR   = <span class="cls">Symbol</span>(<span class="str">"onError"</span>);

<span class="kw">class</span> <span class="cls">HandlerDemoApi</span> <span class="kw">extends</span> <span class="cls">McAxios</span> {
  <span class="dec">@McAxios.GET</span>(<span class="str">`${BASE}/posts/{id}`</span>, <span class="cls">PostEntity</span>)
  <span class="dec">@McAxios.SUCCESS</span>(ON_SUCCESS)
  <span class="dec">@McAxios.ERROR</span>(ON_ERROR)
  <span class="fn">getPost</span>(id: <span class="ty">string</span>): <span class="ty">Promise</span>&lt;<span class="cls">PostEntity</span>&gt; { ... }

  <span class="dec">@McAxios.SUCCESS_HANDLER</span>(ON_SUCCESS)
  <span class="fn">onSuccess</span>(response: <span class="ty">unknown</span>): <span class="ty">unknown</span> {
    <span class="kw">this</span>.logs.<span class="fn">push</span>(<span class="str">`✅ Post #${r.id}`</span>);
    <span class="kw">return</span> response; <span class="cmt">// 그대로 통과</span>
  }

  <span class="dec">@McAxios.ERROR_HANDLER</span>(ON_ERROR)
  <span class="fn">onError</span>(err: <span class="ty">unknown</span>): <span class="ty">undefined</span> {
    <span class="kw">this</span>.logs.<span class="fn">push</span>(<span class="str">`❌ ${err.message}`</span>);
    <span class="kw">return undefined</span>; <span class="cmt">// 에러 재전파</span>
  }
}</pre>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header"><span class="dot"></span> 실행</div>
      <div class="panel-body">
        <div class="form-group">
          <label>Post ID — 유효한 값(1~100)은 SUCCESS, 그 외는 ERROR 핸들러가 실행됩니다</label>
          <input v-model="postId" type="text" placeholder="1 ~ 100 또는 9999 (에러 유도)" />
        </div>

        <button class="btn" :disabled="loading || !postId" @click="run">
          <span v-if="loading" class="spinner"></span>
          <span v-else>▶</span>
          {{ loading ? "요청 중..." : "getPost() 실행" }}
        </button>

        <div v-if="logs.length" style="margin-top: 16px;">
          <div style="font-size: 12px; color: var(--text-dim); margin-bottom: 8px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em;">
            핸들러 실행 로그
          </div>
          <ul class="log-list">
            <li v-for="(log, i) in logs" :key="i" :class="log.startsWith('✅') ? 'ok' : 'err'">
              {{ log }}
            </li>
          </ul>
        </div>

        <div v-if="result" style="margin-top: 12px;">
          <span :class="['status-badge', status]">
            {{ status === 'success' ? '✓ PostEntity' : '✕ 에러 재전파됨' }}
          </span>
          <div :class="['result-box', status]">{{ result }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
