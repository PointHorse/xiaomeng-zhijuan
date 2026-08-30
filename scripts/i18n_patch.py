# -*- coding: utf-8 -*-
"""i18n 接入补丁：EditorPane / WorldTreeView / SettingsView / App / persist(语言持久化)"""
import io

def patch(path, pairs, must=True):
    d = io.open(path, encoding='utf-8').read()
    ok = 0
    for old, new in pairs:
        if old in d:
            d = d.replace(old, new)
            ok += 1
        elif must:
            print(f'  [MISS] {path}: {old[:50]!r}')
    io.open(path, 'w', encoding='utf-8').write(d)
    print(f'{path}: {ok}/{len(pairs)} 处替换')

# ---- EditorPane ----
patch('src/editor/EditorPane.tsx', [
    ("import { useGenerate } from './useGenerate';",
     "import { useGenerate } from './useGenerate';\nimport { useT } from '../i18n/useI18n';"),
    ("  const revertRed = useStore((s) => s.revertRed);",
     "  const revertRed = useStore((s) => s.revertRed);\n  const t = useT();"),
    ('placeholder="在这里写下或粘贴故事开头… 按 Ctrl+Enter 生成续写"',
     'placeholder={t((d) => d.inputPlaceholder)}'),
    ('              ✒ 写下这段并续写\n', '              {t((d) => d.writeAndContinue)}\n'),
    ('                记忆截断：仅使用最近 {settings.contextWindow} 字作为上下文',
     '                {t((d) => d.memoryTruncated, { n: settings.contextWindow })}'),
    ('              <UndoIcon /> 撤回\n', '              <UndoIcon /> {t((d) => d.undoRed)}\n'),
    ('              <EditIcon /> 修改\n', '              <EditIcon /> {t((d) => d.editRed)}\n'),
    ('              <CheckIcon /> 继续\n', '              <CheckIcon /> {t((d) => d.continueGen)}\n'),
    ('                <CheckIcon /> 确认\n', '                <CheckIcon /> {t((d) => d.confirm)}\n'),
    ('                取消\n', '                {t((d) => d.cancelAction)}\n'),
    ('          ⚠ 生成失败：{gen.errorMessage}\n', '          ⚠ {t((d) => d.genFailed)}：{gen.errorMessage}\n'),
    ('              重试\n', '              {t((d) => d.retry)}\n'),
    ('          本轮共 {candidates.length} 条候选，可在右侧切换\n',
     '          {t((d) => d.candidatesInRound, { n: candidates.length })}\n'),
], must=False)

# ---- WorldTreeView ----
patch('src/worldtree/WorldTreeView.tsx', [
    ("import { TreeIcon } from '../components/Icons';",
     "import { TreeIcon } from '../components/Icons';\nimport { useT } from '../i18n/useI18n';"),
    ("  const setView = useStore((s) => s.setView);",
     "  const setView = useStore((s) => s.setView);\n  const t = useT();"),
    ("      <h2>平行世界树</h2>", "      <h2>{t((d) => d.worldTreeTitle)}</h2>"),
    ("        点击任意节点穿越回该时间线继续创作；原分支完整保留。\n        <button",
     "        {t((d) => d.worldTreeSub)}\n        <button"),
    ("          返回正文\n", "          {t((d) => d.backToEditor)}\n"),
    ('            <span>{r.isCurrent ? \'⬤ 当前\' : r.source === \'user\' ? \'用户\' : \'AI 续写\'}</span>',
     '            <span>{r.isCurrent ? `⬤ ${t((d) => d.nodeCurrent)}` : r.source === \'user\' ? t((d) => d.nodeUser) : t((d) => d.nodeAi)}</span>'),
    ('              <span className="wt-branch-tag">分叉 · {r.candidateCount} 条候选</span>',
     '              <span className="wt-branch-tag">{t((d) => d.branchTag, { n: r.candidateCount })}</span>'),
    ("          title=\"点击穿越到此节点\"", "          title={t((d) => d.clickTravel)}"),
    ("          <TreeIcon /> 暂无节点\n", "          <TreeIcon /> {t((d) => d.emptyTree)}\n"),
], must=False)

