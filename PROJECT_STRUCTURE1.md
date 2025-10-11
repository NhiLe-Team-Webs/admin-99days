# admin-99days - Cau truc va Muc tieu

## Muc tieu san pham
- Cung cap bang dieu khien noi bo de quan ly chuong trinh 99 Days Challenge.
- Cho phep nhan vien duyet ho so dang ky, chuyen thanh vien moi sang bang `members` va theo doi thong ke.
- Quan ly danh sach link Zoom hang ngay va dieu phoi thong tin den thanh vien.

## Cong nghe nen tang
- Vite + React + TypeScript cho giao dien SPA phan hoi nhanh.
- Tailwind CSS ket hop bo UI shadcn tao bo thanh phan tuy bien (tables, modal, tabs).
- Supabase lam backend-as-a-service: bang `applicants`, `members`, RPC qua REST API.

## Cau truc thu muc chinh
- `public/`: Tai nguyen tĩnh va `index.html` khoi tao ung dung.
- `src/`: Ma nguon TypeScript chinh.
  - `components/`: Cac thanh phan UI tai su dung nhu `ApplicantTable`, `MemberTable`, `StatsCard`, `TabNavigation`, `ConfirmationModal` va thu vien `ui/` cua shadcn.
  - `hooks/`: Gom `use-toast` de hien thong bao va `use-mobile` ho tro layout tren thiet bi nho.
  - `lib/`: Ham lam viec voi Supabase (`api.ts` gom logic duyet, xoa, di chuyen ho so; `supabase.ts` khoi tao client; `utils.ts` tien ich).
  - `pages/`: `Index.tsx` chua toan bo bang dieu khien theo tab, `NotFound.tsx` cho tuyen khong ton tai.
  - `App.tsx` va `main.tsx`: Dinh tuyen va mount ung dung React.
- Tap tin cau hinh chung: `tailwind.config.ts`, `postcss.config.js`, `package.json`, `tsconfig*.json`.

## Luong chuc nang chinh
- `Index.tsx` tai du lieu applicants/members bang `getApplicants`, `getMembers` va hien thi thong ke tren tab Dashboard.
- Tab `Applicants` cho phep duyet (`approveApplicant`) hoac tu choi (`updateApplicantStatus`), co modal xac nhan truoc khi thuc thi.
- Tab `Members` ho tro loai bo thanh vien (`removeMember`) va dong bo lai danh sach.
- Tab `Settings` quan ly danh sach link Zoom: nhap theo dong, luu vao state va thong bao qua `use-toast`.
- Toan bo tac vu Supabase thuc hien trong `lib/api.ts` de tach biet tang du lieu va giao dien.

## Ghi chu van hanh
- Dien day du `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY`, `VITE_SUPABASE_SERVICE_ROLE_KEY`, `VITE_MEMBER_APP_URL`) de ung dung ket noi dung co so du lieu chung voi frontend 99days va co the moi thanh vien dat mat khau.
- Neu chay song song voi ung dung khach hang, hay dam bao quyen truy cap Supabase duoc gioi han theo vai tro (service role hoac RLS) va chi phat hanh admin panel trong moi truong tin cay.

## Dinh huong mo rong
- Them phan quyen dang nhap admin va nhat ky hoat dong cho cac thao tac duyet/xoa.
- Bo sung bo loc va tim kiem nang cao tren bang applicants/members.
- Tich hop tu dong gui email/Telegram khi duyet hoac cap nhat link Zoom.
