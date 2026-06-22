<script setup lang="ts">
import { ref } from "vue";
import { api, CreatePostRequest } from "../../api";

const title = ref("데모 포스트 제목");
const body = ref("axios-kit-ts @REQUEST 데코레이터로 전송된 본문입니다.");
const userId = ref(1);
const loading = ref(false);
const result = ref<string>("");
const sent = ref<string>("");
const status = ref<"idle" | "success" | "error">("idle");

async function run() {
  loading.value = true;
  status.value = "idle";
  result.value = "";
  const req = new CreatePostRequest(title.value, body.value, userId.value);
  sent.value = JSON.stringify(req.toJson(), null, 2);
  try {
    const post = await api.createPost(req);
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
    <div class="scenario-title">03 — POST + REQUEST</div>
    <div class="scenario-desc">
      <code>@McAxios.POST</code> 만으로 동작합니다. <code>McRequest</code> 서브클래스 인자는 자동으로 감지되어<br />
      <code>toJson()</code> 결과가 요청 바디로 전송됩니다. 별도의 <code>@McAxios.REQUEST</code> 데코레이터가 필요 없습니다.
    </div>
  </div>

  <div class="scenario-grid">
    <div class="panel">
      <div class="panel-header"><span class="dot"></span> 데코레이터 정의</div>
      <div class="panel-body">
        <div class="code-block">
          <pre><span class="cmt">// requests/CreatePostRequest.ts</span>
<span class="kw">class</span> <span class="cls">CreatePostRequest</span> <span class="kw">extends</span> <span class="cls">McAxios.Request</span> {
  <span class="dec">@McEntity.SERIALIZE</span> title!: <span class="ty">string</span>;
  <span class="dec">@McEntity.SERIALIZE</span> body!: <span class="ty">string</span>;
  <span class="dec">@McEntity.SERIALIZE</span> userId!: <span class="ty">number</span>;
}

<span class="cmt">// api.ts</span>
<span class="dec">@McAxios.POST</span>(<span class="str">`${BASE}/posts`</span>, <span class="cls">PostEntity</span>)
<span class="fn">createPost</span>!: (req: <span class="cls">CreatePostRequest</span>) =&gt; <span class="ty">Promise</span>&lt;<span class="cls">PostEntity</span>&gt;;

<span class="cmt">// McRequest 서브클래스는 instanceof로 호출 시 자동 감지</span>
<span class="cmt">// → req.toJson() 결과가 요청 바디로 전송됨</span></pre>
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header"><span class="dot"></span> 실행</div>
      <div class="panel-body">
        <div class="form-group">
          <label>title</label>
          <input v-model="title" type="text" placeholder="포스트 제목" />
        </div>
        <div class="form-group">
          <label>body</label>
          <textarea v-model="body" placeholder="포스트 본문"></textarea>
        </div>
        <div class="form-group">
          <label>userId</label>
          <input v-model.number="userId" type="number" min="1" max="10" />
        </div>

        <button class="btn" :disabled="loading" @click="run">
          <span v-if="loading" class="spinner"></span>
          <span v-else>▶</span>
          {{ loading ? "요청 중..." : "createPost(req) 실행" }}
        </button>

        <div v-if="sent" style="margin-top: 16px;">
          <div class="panel-header" style="border-radius: 6px 6px 0 0; margin: 0;">
            <span class="dot" style="background: var(--yellow);"></span> 전송된 JSON (req.toJson())
          </div>
          <div class="result-box" style="border-radius: 0 0 6px 6px; border-top: none; margin-top: 0; color: var(--yellow);">{{ sent }}</div>
        </div>

        <div v-if="result" style="margin-top: 12px;">
          <span :class="['status-badge', status]">
            {{ status === 'success' ? '✓ PostEntity (id: 101)' : '✕ Error' }}
          </span>
          <div :class="['result-box', status]">{{ result }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
