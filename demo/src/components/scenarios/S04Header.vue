<script setup lang="ts">
import { ref } from "vue";
import { api } from "../../api";

const userId = ref("1");
const token = ref("my-secret-token-1234");
const loading = ref(false);
const result = ref<string>("");
const status = ref<"idle" | "success" | "error">("idle");

async function run() {
  if (!userId.value) return;
  loading.value = true;
  status.value = "idle";
  result.value = "";
  try {
    const user = await api.getUser(userId.value, token.value);
    result.value = JSON.stringify(user, null, 2);
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
    <div class="scenario-title">04 — HEADER</div>
    <div class="scenario-desc">
      <code>@McAxios.HEADER("헤더명", index)</code> 으로 메서드 인자를 HTTP 요청 헤더에 주입합니다.<br />
      선언 스타일에서는 인덱스(숫자)로 직접 지정하고, 함수 body 스타일에서는 파라미터 이름(문자열)도 사용 가능합니다.
    </div>
  </div>

  <div class="scenario-grid">
    <div class="panel">
      <div class="panel-header"><span class="dot"></span> 데코레이터 정의</div>
      <div class="panel-body">
        <div class="code-block">
          <pre><span class="dec">@McAxios.GET</span>(<span class="str">`${BASE}/users/{id}`</span>, <span class="cls">UserEntity</span>)
<span class="dec">@McAxios.HEADER</span>(<span class="str">"X-Custom-Token"</span>, <span class="num">1</span>)  <span class="cmt">// arg 1을 헤더로 주입</span>
<span class="fn">getUser</span>!: (id: <span class="ty">string</span>, token: <span class="ty">string</span>) =&gt; <span class="ty">Promise</span>&lt;<span class="cls">UserEntity</span>&gt;;

<span class="cmt">// 호출 예:</span>
<span class="cmt">// getUser("1", "my-secret-token")</span>
<span class="cmt">// → GET /users/1</span>
<span class="cmt">// → Headers: { X-Custom-Token: "my-secret-token" }</span></pre>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header"><span class="dot"></span> 실행</div>
      <div class="panel-body">
        <div class="form-group">
          <label>User ID (1 ~ 10)</label>
          <input v-model="userId" type="number" min="1" max="10" />
        </div>
        <div class="form-group">
          <label>X-Custom-Token 헤더 값</label>
          <input v-model="token" type="text" placeholder="토큰 값" />
        </div>

        <p style="font-size: 12px; color: var(--text-dim); margin-bottom: 14px;">
          💡 브라우저 DevTools → Network 탭에서 <code>X-Custom-Token</code> 헤더를 확인하세요.
        </p>

        <button class="btn" :disabled="loading || !userId" @click="run">
          <span v-if="loading" class="spinner"></span>
          <span v-else>▶</span>
          {{ loading ? "요청 중..." : "getUser() 실행" }}
        </button>

        <div v-if="result" style="margin-top: 16px;">
          <span :class="['status-badge', status]">
            {{ status === 'success' ? '✓ UserEntity' : '✕ Error' }}
          </span>
          <div :class="['result-box', status]">{{ result }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
