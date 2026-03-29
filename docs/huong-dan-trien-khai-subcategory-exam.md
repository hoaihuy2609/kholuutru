# Huong dan trien khai tinh nang phan loai de thi theo chuong (`subCategory`)

Tai lieu nay duoc viet theo dung hien trang code trong project hien tai, de ban co the sua tung file mot cach an toan, de doc, va giam toi da nguy co loi build.

Muc tieu cua tinh nang:

- Giup de thi loai `chapter` co them ten chuong cu the.
- Khong lam vo du lieu cu.
- Khong nhét logic group phuc tap truc tiep vao JSX.
- Co fallback ro rang cho de cu chua co `subCategory`.

---

## 1. File can sua

Ban se dong vao dung 3 file:

- `C:\Users\Acer\Downloads\physivault---kho-lưu-trữ-vật-lý\types.ts`
- `C:\Users\Acer\Downloads\physivault---kho-lưu-trữ-vật-lý\components\ExamManager.tsx`
- `C:\Users\Acer\Downloads\physivault---kho-lưu-trữ-vật-lý\components\ExamListPage.tsx`

Khong can sua database schema neu du lieu exam dang duoc luu dang JSON/object thong thuong, vi `subCategory` la field optional.

---

## 2. Nguyen tac truoc khi sua

Truoc khi code, giu 4 nguyen tac nay:

1. `subCategory` phai la optional (`subCategory?: string`).
2. Chi luu `subCategory` khi `category === 'chapter'`.
3. Moi noi doc `subCategory` deu phai co fallback `trim()` + gia tri mac dinh.
4. Toan bo logic `filter` va `group` phai duoc tinh truoc `return`, khong viet IIFE long nhau trong JSX cho phan group moi.

---

## 3. Buoc 1 - Sua `types.ts`

### Muc tieu

Them field `subCategory?: string` vao `Exam`.

### Vi tri hien tai

Trong `types.ts`, interface `Exam` dang co dang:

```ts
export interface Exam {
  id: string;
  title: string;
  pdfTelegramFileId: string;
  pdfFileName: string;
  duration: number;
  grade: number;
  createdAt: number;
  answers: ExamAnswers;
  category?: 'school' | 'chapter';
}
```

### Can doi thanh

```ts
export interface Exam {
  id: string;
  title: string;
  pdfTelegramFileId: string;
  pdfFileName: string;
  duration: number;
  grade: number;
  createdAt: number;
  answers: ExamAnswers;
  category?: 'school' | 'chapter';
  subCategory?: string;
}
```

### Ly do

- Optional giup de thi cu khong bi vo type.
- Student page co the doc `exam.subCategory` an toan.
- Admin page co the luu ten chuong khi can.

---

## 4. Buoc 2 - Sua `components/ExamManager.tsx`

## 4.1. Muc tieu

Them o nhap ten chuong trong modal tao/sua de thi, chi hien khi `category === 'chapter'`.

## 4.2. Viec can lam theo thu tu

### A. Them state moi cho `subCategory`

Trong `CreateExamModal`, ngay sau state `category`, them state moi:

```ts
const [subCategory, setSubCategory] = useState(
    examToEdit?.category === 'chapter' ? (examToEdit.subCategory || '') : ''
);
```

Nen dat no ngay sau dong nay:

```ts
const [category, setCategory] = useState<'school' | 'chapter'>(examToEdit?.category || 'school');
```

### B. Tao bien da chuan hoa de dung lai nhieu lan

Ngay truoc `canNext1`, them:

```ts
const normalizedSubCategory = subCategory.trim();
```

### C. Cap nhat dieu kien cho phep qua Step 1

`canNext1` hien tai dang la:

```ts
const canNext1 = title.trim() && pdfFileId && !pdfUploading && parseInt(duration) > 0;
```

Sua thanh:

```ts
const canNext1 = Boolean(
    title.trim() &&
    pdfFileId &&
    !pdfUploading &&
    parseInt(duration) > 0 &&
    (category === 'school' || normalizedSubCategory)
);
```

