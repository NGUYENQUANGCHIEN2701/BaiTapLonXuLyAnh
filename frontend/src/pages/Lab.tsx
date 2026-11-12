import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Circle, Clock3, Dices, FlaskConical, ImageUp, Info, Maximize2, ScanLine, Settings, Timer } from "lucide-react";
import { Badge, Button, Card, CardHeader, Dropzone, Field, Input, Modal, PageLoader } from "../components/ui";
import { errMsg, upload } from "../lib/api";
import type { LabResult, LabStep } from "../lib/types";
import { cn, FLAG_LABEL } from "../lib/utils";

const PIPELINE = [
  { key:"input", label:"Ảnh đầu vào", short:"Chọn ảnh để phân tích" },
  { key:"gray", label:"Ảnh xám", short:"Chuyển ảnh sang mức xám" },
  { key:"background", label:"Ước lượng nền giấy", short:"Loại ảnh hưởng bóng và nền" },
  { key:"normalized", label:"Chuẩn hóa độ sáng", short:"Cân bằng ánh sáng trên phiếu" },
  { key:"binary", label:"Nhị phân hóa (Otsu)", short:"Tách nét mực khỏi nền giấy" },
  { key:"markers", label:"Tìm 4 marker góc", short:"Xác định vị trí và góc phiếu" },
  { key:"warped", label:"Nắn phối cảnh", short:"Chuẩn hóa khung phiếu A4" },
  { key:"qr", label:"Đọc mã QR", short:"Lấy cấu hình phiếu nếu có" },
  { key:"align_blocks", label:"Căn chỉnh tinh từng khối", short:"Bù sai lệch do giấy cong" },
  { key:"values", label:"Đo độ sáng từng ô", short:"Đo mức tô ở từng đáp án" },
  { key:"threshold", label:"Tính ngưỡng tô", short:"Tìm ngưỡng phân biệt ô tô" },
  { key:"result", label:"Kết quả nhận dạng", short:"Đọc SBD, mã đề và đáp án" },
];

function LabHeroArt() {
  return <svg viewBox="0 0 540 150" className="h-[140px] w-full max-w-[530px]" aria-hidden="true">
    <path d="M0 132c92-64 165-43 241-8s186 16 299-54v80H0Z" fill="#DBEEFF"/><path d="M16 146c115-31 181-9 267-4s169-21 257-70v78H16Z" fill="#C8E5FF" />
    <g transform="rotate(7 188 74)"><rect x="118" y="5" width="146" height="133" rx="14" fill="white" stroke="#A8D1FA" strokeWidth="3" />
      {[0,1,2,3].map((c)=><text key={c} x={165+c*22} y="34" textAnchor="middle" fontFamily="sans-serif" fontWeight="700" fontSize="12" fill="#365987">{"ABCD"[c]}</text>)}
      {[0,1,2,3].map((r)=><g key={r}><text x="143" y={59+r*23} textAnchor="middle" fontFamily="sans-serif" fontWeight="700" fontSize="11" fill="#31527B">{r+1}</text>{[0,1,2,3].map((c)=><circle key={c} cx={165+c*22} cy={55+r*23} r="7" fill={(r+c)%3===1?"#1686DF":"white"} stroke="#9FC9F5" strokeWidth="1.7" />)}</g>)}
    </g>
    <path d="M118 7h-14q-11 0-11 11v15m176-26h14q11 0 11 11v15M120 139h-16q-11 0-11-11v-15m178 26h12q11 0 11-11v-15" fill="none" stroke="#0879E2" strokeWidth="4" strokeLinecap="round" />
    <rect x="324" y="38" width="79" height="79" rx="20" fill="#168CE8"/><g transform="translate(344 58)" fill="white"><path d="M16 0a4 4 0 0 1 4 4v2.2a14 14 0 0 1 3 1.2l1.6-1.6a4 4 0 0 1 5.7 5.7l-1.6 1.6a14 14 0 0 1 1.2 3H32a4 4 0 0 1 0 8h-2.2a14 14 0 0 1-1.2 3l1.6 1.6a4 4 0 0 1-5.7 5.7l-1.6-1.6a14 14 0 0 1-3 1.2V39a4 4 0 0 1-8 0v-2.2a14 14 0 0 1-3-1.2l-1.6 1.6a4 4 0 0 1-5.7-5.7l1.6-1.6a14 14 0 0 1-1.2-3H0a4 4 0 0 1 0-8h2.2a14 14 0 0 1 1.2-3l-1.6-1.6a4 4 0 0 1 5.7-5.7l1.6 1.6a14 14 0 0 1 3-1.2V4a4 4 0 0 1 4-4Zm0 12a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z" transform="scale(.82)" /></g>
    <rect x="418" y="50" width="118" height="55" rx="16" fill="#EAF6FF" stroke="#D1E9FF"/><circle cx="439" cy="77" r="14" fill="#0879E2"/><path d="m432 77 5 5 9-10" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/><text x="461" y="73" fontFamily="sans-serif" fontSize="12" fontWeight="700" fill="#09285D">Pipeline 12 bước</text><text x="461" y="90" fontFamily="sans-serif" fontSize="9" fill="#365987">Ảnh đầu vào → kết quả</text>
  </svg>;
}

