# Bilingual Course Study Skill

面向持续课程学习的 Codex Skill。它先完整解析 PDF、PPTX 或 DOCX 课件并建立来源覆盖，再按用户确认的语言与交付范围生成可追溯的知识点 Word、期末总复习，或依据课件辅助作业。

## 主要能力

- 先解析课件，再确认是否生成单课件资料、是否更新期末复习、目标语言和保存位置。
- 为每个章节、知识点和解释保留课件原文与目标语言对照；同语言时只写一次。
- 每个知识点原则上提供一个使用目标语言的通俗例子。
- 模型依据课件上下文自主选择段落版或表格版，不机械套用表格。
- 对 PDF 和 PPTX 建立逐页覆盖清单，防止图片页、空文本页和后半段内容被静默遗漏。
- 支持分层缓存，课件未变化时减少重复读取；引用、公式、代码和图意仍会回查原文件。
- 内置段落版与表格版 DOCX 模板；代码和公式使用浅灰底、蓝色左边线的醒目块样式。
- 多模态模型直接理解课件图片；不能看图时可使用可选 OCR 脚本。

## 仓库结构

```text
SKILL.md
assets/
  course-notes-template.docx
  course-study-table-template.docx
references/
  assignment-workflow.md
  cache.md
  course-workflow.md
  ocr.md
  table-template.md
  word-template.md
scripts/
  ocr-image.mjs
  prepare-notes-docx.mjs
  validate-course-cache.mjs
  validate-source-coverage.mjs
```

`SKILL.md` 是入口；详细流程按任务从 `references/` 渐进加载。`assets/` 中的 DOCX 是生成资料时必须复制的模板，`scripts/` 提供模板准备、来源覆盖校验、缓存校验和可选 OCR。

## 安装

将整个仓库目录复制或克隆为技能目录：

- Codex 个人技能：`~/.codex/skills/bilingual-course-study`
- 项目内技能：`<项目目录>/.agents/skills/bilingual-course-study`

仓库根目录必须直接包含 `SKILL.md`。如果需要使用 OCR，在仓库根目录运行：

```bash
npm install
```

OCR 使用 Tesseract.js；首次识别某种语言时会尝试获取对应语言数据，也可以通过 `--lang-path` 指向本地语言数据目录。其余校验和模板复制脚本只使用 Node.js 内置模块。

## 使用

在 Codex 中明确调用：

```text
$bilingual-course-study
```

然后上传课件或提供课程文件夹路径。Skill 会先只读解析，再集中确认尚未给出的交付需求，确认后才生成或更新资料。

示例请求：

```text
请解析这份课件，目标语言为中文；生成本课件知识点解析，并同时更新期末总复习。
```

```text
这是作业。请优先依据已经上传的课件逐题回答，并生成答案解析 Word。
```

## 本地检查

```bash
npm run validate
node scripts/prepare-notes-docx.mjs --help
node scripts/validate-source-coverage.mjs --help
node scripts/validate-course-cache.mjs --help
node scripts/ocr-image.mjs --help
```

`MANIFEST-SHA256.txt` 记录发布包内文件的 SHA-256，可用于上传前或下载后的完整性核对。

## 隐私与发布注意事项

- 不要把学生姓名、学号、课程账号、聊天附件路径或真实课件一起提交到此仓库。
- 课件、作业、生成资料与 OCR 缓存应保存在仓库之外；`.gitignore` 已排除常见本地目录。
- 模板已移除参考课程正文和个人元数据，但公开发布前仍建议查看最终 Git 变更列表。

## 许可证

本发布包暂未附带开源许可证。上传到公开 GitHub 仓库前，请由仓库所有者选择并添加合适的 `LICENSE`；在此之前默认不授予复制、修改或再分发许可。