# ---- SettingsView：语言切换 + 文案 ----
patch('src/settings/SettingsView.tsx', [
    ("import { invoke } from '@tauri-apps/api/core';",
     "import { invoke } from '@tauri-apps/api/core';\nimport { useI18n } from '../i18n/useI18n';"),
    ("  const setView = useStore((s) => s.setView);",
     "  const setView = useStore((s) => s.setView);\n  const lang = useI18n((s) => s.lang);\n  const setLang = useI18n((s) => s.setLang);\n  const t = useT();"),
    ('import { useT } from', 'import { useT } from'),
    ("      <h2>设置</h2>", "      <h2>{t((d) => d.settingsTitle)}</h2>"),
    ("      <div className=\"page-sub\">全部数据仅保存在本机；API Key 经 Windows DPAPI 加密存储。</div>",
     "      <div className=\"page-sub\">{t((d) => d.settingsSub)}</div>"),
    ("        <h3>模型服务</h3>", "        <h3>{t((d) => d.sectionModel)}</h3>"),
    ("          <label>Base URL</label>", "          <label>{t((d) => d.baseUrl)}</label>"),
    ("            placeholder=\"http://127.0.0.1:8080/v1\"", "            placeholder=\"http://127.0.0.1:8080/v1\""),
    ("          <label>API Key</label>", "          <label>{t((d) => d.apiKey)}</label>"),
    ("            placeholder=\"本地服务可留空\"", "            placeholder={t((d) => d.apiKeyPlaceholder)}"),
    ("          <label>模型名</label>", "          <label>{t((d) => d.model)}</label>"),
    ("            placeholder=\"留空或填 mock 试用演示模式\"", "            placeholder={t((d) => d.modelPlaceholder)}"),
    ("            {probing ? '测试中…' : '测试连接'}", "            {probing ? t((d) => d.testing) : t((d) => d.testConn)}"),
    ("            自动探测本地服务\n", "            {t((d) => d.autoDetect)}\n"),
    ("              {probe.ok\n                ? `连接成功 · ${probe.latencyMs}ms · ${probe.models.length} 个模型`\n                : `失败：${probe.error ?? '未知'}`}",
     "              {probe.ok\n                ? t((d) => d.connOk, { ms: probe.latencyMs, n: probe.models.length })\n                : t((d) => d.connFail, { e: probe.error ?? 'unknown' })}"),
    ("        <h3>生成参数</h3>", "        <h3>{t((d) => d.sectionGen)}</h3>"),
    ("              {GEN_PRESET_LABELS[k]}", "              {t((d) => d[`preset${k[0].toUpperCase()}${k.slice(1)}` as keyof typeof d])}"),
    ("          <label>温度</label>", "          <label>{t((d) => d.temperature)}</label>"),
    ("          <label>Top P</label>", "          <label>{t((d) => d.topP)}</label>"),
    ("          <label>最大生成长度</label>", "          <label>{t((d) => d.maxTokens)}</label>"),
    ("          <label>记忆窗口（字）</label>", "          <label>{t((d) => d.contextWindow)}</label>"),
    ("        <h3>外观</h3>", "        <h3>{t((d) => d.sectionAppearance)}</h3>"),
    ("          <label>主题</label>", "          <label>{t((d) => d.theme)}</label>"),
    ("            <option value=\"system\">跟随系统</option>\n            <option value=\"light\">浅色</option>\n            <option value=\"dark\">深色</option>",
     "            <option value=\"system\">{t((d) => d.themeSystem)}</option>\n            <option value=\"light\">{t((d) => d.themeLight)}</option>\n            <option value=\"dark\">{t((d) => d.themeDark)}</option>"),
    ("          <label>字号</label>", "          <label>{t((d) => d.fontSize)}</label>"),
    ("          <label>行距</label>", "          <label>{t((d) => d.lineHeight)}</label>"),
    ("      <button className=\"pill-btn\" onClick={() => setView('editor')}>\n        返回正文\n      </button>",
     "      <button className=\"pill-btn\" onClick={() => setView('editor')}>\n        {t((d) => d.back)}\n      </button>"),
], must=False)

# 语言切换区块（插在外观 section 之前）
d = io.open('src/settings/SettingsView.tsx', encoding='utf-8').read()
if "sectionLang" not in d:
    lang_block = """      {/* 语言 */}
      <section className="settings-section">
        <h3>{t((d) => d.sectionLang)}</h3>
        <div className="field-row">
          <label>{t((d) => d.language)}</label>
          <select value={lang} onChange={(e) => setLang(e.target.value as 'zh' | 'en')}>
            <option value="zh">{t((d) => d.langZh)}</option>
            <option value="en">{t((d) => d.langEn)}</option>
          </select>
        </div>
      </section>

      {/* 外观 */}"""
    d = d.replace("      {/* 外观 */}", lang_block)
    io.open('src/settings/SettingsView.tsx', 'w', encoding='utf-8').write(d)
    print('SettingsView: 语言切换区块已插入')

# SettingsView 里 useT 缺 import
d = io.open('src/settings/SettingsView.tsx', encoding='utf-8').read()
if "import { useT }" not in d:
    d = d.replace("import { useI18n } from '../i18n/useI18n';",
                  "import { useI18n, useT } from '../i18n/useI18n';")
    io.open('src/settings/SettingsView.tsx', 'w', encoding='utf-8').write(d)
    print('SettingsView: useT import 已补')

print('补丁完成')