function ThresholdChart({ step }: { step: LabStep }) {
  const data=useMemo(()=> (step.sorted_values??[]).map((value,index)=>({index,value})),[step.sorted_values]);
  return <div className="h-56 min-w-0">
    <ResponsiveContainer><AreaChart data={data} margin={{left:-12,right:12,top:8}}>
      <CartesianGrid stroke="var(--color-border)" />
      <XAxis dataKey="index" tick={{fontSize:11}} label={{value:"Thứ tự ô (đã sắp xếp)",position:"insideBottom",offset:-2,fontSize:11}} height={36} />
      <YAxis domain={[0,255]} tick={{fontSize:11}} />
      <Tooltip formatter={(value:number)=>[value,"Độ sáng"]} labelFormatter={(label)=>`Ô #${label}`} />
      <Area type="stepAfter" dataKey="value" stroke="var(--color-primary)" fill="var(--color-primary-soft)" strokeWidth={1.5} isAnimationActive={false} />
      {step.threshold!==undefined&&<ReferenceLine y={step.threshold} stroke="var(--color-danger)" strokeWidth={1.5} strokeDasharray="6 4" label={{value:`Ngưỡng ${step.threshold}`,fill:"var(--color-danger)",fontSize:12,position:"insideTopLeft"}} />}
    </AreaChart></ResponsiveContainer>
  </div>;
}

