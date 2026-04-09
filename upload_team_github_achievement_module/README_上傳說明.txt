這個資料夾是可直接上傳到小組 GitHub 的 Achievement 模組整合檔。

請把以下檔案依照相同路徑覆蓋到主體專案：
1. backend/handlers/handlers.go
2. backend/handlers/achievement_demo_http.go
3. backend/handlers/achievement_demo_models.go
4. backend/handlers/achievement_demo_store.go
5. backend/handlers/achievement_demo_test.go
6. apps/web/app/achievements/page.tsx
7. apps/web/public/achievement-module.html

說明：
- Achievement 模組資料獨立寫入 backend/data/achievement-demo.json
- 不會影響主體原本的會員、投票、點餐資料流
- 建議上傳後重新執行 docker compose up --build 測試

補充：若要在主體導覽列直接看到 Achievement 頁面，請一併覆蓋 apps/web/components/app-nav.tsx