### D. Khi bam chon loai de, xu ly dung state

Hien tai button dang set category nhu sau:

```ts
onClick={() => setCategory('school')}
onClick={() => setCategory('chapter')}
```

Ban nen doi thanh:

```ts
onClick={() => {
    setCategory('school');
    setSubCategory('');
}}
```

va

```ts
onClick={() => setCategory('chapter')}
```

### E. Them input ten chuong vao UI Step 1

Dat block nay ngay ben duoi phan `Phan loai *`, truoc phan `Thoi gian + Lop`:

```tsx
{category === 'chapter' && (
    <div>
        <label className="block text-xs font-semibold mb-1.5" style={{ color: '#57564F' }}>
            Ten chuong *
        </label>
        <input
            type="text"
            value={subCategory}
            onChange={e => setSubCategory(e.target.value)}
            placeholder="VD: Chuong 1 - Dao dong co"
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
            style={{ border: '1.5px solid #E9E9E7', background: '#F7F6F3', color: '#1A1A1A' }}
            onFocus={e => (e.target as HTMLElement).style.borderColor = ACCENT}
            onBlur={e => (e.target as HTMLElement).style.borderColor = '#E9E9E7'}
        />
        <p className="text-[11px] mt-1" style={{ color: '#AEACA8' }}>
            Ten chuong se duoc dung de gom nhom de thi ben trang hoc sinh.
        </p>
    </div>
)}
```

### F. Chan save neu de `chapter` nhung chua nhap ten chuong

Trong `handleSave`, ngay sau `setSaving(true);`, them block guard:

```ts
if (category === 'chapter' && !normalizedSubCategory) {
    onShowToast('Vui long nhap ten chuong cho de on theo chuong', 'warning');
    setSaving(false);
    return;
}
```

### G. Luu `subCategory` dung cach

Trong object `exam` ben trong `handleSave`, hien tai dang co:

```ts
const exam: Exam = {
    id: examToEdit ? examToEdit.id : crypto.randomUUID(),
    title: title.trim(),
    pdfTelegramFileId: pdfFileId,
    pdfFileName,
    duration: parseInt(duration),
    grade,
    createdAt: examToEdit ? examToEdit.createdAt : Date.now(),
    answers,
    category,
};
```

Sua thanh:

```ts
const exam: Exam = {
    id: examToEdit ? examToEdit.id : crypto.randomUUID(),
    title: title.trim(),
    pdfTelegramFileId: pdfFileId,
    pdfFileName,
    duration: parseInt(duration),
    grade,
    createdAt: examToEdit ? examToEdit.createdAt : Date.now(),
    answers,
    category,
    subCategory: category === 'chapter' ? normalizedSubCategory : undefined,
};
```

### H. Neu muon, them thong tin vao phan summary cuoi modal

Trong khoi `Tom tat de thi`, co the them dong sau de admin tu kiem tra lai truoc khi luu:

```tsx
{category === 'chapter' && (
    <div className="flex justify-between">
        <span>Chuong:</span>
        <span className="font-medium">{normalizedSubCategory}</span>
    </div>
)}
```

## 4.3. Luu y quan trong o file admin

- Khong luu `subCategory: ''` cho de `school`. Tot nhat de `undefined`.
- Nhat dinh phai `trim()` truoc khi save.
- Khi sua de cu:
  - neu la `chapter` va chua co `subCategory` -> input hien rong.
  - neu doi tu `chapter` sang `school` -> phai xoa `subCategory` trong object luu.

---

## 5. Buoc 3 - Sua `components/ExamListPage.tsx`

Day la buoc quan trong nhat.

Muc tieu:

- Van filter theo khoi lop va loai de nhu hien tai.
- Neu dang o tab `chapter`, can group theo `subCategory`.
- Logic group phai tach ra truoc `return`.
- De cu khong co `subCategory` phai vao nhom `Chua phan loai`.

## 5.1. Van de trong code hien tai

File hien tai dang:

- filter `filteredExams` ben trong IIFE JSX
- render 1 list phang bang `filteredExams.map(...)`
- chua co xu ly `subCategory`

Neu tiep tuc nhet them `reduce(...).map(...)` truc tiep vao JSX nay, rat de bi loi dau ngoac khi build.

## 5.2. Cach sua an toan nhat

Khuyen nghi: tach 3 phan ro rang truoc `return`:

1. `filteredExams`
2. `groupedChapterExams`
3. `renderExamRow()`

## 5.3. Them helper de chuan hoa ten chuong

Dat helper nay ben ngoai component, gan `const ACCENT = '#6B7CDB';`:

```ts
const getExamSubCategoryLabel = (exam: Exam) => {
    const raw = typeof exam.subCategory === 'string' ? exam.subCategory.trim() : '';
    return raw || 'Chua phan loai';
};
```

Neu ban muon hien thi tieng Viet co dau thi duoc, nhung giu thong nhat toan file.

## 5.4. Tao cac bien tinh toan truoc `return`

Dat block nay trong component, ngay truoc `const scoringInfo = [...]` hoac ngay sau no, mien la truoc `return`:

```ts
const filteredExams = exams.filter(e => {
    const matchGrade = !e.grade || e.grade === activeTab;
    const matchCategory =
        activeCategory === 'school'
            ? (!e.category || e.category === 'school')
            : e.category === 'chapter';

    return matchGrade && matchCategory;
});

const groupedChapterExams =
    activeCategory === 'chapter'
        ? filteredExams.reduce<Record<string, Exam[]>>((acc, exam) => {
              const groupName = getExamSubCategoryLabel(exam);
              if (!acc[groupName]) {
                  acc[groupName] = [];
              }
              acc[groupName].push(exam);
              return acc;
          }, {})
        : {};

const groupedChapterEntries =
    activeCategory === 'chapter'
        ? Object.entries(groupedChapterExams).sort(([a], [b]) => a.localeCompare(b, 'vi'))
        : [];
```

## 5.5. Tao ham render 1 dong exam de tranh lap code

Dat ham nay trong component, truoc `return`:

