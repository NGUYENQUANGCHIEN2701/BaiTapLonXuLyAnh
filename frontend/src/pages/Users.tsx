import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GraduationCap, Plus, Search, ShieldCheck, Trash2, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { Badge, Button, Card, Empty, Field, Input, Modal, PageLoader, Select, useConfirm } from "../components/ui";
import { api, errMsg } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { Role, User } from "../lib/types";
import { fmtDate } from "../lib/utils";

function UsersIllustration() {
  return <svg viewBox="0 0 420 150" className="h-[138px] w-full max-w-[440px]" aria-hidden="true">
    <path d="M0 128c70-58 140-46 206-8s142 23 214-27v57H0Z" fill="#DBEEFF"/><path d="M24 144c82-35 146-13 213 0s116 2 183-34v40H24Z" fill="#C8E5FF" />
    <g transform="rotate(6 150 75)"><rect x="57" y="9" width="179" height="123" rx="17" fill="white" stroke="#B9D9FA" strokeWidth="2" />
      <circle cx="108" cy="61" r="29" fill="#DFF3FF"/><circle cx="108" cy="53" r="11" fill="#0879E2"/><path d="M87 82c2-13 12-20 21-20s19 7 21 20" fill="#0879E2"/>
      <rect x="150" y="37" width="62" height="9" rx="4.5" fill="#91C9FA"/><rect x="150" y="55" width="52" height="8" rx="4" fill="#C3E3FF"/><rect x="78" y="100" width="132" height="8" rx="4" fill="#A8D6FF"/>
    </g>
    <g transform="translate(278 26) rotate(-5 55 36)"><path d="m0 24 54-24 57 25-56 28Z" fill="#168CE8"/><path d="M21 39v27c22 16 47 16 68-1V39L55 53Z" fill="#0871CF"/><path d="M109 26v42" stroke="#0758A9" strokeWidth="5" strokeLinecap="round"/><circle cx="109" cy="71" r="7" fill="#0758A9"/><path d="M86 62 95 87h-18Z" fill="#0758A9"/></g>
  </svg>;
}

function UserSummary({ title, value, icon, tone }: { title: string; value: number; icon: React.ReactNode; tone: "blue" | "violet" | "green" }) {
  const colors={blue:{icon:"bg-primary-soft text-primary",art:"text-primary/20",bg:"from-primary-soft/70 to-white"},violet:{icon:"bg-violet-100 text-violet-700",art:"text-violet-600/20",bg:"from-violet-50 to-white"},green:{icon:"bg-success-soft text-success",art:"text-success/20",bg:"from-success-soft/70 to-white"}}[tone];
  return <Card className={`relative min-h-[118px] overflow-hidden border-primary-soft bg-gradient-to-br ${colors.bg} p-4 sm:p-5`}>
    <div className="relative z-[1] flex items-center gap-4"><span className={`flex h-[62px] w-[62px] shrink-0 items-center justify-center rounded-2xl ${colors.icon} [&_svg]:h-8 [&_svg]:w-8`}>{icon}</span><div><p className="text-[15px] font-medium text-slate-700">{title}</p><p className="mt-1 text-[32px] font-bold leading-none tabular text-navy">{value}</p></div></div>
    <span aria-hidden className={`absolute -bottom-4 right-2 [&_svg]:h-[58px] [&_svg]:w-[58px] ${colors.art}`}>{icon}</span>
    <span aria-hidden className="absolute -bottom-7 right-7 h-16 w-36 rounded-[60%] bg-primary-soft/50" />
  </Card>;
}

function createdDate(value?: string) {
  if (!value) return "—";
  const date=new Date(value);
  return Number.isNaN(date.getTime())?fmtDate(value):new Intl.DateTimeFormat("vi-VN",{hour:"2-digit",minute:"2-digit",day:"2-digit",month:"2-digit",year:"numeric"}).format(date);
}

