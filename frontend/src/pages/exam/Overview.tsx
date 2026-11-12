import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Check, Circle, Clock3, Pencil, Sparkles, Trash2, Trophy, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ExamFormModal } from "../../components/ExamForm";
import { Button, Card, Field, Input, Modal, useConfirm } from "../../components/ui";
import { api, errMsg } from "../../lib/api";
import type { Activity, ExamStats } from "../../lib/types";
import { fmtScore, timeAgo } from "../../lib/utils";
import { ACTION_LABEL } from "../Dashboard";
import { useExam } from "./ExamLayout";

function ScoreMetric({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: "blue" | "amber" | "violet" }) {
  const styles={blue:"bg-primary-soft text-primary",amber:"bg-warning-soft text-warning",violet:"bg-violet-100 text-violet-700"}[tone];
  return <Card className="relative min-h-[130px] overflow-hidden border-primary-soft bg-gradient-to-br from-white to-primary-softer p-4 sm:p-5">
    <div className="relative z-[1] flex items-center gap-3"><span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${styles} [&_svg]:h-6 [&_svg]:w-6`}>{icon}</span><div className="min-w-0"><p className="text-[14px] font-medium text-slate-600">{label}</p><p className="mt-1 text-[29px] font-bold leading-none tabular text-navy">{value}</p></div></div>
    <span aria-hidden className="absolute -bottom-8 right-2 h-16 w-36 rounded-[60%] bg-primary-soft/60" />
  </Card>;
}

export default function Overview() {
  const exam=useExam();
  const qc=useQueryClient();
  const nav=useNavigate();
  const confirm=useConfirm();
  const [edit,setEdit]=useState(false);
  const [demoOpen,setDemoOpen]=useState(false);
  const [demoN,setDemoN]=useState(20);
  const [showAllHistory,setShowAllHistory]=useState(false);
  const {data:activity}=useQuery({queryKey:["activity",exam.id],queryFn:()=>api.get<Activity[]>(`/api/exams/${exam.id}/activity?limit=50`)});
  const {data:stats}=useQuery({queryKey:["stats",exam.id,null],queryFn:()=>api.get<ExamStats>(`/api/exams/${exam.id}/stats`)});

  const demo=useMutation({
    mutationFn:()=>api.post<{created:number}>(`/api/exams/${exam.id}/demo?n=${demoN}`),
    onSuccess:(result)=>{toast.success(`Đã sinh và chấm ${result.created} phiếu demo`);qc.invalidateQueries();setDemoOpen(false);},
    onError:(error)=>toast.error(errMsg(error)),
  });

  const steps=[
    {done:true,title:"Tạo kỳ thi",desc:`${exam.num_questions} câu, ${exam.num_options} phương án`,to:""},
    {done:exam.num_keys>0,title:"Nhập đáp án",desc:exam.num_keys?`${exam.num_keys} mã đề`:"Nhập tay, từ Excel hoặc chụp phiếu đáp án",to:"keys"},
    {done:exam.num_students>0,title:"Danh sách thí sinh",desc:exam.num_students?`${exam.num_students} thí sinh`:"Không bắt buộc — giúp ghép tên theo SBD",to:"students"},
    {done:exam.num_submissions>0,title:"In phiếu & chấm bài",desc:exam.num_submissions?`${exam.num_submissions} bài đã nộp`:"Tải ảnh, PDF quét, hoặc dùng webcam",to:"grade"},
    {done:exam.num_submissions>0&&exam.num_review===0,title:"Duyệt bài cần xem lại",desc:exam.num_review?`${exam.num_review} bài đang chờ`:"Không còn bài nào",to:"results?status=review"},
  ];

  const distribution=useMemo(()=>{
    const bins=stats?.histogram??[];
    const paired=[];
    for(let i=0;i<bins.length;i+=2){
      const first=bins[i],last=bins[i+1];
      paired.push({range:last?`${first.range.split("–")[0].trim()} – ${last.range.split("–").at(-1)?.trim()}`:first.range,from:first.from,count:first.count+(last?.count??0)});
    }
    return paired;
  },[stats?.histogram]);

  const remove=async()=>{
    const ok=await confirm({title:"Xóa kỳ thi?",message:<>Toàn bộ đáp án, thí sinh, bài làm và ảnh của <b>{exam.name}</b> sẽ bị xóa vĩnh viễn.</>,confirmText:"Xóa kỳ thi",danger:true});
    if(!ok)return;
    try{await api.del(`/api/exams/${exam.id}`);qc.invalidateQueries({queryKey:["exams"]});toast.success("Đã xóa kỳ thi");nav("/exams");}
    catch(error){toast.error(errMsg(error));}
  };

  const overview=stats?.overview;
  const history=activity??[];
  const visibleHistory=showAllHistory?history:history.slice(0,4);
  const topBinCount=Math.max(0,...distribution.map((bin)=>bin.count));

  return <div className="grid min-w-0 gap-4 xl:grid-cols-12">
    <div className="min-w-0 space-y-5 xl:col-span-9">
      <section aria-label="Thống kê kỳ thi" className="grid grid-cols-1 gap-3 min-[500px]:grid-cols-3">
        <ScoreMetric label="Bài đã chấm" value={`${overview?.scored??exam.num_submissions} / ${overview?.roster||exam.num_students||exam.num_submissions}`} icon={<Check />} tone="blue" />
        <ScoreMetric label="Cần xem lại" value={`${overview?.review??exam.num_review}`} icon={<Clock3 />} tone="amber" />
        <ScoreMetric label="Điểm trung bình" value={fmtScore(overview?.mean??exam.avg_score)} icon={<BarChart3 />} tone="violet" />
      </section>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(270px,0.78fr)_minmax(0,1.22fr)]">
        <Card className="overflow-hidden">
          <div className="flex items-center gap-3 border-b border-border px-4 py-4 sm:px-5"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary"><Sparkles className="h-5 w-5" /></span><div><h2 className="text-[18px] font-bold text-navy">Quy trình</h2><p className="text-[13px] text-slate-600">Các bước chuẩn bị và chấm một kỳ thi</p></div></div>
          <ol className="relative space-y-0 px-4 py-2 sm:px-5">{steps.map((step,index)=><li key={step.title} className="relative">
            {index<steps.length-1&&<span aria-hidden className={`absolute bottom-[-8px] left-[10px] top-8 w-0.5 ${step.done?"bg-success":"bg-border"}`} />}
            <Link to={step.to} className="relative flex items-start gap-3 rounded-xl py-1 hover:bg-primary-softer">
              <span className={`relative z-[1] mt-1 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full ${step.done?"bg-success text-white":"border-2 border-slate-400 bg-white text-transparent"}`}>{step.done?<Check className="h-4 w-4" />:<Circle className="h-3 w-3" />}</span>
              <span className="min-w-0 flex-1 rounded-xl border border-primary-soft bg-primary-softer/60 px-3 py-1.5"><span className="block text-[14px] font-bold leading-5 text-navy">{index+1}. {step.title}</span><span className="block text-[13px] leading-5 text-slate-600">{step.desc}</span></span>
            </Link>
          </li>)}</ol>
        </Card>

        <div className="min-w-0 space-y-4">
        <Card className="min-w-0 overflow-hidden">
          <div className="flex items-center gap-3 border-b border-border px-4 py-4 sm:px-5"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary"><BarChart3 className="h-5 w-5" /></span><div><h2 className="text-[18px] font-bold text-navy">Phân bố điểm</h2><p className="text-[13px] text-slate-600">Số bài theo khoảng điểm</p></div></div>
          {overview?.scored ? <div className="h-[225px] min-w-0 px-2 pb-3 pt-4">
            <ResponsiveContainer width="100%" height="100%"><BarChart data={distribution} margin={{top:20,right:12,left:-12,bottom:0}}>
              <CartesianGrid vertical={false} stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis dataKey="range" tick={{fontSize:12,fill:"var(--color-text)"}} tickLine={false} axisLine={{stroke:"var(--color-border)"}} />
              <YAxis allowDecimals={false} tick={{fontSize:12,fill:"var(--color-text-muted)"}} tickLine={false} axisLine={false} />
              <Tooltip cursor={{fill:"var(--color-primary-softer)"}} contentStyle={{borderRadius:10,borderColor:"var(--color-border)"}} formatter={(value:number)=>[value,"Số bài"]} />
              <Bar dataKey="count" radius={[7,7,0,0]} maxBarSize={66}><LabelList dataKey="count" position="top" style={{fontSize:13,fontWeight:700,fill:"var(--color-navy)"}} />{distribution.map((bin,index)=><Cell key={`${bin.range}-${index}`} fill={bin.count===topBinCount&&topBinCount>0?"var(--color-primary)":"#93C5FD"} />)}</Bar>
            </BarChart></ResponsiveContainer>
          </div> : <div className="flex h-[225px] flex-col items-center justify-center px-6 text-center"><span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary"><BarChart3 className="h-6 w-6" /></span><p className="text-[15px] font-semibold text-navy">Chưa có dữ liệu điểm</p><p className="mt-1 max-w-sm text-[13px] leading-5 text-slate-600">Hãy nhập đáp án và chấm bài để xem phân bố điểm của kỳ thi.</p></div>}
        </Card>
        <section aria-label="Tóm tắt kết quả" className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-white p-2 sm:grid-cols-3 sm:p-3">
        <div className="flex items-center gap-3 rounded-lg bg-warning-soft/60 px-3 py-1"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning-soft text-warning"><Trophy className="h-6 w-6" /></span><div><p className="text-[13px] text-slate-600">Điểm cao nhất</p><p className="text-[21px] font-bold tabular text-navy">{fmtScore(overview?.max)}</p></div></div>
        <div className="flex items-center gap-3 rounded-lg bg-primary-softer px-3 py-1"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary-hover"><UsersRound className="h-6 w-6" /></span><div><p className="text-[13px] text-slate-600">Điểm thấp nhất</p><p className="text-[21px] font-bold tabular text-navy">{fmtScore(overview?.min)}</p></div></div>
        <div className="flex items-center gap-3 rounded-lg bg-success-soft/60 px-3 py-1"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-soft text-success"><UsersRound className="h-6 w-6" /></span><div><p className="text-[13px] text-slate-600">Tỷ lệ đạt (≥ {exam.pass_score})</p><p className="text-[21px] font-bold tabular text-success">{overview?.pass_rate==null?"—":`${Math.round(overview.pass_rate*100)}%`}</p></div></div>
        </section>
        </div>
      </div>
    </div>

    <aside className="min-w-0 space-y-4 xl:col-span-3">
      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3.5"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary"><Pencil className="h-[18px] w-[18px]" /></span><h2 className="text-[18px] font-bold text-navy">Thao tác</h2></div>
        <div className="space-y-2 p-4">
          <Button className="w-full" icon={<Pencil />} onClick={()=>setEdit(true)}>Sửa thông tin kỳ thi</Button>
          <Button variant="outline" className="w-full" icon={<Sparkles />} onClick={()=>setDemoOpen(true)}>Sinh dữ liệu demo</Button>
          <Button variant="outline" className="w-full border-danger text-danger hover:bg-danger-soft" icon={<Trash2 />} onClick={remove}>Xóa kỳ thi</Button>
        </div>
        {exam.description&&<p className="border-t border-border px-4 py-3 text-[14px] leading-5 text-slate-600">{exam.description}</p>}
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3.5"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary"><Clock3 className="h-[18px] w-[18px]" /></span><h2 className="text-[18px] font-bold text-navy">Lịch sử</h2></div>
        {visibleHistory.length ? <ol className="relative divide-y divide-border px-4">{visibleHistory.map((item,index)=><li key={item.id} className="relative flex gap-3 py-2.5">
          {index<visibleHistory.length-1&&<span aria-hidden className="absolute bottom-[-9px] left-[7px] top-8 w-px bg-border" />}
          <span className={`relative z-[1] mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-white ${index===0?"bg-primary":index===1?"bg-primary-hover":"bg-success"}`} />
          <div className="min-w-0 flex-1"><p className="text-[13px] leading-5 text-slate-700"><span className="font-semibold text-navy">{item.user||"Hệ thống"}</span> {ACTION_LABEL[item.action]??item.action}{item.submission_id&&<> <Link to={`/submissions/${item.submission_id}`} className="font-semibold text-primary-hover hover:underline">#{item.submission_id}</Link></>}</p><p className="text-[12px] text-slate-500">{timeAgo(item.created_at)}</p></div>
        </li>)}</ol> : <p className="px-4 py-6 text-[14px] text-slate-500">Chưa có hoạt động.</p>}
        {history.length>4&&<button onClick={()=>setShowAllHistory((value)=>!value)} className="flex min-h-11 w-full items-center justify-center gap-2 border-t border-border px-4 text-[14px] font-semibold text-primary-hover hover:bg-primary-softer">{showAllHistory?"Thu gọn lịch sử":"Xem tất cả lịch sử"}<span aria-hidden>→</span></button>}
      </Card>
    </aside>

    <ExamFormModal open={edit} onClose={()=>setEdit(false)} exam={exam} />
    <Modal open={demoOpen} onClose={()=>setDemoOpen(false)} title="Sinh dữ liệu demo" description="Tạo danh sách thí sinh, đáp án (nếu chưa có) và ảnh chụp mô phỏng phiếu đã tô — rồi chấm tự động. Hữu ích để thử hệ thống hoặc thuyết trình." footer={<><Button variant="secondary" onClick={()=>setDemoOpen(false)}>Hủy</Button><Button loading={demo.isPending} onClick={()=>demo.mutate()} icon={<Sparkles />}>Sinh {demoN} phiếu</Button></>}>
      <Field label="Số phiếu" hint="Mỗi phiếu mất khoảng 0,3 giây (sinh ảnh + chấm)."><Input type="number" min={1} max={100} value={demoN} onChange={(event)=>setDemoN(Math.max(1,Math.min(100,Number(event.target.value)||1)))} /></Field>
    </Modal>
  </div>;
}
