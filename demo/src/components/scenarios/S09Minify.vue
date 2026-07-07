<script setup lang="ts">
import { ref } from "vue";
import { api } from "../../api";

const postId = ref("1");
const loading = ref(false);

const unsafeResult = ref<string>("");
const unsafeStatus = ref<"idle" | "success" | "error">("idle");
const safeResult = ref<string>("");
const safeStatus = ref<"idle" | "success" | "error">("idle");

// biome-ignore lint/correctness/noUnusedVariables: used in Vue template
async function runUnsafe() {
  if (!postId.value) return;
  loading.value = true;
  unsafeStatus.value = "idle";
  unsafeResult.value = "";
  try {
    const post = await api.getPostMangledUnsafe(postId.value);
    unsafeResult.value = JSON.stringify(post, null, 2);
    unsafeStatus.value = "success";
  } catch (e) {
    unsafeResult.value = (e as Error).message;
    unsafeStatus.value = "error";
  } finally {
    loading.value = false;
  }
}

// biome-ignore lint/correctness/noUnusedVariables: used in Vue template
async function runSafe() {
  if (!postId.value) return;
  loading.value = true;
  safeStatus.value = "idle";
  safeResult.value = "";
  try {
    const post = await api.getPostMangledSafe(postId.value);
    safeResult.value = JSON.stringify(post, null, 2);
    safeStatus.value = "success";
  } catch (e) {
    safeResult.value = (e as Error).message;
    safeStatus.value = "error";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="scenario-header">
    <div class="scenario-title">09 — params (minify 안전성)</div>
    <div class="scenario-desc">
      <code>params</code> 를 생략하면 <code>{id}</code> 매핑은 <code>fn.toString()</code> 으로 실제 인자 이름을 읽어서 동작합니다.<br />
      프로덕션 빌드에서 minifier(terser/esbuild/SWC 등)가 인자 이름을 <code>id</code> → <code>a</code> 처럼 바꿔버리면 이 매핑이 조용히 깨집니다.<br />
      아래 두 메서드는 실제로 인자 이름을 <code>a</code>로 선언해 "minify 된 것처럼" 흉내낸 상태입니다 — 실제 프로덕션 빌드를 만들지 않고도 문제를 그대로 재현합니다.
    </div>
  </div>

  <div class="scenario-grid">
    <div class="panel">
      <div class="panel-header"><span class="dot" style="background: var(--red);"></span> ① params 생략 — 위험</div>
      <div class="panel-body">
        <div class="code-block">
          <pre><span class="dec">@McAxios.GET</span>(<span class="str">`${BASE}/posts/{id}`</span>, <span class="cls">PostEntity</span>)
<span class="fn">getPostMangledUnsafe</span>(a: <span class="ty">string</span>): <span class="ty">Promise</span>&lt;<span class="cls">PostEntity</span>&gt; {
  <span class="kw">return this</span>.<span class="fn">dispatch</span>();
}

<span class="cmt">// 리플렉션이 읽는 이름은 "a" → {id} 와 매칭 실패</span>
<span class="cmt">// → URL이 .../posts/{id} 그대로 나가서 요청 실패</span></pre>
        </div>

        <div class="form-group" style="margin-top: 14px;">
          <label>Post ID (1 ~ 100)</label>
          <input v-model="postId" type="number" min="1" max="100" />
        </div>
        <button class="btn" :disabled="loading || !postId" @click="runUnsafe" style="background: #dc2626;">
          <span v-if="loading" class="spinner"></span>
          <span v-else>▶</span>
          getPostMangledUnsafe() 실행
        </button>

        <div v-if="unsafeResult" style="margin-top: 16px;">
          <span :class="['status-badge', unsafeStatus]">
            {{ unsafeStatus === 'success' ? '✓ 성공 (예상치 못한 결과일 수 있음)' : '✕ Error — {id} 매핑 실패로 요청 깨짐' }}
          </span>
          <div :class="['result-box', unsafeStatus]">{{ unsafeResult }}</div>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header"><span class="dot" style="background: var(--green);"></span> ② params 명시 — 안전</div>
      <div class="panel-body">
        <div class="code-block">
          <pre><span class="dec">@McAxios.GET</span>(<span class="str">`${BASE}/posts/{id}`</span>, <span class="cls">PostEntity</span>, <span class="str">["id"]</span>)
<span class="fn">getPostMangledSafe</span>(a: <span class="ty">string</span>): <span class="ty">Promise</span>&lt;<span class="cls">PostEntity</span>&gt; {
  <span class="kw">return this</span>.<span class="fn">dispatch</span>();
}

<span class="cmt">// params 가 "id" → arg 0 을 명시적으로 고정</span>
<span class="cmt">// 인자 이름이 무엇이든(mangling 여부와 무관) 항상 정확히 매핑</span></pre>
        </div>

        <p style="font-size: 12px; color: var(--text-dim); margin-top: 14px;">
          같은 Post ID 입력값을 사용합니다. (좌측 입력값 공유)
        </p>
        <button class="btn" :disabled="loading || !postId" @click="runSafe" style="background: #16a34a; margin-top: 8px;">
          <span v-if="loading" class="spinner"></span>
          <span v-else>▶</span>
          getPostMangledSafe() 실행
        </button>

        <div v-if="safeResult" style="margin-top: 16px;">
          <span :class="['status-badge', safeStatus]">
            {{ safeStatus === 'success' ? `✓ GET /posts/${postId}` : '✕ Error' }}
          </span>
          <div :class="['result-box', safeStatus]">{{ safeResult }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