export default function Users() {
  const { user }=useAuth();
  const qc=useQueryClient();
  const confirm=useConfirm();
  const [open,setOpen]=useState(false);
  const [q,setQ]=useState("");
  const [showAdmins,setShowAdmins]=useState(true);
  const [showTeachers,setShowTeachers]=useState(true);
  const [page,setPage]=useState(1);
  const [pageSize,setPageSize]=useState(10);
  const [form,setForm]=useState({username:"",full_name:"",password:"",role:"teacher" as Role});
  const {data,isLoading}=useQuery({queryKey:["users"],queryFn:()=>api.get<User[]>("/api/users"),enabled:user?.role==="admin"});
  const create=useMutation({
    mutationFn:()=>api.post<User>("/api/users",form),
    onSuccess:()=>{toast.success("Đã tạo tài khoản");setOpen(false);setForm({username:"",full_name:"",password:"",role:"teacher"});qc.invalidateQueries({queryKey:["users"]});},
    onError:(error)=>toast.error(errMsg(error)),
  });

  const filtered=useMemo(()=>{
    const query=q.trim().toLocaleLowerCase("vi");
    return (data??[]).filter((item)=>{
      const matchesText=!query||`${item.username} ${item.full_name}`.toLocaleLowerCase("vi").includes(query);
      const matchesRole=(item.role==="admin"&&showAdmins)||(item.role==="teacher"&&showTeachers);
      return matchesText&&matchesRole;
    });
  },[data,q,showAdmins,showTeachers]);
  const pages=Math.max(1,Math.ceil(filtered.length/pageSize));
  const currentPage=Math.min(page,pages);
  const visible=filtered.slice((currentPage-1)*pageSize,currentPage*pageSize);

  if(user?.role!=="admin")return <Navigate to="/" replace />;
  if(isLoading)return <PageLoader />;

  const remove=async(target:User)=>{
    if(!(await confirm({title:`Xóa tài khoản ${target.username}?`,message:"Các kỳ thi của tài khoản này vẫn được giữ lại và chuyển cho quản trị viên quản lý.",danger:true,confirmText:"Xóa"})))return;
    try{await api.del(`/api/users/${target.id}`);qc.invalidateQueries({queryKey:["users"]});toast.success("Đã xóa tài khoản");}
    catch(error){toast.error(errMsg(error));}
  };

  return <div className="user-admin-page">
    <section className="relative mb-5 grid min-h-[142px] items-center overflow-hidden rounded-2xl bg-primary-softer px-5 py-5 sm:px-7 lg:grid-cols-[1fr_420px] lg:px-8">
      <div className="relative z-[1] flex items-start gap-4"><span className="flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary"><UsersRound className="h-9 w-9" /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-3"><h1 className="text-[34px] font-bold leading-tight tracking-tight text-navy sm:text-[42px]">Người dùng</h1><span className="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1.5 text-[14px] font-semibold text-primary-hover"><ShieldCheck className="h-4 w-4" />Admin &amp; Giáo viên</span></div><p className="mt-1 max-w-[620px] text-[14px] leading-6 text-slate-600 sm:text-[15px]">Quản lý tài khoản quản trị viên và giáo viên của hệ thống.</p></div></div>
      <div className="pointer-events-none absolute bottom-0 right-0 top-0 hidden w-[48%] items-center justify-end lg:flex"><UsersIllustration /></div>
    </section>

    <section aria-label="Thống kê tài khoản" className="mb-5 grid grid-cols-1 gap-3 min-[520px]:grid-cols-3">
      <UserSummary title="Tổng tài khoản" value={data?.length??0} icon={<UsersRound />} tone="blue" />
      <UserSummary title="Quản trị viên" value={(data??[]).filter((item)=>item.role==="admin").length} icon={<ShieldCheck />} tone="violet" />
      <UserSummary title="Giáo viên" value={(data??[]).filter((item)=>item.role==="teacher").length} icon={<GraduationCap />} tone="green" />
    </section>

    <section aria-label="Tìm kiếm và lọc tài khoản" className="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-border bg-white p-3 sm:p-4 lg:grid-cols-[minmax(250px,1.3fr)_minmax(280px,1fr)_auto] lg:items-center">
      <label className="relative block min-w-0"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" /><Input aria-label="Tìm theo tên đăng nhập hoặc họ tên" className="h-12 rounded-xl pl-11" placeholder="Tìm theo tên đăng nhập, họ tên..." value={q} onChange={(event)=>{setQ(event.target.value);setPage(1);}} /></label>
      <fieldset className="flex min-h-12 flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-border px-4 py-2"><legend className="sr-only">Lọc theo vai trò</legend><span className="text-[14px] font-semibold text-slate-700">Vai trò</span><label className="inline-flex cursor-pointer items-center gap-2 text-[14px] font-medium text-slate-800"><input type="checkbox" checked={showAdmins} onChange={(event)=>{setShowAdmins(event.target.checked);setPage(1);}} className="h-5 w-5 rounded accent-primary" />Admin</label><label className="inline-flex cursor-pointer items-center gap-2 text-[14px] font-medium text-slate-800"><input type="checkbox" checked={showTeachers} onChange={(event)=>{setShowTeachers(event.target.checked);setPage(1);}} className="h-5 w-5 rounded accent-primary" />Giáo viên</label></fieldset>
      <Button className="h-12 w-full whitespace-nowrap lg:w-auto" icon={<Plus />} onClick={()=>setOpen(true)}>Thêm tài khoản</Button>
    </section>

    <Card className="overflow-hidden">
      {visible.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-[14px]">
        <thead className="text-left text-[13px]"><tr className="border-b border-border"><th className="px-5 py-3 font-semibold">Tên đăng nhập</th><th className="px-5 py-3 font-semibold">Họ tên</th><th className="px-5 py-3 font-semibold">Vai trò</th><th className="px-5 py-3 font-semibold">Ngày tạo</th><th className="px-5 py-3 text-right font-semibold">Thao tác</th></tr></thead>
        <tbody className="divide-y divide-border">{visible.map((item)=><tr key={item.id} className="hover:bg-primary-softer">
          <td className="px-5 py-3.5"><div className="flex items-center gap-3"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[18px] font-bold ${item.role==="admin"?"bg-primary-soft text-primary":"bg-primary-soft text-primary-hover"}`}>{(item.username||"U").charAt(0).toUpperCase()}</span><span className="font-semibold text-navy">{item.username}</span></div></td>
          <td className="px-5 py-3.5 font-medium text-slate-800">{item.full_name||"—"}</td>
          <td className="px-5 py-3.5">{item.role==="admin"?<Badge tone="violet" className="px-3 py-1.5"><ShieldCheck className="h-4 w-4" />Admin</Badge>:<Badge tone="green" className="px-3 py-1.5"><GraduationCap className="h-4 w-4" />Giáo viên</Badge>}</td>
          <td className="whitespace-nowrap px-5 py-3.5 text-slate-600">{createdDate(item.created_at)}</td>
          <td className="px-5 py-3.5 text-right">{item.id!==user.id&&<button aria-label={`Xóa tài khoản ${item.username}`} title="Xóa tài khoản" className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-danger-soft text-danger hover:bg-danger hover:text-white" onClick={()=>remove(item)}><Trash2 className="h-[18px] w-[18px]" /></button>}</td>
        </tr>)}</tbody>
      </table></div> : <Empty icon={<UsersRound />} title="Không tìm thấy tài khoản" description="Thử đổi từ khóa hoặc bộ lọc vai trò." action={<Button variant="secondary" onClick={()=>{setQ("");setShowAdmins(true);setShowTeachers(true);}}>Xóa bộ lọc</Button>} />}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-5">
        <p className="text-[13px] text-slate-600">Hiển thị <span className="font-semibold text-slate-800">{filtered.length?((currentPage-1)*pageSize)+1:0} – {Math.min(currentPage*pageSize,filtered.length)}</span> của {filtered.length} tài khoản</p>
        <div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-[13px] text-slate-600">Số dòng mỗi trang:<Select aria-label="Số dòng mỗi trang" className="min-h-10 w-[78px] py-1" value={pageSize} onChange={(event)=>{setPageSize(Number(event.target.value));setPage(1);}}><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></Select></label><span className="hidden h-8 w-px bg-border sm:block" /><div className="flex items-center gap-1"><Button variant="ghost" size="icon" aria-label="Trang trước" disabled={currentPage<=1} onClick={()=>setPage((value)=>Math.max(1,value-1))}>‹</Button><span className="flex h-10 min-w-10 items-center justify-center rounded-lg bg-primary px-3 text-[14px] font-semibold text-white">{currentPage}</span><Button variant="ghost" size="icon" aria-label="Trang sau" disabled={currentPage>=pages} onClick={()=>setPage((value)=>Math.min(pages,value+1))}>›</Button></div></div>
      </div>
    </Card>

    <Modal open={open} onClose={()=>setOpen(false)} title="Thêm tài khoản" footer={<><Button variant="secondary" onClick={()=>setOpen(false)}>Hủy</Button><Button loading={create.isPending} onClick={()=>create.mutate()} disabled={form.username.length<3||form.password.length<6}>Tạo</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tên đăng nhập" hint="Tối thiểu 3 ký tự"><Input value={form.username} onChange={(event)=>setForm({...form,username:event.target.value.trim()})} autoFocus /></Field>
        <Field label="Họ tên"><Input value={form.full_name} onChange={(event)=>setForm({...form,full_name:event.target.value})} /></Field>
        <Field label="Mật khẩu" hint="Tối thiểu 6 ký tự"><Input type="password" value={form.password} onChange={(event)=>setForm({...form,password:event.target.value})} /></Field>
        <Field label="Vai trò"><Select value={form.role} onChange={(event)=>setForm({...form,role:event.target.value as Role})}><option value="teacher">Giáo viên</option><option value="admin">Quản trị viên</option></Select></Field>
      </div>
    </Modal>
  </div>;
}
