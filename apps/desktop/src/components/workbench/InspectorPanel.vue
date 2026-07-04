<script setup lang="ts">
import { CheckCircle2 } from "lucide-vue-next";
import type { InspectorTab } from "@/types/workbench";

defineProps<{
  tab: InspectorTab;
}>();

const emit = defineEmits<{
  "update:tab": [tab: InspectorTab];
}>();
</script>

<template>
  <aside class="inspector" aria-label="检查器">
    <div class="insp-head">
      <button :class="['insp-tab', tab === 'result' ? 'active' : '']" type="button" @click="emit('update:tab', 'result')">结果</button>
      <button :class="['insp-tab', tab === 'source' ? 'active' : '']" type="button" @click="emit('update:tab', 'source')">依据</button>
      <button :class="['insp-tab', tab === 'context' ? 'active' : '']" type="button" @click="emit('update:tab', 'context')">上下文</button>
    </div>

    <div class="insp-body">
      <section v-if="tab === 'result'">
        <div class="panel-title-line">
          <CheckCircle2 class="tiny-icon accent" />
          <strong>校审结果</strong>
          <span class="badge high">3 高风险</span>
        </div>
        <article class="issue high">
          <div><span class="badge high">高风险</span><span class="loc">P12 / 表 3-1</span></div>
          <h3>主变容量前后不一致</h3>
          <p>正文写作 2x180MVA，设备参数表写作 2x240MVA。建议确认设计输入后统一。</p>
          <blockquote>建议：将第 3.2 节容量描述与表 3-1 统一，并在修订说明中记录依据来源。</blockquote>
        </article>
        <article class="issue high">
          <div><span class="badge high">高风险</span><span class="loc">P26 / 图 A-02</span></div>
          <h3>接线方式与图纸标注冲突</h3>
          <p>说明书为单母线分段，图签识别结果为双母线接线，需要人工确认。</p>
        </article>
        <article class="issue">
          <div><span class="badge mid">需确认</span><span class="loc">全文 8 处</span></div>
          <h3>术语写法不一致</h3>
          <p>“站用变”和“所用变”混用。项目术语库建议使用“站用变”。</p>
        </article>
      </section>

      <section v-else-if="tab === 'source'">
        <div class="ctx-card">
          <span>引用依据</span>
          <strong>GB 50059-2011</strong>
          <p>35kV-110kV 变电站设计规范 / 第 3.1.2 条</p>
        </div>
        <div class="ctx-card">
          <span>企业资料</span>
          <strong>220kV 变电站典型设计</strong>
          <p>2024 版 / 主接线与设备配置章节</p>
        </div>
        <div class="ctx-card">
          <span>项目术语库</span>
          <strong>变电一次专业术语表</strong>
          <p>命中 12 条 / 发现 8 处不一致</p>
        </div>
      </section>

      <section v-else>
        <div class="ctx-card">
          <span>当前模型</span>
          <strong>企业内网模型 / 文档校审 Agent</strong>
          <p>外部 API 调用：关闭</p>
        </div>
        <div class="ctx-card">
          <span>任务工作区</span>
          <strong>只读原文件 + 副本处理</strong>
          <p>原文件不会被覆盖，导出需要人工确认。</p>
        </div>
        <div class="ctx-card">
          <span>上下文占用</span>
          <strong>42,800 / 200k token</strong>
          <div class="token-bar"><span /></div>
          <p>21% / 剩余约 157k</p>
        </div>
        <div class="ctx-card">
          <span>工具调用</span>
          <strong>9 次</strong>
          <p>docx.parse 1 / rag.search 4 / word.review 3 / file.export 1</p>
        </div>
      </section>
    </div>
  </aside>
</template>
