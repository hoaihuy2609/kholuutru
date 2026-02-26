---
description: Hoàn tác toàn bộ về version trước khi cài đặt Supabase
---

Thực hiện việc hoàn tác code dự án về nhánh `backup-before-supabase` (phiên bản 1a2f082d... hoặc branch backup)

// turbo-all
1. Xóa các thay đổi chưa được commit: `git reset --hard` và `git clean -fd`
2. Quay lại nhánh backup-before-supabase hoặc main tại thời điểm backup: `git checkout backup-before-supabase` hoặc `git checkout a1711a1cfddfd3e03bbdfa4185d7aa65e21d0039`
3. Đặt lại nhánh main theo nhánh backup nếu đang ở main: `git reset --hard a1711a1cfddfd3e03bbdfa4185d7aa65e21d0039`