function DataPanel({ step }: { step: LabStep }) {
  if(step.key==="threshold")return <div className="space-y-3 px-4 pb-4"><div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-primary-softer p-3"><p className="text-[12px] text-slate-600">Ngưỡng (threshold)</p><p className="text-[20px] font-bold tabular text-navy">{step.threshold?.toFixed(1)??"—"}</p></div><div className="rounded-xl bg-primary-softer p-3"><p className="text-[12px] text-slate-600">Bước nhảy</p><p className="text-[20px] font-bold tabular text-navy">{step.jump?.toFixed(1)??"—"}</p></div></div><ThresholdChart step={step} /></div>;
  if(step.key==="result")return <div className="px-4 pb-4"><div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-primary-softer p-3"><p className="text-[12px] text-slate-600">SBD</p><p className="text-[18px] font-bold tabular text-navy">{step.sbd||"Không đọc được"}</p></div><div className="rounded-xl bg-primary-softer p-3"><p className="text-[12px] text-slate-600">Mã đề</p><p className="text-[18px] font-bold tabular text-navy">{step.exam_code||"—"}</p></div></div><p className="mt-3 text-[13px] font-medium text-slate-700">Đáp án nhận dạng</p><div className="mt-2 flex flex-wrap gap-1.5">{step.answers?.map((answer,index)=><span key={index} className="min-w-8 rounded-md border border-border bg-white px-1.5 py-1 text-center text-[12px] tabular text-slate-700">{index+1}. {answer||"–"}</span>)}</div>{!!step.flags?.length&&<div className="mt-3 flex flex-wrap gap-1.5">{step.flags.map((flag,index)=><Badge key={index} tone={flag.kind==="warning"?"gray":"amber"}>{FLAG_LABEL[flag.kind]??flag.kind}: {flag.field}</Badge>)}</div>}</div>;
  if(step.key==="warped"&&step.homography)return <div className="px-4 pb-4"><p className="mb-2 text-[13px] font-semibold text-slate-700">Ma trận homography H</p><div className="overflow-x-auto rounded-xl bg-surface p-3"><table className="font-sans text-[13px] text-slate-700"><tbody>{step.homography.map((row,index)=><tr key={index}>{row.map((value,column)=><td key={column} className="px-3 py-1 text-right tabular">{value.toFixed(4)}</td>)}</tr>)}</tbody></table></div></div>;
  if(step.key==="align_blocks"&&step.shifts)return <div className="flex flex-wrap gap-2 px-4 pb-4">{Object.entries(step.shifts).map(([key,[dx,dy,score]])=><Badge key={key} tone={score>.4?"green":score>.25?"blue":"gray"}>{key}: ({dx>=0?"+":""}{dx}, {dy>=0?"+":""}{dy}) px · r={score}</Badge>)}</div>;
  if(step.key==="qr")return <div className="px-4 pb-4"><div className="rounded-xl bg-primary-softer p-4"><p className="text-[13px] font-semibold text-navy">Thông tin QR</p><pre className="mt-2 overflow-x-auto text-[13px] text-slate-700">{step.qr?JSON.stringify(step.qr,null,2):"Không đọc được QR; pipeline dùng cấu hình nhập tay."}</pre></div></div>;
  if(step.key==="markers")return <div className="grid grid-cols-2 gap-3 px-4 pb-4"><div className="rounded-xl bg-primary-softer p-3"><p className="text-[12px] text-slate-600">Phương pháp căn chỉnh</p><p className="mt-1 text-[16px] font-bold text-navy">{step.method||"—"}</p></div><div className="rounded-xl bg-primary-softer p-3"><p className="text-[12px] text-slate-600">Điểm xác minh</p><p className="mt-1 text-[16px] font-bold text-navy">{step.verify_score==null?"—":`${Math.round(step.verify_score*100)}%`}</p></div></div>;
  if(step.key==="values")return <div className="grid grid-cols-2 gap-3 px-4 pb-4"><div className="rounded-xl bg-primary-softer p-3"><p className="text-[12px] text-slate-600">Số ô được đo</p><p className="mt-1 text-[20px] font-bold text-navy">{step.sorted_values?.length??"—"}</p></div><div className="rounded-xl bg-primary-softer p-3"><p className="text-[12px] text-slate-600">Số khối căn chỉnh</p><p className="mt-1 text-[20px] font-bold text-navy">{step.shifts?Object.keys(step.shifts).length:"—"}</p></div></div>;
  return <div className="flex items-center gap-3 px-4 pb-4 text-[13px] text-slate-600"><Info className="h-4 w-4 shrink-0 text-primary" />Kết quả ảnh của bước này được hiển thị ở khung xem trước phía trên.</div>;
}