```tsx
const renderExamRow = (exam: Exam, idx: number, total: number, keyPrefix = '') => {
    const bestScore = doneMap[exam.id];
    const isDone = bestScore !== undefined;

    return (
        <div
            key={`${keyPrefix}${exam.id}`}
            className="flex items-center gap-4 px-4 py-3.5 cursor-pointer group pv-row-hover"
            style={{
                borderBottom: idx < total - 1 ? '1px solid #F1F0EC' : 'none',
                background: '#FFFFFF',
                borderLeft: isDone ? '3px solid #448361' : '3px solid transparent',
            }}
            onClick={() => onSelectExam(exam)}
        >
            <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-bold text-sm"
                style={{
                    background: isDone ? '#EAF3EE' : '#EEF0FB',
                    color: isDone ? '#448361' : ACCENT,
                }}
            >
                {isDone ? <CheckCircle className="w-4 h-4" /> : idx + 1}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold truncate" style={{ color: '#1A1A1A' }}>
                        {exam.title}
                    </h3>
                    {isDone && (
                        <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0"
                            style={{ background: '#EAF3EE', color: '#448361', border: '1px solid #B7D9C4' }}
                        >
                            <CheckCircle className="w-2.5 h-2.5" />
                            {bestScore.toFixed(2)}d
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="flex items-center gap-1 text-xs" style={{ color: '#787774' }}>
                        <Clock className="w-3 h-3" style={{ color: '#D9730D' }} />
                        {exam.duration} phut
                    </span>
                    <span className="flex items-center gap-1 text-xs truncate max-w-[180px]" style={{ color: '#AEACA8' }}>
                        <FileText className="w-3 h-3" />
                        {exam.pdfFileName}
                    </span>
                    <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ background: '#F1F0EC', color: '#AEACA8' }}>
                        {new Date(exam.createdAt).toLocaleDateString('vi-VN')}
                    </span>
                </div>
            </div>

            <button
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold shrink-0 active:scale-95 ${isDone ? 'pv-btn-secondary-hover' : 'pv-btn-primary-hover'}`}
                style={{
                    background: isDone ? '#F1F0EC' : ACCENT,
                    color: isDone ? '#57564F' : '#fff',
                }}
                onClick={e => {
                    e.stopPropagation();
                    onSelectExam(exam);
                }}
            >
                <Play className="w-3.5 h-3.5" />
                {isDone ? 'Lam lai' : 'Lam bai'}
            </button>
        </div>
    );
};
```

## 5.6. Thay phan render list cu

Trong block hien tai:

```tsx
} : (() => {
    const filteredExams = ...
    if (filteredExams.length === 0) {
        ...
    }
    return (
        <div ...>
            {filteredExams.map(...)}
        </div>
    );
})()}
```

Ban nen doi sang cau truc sau:

```tsx
} : filteredExams.length === 0 ? (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E9E9E7', background: '#FFFFFF' }}>
        <div className="py-12 text-center">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-3" style={{ background: '#F1F0EC' }}>
                <ClipboardList className="w-5 h-5" style={{ color: '#CFCFCB' }} />
            </div>
            <p className="font-medium" style={{ color: '#57564F' }}>Chua co de thi nao</p>
            <p className="text-sm mt-1" style={{ color: '#AEACA8' }}>
                {activeCategory === 'chapter'
                    ? 'Chua co de on theo chuong nao trong muc nay.'
                    : 'Thay/co se dang de thi som nhe!'}
            </p>
        </div>
    </div>
) : activeCategory === 'school' ? (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E9E9E7', background: '#FFFFFF' }}>
        {filteredExams.map((exam, idx) => renderExamRow(exam, idx, filteredExams.length, 'school-'))}
    </div>
) : (
    <div className="space-y-4">
        {groupedChapterEntries.map(([groupName, examsInGroup]) => (
            <div
                key={groupName}
                className="rounded-xl overflow-hidden"
                style={{ border: '1px solid #E9E9E7', background: '#FFFFFF' }}
            >
                <div
                    className="px-4 py-3"
                    style={{ borderBottom: '1px solid #E9E9E7', background: '#FAFAF9' }}
                >
                    <h3 className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>
                        {groupName}
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: '#AEACA8' }}>
                        {examsInGroup.length} de thi
                    </p>
                </div>

                <div>
                    {examsInGroup.map((exam, idx) =>
                        renderExamRow(exam, idx, examsInGroup.length, `${groupName}-`)
                    )}
                </div>
            </div>
        ))}
    </div>
)}
```

## 5.7. Vi sao cach nay an toan hon

- Khong con `reduce + map + JSX` long nhau trong 1 IIFE lon.
- `filteredExams`, `groupedChapterExams`, `groupedChapterEntries` deu duoc tinh ro rang truoc `return`.
- `renderExamRow()` giup tranh copy-paste HTML list item 2 lan.
- `key` co prefix theo nhom: ``${groupName}-${exam.id}``.

---

## 6. Checklist sua file theo thu tu an toan

Lam dung thu tu nay de de debug:

1. Sua `types.ts` truoc.
2. Sua state + save logic trong `ExamManager.tsx`.
3. Them input `subCategory` vao modal admin.
4. Test tao/sua de tren admin truoc.
5. Sau do moi sua `ExamListPage.tsx`.
6. Tach helper/filter/group truoc `return`.
7. Sau cung moi thay block render danh sach.

Neu sua het 3 file mot luc, rat kho biet loi nam o dau.

---

## 7. Test tay bat buoc sau khi code

Day la phan rat quan trong. Khong duoc bo qua.

### Case 1 - Tao de `school`

- Tao de moi loai `school`.
- Xac nhan khong co input ten chuong.
- Luu thanh cong.
- Mo lai de sua -> khong duoc xuat hien `subCategory` cu.

### Case 2 - Tao de `chapter`

- Tao de moi loai `chapter`.
- Nhap `subCategory = "Chuong 1 - Dao dong co"`.
- Luu thanh cong.
- Sang trang hoc sinh, tab `On theo Chuong` -> de phai nam dung trong nhom do.

### Case 3 - Trim khoang trang

- Tao de `chapter` voi input `"   Chuong 2 - Song co   "`.
- Sau khi luu, trang hoc sinh chi duoc hien `Chuong 2 - Song co`.
- Khong duoc tao them mot nhom co dau cach thua.

### Case 4 - Chuyen category khi sua

- Sua 1 de dang la `chapter`, doi sang `school`.
- Luu lai.
- Trang hoc sinh tab `On theo Chuong` khong duoc con nhin thay de nay.
- `subCategory` phai bi xoa khoi object luu.

### Case 5 - Legacy data

- Tao thu mot object exam cu khong co `subCategory` nhung co `category: 'chapter'`.
- Trang hoc sinh phai tu dong dua no vao nhom `Chua phan loai`.

### Case 6 - Empty state

- Chon tab `On theo Chuong` cho khoi khong co de.
- Trang phai hien thong bao trong, khong duoc trang xoa.

### Case 7 - Key warning

- Mo console browser.
- Di chuyen giua cac tab va category.
- Khong duoc xuat hien warning ve duplicate key.

---

## 8. Lenh kiem tra sau cung

Sau khi sua xong, chay:

```bash
npm run build
```

Neu muon kiem tra nhanh khi dev:

```bash
npm run dev
```

Neu `build` fail, uu tien kiem tra theo thu tu nay:

1. Thieu dau `)` hoac `}` trong JSX moi.
2. Quen import/khai bao helper truoc `return`.
3. `renderExamRow()` bi dat sau `return`.
4. Goi `trim()` tren gia tri co the `undefined` ma chua check.

---

## 9. Nhung loi de gap nhat trong luc sua

### Loi 1 - Input chapter hien nhung khong bat buoc

Neu ban chi them input ma khong sua `canNext1` va `handleSave`, admin van co the luu de `chapter` rong ten chuong.

### Loi 2 - Doi sang `school` nhung van giu `subCategory`

Neu ban khong set:

```ts
subCategory: category === 'chapter' ? normalizedSubCategory : undefined
```

thi du lieu cu van co the ton tai ngam.

### Loi 3 - Group truc tiep trong JSX

Neu ban viet kieu:

```tsx
{Object.entries(filteredExams.reduce(...)).map(...)}
```

ngay trong return, nguy co loi build rat cao khi JSX phuc tap.

### Loi 4 - Nhom bi tach do khoang trang

`"Chuong 1"` va `" Chuong 1 "` se thanh 2 nhom neu khong `trim()`.

### Loi 5 - Nhom `undefined`

Neu ban render truc tiep `exam.subCategory`, UI co the hien `undefined`.

Phai dung helper:

```ts
getExamSubCategoryLabel(exam)
```

---

## 10. Mau ket qua mong muon sau khi xong

Sau khi lam dung, he thong se hoat dong nhu sau:

- Admin tao de `school` -> khong can ten chuong.
- Admin tao de `chapter` -> bat buoc nhap ten chuong.
- Student vao `On theo Chuong` -> thay de duoc chia section theo chuong.
- De cu khong co `subCategory` -> vao `Chua phan loai`.
- Khong loi build.
- Khong warning duplicate key.
- Khong hien `undefined` tren giao dien.

---

## 11. Goi y cach commit de de rollback

Neu ban muon di tung buoc chac chan, co the chia commit:

1. `add optional subCategory to Exam type`
2. `add subCategory field to exam manager modal`
3. `group chapter exams by subCategory on student page`

Lam vay neu co loi, ban biet ngay no nam o buoc nao.

---

## 12. Ket luan

Neu ban muon lam dung va it rui ro nhat, hay nho 1 cong thuc:

`type optional -> admin input + trim + conditional save -> student filter -> student group -> render`

Dung don gian hoa van de bang cach tinh toan truoc `return`, va co fallback cho du lieu cu, thi tinh nang nay se ben va de bao tri.
