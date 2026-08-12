# 🔬 GEMINI RESEARCH PROMPT: Комплексний аудит та використання вбудованих компонентів Astryx Framework (@astryxdesign/core v0.3.0)

> **Документ:** `docs/for-agents/prompts/gemini-research-astryx-framework-components.md`  
> **Пакет:** `@astryxdesign/core` (`web/node_modules/@astryxdesign/core/dist/`)  
> **Ціль:** Повний аудит та заміна саморобних UI-компонентів у `web/src/` на нативні рішення Astryx  

---

## 🎯 1. РОЛЬ ТА КОНТЕКСТ ЗАВДАННЯ

Ти — головний фронтенд-архітектор фреймворку Astryx. Твоє завдання: провести ревізію React-консолі `vydra-swiss-survey` у `web/src/` та сформувати рекомендації з максимального використання вбудованих нативних компонентів бібліотеки `@astryxdesign/core`.

---

## 🔬 2. КАТАЛОГ ВБУДОВАНИХ КОМПОНЕНТІВ ASTRYX (@astryxdesign/core)

У проєкті вже встановлено **понад 80 нативних компонентів Astryx**:
- **Макет та Структура:** `AppShell`, `TopNav`, `SideNav`, `FormLayout`, `Section`, `Card`, `Grid`, `HStack`, `VStack`, `Stack`, `Divider`
- **Індикація та Статуси:** `Badge`, `StatusDot`, `Banner`, `ProgressBar`, `Spinner`, `Skeleton`, `EmptyState`
- **Дані та Таблиці:** `Table`, `MetadataList`, `TreeList`, `CodeBlock`, `Timestamp`, `Kbd`
- **Інтерактив та Форми:** `Button`, `IconButton`, `ButtonGroup`, `SegmentedControl`, `Switch`, `TextInput`, `TextArea`, `DropdownMenu`, `Popover`, `Tooltip`

---

## 📋 3. ЗАВДАННЯ ДЛЯ ДОСЛІДЖЕННЯ

1. **Аудит `web/src/screens/ops/SurveyOps.tsx`:**
   - Замінити кустарні контейнери на `Card`, `Section`, `HStack`, `VStack`, `StatusDot`, `Banner`
2. **Аудит `web/src/screens/rules/RulesTable.tsx`:**
   - Використати нативний `Table`, `Badge`, `MetadataList` та `CodeBlock`
3. **Аудит `web/src/screens/settings/BrowserSourcesPanel.tsx` & `PatternsPanel.tsx`:**
   - Використати `SegmentedControl`, `Switch`, `Card`, `StatusDot`