export default function Lab() {
  const [result,setResult]=useState<LabResult|null>(null);
  const [busy,setBusy]=useState(false);
  const [preview,setPreview]=useState<string|null>(null);
  const [zoomImg,setZoomImg]=useState<LabStep|null>(null);
  const [nq,setNq]=useState(40);
  const [strength,setStrength]=useState(1);
  const [selectedIndex,setSelectedIndex]=useState(4);

  const analyze=async(file:File|Blob,name="image.jpg")=>{
    setBusy(true);setResult(null);setPreview(URL.createObjectURL(file));
    const form=new FormData();form.append("file",file,name);form.append("num_questions",String(nq));
    try{
      const response=await upload<LabResult>("/api/lab/analyze",form);setResult(response);
      const binaryIndex=response.steps.findIndex((step)=>step.key==="binary");
      setSelectedIndex(binaryIndex>=0?binaryIndex:Math.max(0,response.steps.length-1));
      if(!response.ok)toast.error(response.error??"Không xử lý được ảnh");
    }catch(error){toast.error(errMsg(error));}
    finally{setBusy(false);}
  };

  const sample=async()=>{
    setBusy(true);setResult(null);
    try{
      const response=await fetch(`/api/lab/sample?seed=${Math.floor(Math.random()*1e6)}&strength=${strength}&questions=${nq}`,{credentials:"include"});
      if(!response.ok)throw new Error(`Lỗi ${response.status}`);
      await analyze(await response.blob(),"sample.jpg");
    }catch(error){toast.error(errMsg(error));setBusy(false);}
  };

  const steps=result?.steps??[];
  const index=Math.min(selectedIndex,Math.max(0,steps.length-1));
  const active=steps[index];
  const inputImageStep=index>0?[...steps.slice(0,index)].reverse().find((step)=>step.image):undefined;
  const inputImage=inputImageStep?.image??preview;
  const total=steps.reduce((sum,step)=>sum+step.ms,0);
  const completedKeys=new Set(steps.map((step)=>step.key));
  const title=active?.title??PIPELINE[selectedIndex]?.label??PIPELINE[0].label;

  return <div className="lab-workspace">
    <section className="relative mb-4 grid min-h-[142px] items-center overflow-hidden rounded-2xl bg-primary-softer px-5 py-5 sm:px-7 2xl:grid-cols-[1fr_450px] lg:px-8">
      <div className="relative z-[1] flex items-start gap-4"><span className="flex h-[66px] w-[66px] shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary"><FlaskConical className="h-9 w-9" /></span><div><h1 className="text-[30px] font-bold leading-tight tracking-tight text-navy sm:text-[38px]">Phòng thí nghiệm xử lý ảnh</h1><p className="mt-1 max-w-[680px] text-[14px] leading-6 text-slate-600 sm:text-[15px]">Thử nghiệm và tinh chỉnh pipeline OMR với 12 bước xử lý ảnh.</p></div></div>
      <div className="pointer-events-none absolute bottom-0 right-0 top-0 hidden w-[48%] items-center justify-end 2xl:flex"><LabHeroArt /></div>
    </section>

    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(280px,.9fr)_minmax(0,1.8fr)] 2xl:grid-cols-[minmax(280px,.86fr)_minmax(320px,1fr)_minmax(0,1.8fr)]">
      <Card className="min-w-0 overflow-hidden">
        <CardHeader title={<span className="flex items-center gap-2"><ImageUp className="h-5 w-5 text-primary" />Ảnh đầu vào</span>} />
        <div className="space-y-4 p-4">
          <Dropzone accept="image/*,.pdf" multiple={false} onFiles={(files)=>analyze(files[0],files[0].name)} className={cn("rounded-xl border-dashed p-5 text-center",busy&&"pointer-events-none opacity-60")}>
            <ImageUp className="mx-auto mb-2 h-9 w-9 text-primary" /><p className="text-[14px] font-semibold text-navy">Chọn ảnh phiếu để phân tích</p><p className="mt-1 text-[13px] text-slate-500">Hoặc kéo thả ảnh vào đây</p>
          </Dropzone>
          <Button variant="secondary" className="w-full" icon={<ScanLine />} onClick={sample} disabled={busy}><span>Sử dụng ảnh mẫu</span></Button>
          <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
            <Field label="Số câu" hint="Dùng khi QR không đọc được"><Input aria-label="Số câu" type="number" min={1} max={120} value={nq} onChange={(event)=>setNq(Math.max(1,Math.min(120,Number(event.target.value)||1)))} /></Field>
            <Field label={`Độ khó ảnh: ${strength.toFixed(1)}`} hint="Nghiêng, bóng, mờ"><input aria-label="Độ khó ảnh" type="range" min={0} max={1.6} step={0.1} value={strength} onChange={(event)=>setStrength(Number(event.target.value))} className="mt-3 w-full accent-primary" /><span className="block text-[12px] text-text-muted">{strength<.5?"Nhẹ":strength<1.1?"Trung bình":"Nhiều nhiễu"}</span></Field>
          </div>
          <Button className="w-full" icon={<Dices />} onClick={sample} disabled={busy}>Sinh ảnh ngẫu nhiên</Button>
          {preview&&<div className="overflow-hidden rounded-xl border border-border bg-surface"><img src={preview} alt="Ảnh phiếu đầu vào" className="max-h-[270px] w-full object-contain" /><p className="border-t border-border px-3 py-2 text-[12px] text-slate-500">Ảnh đầu vào · không lưu trên hệ thống</p></div>}
          {result?.ok&&<div className="rounded-xl border border-border bg-white p-3"><div className="mb-2 flex items-center justify-between"><span className="text-[14px] font-semibold text-navy">Kết quả nhận dạng</span><Badge tone="blue"><Timer className="h-3.5 w-3.5" />{total.toFixed(0)} ms</Badge></div><div className="grid grid-cols-2 gap-2 text-[13px]"><span className="rounded-lg bg-surface p-2">SBD <b className="ml-1 text-navy">{steps.find((step)=>step.key==="result")?.sbd||"—"}</b></span><span className="rounded-lg bg-surface p-2">Mã đề <b className="ml-1 text-navy">{steps.find((step)=>step.key==="result")?.exam_code||"—"}</b></span></div></div>}
        </div>
      </Card>

      <Card className="min-w-0 overflow-hidden xl:col-span-2 xl:row-start-2 2xl:col-span-1 2xl:row-start-auto">
        <CardHeader title={<span className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-soft text-primary"><Settings className="h-4 w-4" /></span>Quy trình xử lý ảnh (12 bước)</span>} />
        <ol className="relative max-h-[680px] space-y-1 overflow-y-auto px-3 py-3 sm:px-4">{PIPELINE.map((step,stepIndex)=>{
          const isActive=selectedIndex===stepIndex;
          const done=completedKeys.has(step.key);
          return <li key={step.key} className="relative">
            {stepIndex<PIPELINE.length-1&&<span aria-hidden className={`absolute bottom-[-6px] left-[10px] top-8 w-0.5 ${done?"bg-success":"bg-border"}`} />}
            <button aria-current={isActive?"step":undefined} aria-label={`Bước ${stepIndex+1}: ${step.label}`} onClick={()=>setSelectedIndex(stepIndex)} className={cn("relative z-[1] flex min-h-[45px] w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors",isActive?"bg-primary font-semibold text-white shadow-sm":"border border-border bg-white text-slate-700 hover:bg-primary-softer")}>
              <span className={cn("flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full",isActive?"border-2 border-white text-white":done?"bg-success text-white":"border-2 border-slate-300 bg-white text-slate-400")}>{isActive?<span className="h-2.5 w-2.5 rounded-full bg-white"/>:done?<Check className="h-4 w-4"/>:<Circle className="h-3 w-3"/>}</span>
              <span className="min-w-0 text-[13px] leading-5"><b>{stepIndex+1}. {step.label}</b></span>
            </button>
          </li>;
        })}</ol>
        <div className="border-t border-border bg-surface px-4 py-3 text-[12px] text-slate-600">{result?`${steps.length} / 12 bước đã chạy`:"Tải ảnh lên để xem kết quả từng bước."}</div>
      </Card>

      <Card className="min-w-0 overflow-hidden xl:col-start-2 xl:row-start-1 2xl:col-start-auto 2xl:row-start-auto">
        <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 border-b border-border px-4 py-4 sm:px-5">
          <Badge tone="blue" className="row-span-2 mt-0.5 shrink-0">Bước {selectedIndex+1} / 12</Badge>
          <h2 className="min-w-0 break-words text-[18px] font-bold leading-6 text-navy">{title}</h2>
          {active&&<Badge tone="gray" className="col-start-3 row-start-1 shrink-0"><Clock3 className="h-3.5 w-3.5" />{active.ms.toFixed(1)} ms</Badge>}
          <p className="col-start-2 col-end-4 min-w-0 line-clamp-2 text-[13px] leading-5 text-slate-600">{active?.description??PIPELINE[selectedIndex]?.short}</p>
        </div>

        {busy?<div className="flex min-h-[380px] flex-col items-center justify-center gap-3 px-6 text-center"><PageLoader /><p className="text-[14px] font-medium text-slate-600">Đang chạy pipeline xử lý ảnh 12 bước…</p><p className="text-[12px] text-slate-500">Ảnh không được lưu sau khi phân tích.</p></div>
          : !result?<div className="flex min-h-[380px] flex-col items-center justify-center px-6 py-8 text-center"><span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-soft text-primary"><FlaskConical className="h-8 w-8" /></span><h3 className="text-[18px] font-bold text-navy">Thử nghiệm pipeline OMR</h3><p className="mt-2 max-w-md text-[14px] leading-6 text-slate-600">Chọn ảnh phiếu hoặc sinh ảnh mẫu. Hệ thống sẽ hiển thị ảnh trung gian, thông số và kết quả của từng bước xử lý.</p><Button className="mt-5" icon={<Dices />} onClick={sample}>Sinh ảnh mẫu</Button></div>
          : <>
            <div className="grid min-w-0 grid-cols-1 gap-3 p-4 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
              <figure className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface"><figcaption className="border-b border-border px-3 py-2 text-center text-[12px] font-semibold text-slate-700">{inputImageStep?.title??"Ảnh đầu vào"}</figcaption>{inputImage?<button className="group relative block w-full p-2" onClick={()=>inputImageStep&&setZoomImg(inputImageStep)}><img src={inputImage} alt="Ảnh trước bước xử lý" className="mx-auto h-[190px] w-full rounded-lg object-contain" /><span className="absolute right-4 top-4 rounded-md bg-white p-1.5 opacity-0 shadow-sm group-hover:opacity-100"><Maximize2 className="h-4 w-4" /></span></button>:<div className="flex h-[206px] items-center justify-center text-[13px] text-slate-500">Ảnh đầu vào chưa có</div>}</figure>
              <ArrowRight className="mx-auto hidden h-7 w-7 text-primary-hover lg:block" />
              <figure className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface"><figcaption className="border-b border-border px-3 py-2 text-center text-[12px] font-semibold text-slate-700">Kết quả bước {selectedIndex+1}</figcaption>{active?.image?<button className="group relative block w-full p-2" onClick={()=>setZoomImg(active)}><img src={active.image} alt={`Ảnh sau bước ${active.title}`} className="mx-auto h-[190px] w-full rounded-lg object-contain" /><span className="absolute right-4 top-4 rounded-md bg-white p-1.5 opacity-0 shadow-sm group-hover:opacity-100"><Maximize2 className="h-4 w-4" /></span></button>:<div className="flex h-[206px] items-center justify-center px-5 text-center text-[13px] text-slate-500">Bước này xử lý dữ liệu và không tạo ảnh trung gian.</div>}</figure>
            </div>
            <div className="border-t border-border">
              {active?<><div className="flex items-center gap-2 px-4 py-3"><Info className="h-4 w-4 text-primary"/><h3 className="text-[15px] font-bold text-navy">Kết quả bước {selectedIndex+1}</h3></div><DataPanel step={active} />{!active.threshold&&!active.answers&&!active.homography&&!active.shifts&&<p className="px-4 pb-4 text-[13px] text-slate-600">{active.description}</p>}</>
                :<div className="flex items-center gap-3 px-4 py-4 text-[14px] text-slate-600"><Info className="h-5 w-5 text-warning" />{result.error??"Ảnh chưa xử lý được hết pipeline."}</div>}
            </div>
          </>}

        <div className="flex flex-wrap items-center gap-3 border-t border-border bg-surface px-4 py-3 sm:px-5 lg:pr-40">
          <Button variant="secondary" size="sm" icon={<ArrowLeft />} disabled={selectedIndex<=0} onClick={()=>setSelectedIndex((value)=>Math.max(0,value-1))}>Bước trước</Button>
          <div className="flex min-w-[150px] flex-1 items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-primary transition-all" style={{width:`${((selectedIndex+1)/PIPELINE.length)*100}%`}} /></div><span className="whitespace-nowrap text-[13px] tabular text-slate-600">{selectedIndex+1} / 12</span></div>
          <Button size="sm" icon={<ArrowRight />} onClick={()=>setSelectedIndex((value)=>Math.min(PIPELINE.length-1,value+1))} disabled={selectedIndex>=PIPELINE.length-1}>Bước tiếp theo</Button>
        </div>
      </Card>
    </div>

    <Modal open={!!zoomImg} onClose={()=>setZoomImg(null)} title={zoomImg?.title} size="xl">{zoomImg?.image&&<img src={zoomImg.image} alt={zoomImg.title} className="mx-auto max-h-[75vh]" />}</Modal>
  </div>;
}
